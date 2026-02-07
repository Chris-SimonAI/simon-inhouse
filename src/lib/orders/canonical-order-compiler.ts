import { z } from 'zod';
import { SecureOrderItemSchema } from '@/validations/dine-in-orders';

export type CanonicalCompileStatus =
  | 'ready_to_execute'
  | 'needs_user_input'
  | 'unfulfillable';

export type CanonicalIssueSeverity = 'needs_user_input' | 'unfulfillable';

export type CanonicalIssueCode =
  | 'invalid_payload'
  | 'menu_item_not_found'
  | 'modifier_group_not_found'
  | 'modifier_option_not_found'
  | 'modifier_option_not_in_group'
  | 'required_modifier_missing'
  | 'modifier_selection_above_max'
  | 'modifier_selection_not_allowed';

export interface CanonicalCompileIssue {
  severity: CanonicalIssueSeverity;
  code: CanonicalIssueCode;
  message: string;
  menuItemGuid?: string;
  modifierGroupGuid?: string;
  modifierOptionGuid?: string;
}

export interface CompiledOrderItem {
  menuItemId: number;
  menuItemGuid: string;
  itemName: string;
  itemDescription: string;
  basePrice: number;
  modifierPrice: number;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  modifierDetails: Array<{
    groupId: string;
    groupName: string;
    options: Array<{
      optionId: string;
      optionName: string;
      optionPrice: string;
    }>;
  }>;
}

export interface CanonicalCompileResult {
  status: CanonicalCompileStatus;
  subtotal: number;
  items: CompiledOrderItem[];
  issues: CanonicalCompileIssue[];
}

export interface CanonicalCatalog {
  menuItems: Array<{
    id: number;
    menuItemGuid: string;
    name: string;
    description: string | null;
    price: string | null;
  }>;
  modifierGroups: Array<{
    id: number;
    modifierGroupGuid: string;
    menuItemId: number;
    name: string;
    minSelections: number | null;
    maxSelections: number | null;
    isRequired: boolean | null;
    isMultiSelect: boolean | null;
  }>;
  modifierOptions: Array<{
    id: number;
    modifierOptionGuid: string;
    modifierGroupId: number;
    name: string;
    price: string | null;
  }>;
}

const compileItemsSchema = z.array(SecureOrderItemSchema).min(1);

