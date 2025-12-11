import type { MenuItem, MenuModifierGroup, MenuOption } from "@/actions/menu";

/**
 * Compute the lowest possible starting price for a menu item.
 * - Uses the item's base price when present (> 0).
 * - Adds the minimum cost required by any required modifier groups
 *   (choosing the cheapest valid combination based on minSelections).
 */
export function getMenuItemStartingPrice(item: MenuItem): number {
	let total = item.price;

	if (!Array.isArray(item.modifierGroups) || item.modifierGroups.length === 0) {
		return roundToTwo(total);
	}

	for (const group of item.modifierGroups) {
		total += getRequiredGroupMinimumPrice(group);
	}

	return roundToTwo(total);
}

/**
 * For a required modifier group, return the minimum additional price contribution.
 * If the group isn't required (isRequired=false and minSelections<=0), returns 0.
 */
function getRequiredGroupMinimumPrice(group: MenuModifierGroup): number {
	const isRequired = Boolean(group.isRequired) || (group.minSelections ?? 0) > 0;
	if (!isRequired) {
		return 0;
	}

	const minSelections = Math.max(1, group.minSelections ?? 1);
	const options = Array.isArray(group.options) ? group.options : [];
	if (options.length === 0) {
		return 0;
	}

	// Choose the cheapest valid combination:
	// - If multi-select and minSelections > 1, sum the cheapest N options.
	// - Otherwise, choose the single cheapest option.
	const prices = options
		.map((o: MenuOption) => (Number.isFinite(o.price) ? o.price : Number(o.price) || 0))
		.filter((p) => Number.isFinite(p))
		.sort((a, b) => a - b);

	if (prices.length === 0) {
		return 0;
	}

	if (group.isMultiSelect && minSelections > 1) {
		let sum = 0;
		for (let i = 0; i < Math.min(minSelections, prices.length); i += 1) {
			sum += prices[i];
		}
		return roundToTwo(sum);
	}

	// Single selection (or minSelections <= 1): choose the cheapest option.
	return roundToTwo(prices[0]);
}

function roundToTwo(n: number): number {
	return Math.round(n * 100) / 100;
}


