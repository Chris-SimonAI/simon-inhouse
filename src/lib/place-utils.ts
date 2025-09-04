export function parseCategory(
  types: string[] | undefined,
  suffixToRemove: string,
  defaultCategory: string = ""
): string {
  if (!types || types.length === 0) {
    return defaultCategory;
  }

  // Filter out generic types
  const filteredTypes = types.filter(
    (type) => !type.includes("point_of_interest") && !type.includes("establishment")
  );

  if (filteredTypes.length === 0) {
    return defaultCategory;
  }

  // Take the first type, clean it up, and format it
  return filteredTypes[0]
    .replace(new RegExp(`${suffixToRemove}$`), '') // Remove the suffix
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize words
}


export function formatPriceLevel(priceLevel?: string): string {
    if (!priceLevel) return "";
  
    switch (priceLevel) {
      case "PRICE_LEVEL_FREE":
        return "$";
      case "PRICE_LEVEL_INEXPENSIVE":
        return "$";
      case "PRICE_LEVEL_MODERATE":
        return "$$";
      case "PRICE_LEVEL_EXPENSIVE":
        return "$$$";
      case "PRICE_LEVEL_VERY_EXPENSIVE":
        return "$$$$";
      case "PRICE_LEVEL_UNSPECIFIED":
      default:
        return "";
    }
  }
  