export function compileOrderWithCatalog(
  inputItems: unknown,
  catalog: CanonicalCatalog,
): CanonicalCompileResult {
  const parsedItems = compileItemsSchema.safeParse(inputItems);
  if (!parsedItems.success) {
    return {
      status: 'unfulfillable',
      subtotal: 0,
      items: [],
      issues: [
        {
          severity: 'unfulfillable',
          code: 'invalid_payload',
          message: 'Order payload is invalid',
        },
      ],
    };
  }

  const items = parsedItems.data;
  const menuItemsByGuid = new Map(
    catalog.menuItems.map((menuItem) => [menuItem.menuItemGuid, menuItem]),
  );

  const groupsByMenuItemId = new Map<number, CanonicalCatalog['modifierGroups']>();
  for (const group of catalog.modifierGroups) {
    const existing = groupsByMenuItemId.get(group.menuItemId);
    if (existing) {
      existing.push(group);
    } else {
      groupsByMenuItemId.set(group.menuItemId, [group]);
    }
  }

  const optionsByGroupId = new Map<number, CanonicalCatalog['modifierOptions']>();
  const optionByGuid = new Map(
    catalog.modifierOptions.map((option) => [option.modifierOptionGuid, option]),
  );
  for (const option of catalog.modifierOptions) {
    const existing = optionsByGroupId.get(option.modifierGroupId);
    if (existing) {
      existing.push(option);
    } else {
      optionsByGroupId.set(option.modifierGroupId, [option]);
    }
  }

  const issues: CanonicalCompileIssue[] = [];
  const compiledItems: CompiledOrderItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const itemIssuesStart = issues.length;
    const menuItem = menuItemsByGuid.get(item.menuItemGuid);
    if (!menuItem) {
      issues.push({
        severity: 'unfulfillable',
        code: 'menu_item_not_found',
        message: `Menu item not found: ${item.menuItemGuid}`,
        menuItemGuid: item.menuItemGuid,
      });
      continue;
    }

    const modifierGroupsForItem = groupsByMenuItemId.get(menuItem.id) ?? [];
    const groupByGuid = new Map(
      modifierGroupsForItem.map((group) => [group.modifierGroupGuid, group]),
    );

    for (const [groupGuid, selectedOptionGuids] of Object.entries(
      item.selectedModifiers,
    )) {
      const group = groupByGuid.get(groupGuid);
      if (!group) {
        issues.push({
          severity: 'unfulfillable',
          code: 'modifier_group_not_found',
          message: `Modifier group not found for item ${item.menuItemGuid}: ${groupGuid}`,
          menuItemGuid: item.menuItemGuid,
          modifierGroupGuid: groupGuid,
        });
        continue;
      }

      const maxSelections = group.maxSelections;
      const isMultiSelect = group.isMultiSelect === true;

      if (!isMultiSelect && selectedOptionGuids.length > 1) {
        issues.push({
          severity: 'needs_user_input',
          code: 'modifier_selection_not_allowed',
          message: `Modifier group ${groupGuid} only allows one selection`,
          menuItemGuid: item.menuItemGuid,
          modifierGroupGuid: groupGuid,
        });
      } else if (
        maxSelections !== null &&
        selectedOptionGuids.length > maxSelections
      ) {
        issues.push({
          severity: 'needs_user_input',
          code: 'modifier_selection_above_max',
          message: `Modifier group ${groupGuid} exceeds max selections`,
          menuItemGuid: item.menuItemGuid,
          modifierGroupGuid: groupGuid,
        });
      }

      for (const optionGuid of selectedOptionGuids) {
        const option = optionByGuid.get(optionGuid);
        if (!option) {
          issues.push({
            severity: 'unfulfillable',
            code: 'modifier_option_not_found',
            message: `Modifier option not found: ${optionGuid}`,
            menuItemGuid: item.menuItemGuid,
            modifierGroupGuid: groupGuid,
            modifierOptionGuid: optionGuid,
          });
          continue;
        }

        if (option.modifierGroupId !== group.id) {
          issues.push({
            severity: 'unfulfillable',
            code: 'modifier_option_not_in_group',
            message: `Modifier option ${optionGuid} does not belong to group ${groupGuid}`,
            menuItemGuid: item.menuItemGuid,
            modifierGroupGuid: groupGuid,
            modifierOptionGuid: optionGuid,
          });
        }
      }
    }

    for (const group of modifierGroupsForItem) {
      const selected = item.selectedModifiers[group.modifierGroupGuid];
      const selectedCount = Array.isArray(selected) ? selected.length : 0;

      const minSelections = resolveMinSelections(group);
      if (selectedCount < minSelections) {
        issues.push({
          severity: 'needs_user_input',
          code: 'required_modifier_missing',
          message: `Required modifier group ${group.modifierGroupGuid} is missing selections`,
          menuItemGuid: item.menuItemGuid,
          modifierGroupGuid: group.modifierGroupGuid,
        });
      }
    }

    const itemIssues = issues.slice(itemIssuesStart);
    if (itemIssues.length > 0) {
      continue;
    }

    const basePrice = parseNullableMoney(menuItem.price);
    let modifierPrice = 0;
    const modifierDetails: CompiledOrderItem['modifierDetails'] = [];

    for (const [groupGuid, selectedOptionGuids] of Object.entries(
      item.selectedModifiers,
    )) {
      const group = groupByGuid.get(groupGuid);
      if (!group) {
        continue;
      }

      const optionsForGroup = optionsByGroupId.get(group.id) ?? [];
      const optionMap = new Map(
        optionsForGroup.map((option) => [option.modifierOptionGuid, option]),
      );
      const selectedOptions = [];
      for (const optionGuid of selectedOptionGuids) {
        const option = optionMap.get(optionGuid);
        if (!option) {
          continue;
        }

        const optionPrice = parseNullableMoney(option.price);
        modifierPrice += optionPrice;
        selectedOptions.push({
          optionId: option.modifierOptionGuid,
          optionName: option.name,
          optionPrice: optionPrice.toFixed(2),
        });
      }

      if (selectedOptions.length > 0) {
        modifierDetails.push({
          groupId: group.modifierGroupGuid,
          groupName: group.name,
          options: selectedOptions,
        });
      }
    }

    const unitPrice = roundMoney(basePrice + modifierPrice);
    const totalPrice = roundMoney(unitPrice * item.quantity);
    subtotal = roundMoney(subtotal + totalPrice);

    compiledItems.push({
      menuItemId: menuItem.id,
      menuItemGuid: menuItem.menuItemGuid,
      itemName: menuItem.name,
      itemDescription: menuItem.description === null ? '' : menuItem.description,
      basePrice: roundMoney(basePrice),
      modifierPrice: roundMoney(modifierPrice),
      unitPrice,
      quantity: item.quantity,
      totalPrice,
      modifierDetails,
    });
  }

  if (issues.length === 0) {
    return {
      status: 'ready_to_execute',
      subtotal: roundMoney(subtotal),
      items: compiledItems,
      issues: [],
    };
  }

  const hasUnfulfillable = issues.some(
    (issue) => issue.severity === 'unfulfillable',
  );
  return {
    status: hasUnfulfillable ? 'unfulfillable' : 'needs_user_input',
    subtotal: roundMoney(subtotal),
    items: compiledItems,
    issues,
  };
}

function parseNullableMoney(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveMinSelections(
  group: CanonicalCatalog['modifierGroups'][number],
): number {
  if (group.minSelections !== null) {
    return Math.max(0, group.minSelections);
  }

  if (group.isRequired === true) {
    return 1;
  }

  return 0;
}
