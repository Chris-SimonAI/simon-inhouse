import 'server-only';

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { env } from '@/env';
import { createSuccess, createError } from '@/lib/utils';

// Initialize SQS client
const sqsClient = new SQSClient({
  region: env.AWS_REGION,
});

export interface OrderItem {
  name: string;
  quantity?: number;
  modifiers?: string[];
  specialInstructions?: string;
}

export interface BotOrderPayload {
  cmd: 'place-order';
  orderId: number;
  url: string;
  items: OrderItem[];
  guest?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  deliveryAddress?: string;
  apartment?: string;
  callbackUrl?: string;
  callbackSecret?: string;
  debug?: string;
}

/**
 * Send order to Lambda bot via SQS FIFO queue
 */
export async function sendOrderToBot(payload: BotOrderPayload) {
  try {
    const messageBody = {
      cmd: payload.cmd,
      orderId: payload.orderId,
      url: payload.url,
      items: payload.items, // Array of OrderItem objects
      guest: payload.guest,
      deliveryAddress: payload.deliveryAddress,
      apartment: payload.apartment,
      callbackUrl: payload.callbackUrl,
      callbackSecret: payload.callbackSecret,
      debug: payload.debug,
    };

    // Generate message group ID and deduplication ID based on orderId
    const messageGroupId = `order-${payload.orderId}`;
    const messageDeduplicationId = `order-${payload.orderId}-${Date.now()}`;

    const command = new SendMessageCommand({
      QueueUrl: env.AWS_SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: messageGroupId,
      MessageDeduplicationId: messageDeduplicationId,
    });

    const result = await sqsClient.send(command);

    console.log('Order sent to SQS for bot processing:', {
      orderId: payload.orderId,
      messageId: result.MessageId,
      messageGroupId,
      messageDeduplicationId,
    });

    return createSuccess({
      messageId: result.MessageId,
      messageGroupId,
      messageDeduplicationId,
    });
  } catch (error) {
    console.error('Failed to send order to SQS:', error);
    return createError('Failed to send order to bot queue', error);
  }
}

/**
 * Prepare bot payload from order data
 */
export function prepareBotPayload(
  orderId: number,
  restaurantUrl: string,
  orderItems: Array<{
    itemName: string;
    quantity: number;
  }>,
  guestInfo: {
    name?: string;
    email?: string;
    phone?: string;
  },
  deliveryAddress: string,
  apartment?: string
): BotOrderPayload {
  // Convert items to OrderItem format
  const itemsArray: OrderItem[] = orderItems.map(item => ({
    name: item.itemName,
    quantity: item.quantity,
    // modifiers and specialInstructions can be added here if available
  }));
  
  return {
    cmd: 'place-order',
    orderId,
    url: restaurantUrl,
    items: itemsArray, // Array of OrderItem objects
    guest: guestInfo,
    deliveryAddress,
    apartment,
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/api/fulfillment/callback`,
    callbackSecret: env.FULFILLMENT_CALLBACK_SECRET,
  };
}
