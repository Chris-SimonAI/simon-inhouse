'use server';

import 'server-only';

import { db } from '@/db';
import { dineInOrders, dineInOrderItems, dineInRestaurants, hotels, menuItems, modifierOptions } from '@/db/schemas';
import { eq, inArray } from 'drizzle-orm';
import { createSuccess, createError } from '@/lib/utils';
import { env } from '@/env';

interface SmsOrderItem {
  menuItemGuid: string;
  name: string;
  quantity: number;
  selectedModifiers?: Record<string, string[]>;
}

interface SmsCheckoutInput {
  phone: string;
  name: string;
  hotelId: number;
  restaurantId: number;
  roomNumber: string;
  items: SmsOrderItem[];
  specialInstructions?: string;
}

interface CheckoutResult {
  orderId: number;
  checkoutUrl: string;
  total: string;
  items: Array<{ name: string; quantity: number; price: string }>;
}

/**
 * Create a Stripe Checkout Session for an SMS-originated order.
 *
 * 1. Calculates totals server-side from database prices
 * 2. Creates dineInOrders record (userId: null, metadata.source: 'sms')
 * 3. Creates dineInOrderItems records
 * 4. Creates Stripe Checkout Session with manual capture
 * 5. Returns checkout URL for the guest
 */
export async function createSmsCheckoutSession(
  input: SmsCheckoutInput
): Promise<ReturnType<typeof createSuccess<CheckoutResult>> | ReturnType<typeof createError>> {
  try {
    const { stripe } = await import('@/lib/stripe');

    // 1. Get restaurant details
    const [restaurant] = await db
      .select({
        id: dineInRestaurants.id,
        name: dineInRestaurants.name,
        hotelId: dineInRestaurants.hotelId,
        deliveryFee: dineInRestaurants.deliveryFee,
        serviceFeePercent: dineInRestaurants.serviceFeePercent,
      })
      .from(dineInRestaurants)
      .where(eq(dineInRestaurants.id, input.restaurantId))
      .limit(1);

    if (!restaurant) {
      return createError('Restaurant not found');
    }

    const deliveryFee = parseFloat(restaurant.deliveryFee);
    const serviceFeePercent = parseFloat(restaurant.serviceFeePercent);

    // 2. Fetch menu items from database
    const menuItemGuids = input.items.map((item) => item.menuItemGuid);
    const dbMenuItems = await db
      .select({
        id: menuItems.id,
        menuItemGuid: menuItems.menuItemGuid,
        name: menuItems.name,
        description: menuItems.description,
        price: menuItems.price,
      })
      .from(menuItems)
      .where(inArray(menuItems.menuItemGuid, menuItemGuids));

    const menuItemMap = new Map(
      dbMenuItems.map((item) => [item.menuItemGuid, item])
    );

    // 3. Fetch modifier options
    const allModifierOptionGuids: string[] = [];
    for (const item of input.items) {
      if (item.selectedModifiers) {
        for (const optionGuids of Object.values(item.selectedModifiers)) {
          allModifierOptionGuids.push(...optionGuids);
        }
      }
    }

    let modifierOptionMap = new Map<string, { id: number; name: string; price: string; modifierGroupId: number }>();
    if (allModifierOptionGuids.length > 0) {
      const dbModifierOptions = await db
        .select({
          id: modifierOptions.id,
          modifierOptionGuid: modifierOptions.modifierOptionGuid,
          modifierGroupId: modifierOptions.modifierGroupId,
          name: modifierOptions.name,
          price: modifierOptions.price,
        })
        .from(modifierOptions)
        .where(inArray(modifierOptions.modifierOptionGuid, allModifierOptionGuids));

      modifierOptionMap = new Map(
        dbModifierOptions.map((opt) => [
          opt.modifierOptionGuid,
          { id: opt.id, name: opt.name, price: opt.price ?? '0', modifierGroupId: opt.modifierGroupId },
        ])
      );
    }

    // 4. Calculate item prices
    const calculatedItems: Array<{
      menuItemId: number;
      menuItemGuid: string;
      itemName: string;
      itemDescription: string;
      basePrice: number;
      modifierPrice: number;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
      modifierDetails: unknown;
    }> = [];

    let subtotal = 0;

    for (const item of input.items) {
      const menuItem = menuItemMap.get(item.menuItemGuid);
      if (!menuItem) {
        return createError(`Menu item not found: ${item.menuItemGuid}`);
      }

      const basePrice = parseFloat(menuItem.price || '0');
      let modifierPrice = 0;
      const modifierDetails: Array<{
        groupId: string;
        groupName: string;
        options: Array<{ optionId: string; optionName: string; optionPrice: string }>;
      }> = [];

      if (item.selectedModifiers) {
        for (const [groupGuid, optionGuids] of Object.entries(item.selectedModifiers)) {
          const groupOptions: Array<{ optionId: string; optionName: string; optionPrice: string }> = [];
          for (const optionGuid of optionGuids) {
            const option = modifierOptionMap.get(optionGuid);
            if (!option) {
              return createError(`Modifier option not found: ${optionGuid}`);
            }
            const optionPrice = parseFloat(option.price);
            modifierPrice += optionPrice;
            groupOptions.push({
              optionId: optionGuid,
              optionName: option.name,
              optionPrice: optionPrice.toFixed(2),
            });
          }
          if (groupOptions.length > 0) {
            modifierDetails.push({ groupId: groupGuid, groupName: '', options: groupOptions });
          }
        }
      }

      const unitPrice = basePrice + modifierPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      calculatedItems.push({
        menuItemId: menuItem.id,
        menuItemGuid: item.menuItemGuid,
        itemName: menuItem.name,
        itemDescription: menuItem.description || '',
        basePrice: Math.round(basePrice * 100) / 100,
        modifierPrice: Math.round(modifierPrice * 100) / 100,
        unitPrice: Math.round(unitPrice * 100) / 100,
        quantity: item.quantity,
        totalPrice: Math.round(totalPrice * 100) / 100,
        modifierDetails,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const serviceFee = Math.round((subtotal * serviceFeePercent / 100) * 100) / 100;
    const total = Math.round((subtotal + serviceFee + deliveryFee) * 100) / 100;

    // 5. Create order record (userId is null for SMS orders)
    const [order] = await db
      .insert(dineInOrders)
      .values({
        hotelId: input.hotelId,
        restaurantId: input.restaurantId,
        userId: null,
        roomNumber: input.roomNumber,
        specialInstructions: input.specialInstructions,
        totalAmount: total.toFixed(2),
        orderStatus: 'pending',
        metadata: {
          source: 'sms',
          phoneNumber: input.phone,
          fullName: input.name,
          paymentBreakdown: { subtotal, serviceFee, deliveryFee, total },
        } as Record<string, unknown>,
      })
      .returning();

    // 6. Create order items
    await Promise.all(
      calculatedItems.map((item) =>
        db.insert(dineInOrderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          menuItemGuid: item.menuItemGuid,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          basePrice: item.basePrice.toFixed(2),
          modifierPrice: item.modifierPrice.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
          totalPrice: item.totalPrice.toFixed(2),
          modifierDetails: item.modifierDetails as unknown,
          metadata: {} as Record<string, unknown>,
        })
      )
    );

    // 7. Get hotel name for Stripe metadata
    const [hotel] = await db
      .select({ name: hotels.name })
      .from(hotels)
      .where(eq(hotels.id, input.hotelId))
      .limit(1);

    // 8. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual',
        metadata: {
          type: 'dine_in',
          orderId: order.id.toString(),
          hotelId: input.hotelId.toString(),
          restaurantId: input.restaurantId.toString(),
          hotelName: hotel?.name || 'Unknown Hotel',
          restaurantName: restaurant.name,
          roomNumber: input.roomNumber,
          fullName: input.name,
          phoneNumber: input.phone,
          source: env.NODE_ENV,
        },
      },
      line_items: calculatedItems.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.itemName,
            description: item.itemDescription || undefined,
          },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      })).concat(
        serviceFee > 0
          ? [{
              price_data: {
                currency: 'usd',
                product_data: { name: 'Service Fee', description: undefined },
                unit_amount: Math.round(serviceFee * 100),
              },
              quantity: 1,
            }]
          : [],
        deliveryFee > 0
          ? [{
              price_data: {
                currency: 'usd',
                product_data: { name: 'Delivery Fee', description: undefined },
                unit_amount: Math.round(deliveryFee * 100),
              },
              quantity: 1,
            }]
          : []
      ),
      success_url: `${env.BASE_URL}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.BASE_URL}/order-cancelled`,
    });

    console.log('[sms-payments] Checkout session created:', {
      sessionId: session.id,
      orderId: order.id,
      total,
      url: session.url,
    });

    return createSuccess({
      orderId: order.id,
      checkoutUrl: session.url!,
      total: total.toFixed(2),
      items: calculatedItems.map((i) => ({
        name: i.itemName,
        quantity: i.quantity,
        price: i.totalPrice.toFixed(2),
      })),
    });
  } catch (error) {
    console.error('[sms-payments] Error creating checkout session:', error);
    return createError('Failed to create checkout session');
  }
}
