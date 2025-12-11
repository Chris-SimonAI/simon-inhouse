import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import "dotenv/config";
import type { ClientConfig } from "pg";
import fs from "fs";
import { OpenAIEmbeddings } from "@langchain/openai";

// Quote identifier to avoid SQL injection
// Needed cause user is a reserved word
// and we are trying to delete the user table
const qi = (id: string) => `"${id.replace(/"/g, '""')}"`;

/**
 * Normalizes a vector to unit length for consistent distance calculations
 */
function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return v; // Avoid division by zero
  return v.map((val) => val / norm);
}

/**
 * Converts an amenity (or any JSON object) into a semantically meaningful embedding.
 * Adds context, removes formatting noise, and handles nested fields gracefully.
 */
export async function generateEmbeddingFromJSON(
  data: Record<string, unknown>,
  model = "text-embedding-3-small"
): Promise<number[]> {
  const embeddings = new OpenAIEmbeddings({ model });
  const text = jsonToReadableText(data);
  const embedding = await embeddings.embedQuery(text);
  return normalizeVector(embedding);
}

/**
 * Converts an amenity object into a clean, readable text string for embedding.
 * Emphasizes semantic meaning while stripping Markdown and formatting artifacts.
 */
export function jsonToReadableText(obj: Record<string, unknown>): string {
  if (obj.name && obj.description) {
    const cleanLongDescription = obj.longDescription && typeof obj.longDescription === 'string'
      ? obj.longDescription.replace(/[*_#>\n]+/g, " ").trim()
      : "";
    const tagsText =
      obj.tags && Array.isArray(obj.tags) && obj.tags.length > 0
        ? `Tags: ${obj.tags.join(", ")}.`
        : "";
    return `Amenity: ${obj.name}. Description: ${obj.description}. ${cleanLongDescription} ${tagsText}`;
  }
  const flatten = (input: unknown): string => {
    if (input === null || input === undefined) return "";
    if (typeof input === "object") {
      if (Array.isArray(input)) return input.map(flatten).join(", ");
      return Object.entries(input)
        .map(([key, value]) => `${key}: ${flatten(value)}`)
        .join(". ");
    }
    return String(input);
  };

  return flatten(obj);
}

export const DEMO_HOTEL = {
  name: "The Anza Hotel",
  slug: "anza",
  address: "2210 Broadway, Santa Monica CA 90404, USA",
  latitude: "34.029117",
  longitude: "-118.476193",
  restaurantDiscount: 20.0,
  metadata: {
    rooms_total: 122,
    pet_friendly: true,
    check_in: {
      time: "16:00",
      age_requirement: 18,
      early_check_in_fee: {
        amount: 45,
        currency: "USD",
        notes: "Plus tax, upon availability",
      },
    },
    check_out: {
      time: "11:00",
      late_check_out_fee: {
        amount: 45,
        currency: "USD",
        notes: "Plus tax, upon availability",
      },
    }
  },
};

export const DEMO_AMENITIES = [
  {
    name: "Outdoor Pool",
    description: "Heated outdoor pool with cabanas and lounge seating.",
    longDescription: "The Anza offers a relaxing outdoor pool area perfect for enjoying the California sun.\n\n\n\n**The Setting**  \nGuests can relax on comfortable lounge chairs or enjoy shaded seating in private cabanas. The pool is heated and surrounded by modern landscaping, creating a calm and serene atmosphere.\n\n\n\n**The Experience**  \nTake a refreshing swim, unwind on the poolside loungers, or enjoy food and drinks delivered by staff. The heated pool ensures year-round enjoyment.\n\n\n\n**Good To Know**\n* **Hours:** 9:00 am – 9:00 pm daily\n* **Amenities:** Heated pool, lounge chairs, private cabanas, towels provided\n* **Dining:** Food and drinks available from staff during opening hours\n* **Ideal For:** Guests seeking relaxation and leisure",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1684185767/sx7baz2izfawkj0dd6ij.jpg",
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1694192356/q8vdwgekwa3vgojsmrvx.jpg",
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1695637622/kibucfzcfg7wvrmh8huu.jpg"
    ],
    tags: ["pool"],
    metadata: {},
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
  {
    name: "Fitness Center",
    description: "24-hour fitness center with weights and Peloton bikes.",
    longDescription: "The Anza offers a fully equipped fitness center available 24 hours a day, so guests can fit a workout into their schedule at any time.\n\n\n\n**The Setting**  \nThe fitness center is bright and contemporary, featuring modern cardio and strength-training equipment, including Peloton bikes. Towels and water are available nearby.\n\n\n\n**The Experience**  \nGuests can enjoy a flexible workout at any time, whether it's cardio, strength training, or cycling. The space is ideal for staying active while traveling.\n\n\n\n**Good To Know**  \n* **Hours:** Open 24 hours daily\n* **Equipment:** Cardio machines, strength-training equipment, Peloton bikes\n* **Amenities:** Towels and water provided\n* **Ideal For:** Business and leisure travelers who want to stay active",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1684185771/hy3cieskbf656vpvjh71.jpg",
    ],
    tags: ["fitness", "gym"],
    metadata: {},
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
  {
    name: "Meeting & Event Space",
    description: "Private meeting room ~800 sq ft; up to 50 guests.",
    longDescription: "The Anza offers a flexible meeting room designed for small to mid-sized gatherings.\n\n\n\n**The Setting**  \nAt approximately 800 square feet, the room provides a bright and welcoming environment with contemporary design that aligns with the hotel’s modern aesthetic.\n\n\n\n**The Experience**  \nThe room can be arranged in theater, classroom, conference, or U-shape layouts to suit different events such as interviews, training sessions, or celebrations.\n\n\n\n**Good To Know**  \n* **Capacity:** Up to 50 guests\n* **Size:** Approximately 800 sq. ft.\n* **Ideal For:** Interviews, training, and celebrations\n* **Audiovisual:** Support available upon request",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1694192354/el1kvymi8djn8ygqbazd.jpg",
    ],
    tags: ["meeting", "conference"],
    metadata: { capacity: 50 },
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
  {
    name: "Graze Bistro (On-site Dining)",
    description:
      "Graze Bistro with free morning breakfast.",
    longDescription: "Graze Bistro is the hotel's on-site dining venue, offering a contemporary space for meals and drinks.\n\n\n\n**The Setting**  \nThe bistro provides a modern and inviting environment, perfect for enjoying breakfast or other meals in a bright, contemporary setting.\n\n\n\n**The Experience**  \nGuests can enjoy fresh, approachable dishes and a variety of drinks in a relaxed atmosphere, making it an ideal spot to start the day.\n\n\n\n**Good To Know**  \n* **Hours:** Breakfast served daily\n* **Cuisine:** Fresh, approachable dishes\n* **Setting:** Contemporary and inviting\n* **Ideal For:** Breakfast, casual meals, and drinks",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1684185696/uhiqlrsfrafrkehhof9h.jpg",
    ],
    tags: ["dining", "restaurant"],
    metadata: {},
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
  {
    name: "Complimentary Wi-Fi",
    description:
      "Free Wi-Fi throughout the hotel.",
    longDescription: "High-speed Wi-Fi is available throughout The Anza, ensuring seamless connectivity in guest rooms, public spaces, and meeting areas.\n\n\n\n**The Setting**  \nReliable Wi-Fi is provided in all guest rooms, public areas, and meeting spaces, allowing guests to stay connected at all times.\n\n\n\n**The Experience**  \nWhether streaming, attending video calls, or browsing casually, guests can enjoy high-speed internet access included at no extra cost.\n\n\n\n**Good To Know**  \n* **Availability:** Throughout the hotel, including guest rooms and public spaces\n* **Cost:** Complimentary for all guests\n* **Ideal For:** Business travelers, families, or anyone needing reliable internet access\n* **Ideal For:** Streaming, video calls, casual browsing",
    imageUrls: [
      "https://www.pembrokeshirepc.co.uk/images/2022/01/16/this-hotel-has-wi-fi-access.jpg",
    ],
    tags: ["wifi", "internet"],
    metadata: {},
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
  {
    name: "Parking",
    description: "On-site parking available; $15/night.",
    longDescription: "Guests have access to convenient on-site parking, just steps away from the hotel entrance.\n\n\n\n**The Setting**  \nParking is located near the hotel entrance, providing easy and quick access for all guests.\n\n\n\n**The Experience**  \nGuests can park standard or accessible vehicles with ease, enjoying a hassle-free arrival and departure experience.\n\n\n\n**Good To Know**  \n* **Rate:** $15 per night\n* **Availability:** On-site, near the hotel entrance\n* **Accessibility:** ADA-designated spots provided\n* **Ideal For:** Guests arriving by car seeking convenience and affordability",
    imageUrls: [
      "https://hospitalityrisksolutions.files.wordpress.com/2010/07/hotel-parking-theft-1.jpg",
    ],
    tags: ["parking", "car", "parking lot"],
    metadata: {},
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
  {
    name: "Pet-Friendly",
    description: "Dogs welcome at The Anza!",
    longDescription: "The Anza welcomes four-legged companions, making it an ideal choice for pet owners.\n\n\n\n**The Setting**  \nSelect rooms and floors are designated as pet-friendly, ensuring comfort for both pets and guests.\n\n\n\n**The Experience**  \nGuests can enjoy their stay with their pets, whether for short visits or extended vacations, while adhering to the hotel’s pet policy.\n\n\n\n**Good To Know**  \n* **Fee:** $35 per pet\n* **Limit:** Maximum of 2 dogs per room\n* **Rooms:** Pet-friendly rooms and floors only\n* **Contact:** Guests should contact the hotel in advance for full details",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1695637061/hfugoixcvrxhe6f542b9.jpg",
    ],
    tags: ["pet-friendly", "dogs", "pets"],
    metadata: {},
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  },
  {
    name: "Marketplace & Boarding Pass Kiosk",
    description: "24/7 marketplace and boarding pass printing kiosk.",
    longDescription: "For added convenience, guests can use the 24/7 marketplace in the lobby to grab snacks, drinks, or essentials at any time.\n\n\n\n**The Setting**  \nThe lobby features a marketplace and boarding pass kiosk, designed for quick access to snacks, beverages, and travel essentials.\n\n\n\n**The Experience**  \nGuests can shop, grab refreshments, or print boarding passes 24/7, making travel or business trips more convenient.\n\n\n\n**Good To Know**  \n* **Marketplace:** Open 24/7 for snacks, drinks, and essentials\n* **Boarding Pass Kiosk:** Print flight passes quickly\n* **Ideal For:** Business travelers or guests with early flights\n* **Location:** Lobby area for easy access",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1684185710/zjkufqqi2mzenpzluorw.jpg",
    ],
    tags: ["marketplace", "boarding pass", "kiosk"],
    metadata: {},
    embedding: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  }
];


export const DEMO_RESTAURANTS = [
  {
    name: "BBQ",
    restaurantGuid: "efee1329-76cb-4021-8dec-645725820bb2",
    addressLine1: "1329 Santa Monica BoulevardSanta Monica",
    cuisine: "BBQ",
    showTips: true,
    city: "Santa Monica",
    state: "CA",
    zipCode: "90404",
    country: "USA",
    description: "Fire up your appetite with our bold and smoky BBQ favorites! From tender, slow-cooked ribs to juicy grilled meats and savory sides, every bite is packed with flavor and backyard-style goodness. Get ready to dig in — the ultimate BBQ feast is just a click away!",
    phoneNumber: "3103102775",
    rating: 4.5,
    deliveryFee: 5.00,
    serviceFeePercent: 20.0,
    imageUrls: ["https://d2s742iet3d3t1.cloudfront.net/restaurants/restaurant-156527000000000000/banner_1716317865.jpg?size=medium"], 
    metadata: {
      sourceUrl: "https://www.toasttab.com/local/order/bludsos-bbq-santamonica",
      extractedAt: "2025-10-31T13:59:53.170Z",
      scraperVersion: "1.0.0",
      urls: {
        orderOnline: "https://www.toasttab.com/local/order/bludsos-bbq-santamonica"
      },
    }
  },
  {
    name: "Pizza",
    restaurantGuid: "fa3b226a-3cc9-4515-aebe-1779126f696a",
    addressLine1: "3032 Wilshire BoulevardSanta Monica",
    cuisine: "Pizza",
    showTips: false,
    city: "Santa Monica",
    state: "CA",
    zipCode: "90403",
    country: "USA",
    description: "Savor the flavors of Italy with our mouth-watering selection of pizzas and classic Italian favorites! From crispy, cheesy slices straight from the oven to rich pastas and hearty sauces, every bite is crafted for comfort and joy. Buon appetito — your Italian feast is just a click away!",
    phoneNumber: "3103103462",
    rating: 4.3,
    deliveryFee: 0,
    serviceFeePercent: 20.0,
    imageUrls: ["https://d2s742iet3d3t1.cloudfront.net/restaurant_service/restaurants/e2bb67bf-956f-4f35-99ff-7ccc42a20525/Restaurant/dcd0e0ed-e85c-4928-bcad-f2132753f53d.jpg?size=medium"],
    metadata: {
      sourceUrl: "https://www.toasttab.com/local/order/pizza-fling-3032-wilshire-boulevard",
      extractedAt: "2025-10-31T12:17:30.808Z",
      scraperVersion: "1.0.0",
      urls: {
        orderOnline: "https://www.toasttab.com/local/order/pizza-fling-3032-wilshire-boulevard"
      }
    }
  }
];

export const DEMO_MENU = { 
  menuGuid: "5ecdbd3b-f8f0-4e27-b645-ad6c854114a2", 
  name: "Main Menu", 
  description: "Restaurant menu from Toast ordering system",
  imageUrls: ["https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=60"], 
  lastUpdated: new Date(), 
  metadata: { 
    version: "1.0", 
    lastUpdated: new Date().toISOString(),
    coffeeShop: true,
    specialties: ["single-origin", "espresso", "pastries"]
  } 
};

export const DEMO_MENU_GROUPS = [
  { menuGroupGuid: "e8da858e-0000-4266-860b-b241e578aab8", name: "Starters", description: "Hushpuppies", imageUrls: ["https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=800&auto=format&fit=crop&q=60"],sortOrder: 0, metadata: { category: "starters", featured: true } },
  { menuGroupGuid: "7f266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Meats", description: "Seasoned with our custom dry rubs & smoked slow & low. All sauce is served on the side.", imageUrls: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=60"],sortOrder: 1, metadata: { category: "meats", featured: true } },
  { menuGroupGuid: "3d6df852-c2eb-490c-9784-209659616463", name: "Sides", description: "All sides are made in house from scratch. \n1/2 Pint Feeds 1-2ppl\nPint Feeds 3-4ppl\nQuart Feeds 6-8ppl", imageUrls: ["https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60"],sortOrder: 2, metadata: { category: "sides", featured: false } },
  { menuGroupGuid: "7eca7639-ccd1-4f88-8562-a56b8d9caa6b", name: "Drinks", description: "Bludsos famous sweet tea, available in half gallon size.", imageUrls: ["https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=800&auto=format&fit=crop&q=60"],sortOrder: 3, metadata: { category: "drinks", featured: true } },
];

export const DEMO_MENU_ITEMS = [
  { menuItemGuid: "5998d2cb-bfd8-4a7e-9d91-0183f6ac6a85", menuGroupGuid: "7f266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Pork Ribs", description: "Seasoned with our custom dry rubs & smoked slow & low. All sauce is served on the side.", price: "12.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/lGgAfZKogd-C7wHuoIu3ede-3VKgrIkFP5F-E9do-QE/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-59b5ca6c-61f5-4737-8abe-bc66a2f2459a.jpg"], allergens: ["Gluten"], modifierGroupsReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a11", "9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", "3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7e"], sortOrder: 0, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "0475a6d0-116e-4720-b355-bfca578e5043", menuGroupGuid: "7f266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Brisket", description: "Seasoned with our custom dry rubs & smoked slow & low. All sauce is served on the side.", price: "12.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/Tv7QU7AwtcXY7Ie3K2pjYZJ9CnSsdVny-JelpOHgvOk/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-adcf00ec-ee21-4e53-b9b1-4688480ee814.jpg"], allergens: [], modifierGroupsReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a12", "8b2c4d5e-6f7a-48b0-9c1d-2e3f4a5b6c7e", "3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7f"], sortOrder: 1, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "8577e3a7-13da-418d-96fc-a0d5302fa237", menuGroupGuid: "7f266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Turkey", description: "Seasoned with our custom dry rubs & smoked slow & low. All sauce is served on the side.", price: "9.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/0gJlvFCEu-fDmYJ5S0DDrIBKO4SWZJwWSXLa9m1527w/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/items/9/item-400000031700806209_1739563357.png"], allergens: [], modifierGroupsReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a13", "7e9f0a1b-2c3d-4e5f-9012-3456789abcde", "3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d81"], sortOrder: 2, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "260b4013-9dd3-454c-a12b-c0c1d1bdf3f3", menuGroupGuid: "3d6df852-c2eb-490c-9784-209659616463", name: "Mac and Cheese", description: "All sides are made in house from scratch. \n1/2 Pint Feeds 1-2ppl\nPint Feeds 3-4ppl\nQuart Feeds 6-8ppl", price: "7.50", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/-1MoaRAYbDy0orCWQediEwNPxreQCtJSEhOCF8IMwJQ/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-53959e10-d5a8-4280-b7b4-4583f13ea9ca.jpg"], allergens: [], modifierGroupsReferences: ["5a6b7c8d-9e0f-4a1b-2c3d-4e5f60718293"], sortOrder: 0, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "d1326e87-8190-492f-9d04-abe87c6ca3b1", menuGroupGuid: "3d6df852-c2eb-490c-9784-209659616463", name: "Cornbread", description: "All sides are made in house from scratch", price: "3.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/mOeQy7DDkJcD3VWJR_gpJ2ZNcjRnI_HiYDYIjkTmIdI/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-11265470-b2c5-4e4d-a683-6d13e15612e7.jpg"], allergens: [], modifierGroupsReferences: ["6f8a9b0c-1d2e-3f40-5a6b-7c8d9e0f1a2b"], sortOrder: 1, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "91dce625-0678-47d7-bc9e-e1ce4843e5f2", menuGroupGuid: "3d6df852-c2eb-490c-9784-209659616463", name: "Pickles", description: "All sides are made in house from scratch", price: "2.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/pqRmPKAJ2t6jRkToWrpA7Li5SdDZAiNqcOvz4VqXIro/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-7575822f-23c6-4e4f-bca7-298964b58802.jpg"], allergens: [], modifierGroupsReferences: [], sortOrder: 2, metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "a98be9dd-f901-490d-bcb7-99b0313d951b", menuGroupGuid: "e8da858e-0000-4266-860b-b241e578aab8", name: "Hushpuppies", description: " ", price: "10.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/-f_2KOQgJLy2AxYsF5lucVGlqBnwDUPJ-j-qZ_qso58/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/items/1/item-400000031699848561_1739561756.png"], allergens: [], modifierGroupsReferences: [], sortOrder: 0, metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "a8bd4247-f63e-47be-975a-b0b6e2db277c", menuGroupGuid: "7eca7639-ccd1-4f88-8562-a56b8d9caa6b", name: "Sweet Tea", description: "Bludsos famous sweet tea, available in half gallon size.", calories: 0, price: "4.50", imageUrls: ["https://d1w7312wesee68.cloudfront.net/NUY3AgPqcaphWBthx9qcjSr8amYP8EGabwQWyrBPScg/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-5afef588-fd39-44a5-90e6-7a296a0fddd7.jpg"], allergens: [], modifierGroupsReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde1"], sortOrder: 0, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "559d7ee3-5e31-4007-be85-511f5d6ff726", menuGroupGuid: "7eca7639-ccd1-4f88-8562-a56b8d9caa6b", name: "Arnold Palmer", description: "a perfect blend of our famous sweet tea and home made lemonade, available in half gallon.", price: "4.50", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/VJjJ7zjXcX1MNe8caTsKFuESg0a_Ro2NAHyGuVtBF4k/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-d89d19fe-79a7-4c15-8e1b-bc044d5fc8e3.jpg"], allergens: [], modifierGroupsReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde2"], sortOrder: 1, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "0425b29e-f639-4569-95d2-9e94f82f0f51", menuGroupGuid: "7eca7639-ccd1-4f88-8562-a56b8d9caa6b", name: "Lemonade", description: "Home made lemonade, available in half gallon size.", price: "4.50", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/FP88tjfbBbNbtUAAtTI-NwyY0PkovKuMZ15fFXnOszU/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-156527000000000000/menu/images/item-a8894937-d1e8-4148-8fb3-16337dd96df6.jpg"], allergens: [], modifierGroupsReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde3"], sortOrder: 2, metadata: { currency: "USD", hasModifiers: true } },
];

