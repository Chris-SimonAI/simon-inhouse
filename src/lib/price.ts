/**
 * Utility functions for handling price-related data from Google Places API
 */

export function formatPriceLevel(priceLevel?: string): string {
  if (!priceLevel) return "";

  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
      return "$"; // Free places still get one $ for consistency
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
