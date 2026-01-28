import { z } from "zod";

const guidSchema = z.string().uuid("Invalid GUID format");

const priceSchema = z.union([z.string(), z.number()]);

const ModifierOptionSchema = z.object({
  modifierOptionGuid: guidSchema,
  name: z.string().min(1, "Modifier option name is required"),
  description: z.string().optional(),
  price: priceSchema.optional(),
  originalPrice: priceSchema.optional(),
  calories: z.number().optional(),
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  metadata: z.unknown().optional(),
});

const ModifierGroupSchema = z.object({
  modifierGroupGuid: guidSchema,
  name: z.string().min(1, "Modifier group name is required"),
  description: z.string().optional(),
  minSelections: z.number().optional(),
  maxSelections: z.number().optional(),
  isRequired: z.boolean().optional(),
  isMultiSelect: z.boolean().optional(),
  metadata: z.unknown().optional(),
  options: z.array(ModifierOptionSchema).optional().default([]),
});

const MenuItemSchema = z.object({
  menuItemGuid: guidSchema,
  name: z.string().min(1, "Menu item name is required"),
  description: z.string().optional(),
  price: priceSchema.optional(),
  originalPrice: priceSchema.optional(),
  calories: z.number().optional(),
  imageUrls: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  isAvailable: z.boolean().optional(),
  metadata: z.unknown().optional(),
  modifierGroups: z.array(ModifierGroupSchema).optional().default([]),
});

const MenuGroupSchema = z.object({
  menuGroupGuid: guidSchema,
  name: z.string().min(1, "Menu group name is required"),
  description: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  image: z.string().optional(),
  sortOrder: z.number().optional(),
  metadata: z.unknown().optional(),
  items: z.array(MenuItemSchema).min(1, "Menu group must include items"),
});

const MenuSchema = z
  .object({
    id: guidSchema.optional(),
    menuGuid: guidSchema.optional(),
    name: z.string().min(1, "Menu name is required"),
    description: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    lastUpdated: z.union([z.string(), z.date()]).optional(),
    metadata: z.unknown().optional(),
    groups: z.array(MenuGroupSchema).min(1, "Menu must include groups"),
  })
  .refine((data) => Boolean(data.menuGuid || data.id), {
    message: "menuGuid or id is required",
    path: ["menuGuid"],
  });

const RestaurantSchema = z
  .object({
    id: guidSchema.optional(),
    restaurantGuid: guidSchema.optional(),
    name: z.string().min(1, "Restaurant name is required"),
    description: z.string().optional(),
    cuisine: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    rating: z.number().optional(),
    addressLine1: z.string().optional(),
    address_line1: z.string().optional(),
    addressLine2: z.string().optional(),
    address_line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    zip_code: z.string().optional(),
    country: z.string().optional(),
    phoneNumber: z.string().optional(),
    phone_number: z.string().optional(),
    businessHours: z.unknown().optional(),
    schedules: z.unknown().optional(),
    metadata: z.unknown().optional(),
    deliveryFee: priceSchema.optional(),
    serviceFeePercent: priceSchema.optional(),
    showTips: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.restaurantGuid || data.id), {
    message: "restaurantGuid or id is required",
    path: ["restaurantGuid"],
  });

export const MenuImportSchema = z.object({
  hotelId: z.preprocess(
    (value) => (typeof value === "string" ? Number.parseInt(value, 10) : value),
    z.number().int().positive("hotelId must be a positive integer")
  ),
  restaurant: RestaurantSchema,
  menus: z.array(MenuSchema).min(1, "At least one menu is required"),
});

export type MenuImportPayload = z.infer<typeof MenuImportSchema>;