export const DEMO_MODIFIER_GROUPS = [
  { modifierGroupGuid: "0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a11", name: "Sauce Selection", description: "Choose one sauce on the side.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["b2c3d4e5-f6a7-8901-2345-678901abcdea", "b2c3d4e5-f6a7-8901-2345-678901abcdeb", "b2c3d4e5-f6a7-8901-2345-678901abcdec"], metadata: { category: "sauce-selection" } },
  { modifierGroupGuid: "9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d", name: "Pork Ribs Size", description: "Pick a rack size for Pork Ribs.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["c3d4e5f6-a7b8-9012-3456-789012abcdea", "c3d4e5f6-a7b8-9012-3456-789012abcdeb", "c3d4e5f6-a7b8-9012-3456-789012abcdec"], metadata: { category: "pork-ribs-size" } },
  { modifierGroupGuid: "3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7e", name: "Extra Sauce", description: "Add extra sauce cups.", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["d4e5f6a7-b8c9-0123-4567-890123abcdea", "d4e5f6a7-b8c9-0123-4567-890123abcdeb"], metadata: { category: "extra-sauce" } },

  { modifierGroupGuid: "0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a12", name: "Sauce Selection", description: "Choose one sauce on the side for brisket.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["b2c3d4e5-f6a7-8901-2345-678901abce10", "b2c3d4e5-f6a7-8901-2345-678901abce11", "b2c3d4e5-f6a7-8901-2345-678901abce12"], metadata: { category: "sauce-selection-brisket" } },
  { modifierGroupGuid: "8b2c4d5e-6f7a-48b0-9c1d-2e3f4a5b6c7e", name: "Brisket Size", description: "Pick a portion size for Brisket.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["e3f4a5b6-c7d8-9012-3456-789012abcdea", "e3f4a5b6-c7d8-9012-3456-789012abcdef", "e3f4a5b6-c7d8-9012-3456-789012abcdff"], metadata: { category: "brisket-size" } },
  { modifierGroupGuid: "3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7f", name: "Extra Sauce", description: "Add extra sauce cups for brisket.", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["d4e5f6a7-b8c9-0123-4567-890123abced0", "d4e5f6a7-b8c9-0123-4567-890123abced1"], metadata: { category: "extra-sauce-brisket" } },

  { modifierGroupGuid: "0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a13", name: "Sauce Selection", description: "Choose one sauce on the side for turkey.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["b2c3d4e5-f6a7-8901-2345-678901abce20", "b2c3d4e5-f6a7-8901-2345-678901abce21", "b2c3d4e5-f6a7-8901-2345-678901abce22"], metadata: { category: "sauce-selection-turkey" } },
  { modifierGroupGuid: "7e9f0a1b-2c3d-4e5f-9012-3456789abcde", name: "Turkey Size", description: "Pick a portion size for Turkey.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["e4f5a6b7-c8d9-0123-4567-890123abcdea", "e4f5a6b7-c8d9-0123-4567-890123abcdef", "e4f5a6b7-c8d9-0123-4567-890123abcdee"], metadata: { category: "turkey-size" } },
  { modifierGroupGuid: "3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d81", name: "Extra Sauce", description: "Add extra sauce cups for turkey.", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["d4e5f6a7-b8c9-0123-4567-890123abcee0", "d4e5f6a7-b8c9-0123-4567-890123abcee1"], metadata: { category: "extra-sauce-turkey" } },

  { modifierGroupGuid: "6f8a9b0c-1d2e-3f40-5a6b-7c8d9e0f1a2b", name: "Cornbread Size", description: "Select size for cornbread.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["aa11bb22-cc33-dd44-ee55-ff6677889900"], metadata: { category: "cornbread-size" } },
  { modifierGroupGuid: "5a6b7c8d-9e0f-4a1b-2c3d-4e5f60718293", name: "Hot Side Size", description: "Customize your item", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["bb11cc22-dd33-ee44-ff55-001122334455", "bb11cc22-dd33-ee44-ff55-001122334456", "bb11cc22-dd33-ee44-ff55-001122334457"], metadata: { category: "hot-side-size" } },

  { modifierGroupGuid: "2a3b4c5d-6e7f-4890-9123-456789abcde1", name: "Size", description: "Choose a size for Sweet Tea.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["de1f2a3b-4c5d-6e7f-8091-23456789abc1", "de1f2a3b-4c5d-6e7f-8091-23456789abc2"], metadata: { category: "drink-size-sweet-tea" } },
  { modifierGroupGuid: "2a3b4c5d-6e7f-4890-9123-456789abcde2", name: "Size", description: "Choose a size for Arnold Palmer.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["de1f2a3b-4c5d-6e7f-8091-23456789abd1", "de1f2a3b-4c5d-6e7f-8091-23456789abd2"], metadata: { category: "drink-size-arnold-palmer" } },
  { modifierGroupGuid: "2a3b4c5d-6e7f-4890-9123-456789abcde3", name: "Size", description: "Choose a size for Lemonade.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["de1f2a3b-4c5d-6e7f-8091-23456789abe1", "de1f2a3b-4c5d-6e7f-8091-23456789abe2"], metadata: { category: "drink-size-lemonade" } },

  
];

export const DEMO_MODIFIER_OPTIONS = [
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abcdea", name: "Mild BBQ Sauce", description: "(on the side)", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a11"] },
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abcdeb", name: "Hot BBQ Sauce", description: "(on the side)", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a11"] },
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abcdec", name: "No Sauce", description: "No sauce added", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a11"] },

  { modifierOptionGuid: "c3d4e5f6-a7b8-9012-3456-789012abcdea", name: "1/4 Rack Pork Ribs", description: "Quarter rack of pork ribs", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"] },
  { modifierOptionGuid: "c3d4e5f6-a7b8-9012-3456-789012abcdeb", name: "Half Rack Pork Ribs", description: "Half rack of pork ribs", price: "12.00", calories: 0, isDefault: false, modifierGroupReferences: ["9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"] },
  { modifierOptionGuid: "c3d4e5f6-a7b8-9012-3456-789012abcdec", name: "Full Rack Pork Ribs", description: "Full rack of pork ribs", price: "36.00", calories: 0, isDefault: false, modifierGroupReferences: ["9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"] },

  { modifierOptionGuid: "d4e5f6a7-b8c9-0123-4567-890123abcdea", name: "Small Mild BBQ", description: "Small cup of mild BBQ", price: "2.00", calories: 0, isDefault: false, modifierGroupReferences: ["3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7e"] },
  { modifierOptionGuid: "d4e5f6a7-b8c9-0123-4567-890123abcdeb", name: "Small Hot BBQ", description: "Small cup of hot BBQ", price: "2.00", calories: 0, isDefault: false, modifierGroupReferences: ["3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7e"] },

  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abce10", name: "Mild BBQ Sauce", description: "(on the side)", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a12"] },
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abce11", name: "Hot BBQ Sauce", description: "(on the side)", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a12"] },
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abce12", name: "No Sauce", description: "No sauce added", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a12"] },

  { modifierOptionGuid: "e3f4a5b6-c7d8-9012-3456-789012abcdea", name: "1/4 lb Brisket", description: "Quarter pound of brisket", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["8b2c4d5e-6f7a-48b0-9c1d-2e3f4a5b6c7e"] },
  { modifierOptionGuid: "e3f4a5b6-c7d8-9012-3456-789012abcdef", name: "1/2 lb Brisket", description: "Half pound of brisket", price: "11.00", calories: 0, isDefault: false, modifierGroupReferences: ["8b2c4d5e-6f7a-48b0-9c1d-2e3f4a5b6c7e"] },
  { modifierOptionGuid: "e3f4a5b6-c7d8-9012-3456-789012abcdff", name: "1 lb Brisket", description: "One pound of brisket", price: "33.00", calories: 0, isDefault: false, modifierGroupReferences: ["8b2c4d5e-6f7a-48b0-9c1d-2e3f4a5b6c7e"] },

  
  { modifierOptionGuid: "d4e5f6a7-b8c9-0123-4567-890123abced0", name: "Small Mild BBQ", description: "Small cup of mild BBQ", price: "2.00", calories: 0, isDefault: false, modifierGroupReferences: ["3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7f"] },
  { modifierOptionGuid: "d4e5f6a7-b8c9-0123-4567-890123abced1", name: "Small Hot BBQ", description: "Small cup of hot BBQ", price: "2.00", calories: 0, isDefault: false, modifierGroupReferences: ["3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d7f"] },

  
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abce20", name: "Mild BBQ Sauce", description: "(on the side)", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a13"] },
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abce21", name: "Hot BBQ Sauce", description: "(on the side)", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a13"] },
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abce22", name: "No Sauce", description: "No sauce added", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["0f7f2a2a-8f0a-4f5e-9c32-5b6c9e2b1a13"] },

  { modifierOptionGuid: "e4f5a6b7-c8d9-0123-4567-890123abcdea", name: "1/4 lb Turkey", description: "Quarter pound of turkey", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["7e9f0a1b-2c3d-4e5f-9012-3456789abcde"] },
  { modifierOptionGuid: "e4f5a6b7-c8d9-0123-4567-890123abcdef", name: "1/2 lb Turkey", description: "Half pound of turkey", price: "8.00", calories: 0, isDefault: false, modifierGroupReferences: ["7e9f0a1b-2c3d-4e5f-9012-3456789abcde"] },
  { modifierOptionGuid: "e4f5a6b7-c8d9-0123-4567-890123abcdee", name: "1 lb Turkey", description: "One pound of turkey", price: "24.00", calories: 0, isDefault: false, modifierGroupReferences: ["7e9f0a1b-2c3d-4e5f-9012-3456789abcde"] },

  { modifierOptionGuid: "d4e5f6a7-b8c9-0123-4567-890123abcee0", name: "Small Mild BBQ", description: "Small cup of mild BBQ", price: "2.00", calories: 0, isDefault: false, modifierGroupReferences: ["3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d81"] },
  { modifierOptionGuid: "d4e5f6a7-b8c9-0123-4567-890123abcee1", name: "Small Hot BBQ", description: "Small cup of hot BBQ", price: "2.00", calories: 0, isDefault: false, modifierGroupReferences: ["3c4d5e6f-7a8b-49c0-9d1e-2f3a4b5c6d81"] },

  { modifierOptionGuid: "aa11bb22-cc33-dd44-ee55-ff6677889900", name: "1 pc", description: "Single piece", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["6f8a9b0c-1d2e-3f40-5a6b-7c8d9e0f1a2b"] },

  { modifierOptionGuid: "bb11cc22-dd33-ee44-ff55-001122334455", name: "1/2 Pint", description: "Half pint", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["5a6b7c8d-9e0f-4a1b-2c3d-4e5f60718293"] },
  { modifierOptionGuid: "bb11cc22-dd33-ee44-ff55-001122334456", name: "Pint", description: "One pint", price: "6.50", calories: 0, isDefault: false, modifierGroupReferences: ["5a6b7c8d-9e0f-4a1b-2c3d-4e5f60718293"] },
  { modifierOptionGuid: "bb11cc22-dd33-ee44-ff55-001122334457", name: "Quart", description: "One quart", price: "17.50", calories: 0, isDefault: false, modifierGroupReferences: ["5a6b7c8d-9e0f-4a1b-2c3d-4e5f60718293"] },

  { modifierOptionGuid: "de1f2a3b-4c5d-6e7f-8091-23456789abc1", name: "16oz", description: "16 ounce", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde1"] },
  { modifierOptionGuid: "de1f2a3b-4c5d-6e7f-8091-23456789abc2", name: "Half Gallon", description: "Half gallon", price: "15.50", calories: 0, isDefault: false, modifierGroupReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde1"] },

  { modifierOptionGuid: "de1f2a3b-4c5d-6e7f-8091-23456789abd1", name: "16oz", description: "16 ounce", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde2"] },
  { modifierOptionGuid: "de1f2a3b-4c5d-6e7f-8091-23456789abd2", name: "Half Gallon", description: "Half gallon", price: "15.50", calories: 0, isDefault: false, modifierGroupReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde2"] },

  { modifierOptionGuid: "de1f2a3b-4c5d-6e7f-8091-23456789abe1", name: "16oz", description: "16 ounce", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde3"] },
  { modifierOptionGuid: "de1f2a3b-4c5d-6e7f-8091-23456789abe2", name: "Half Gallon", description: "Half gallon", price: "15.50", calories: 0, isDefault: false, modifierGroupReferences: ["2a3b4c5d-6e7f-4890-9123-456789abcde3"] },  
];

export const DEMO_MENU_TWO = { 
  menuGuid: "5ecdbd3b-f8f0-4e27-b645-ad6c854114a3", 
  name: "Main Menu", 
  description: "Restaurant menu from Toast ordering system",
  imageUrls: ["https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=60"], 
  lastUpdated: new Date(), 
  metadata: { 
    version: "1.0", 
    lastUpdated: new Date().toISOString(),
    coffeeShop: true,
    specialties: ["single-origin", "espresso", "pastries"]
  } 
};

export const DEMO_MENU_GROUPS_TWO = [
  { menuGroupGuid: "af266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Pizza - 12\"", description: "Tomato Sauce, Mozzarella.", imageUrls: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=60"],sortOrder: 0, metadata: { category: "pizza", featured: true } },
  { menuGroupGuid: "ad6df852-c2eb-490c-9784-209659616463", name: "Drinks", description: "Italian Artisanal Sprite", imageUrls: ["https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60"],sortOrder: 1, metadata: { category: "drinks", featured: true } },
]
export const DEMO_MENU_ITEMS_TWO = [
  { menuItemGuid: "b911b98d-c648-4622-836c-3b0c5f9172ea", menuGroupGuid: "af266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Margherita", description: "Tomato Sauce, Mozzarella", price: "19.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/xLqeBntVXd6oXs0XedCkjaPlPz6ncKZyEXR5y8U6Wi8/resize:fit:720:720/plain/s3://toasttab/menu_service/restaurants/a9afc1a7-87d3-40e8-9fb4-4535cafb947e/MenuItem/716d3c79-6754-49c5-96a3-6df607d1b4d7.png"], allergens: [], modifierGroupsReferences: ["f7a0c6c4-3d71-4a7f-9a40-8ad2b1c0a012", "a4c7b1d2-59ef-4b8d-a3b3-1f2a9e7c5d34", "e9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c3"], sortOrder: 0, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "10970c73-d39a-45ea-8201-d3b0a5570cb2", menuGroupGuid: "af266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Diavolina", description: "Tomato Sauce, Mozzarella, Spicy Salame ( Sub. Turkey Pepperoni)", price: "24.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/V8gb8gS_ke8eZfXjPtcaNeGAD95t9wTKmXicJh0Xbls/resize:fit:720:720/plain/s3://toasttab/menu_service/restaurants/a9afc1a7-87d3-40e8-9fb4-4535cafb947e/MenuItem/665cbd0a-7b84-4976-9ac3-a45965f1ecd2.png"], allergens: [], modifierGroupsReferences: ["d1a2b3c4-d5e6-47f8-9a0b-1c2d3e4f5d10", "d2a3b4c5-d6e7-48f9-9a0c-1c2d3e4f5d20"], sortOrder: 1, metadata: { currency: "USD", hasModifiers: true}  },
  { menuItemGuid: "1d681287-e559-4075-b614-671fcaec1305", menuGroupGuid: "af266c48-74ec-4c8e-9ad1-7d68cf98660b", name: "Mediterranea", description: "Tomato Sauce, Cherry Tomato Confit, Sautéed Eggplant, Capers, Taggiasche Olives, Oregano", price: "22.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/FBsWBk2m045RCdGeTBXbKnIGCPa4zfKh15AwVvqJFjU/resize:fit:720:720/plain/s3://toasttab/menu_service/restaurants/a9afc1a7-87d3-40e8-9fb4-4535cafb947e/MenuItem/33d7a2ab-7810-4c33-b9b4-8ab7a1b80e09.png"], allergens: [], modifierGroupsReferences: ["e1a2b3c4-e5f6-47f8-9a0b-1c2d3e4f5e10", "e2a3b4c5-e6f7-48f9-9a0c-1c2d3e4f5e20"], sortOrder: 2, metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "12efe4ed-90e2-47e0-a097-7ae68f3372d2", menuGroupGuid: "ad6df852-c2eb-490c-9784-209659616463", name: "Mexican Coke", description: "Italian Artisanal Sprite", price: "4.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/WlwHP9_0Va74NJfJmj1N5AxVL-_tYXSnMSV3Pb_G5Jg/resize:fit:720:720/plain/s3://toasttab/menu_service/restaurants/a9afc1a7-87d3-40e8-9fb4-4535cafb947e/MenuItem/f8e70584-f904-43cc-9a04-aac047924f20.png"], allergens: [], modifierGroupsReferences: [], sortOrder: 0, metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "4308d25c-f9bf-40bd-8ceb-02a445d43d2d", menuGroupGuid: "ad6df852-c2eb-490c-9784-209659616463", name: "Diet Coke", description: "Italian Artisanal Sprite", price: "3.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/BVZ9vTSLO700cX6kyN1mSSAtiNW5m4EtoHkVGMnhf7M/resize:fit:720:720/plain/s3://toasttab/menu_service/restaurants/a9afc1a7-87d3-40e8-9fb4-4535cafb947e/MenuItem/304d3730-49fb-4322-97ce-e7341608e571.png"], allergens: [], modifierGroupsReferences: [], sortOrder: 1, metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "365c7d2f-77f8-4d36-a669-90546f97ee82", menuGroupGuid: "ad6df852-c2eb-490c-9784-209659616463", name: "Gassosa", description: "Italian Artisanal Sprite", price: "4.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/k2XnxwsLN7sN7rE5PRObLLp77aCtCXiDXuPQENUSwmA/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-272227000000000000/menu/items/9/item-1400000000800342589_1753927982.png"], allergens: [], modifierGroupsReferences: [], sortOrder: 2, metadata: { currency: "USD", hasModifiers: false } }
]
export const DEMO_MODIFIER_GROUPS_TWO = [
  { modifierGroupGuid: "f7a0c6c4-3d71-4a7f-9a40-8ad2b1c0a012", name: "Pizza Crust 12\"", description: "Choose your crust.", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["a9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c1", "a9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c2"], metadata: { category: "pizza-crust-12" } },
  { modifierGroupGuid: "a4c7b1d2-59ef-4b8d-a3b3-1f2a9e7c5d34", name: "Pizza Add ON", description: "Add extra toppings.", minSelections: 0, maxSelections: 3, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c1", "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c2", "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c3"], metadata: { category: "pizza-add-on" } },
  { modifierGroupGuid: "e9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c3", name: "Margherita", description: "Customize your Margherita.", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["c9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c1", "c9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c2"], metadata: { category: "margherita-custom" } },
  { modifierGroupGuid: "d1a2b3c4-d5e6-47f8-9a0b-1c2d3e4f5d10", name: "Pizza Crust 12\"", description: "Choose your crust (Diavolina).", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b3c1", "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b3c2"], metadata: { category: "pizza-crust-12-diavolina" } },
  { modifierGroupGuid: "d2a3b4c5-d6e7-48f9-9a0c-1c2d3e4f5d20", name: "Pizza Add ON", description: "Add extra toppings (Diavolina).", minSelections: 0, maxSelections: 3, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c1", "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c2", "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c3"], metadata: { category: "pizza-add-on-diavolina" } },
  { modifierGroupGuid: "e1a2b3c4-e5f6-47f8-9a0b-1c2d3e4f5e10", name: "Pizza Crust 12\"", description: "Choose your crust (Mediterranea).", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["d1b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c1", "d1b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c2"], metadata: { category: "pizza-crust-12-mediterranea" } },
  { modifierGroupGuid: "e2a3b4c5-e6f7-48f9-9a0c-1c2d3e4f5e20", name: "Pizza Add ON", description: "Add extra toppings (Mediterranea).", minSelections: 0, maxSelections: 3, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["d1b7d4c1-2a46-4c83-ae8f-50d6f9a1b4c1", "d1b7d4c1-2a46-4c83-ae8f-50d6f9a1b4c2", "d1b7d4c1-2a46-4c83-ae8f-50d6f9a1b4c3"], metadata: { category: "pizza-add-on-mediterranea" } },
]
export const DEMO_MODIFIER_OPTIONS_TWO = [
  { modifierOptionGuid: "a9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c1", name: "Thin", description: "Thin crust", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["f7a0c6c4-3d71-4a7f-9a40-8ad2b1c0a012"] },
  { modifierOptionGuid: "a9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c2", name: "Thick", description: "Thick crust", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["f7a0c6c4-3d71-4a7f-9a40-8ad2b1c0a012"] },

  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c1", name: "Sauteed Mushrooms", description: "", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["a4c7b1d2-59ef-4b8d-a3b3-1f2a9e7c5d34"] },
  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c2", name: "Porcini Mushrooms", description: "", price: "4.00", calories: 0, isDefault: false, modifierGroupReferences: ["a4c7b1d2-59ef-4b8d-a3b3-1f2a9e7c5d34"] },
  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c3", name: "Turkey Pepperoni", description: "", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["a4c7b1d2-59ef-4b8d-a3b3-1f2a9e7c5d34"] },

  { modifierOptionGuid: "c9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c1", name: "No Tomato Sauce", description: "", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["e9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c3"] },
  { modifierOptionGuid: "c9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c2", name: "No Mozzarella", description: "", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["e9b7d4c1-2a36-4c83-ae8f-50d6f9a1b2c3"] },
  
  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b3c1", name: "Thin", description: "Thin crust", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["d1a2b3c4-d5e6-47f8-9a0b-1c2d3e4f5d10"] },
  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b3c2", name: "Thick", description: "Thick crust", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["d1a2b3c4-d5e6-47f8-9a0b-1c2d3e4f5d10"] },
  
  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c1", name: "Sauteed Mushrooms", description: "", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["d2a3b4c5-d6e7-48f9-9a0c-1c2d3e4f5d20"] },
  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c2", name: "Porcini Mushrooms", description: "", price: "4.00", calories: 0, isDefault: false, modifierGroupReferences: ["d2a3b4c5-d6e7-48f9-9a0c-1c2d3e4f5d20"] },
  { modifierOptionGuid: "b9b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c3", name: "Turkey Pepperoni", description: "", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["d2a3b4c5-d6e7-48f9-9a0c-1c2d3e4f5d20"] },
  
  { modifierOptionGuid: "d1b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c1", name: "Thin", description: "Thin crust", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["e1a2b3c4-e5f6-47f8-9a0b-1c2d3e4f5e10"] },
  { modifierOptionGuid: "d1b7d4c1-2a36-4c83-ae8f-50d6f9a1b4c2", name: "Thick", description: "Thick crust", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["e1a2b3c4-e5f6-47f8-9a0b-1c2d3e4f5e10"] },
  
  { modifierOptionGuid: "d1b7d4c1-2a46-4c83-ae8f-50d6f9a1b4c1", name: "Sauteed Mushrooms", description: "", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["e2a3b4c5-e6f7-48f9-9a0c-1c2d3e4f5e20"] },
  { modifierOptionGuid: "d1b7d4c1-2a46-4c83-ae8f-50d6f9a1b4c2", name: "Porcini Mushrooms", description: "", price: "4.00", calories: 0, isDefault: false, modifierGroupReferences: ["e2a3b4c5-e6f7-48f9-9a0c-1c2d3e4f5e20"] },
  { modifierOptionGuid: "d1b7d4c1-2a46-4c83-ae8f-50d6f9a1b4c3", name: "Turkey Pepperoni", description: "", price: "3.00", calories: 0, isDefault: false, modifierGroupReferences: ["e2a3b4c5-e6f7-48f9-9a0c-1c2d3e4f5e20"] },
]

const USE_SSL = process.env.USE_SSL_FOR_POSTGRES === "true";

const poolConfig = {
  connectionString: process.env.DATABASE_URL as string,
} as ClientConfig;

if (USE_SSL) {
  // Path to where we download the certificate bundle in user_data script
  const rdsCaCertPath = "/opt/certs/rds-ca-bundle.pem";

  if (!fs.existsSync(rdsCaCertPath)) {
    throw new Error(`SSL is enabled but certificate file not found at: ${rdsCaCertPath}`);
  }

  console.log(`📜 Using SSL certificate from: ${rdsCaCertPath}`);

  poolConfig.ssl = {
    rejectUnauthorized: true, // This is crucial for security
    // Read the certificate authority bundle from the file system
    ca: fs.readFileSync(rdsCaCertPath).toString(),
  };
}

const db = drizzle({
  connection: poolConfig,
});

async function resetTable(tableName: string, idColumn: string) {
  await db.execute(sql.raw(`DELETE FROM ${qi(tableName)}`));

  // Fetch the sequence name for the given table + column
  const result = await db.execute(
    sql`SELECT pg_get_serial_sequence(${tableName}, ${idColumn}) as seq;`
  );
  const seqName = result.rows?.[0]?.seq;

  if (seqName) {
    await db.execute(sql.raw(`ALTER SEQUENCE ${seqName} RESTART WITH 1`));
    console.log(`Reset sequence for ${tableName}.${idColumn}: ${seqName}`);
  } else {
    console.warn(`No sequence found for ${tableName}.${idColumn}`);
  }
}

async function resetAllTables() {
  console.log("Resetting all tables...");

  // Reset in correct dependency order (children first, then parents)
  const table_names = [
    "dine_in_payments",   // Depends on dine_in_orders
    "dine_in_order_items", // Depends on dine_in_orders and menu_items
    "dine_in_orders",     // Depends on hotels, dine_in_restaurants
    "modifier_options",    // No dependencies
    "modifier_groups",     // Depends on menu_items
    "menu_items",          // Depends on menu_groups
    "menu_groups",         // Depends on menus
    "menus",              // Depends on dine_in_restaurants
    "tips",               // Depends on dine_in_restaurants
    "dine_in_restaurants", // Depends on hotels
    "amenities",          // Depends on hotels
    "session",            // Depends on hotels
    "account",            // Depends on user
    "verification",       // Depends on user
    "user",              // Removed cause we are removing sessions table
    "hotels"              // No dependencies
  ];

  for (const tableName of table_names) {
    await resetTable(tableName, "id");
  }
  console.log("All tables reset successfully!");
}

async function insertedMenu(
  restaurantId: number,
  menuData: typeof DEMO_MENU,
  menuGroups: typeof DEMO_MENU_GROUPS,
  menuItems: typeof DEMO_MENU_ITEMS,
  modifierGroups: typeof DEMO_MODIFIER_GROUPS,
  modifierOptions: typeof DEMO_MODIFIER_OPTIONS
) {
  const insertedMenu = await db.execute(sql`
    INSERT INTO menus (restaurant_id, menu_guid, name, description, metadata, status, version, created_at, updated_at)
    VALUES (${restaurantId}, ${menuData.menuGuid}, ${menuData.name}, ${menuData.description}, ${JSON.stringify(menuData.metadata)}, 'approved', 1, NOW(), NOW())
    RETURNING id
  `);
  const menuId = insertedMenu.rows[0].id;
  console.log(`Inserted menu with ID: ${menuId}`);

  // Insert menu groups
  const insertedMenuGroups = [];
  for (const group of menuGroups) {
    const imageUrlsArray = `{${group.imageUrls.map((url: string) => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const result = await db.execute(sql`
      INSERT INTO menu_groups (menu_id, menu_group_guid, name, image_urls, description, metadata, sort_order, status, created_at, updated_at)
      VALUES (${menuId}, ${group.menuGroupGuid}, ${group.name}, ${imageUrlsArray}::text[], ${group.description}, ${JSON.stringify(group.metadata)}, ${group.sortOrder}, 'approved', NOW(), NOW())
      RETURNING id
    `);
    insertedMenuGroups.push(result);
  }
  console.log(`Inserted ${insertedMenuGroups?.length} menu groups`);

  // Create mapping of group GUIDs to IDs
  const groupIdMap = new Map<string, number>();
  insertedMenuGroups.forEach((group, index) => {
    groupIdMap.set(menuGroups[index].menuGroupGuid, group.rows[0].id as number);
  });

  // Create item to group mapping using direct menuGroupGuid references
  const itemToGroupMapping: Record<string, string> = {};

  // Map items to groups using the menuGroupGuid field
  menuItems.forEach(item => {
    if (item.menuGroupGuid) {
      itemToGroupMapping[item.menuItemGuid] = item.menuGroupGuid;
    }
  });

  // Insert menu items
  const insertedMenuItems = [];
  for (const item of menuItems) {
    const groupGuid = itemToGroupMapping[item.menuItemGuid];
    const menuGroupId = groupIdMap.get(groupGuid);
    if (!menuGroupId) {
      throw new Error(`Menu group not found for item ${item.menuItemGuid}`);
    }
    const { modifierGroupsReferences: _modifierGroupsReferences, ...itemWithoutRefs } = item;
    const imageUrlsArray = `{${itemWithoutRefs.imageUrls.map((img: string) => `"${img.replace(/"/g, '\\"')}"`).join(',')}}`;
    const allergensArray = `{${itemWithoutRefs.allergens.map((allergen: string) => `"${allergen.replace(/"/g, '\\"')}"`).join(',')}}`;
    const result = await db.execute(sql`
      INSERT INTO menu_items (menu_group_id, menu_item_guid, name, description, price, original_price, calories, image_urls, allergens, modifier_groups_references, sort_order, status, metadata, created_at, updated_at)
      VALUES (${menuGroupId}, ${itemWithoutRefs.menuItemGuid}, ${itemWithoutRefs.name}, ${itemWithoutRefs.description ?? ''}, ${itemWithoutRefs.price}, ${itemWithoutRefs.price}, ${itemWithoutRefs.calories ?? 0}, ${imageUrlsArray}::text[], ${allergensArray}::text[], ARRAY[]::integer[], ${itemWithoutRefs.sortOrder ?? 0}, 'approved', ${JSON.stringify(itemWithoutRefs.metadata)}, NOW(), NOW())
      RETURNING id
    `);
    insertedMenuItems.push(result);
  }
  console.log(`Inserted ${insertedMenuItems?.length} menu items`);

  // Create mapping of item GUIDs to IDs
  const itemIdMap = new Map<string, number>();
  insertedMenuItems.forEach((item, index) => {
    itemIdMap.set(menuItems[index].menuItemGuid, item.rows[0].id as number);
  });

  // Create modifier groups by name and category for better lookup
  const modifierGroupsByCategory = new Map();
  modifierGroups.forEach(group => {
    const key = `${group.name}-${group.metadata.category}`;
    modifierGroupsByCategory.set(key, group);
  });

  // Define modifier group to item mapping using optimized lookups
  const modifierGroupToItemMapping = new Map();

  // Map modifier groups to items based on the modifierGroupsReferences in menu items
  menuItems.forEach(item => {
    item.modifierGroupsReferences.forEach((modifierGroupGuid: string) => {
      modifierGroupToItemMapping.set(modifierGroupGuid, item.menuItemGuid);
    });
  });

  // Insert modifier groups
  const insertedModifierGroups = [];
  for (const group of modifierGroups) {
    const itemGuid = modifierGroupToItemMapping.get(group.modifierGroupGuid);
    if (!itemGuid) {
      console.error(`No mapping found for modifier group: ${group.name} (${group.modifierGroupGuid})`);
      console.error('Available mappings:', Array.from(modifierGroupToItemMapping.keys()));
      throw new Error(`No mapping found for modifier group ${group.name} (${group.modifierGroupGuid})`);
    }
    const menuItemId = itemIdMap.get(itemGuid);
    if (!menuItemId) {
      console.error(`Menu item not found for GUID: ${itemGuid}`);
      console.error('Available menu items:', Array.from(itemIdMap.keys()));
      throw new Error(`Menu item not found for modifier group ${group.modifierGroupGuid}`);
    }
    const { modifierOptionsReferences: _modifierOptionsReferences, ...groupWithoutRefs } = group;

    const result = await db.execute(sql`
      INSERT INTO modifier_groups (menu_item_id, modifier_group_guid, name, description, min_selections, max_selections, is_required, is_multi_select, status, metadata, created_at, updated_at)
      VALUES (${menuItemId}, ${groupWithoutRefs.modifierGroupGuid}, ${groupWithoutRefs.name}, ${groupWithoutRefs.description}, ${groupWithoutRefs.minSelections}, ${groupWithoutRefs.maxSelections}, ${groupWithoutRefs.isRequired}, ${groupWithoutRefs.isMultiSelect}, 'approved', ${JSON.stringify(groupWithoutRefs.metadata)}, NOW(), NOW())
      RETURNING id
    `);
    insertedModifierGroups.push(result);
  }
  console.log(`Inserted ${insertedModifierGroups?.length} modifier groups`);

  // Create mapping of modifier group GUIDs to IDs
  const modifierGroupIdMap = new Map<string, number>();
  insertedModifierGroups.forEach((group, index) => {
    modifierGroupIdMap.set(modifierGroups[index].modifierGroupGuid, group.rows[0].id as number);
  });

  // Update menu items with correct modifier group IDs
  for (const item of menuItems) {
    const modifierGroupIds = item.modifierGroupsReferences
      .map((guid: string) => modifierGroupIdMap.get(guid))
      .filter((id: number | undefined) => id !== undefined) as number[];

    if (modifierGroupIds.length > 0) {
      await db.execute(sql`
        UPDATE menu_items 
        SET modifier_groups_references = ${sql.raw(`ARRAY[${modifierGroupIds.join(',')}]::integer[]`)}
        WHERE menu_item_guid = ${item.menuItemGuid}
      `);
    }
  }
  console.log(`Updated menu items with modifier group references`);

  // Define modifier option to group mapping using optimized lookups
  const modifierOptionToGroupMapping = new Map();

  // Map modifier options to groups based on the modifierOptionsReferences in modifier groups
  modifierGroups.forEach(group => {
    group.modifierOptionsReferences.forEach((modifierOptionGuid: string) => {
      modifierOptionToGroupMapping.set(modifierOptionGuid, group.modifierGroupGuid);
    });
  });


  // Insert modifier options
  const insertedModifierOptions = [];
  for (const option of modifierOptions) {
    const groupGuid = modifierOptionToGroupMapping.get(option.modifierOptionGuid);
    if (!groupGuid) {
      console.error(`No mapping found for modifier option: ${option.name} (${option.modifierOptionGuid})`);
      console.error('Available mappings:', Array.from(modifierOptionToGroupMapping.keys()));
      throw new Error(`No mapping found for modifier option ${option.name} (${option.modifierOptionGuid})`);
    }
    const modifierGroupId = modifierGroupIdMap.get(groupGuid);
    if (!modifierGroupId) {
      console.error(`Modifier group not found for GUID: ${groupGuid}`);
      console.error('Available modifier groups:', Array.from(modifierGroupIdMap.keys()));
      throw new Error(`Modifier group not found for option ${option.modifierOptionGuid}`);
    }
    const { modifierGroupReferences: _modifierGroupReferences, ...optionWithoutRefs } = option;

    const result = await db.execute(sql`
      INSERT INTO modifier_options (modifier_group_id, modifier_option_guid, name, description, price, original_price, calories, is_default, status, metadata, created_at, updated_at)
      VALUES (${modifierGroupId}, ${optionWithoutRefs.modifierOptionGuid}, ${optionWithoutRefs.name}, ${optionWithoutRefs.description}, ${optionWithoutRefs.price}, ${optionWithoutRefs.price}, ${optionWithoutRefs.calories}, ${optionWithoutRefs.isDefault}, 'approved', '{}', NOW(), NOW())
      RETURNING id
    `);
    insertedModifierOptions.push(result);
  }
  console.log(`Inserted ${insertedModifierOptions?.length} modifier options`);
  console.log(`- Menus: 1`);
  console.log(`- Menu Groups: ${insertedMenuGroups?.length}`);
  console.log(`- Menu Items: ${insertedMenuItems?.length}`);
  console.log(`- Modifier Groups: ${insertedModifierGroups?.length}`);
  console.log(`- Modifier Options: ${insertedModifierOptions?.length}`);
}

async function generateEmbeddingForAmenities() {
  const UPDATED_DEMO_AMENITIES = [];
  for (const amenity of DEMO_AMENITIES) {
    // Create a copy of the amenity to avoid modifying the original
    const amenityCopy = { ...amenity };
    console.log(`Generating embedding for: ${amenity.name}`);
    const embedding = await generateEmbeddingFromJSON(amenityCopy);
    amenityCopy["embedding"] = embedding;
    console.log(`Generated embedding length: ${embedding.length}, first 5 values: ${embedding.slice(0, 5).join(', ')}`);
    UPDATED_DEMO_AMENITIES.push(amenityCopy);
  }
  console.log(`Generated embeddings for ${UPDATED_DEMO_AMENITIES.length} amenities`);
  return UPDATED_DEMO_AMENITIES;
}

async function main() {
  console.log("Starting comprehensive seed...");

  // Reset all tables
  await resetAllTables();

  // Insert hotel using direct SQL
  const insertedHotel = await db.execute(sql`
    INSERT INTO hotels (name, slug, address, latitude, longitude, restaurant_discount, metadata, created_at, updated_at)
    VALUES (${DEMO_HOTEL.name}, ${DEMO_HOTEL.slug}, ${DEMO_HOTEL.address}, ${DEMO_HOTEL.latitude}, ${DEMO_HOTEL.longitude}, ${DEMO_HOTEL.restaurantDiscount}, ${JSON.stringify(DEMO_HOTEL.metadata)}, NOW(), NOW())
    RETURNING id
  `);
  const hotelId = insertedHotel.rows[0].id;
  console.log(`Inserted hotel with ID: ${hotelId}`);

  // Insert amenities using direct SQL with proper array formatting
  const amenitiesWithEmbeddings = await generateEmbeddingForAmenities();
  for (const amenity of amenitiesWithEmbeddings) {
    // Convert arrays to PostgreSQL array format
    const imageUrlsArray = `{${amenity.imageUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const tagsArray = `{${amenity.tags.map(tag => `"${tag.replace(/"/g, '\\"')}"`).join(',')}}`;
    // Convert embedding array to PostgreSQL vector format
    const embeddingVector = `[${amenity.embedding.join(',')}]`;
    
    console.log(`Inserting amenity: ${amenity.name} with embedding length: ${amenity.embedding.length}`);

    await db.execute(sql`
      INSERT INTO amenities (hotel_id, name, description, long_description, image_urls, tags, embedding, metadata, created_at, updated_at)
      VALUES (${hotelId}, ${amenity.name}, ${amenity.description}, ${amenity.longDescription}, ${imageUrlsArray}::text[], ${tagsArray}::varchar[], ${embeddingVector}::vector, ${JSON.stringify(amenity.metadata)}, NOW(), NOW())
    `);
  }
  console.log(`Inserted ${DEMO_AMENITIES.length} amenities`);

  // Insert restaurants
  for (const restaurant of DEMO_RESTAURANTS) {
    const imageUrlsArray = `{${restaurant.imageUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const restaurantResult = await db.execute(sql`
      INSERT INTO dine_in_restaurants (
        hotel_id, restaurant_guid, name, description, cuisine,
        image_urls, rating, address_line1, address_line2,
        city, state, zip_code, country, phone_number, status,
        delivery_fee, service_fee_percent,
        metadata, created_at, updated_at
      )
      VALUES (
        ${hotelId}, ${restaurant.restaurantGuid}, ${restaurant.name},
        ${restaurant.description}, ${restaurant.cuisine},
        ${imageUrlsArray}::text[],   
        ${restaurant.rating},
        ${restaurant.addressLine1}, '', ${restaurant.city}, ${restaurant.state},
        ${restaurant.zipCode}, ${restaurant.country}, ${restaurant.phoneNumber},
        'approved',
        ${restaurant.deliveryFee}, ${restaurant.serviceFeePercent},
        ${JSON.stringify(restaurant.metadata)}::jsonb,
        NOW(), NOW()
      )
      RETURNING id
    `);

    console.log(`Inserted restaurant with ID: ${restaurantResult.rows[0].id}`);
    // Insert menu for this restaurant
    if (restaurant.restaurantGuid === "efee1329-76cb-4021-8dec-645725820bb2") {
      await insertedMenu(
        restaurantResult.rows[0].id as number,
        DEMO_MENU,
        DEMO_MENU_GROUPS,
        DEMO_MENU_ITEMS,
        DEMO_MODIFIER_GROUPS,
        DEMO_MODIFIER_OPTIONS
      );
    } else {
      await insertedMenu(
        restaurantResult.rows[0].id as number,
        DEMO_MENU_TWO,
        DEMO_MENU_GROUPS_TWO,
        DEMO_MENU_ITEMS_TWO,
        DEMO_MODIFIER_GROUPS_TWO,
        DEMO_MODIFIER_OPTIONS_TWO
      );
    }
  }

  console.log(`- Hotel: ${hotelId}`);
  console.log(`- Amenities: ${DEMO_AMENITIES.length}`);
  console.log(`- Restaurants: ${DEMO_RESTAURANTS.length}`);
  console.log("Comprehensive seed completed successfully!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
