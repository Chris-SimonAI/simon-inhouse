import { z } from 'zod';
import type { CompiledOrderItem } from '@/lib/orders/canonical-order-compiler';

export const canonicalCompilerVersion = 'canonical-v1';

const artifactOptionSchema = z.object({
  optionId: z.string().uuid(),
  optionName: z.string().min(1),
  optionPrice: z.string(),
});

const artifactGroupSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string().min(1),
  options: z.array(artifactOptionSchema),
});

const artifactItemSchema = z.object({
  menuItemGuid: z.string().uuid(),
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number(),
  basePrice: z.number(),
  modifierPrice: z.number(),
  modifierDetails: z.array(artifactGroupSchema),
});

const canonicalOrderArtifactSchema = z.object({
  compilerVersion: z.string().min(1),
  compiledAt: z.string().min(1),
  status: z.literal('ready_to_execute'),
  subtotal: z.number(),
  itemCount: z.number().int().nonnegative(),
  items: z.array(artifactItemSchema),
});

export type CanonicalOrderArtifact = z.infer<typeof canonicalOrderArtifactSchema>;

export type CanonicalBotOrderItem = {
  itemName: string;
  quantity: number;
  modifierDetails: CompiledOrderItem['modifierDetails'];
};

export function buildCanonicalOrderArtifact(
  compiledItems: CompiledOrderItem[],
  subtotal: number,
): CanonicalOrderArtifact {
  return {
    compilerVersion: canonicalCompilerVersion,
    compiledAt: new Date().toISOString(),
    status: 'ready_to_execute',
    subtotal,
    itemCount: compiledItems.length,
    items: compiledItems.map((item) => ({
      menuItemGuid: item.menuItemGuid,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      basePrice: item.basePrice,
      modifierPrice: item.modifierPrice,
      modifierDetails: item.modifierDetails,
    })),
  };
}

export function extractCanonicalOrderArtifact(
  metadata: unknown,
): CanonicalOrderArtifact | null {
  if (typeof metadata !== 'object' || metadata === null) {
    return null;
  }

  const raw = (metadata as Record<string, unknown>).canonicalOrder;
  const parsed = canonicalOrderArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function extractCanonicalBotItems(
  metadata: unknown,
): CanonicalBotOrderItem[] | null {
  const artifact = extractCanonicalOrderArtifact(metadata);
  if (!artifact) {
    return null;
  }

  return artifact.items.map((item) => ({
    itemName: item.itemName,
    quantity: item.quantity,
    modifierDetails: item.modifierDetails,
  }));
}
