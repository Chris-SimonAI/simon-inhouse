import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import "dotenv/config";
import { type ClientConfig } from "pg";
import fs from "fs";
import { OpenAIEmbeddings } from "@langchain/openai";

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
  data: Record<string, any>,
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
export function jsonToReadableText(obj: Record<string, any>): string {
  // For known structures (like amenities)
  if (obj.name && obj.description) {
    // Clean longDescription: remove Markdown symbols and line breaks
    const cleanLongDescription = obj.longDescription
      ? obj.longDescription.replace(/[*_#>\n]+/g, " ").trim()
      : "";

    // Join tags meaningfully if present
    const tagsText =
      obj.tags && obj.tags.length > 0
        ? `Tags: ${obj.tags.join(", ")}.`
        : "";

    return `Amenity: ${obj.name}. Description: ${obj.description}. ${cleanLongDescription} ${tagsText}`;
  }

  // Generic fallback for other objects — flatten recursively
  const flatten = (input: any): string => {
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

const DEMO_QR_CODE = {
  code: "e4c1f2a9",
  hotelId: 1,
  isValid: true,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3000),
  revokedAt: null
}

export const DEMO_HOTEL = {
  name: "The Anza Hotel",
  address: "23627 Calabasas Road, Calabasas, CA 91302, USA",
  latitude: "34.15667",
  longitude: "-118.64204",
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
    name: "Rosti Tuscan Kitchen",
    restaurantGuid: "1f616b6f-195b-41e7-98e6-4bf1b6402ffc",
    addressLine1: "23663 Calabasas road",
    cuisine: "Italian",
    city: "Calabasas",
    state: "CA",
    zipCode: "91302",
    country: "USA",
    description: "Bringing a taste of Tuscany to Calabasas, **Rosti Tuscan Kitchen** serves rustic Italian comfort food made with fresh, wholesome ingredients. Enjoy handmade pasta, wood-fired flatbreads, and seasonal specials in a cozy, relaxed setting.\n\n\n\n### Must-Try\n* **Roasted Butternut Squash Flatbread:** Caramelized squash, goat cheese & balsamic glaze  \n* **Bruschetta Mozzarella:** Toasted ciabatta with melted mozzarella & sun-dried tomatoes  \n* **The Steak Bomb Calzone:** Grilled steak, peppers & smoked mozzarella  \n\n\n\n### Dining Details\n* **Service Style:** Casual dine-in or takeout  \n* **Delivery Time:** Around 30–40 minutes  \n* **Hours:** Daily, 11 am – 9 pm  \n\n\n\n### The Experience\nA neighborhood favorite for **fresh Italian flavor and easygoing vibes**.",
    phoneNumber: "8185912211",
    rating: 4.5,
    imageUrls: ["https://s3-media0.fl.yelpcdn.com/bphoto/tE86IN4rFHilPn37wiOWFA/l.jpg"], 
    metadata: {
      sourceUrl: "https://www.toasttab.com/local/order/rosti-tuscan-kitchen-calabasas-23663-calabasas-road",
      extractedAt: "2025-10-23T07:41:58.855Z",
      scraperVersion: "1.0.0",
      urls: {
        orderOnline: "https://www.toasttab.com/local/order/rosti-tuscan-kitchen-calabasas-23663-calabasas-road"
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
  { menuGroupGuid: "1bff7e0e-b778-4e2c-94fd-e514d1f15456", name: "Seasonal Chef Specials", description: "Roasted butternut squash soup\n\n*Dairy free, Gluten free, Vegan", imageUrls: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=60"], metadata: { category: "specials", featured: true } },
  { menuGroupGuid: "af2f2e30-b779-4c73-b3e9-63803a8f646f", name: "Appetizers", description: "Toasted Garlic Cibatta Crisps  Topped With Melted Fresh Mozzarella Cheese And Sun-Dried Tomatoes", imageUrls: ["https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60"], metadata: { category: "appetizers", featured: false } },
  { menuGroupGuid: "25acf481-79f9-4fe8-be2d-feffe3a8b31c", name: "Calzone", description: "Grilled Steak, Roasted Peppers, Caramelized Onions, Smoked Mozzarella", imageUrls: ["https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=800&auto=format&fit=crop&q=60"], metadata: { category: "calzone", featured: true } },
];

export const DEMO_MENU_ITEMS = [
  { menuItemGuid: "57bb8c12-fa5c-435d-a22a-7020a962664e", menuGroupGuid: "1bff7e0e-b778-4e2c-94fd-e514d1f15456", name: "Roasted Butternut Squash Soup", description: "Roasted butternut squash soup\n\n*Dairy free, Gluten free, Vegan", price: "12.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/74rRoh-Xa2fuEg0S1nOXFGho1jJZvqcsQIdKYTUOIO8/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/7/item-100000013117007337_1730401285.jpg"], allergens: ['Gluten'], sortOrder: 0, modifierGroupsReferences: ["a1b2c3d4-e5f6-7890-1234-567890abcdef"], metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "d6fc0e41-4d8b-4304-98a4-9b6f794d218d", menuGroupGuid: "1bff7e0e-b778-4e2c-94fd-e514d1f15456", name: "Smoked Salmon Bruschetta", description: "with ricotta, fennel and a drizzle of honey", price: "18.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/JpVqyfdWPRKdP8lLjJst4V87xXfCyvht0ogvCqDnqMo/resize:fit:720:720/plain/s3://toasttab/menu_service/restaurants/6d44d2c3-36bf-421d-83b7-d7559277718d/MenuItem/1b288721-1cb3-4aaf-a33e-f958c4152945.png"], allergens: [], sortOrder: 1, modifierGroupsReferences: [], metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "2cb5ee80-efb5-4a20-964f-ac5b64c7ea1d", menuGroupGuid: "1bff7e0e-b778-4e2c-94fd-e514d1f15456", name: "Roasted Butternut Squash Flatbread", description: "Topped with caramelized roasted butternut squash, creamy goat cheese \nand a drizzle of balsamic glaze", price: "19.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/iEwUluRAACaYMdh8AaLOqKAQ85eIPrpylo4F9gw7co8/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/3/item-100000006165875703_1606344988.jpg"], allergens: [], sortOrder: 2, modifierGroupsReferences: [], metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "f33399bd-3583-49ec-82c7-b39115b7bbd7", menuGroupGuid: "af2f2e30-b779-4c73-b3e9-63803a8f646f", name: "Bruschetta Mozzarella", description: "Toasted Garlic Cibatta Crisps  Topped With Melted Fresh Mozzarella Cheese And Sun-Dried Tomatoes", price: "17.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/Nm_16HOjnnM4ek5g5a2h15kaCjWkSS3FQO98JM2lL9E/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/0/item-100000006165875470_1606343769.jpg"], allergens: [], sortOrder: 0, modifierGroupsReferences: [], metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "258217a3-fb0a-4128-ba5c-2a572e339c44", menuGroupGuid: "af2f2e30-b779-4c73-b3e9-63803a8f646f", name: "Bruschetta Pomodoro", description: "Toasted Garlic Cibatta Crisps Served With Fresh Tomato Checca", price: "14.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/MdNfj73bLGrf2GHzBGdHhDTLOg34iiZD0M_VqYwuAEw/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/8/item-100000006165875468_1607575977.jpg"], allergens: [], sortOrder: 1, modifierGroupsReferences: [], metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "f5176d89-2b19-4e1b-93e2-2cb90904eea0", menuGroupGuid: "af2f2e30-b779-4c73-b3e9-63803a8f646f", name: "Caprese Salad", description: "Fresh Mozzarella, Tomato & Fresh Basil. Drizzled with Italian Extra Virgin Olive Oil", price: "17.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/qU_4cvADCbjgh02mvoeg-RcELXOiWpbUi-l1PN4nq_I/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/2/item-100000006165875452_1606343578.jpg"], allergens: [], sortOrder: 2, modifierGroupsReferences: [], metadata: { currency: "USD", hasModifiers: false } },
  { menuItemGuid: "d33481bb-1e36-4fd0-86ce-58d621166865", menuGroupGuid: "25acf481-79f9-4fe8-be2d-feffe3a8b31c", name: "The Steak Bomb Calzone", description: "Grilled Steak, Roasted Peppers, Caramelized Onions, Smoked Mozzarella", price: "25.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/SUbyrpTzsH9HZbNcegbtqWOS9qMQfHzFVBCIF637xis/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/2/item-100000006165875652_1606348223.jpg"], allergens: [], sortOrder: 0, modifierGroupsReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabca", "a1a2b3c4-d5e6-7890-1234-567890abcdea"], metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "32ab2b9a-c251-4b2c-a874-42d5c20589ef", menuGroupGuid: "25acf481-79f9-4fe8-be2d-feffe3a8b31c", name: "Chicken and Pepper Calzone", description: "Chicken and Pepper Calzone with Ricotta Cheese", price: "24.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/k35f9YVERiDoA64rHh8irmfSNRx-4SeJI6ojA0uesDE/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/4/item-100000006165875654_1607576104.jpg"], allergens: [], sortOrder: 1, modifierGroupsReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcb", "a1a2b3c4-d5e6-7890-1234-567890abcdeb"], metadata: { currency: "USD", hasModifiers: true } },
  { menuItemGuid: "e2d58955-dad6-4eb1-b11f-02c03c6b8dcf", menuGroupGuid: "25acf481-79f9-4fe8-be2d-feffe3a8b31c", name: "Sausage and Spinach Calzone", description: "Sausage and Spinach Calzone with Ricotta Cheese", price: "23.00", calories: 0, imageUrls: ["https://d1w7312wesee68.cloudfront.net/oGVgBcowFT0g33pNUCSA2-YMYplJxv-3pku6ZAaOlTw/resize:fit:720:720/plain/s3://toasttab/restaurants/restaurant-61653000000000000/menu/items/3/item-100000006165875133_1606347008.jpg"], allergens: [], sortOrder: 2, modifierGroupsReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcd", "a1a2b3c4-d5e6-7890-1234-567890abcdef"], metadata: { currency: "USD", hasModifiers: true } },
];

export const DEMO_MODIFIER_GROUPS = [
  { modifierGroupGuid: "a1b2c3d4-e5f6-7890-1234-567890abcdef", name: "Size", description: "Choose your size", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["b2c3d4e5-f6a7-8901-2345-678901abcdef", "c3d4e5f6-a7b8-9012-3456-789012abcdef", "d4e5f6a7-b8c9-0123-4567-890123abcdef"], metadata: { category: "size" } },
  
  { modifierGroupGuid: "e5f6a7b8-c9d0-1234-5678-901234efabca", name: "Toppings", description: "Add extra toppings to your calzone", minSelections: 0, maxSelections: 5, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["f6a7b8c9-d0e1-2345-6789-012345abcdef", "a7a8b9c0-d1e2-3456-7890-123456abcdef", "b8a9b0c1-d2e3-4567-8901-234567abcdef", "c9a0b1c2-d3e4-5678-9012-345678abcdef", "d0a1b2c3-d4e5-6789-0123-456789abcdef"], metadata: { category: "toppings" } },
  { modifierGroupGuid: "a1a2b3c4-d5e6-7890-1234-567890abcdea", name: "Sauce Options", description: "Select up to 1 sauce", minSelections: 0, maxSelections: 1, isRequired: false, isMultiSelect: false, modifierOptionsReferences: ["e2a3b4c5-d6e7-8901-2345-678901abcdef", "f3a4b5c6-d7e8-9012-3456-789012abcdef", "a4a5b6c7-d8e9-0123-4567-890123abcdef"], metadata: { category: "sauce" } },

  { modifierGroupGuid: "e5f6a7b8-c9d0-1234-5678-901234efabcb", name: "Toppings", description: "Add extra toppings to your calzone", minSelections: 0, maxSelections: 5, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["f6a7b8c9-d0e1-2345-6789-012345abcdee", "a7a8b9c0-d1e2-3456-7890-123456abcdee", "b8a9b0c1-d2e3-4567-8901-234567abcdee", "c9a0b1c2-d3e4-5678-9012-345678abcdee", "d0a1b2c3-d4e5-6789-0123-456789abcdee"], metadata: { category: "toppings" } },
  { modifierGroupGuid: "a1a2b3c4-d5e6-7890-1234-567890abcdeb", name: "Sauce Options", description: "Select up to 1 sauce", minSelections: 0, maxSelections: 1, isRequired: false, isMultiSelect: false, modifierOptionsReferences: ["e2a3b4c5-d6e7-8901-2345-678901abcdee", "f3a4b5c6-d7e8-9012-3456-789012abcdee", "a4a5b6c7-d8e9-0123-4567-890123abcdee"], metadata: { category: "sauce" } },

  { modifierGroupGuid: "e5f6a7b8-c9d0-1234-5678-901234efabcd", name: "Toppings", description: "Add extra toppings to your calzone", minSelections: 0, maxSelections: 5, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["f6a7b8c9-d0e1-2345-6789-012345abcded", "a7a8b9c0-d1e2-3456-7890-123456abcded", "b8a9b0c1-d2e3-4567-8901-234567abcded", "c9a0b1c2-d3e4-5678-9012-345678abcded", "d0a1b2c3-d4e5-6789-0123-456789abcded"], metadata: { category: "toppings" } },
  { modifierGroupGuid: "a1a2b3c4-d5e6-7890-1234-567890abcdef", name: "Sauce Options", description: "Select up to 1 sauce", minSelections: 0, maxSelections: 1, isRequired: false, isMultiSelect: false, modifierOptionsReferences: ["e2a3b4c5-d6e7-8901-2345-678901abcded", "f3a4b5c6-d7e8-9012-3456-789012abcded", "a4a5b6c7-d8e9-0123-4567-890123abcded"], metadata: { category: "sauce" } },
];

export const DEMO_MODIFIER_OPTIONS = [
  { modifierOptionGuid: "b2c3d4e5-f6a7-8901-2345-678901abcdef", name: "Cup", description: "Regular cup size", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["a1b2c3d4-e5f6-7890-1234-567890abcdef"] },
  { modifierOptionGuid: "c3d4e5f6-a7b8-9012-3456-789012abcdef", name: "Bowl", description: "Large bowl size", price: "2.00", calories: 0, isDefault: false, modifierGroupReferences: ["a1b2c3d4-e5f6-7890-1234-567890abcdef"] },
  { modifierOptionGuid: "d4e5f6a7-b8c9-0123-4567-890123abcdef", name: "Quart", description: "Family size quart", price: "9.00", calories: 0, isDefault: false, modifierGroupReferences: ["a1b2c3d4-e5f6-7890-1234-567890abcdef"] },
  
  { modifierOptionGuid: "f6a7b8c9-d0e1-2345-6789-012345abcdef", name: "Arugula", description: "Fresh arugula leaves", price: "2.00", calories: 10, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabca"] },
  { modifierOptionGuid: "a7a8b9c0-d1e2-3456-7890-123456abcdef", name: "Pepperoni", description: "Spicy pepperoni slices", price: "2.00", calories: 50, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabca"] },
  { modifierOptionGuid: "b8a9b0c1-d2e3-4567-8901-234567abcdef", name: "Italian Sausage", description: "Seasoned Italian sausage", price: "2.00", calories: 80, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabca"] },
  { modifierOptionGuid: "c9a0b1c2-d3e4-5678-9012-345678abcdef", name: "Onions", description: "Caramelized onions", price: "2.00", calories: 15, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabca"] },
  { modifierOptionGuid: "d0a1b2c3-d4e5-6789-0123-456789abcdef", name: "Black Olives", description: "Sliced black olives", price: "2.00", calories: 20, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabca"] },
  
  { modifierOptionGuid: "e2a3b4c5-d6e7-8901-2345-678901abcdef", name: "Pomodoro Sauce", description: "Classic tomato sauce", price: "0.00", calories: 10, isDefault: true, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdea"] },
  { modifierOptionGuid: "f3a4b5c6-d7e8-9012-3456-789012abcdef", name: "Marinara Sauce", description: "Traditional marinara", price: "0.00", calories: 15, isDefault: false, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdea"] },
  { modifierOptionGuid: "a4a5b6c7-d8e9-0123-4567-890123abcdef", name: "Pesto Sauce", description: "Basil pesto sauce", price: "2.00", calories: 25, isDefault: false, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdea"] },

  { modifierOptionGuid: "f6a7b8c9-d0e1-2345-6789-012345abcdee", name: "Arugula", description: "Fresh arugula leaves", price: "2.00", calories: 10, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcb"] },
  { modifierOptionGuid: "a7a8b9c0-d1e2-3456-7890-123456abcdee", name: "Pepperoni", description: "Spicy pepperoni slices", price: "2.00", calories: 50, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcb"] },
  { modifierOptionGuid: "b8a9b0c1-d2e3-4567-8901-234567abcdee", name: "Italian Sausage", description: "Seasoned Italian sausage", price: "2.00", calories: 80, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcb"] },
  { modifierOptionGuid: "c9a0b1c2-d3e4-5678-9012-345678abcdee", name: "Onions", description: "Caramelized onions", price: "2.00", calories: 15, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcb"] },
  { modifierOptionGuid: "d0a1b2c3-d4e5-6789-0123-456789abcdee", name: "Black Olives", description: "Sliced black olives", price: "2.00", calories: 20, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcb"] },
  
  { modifierOptionGuid: "e2a3b4c5-d6e7-8901-2345-678901abcdee", name: "Pomodoro Sauce", description: "Classic tomato sauce", price: "0.00", calories: 10, isDefault: true, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdeb"] },
  { modifierOptionGuid: "f3a4b5c6-d7e8-9012-3456-789012abcdee", name: "Marinara Sauce", description: "Traditional marinara", price: "0.00", calories: 15, isDefault: false, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdeb"] },
  { modifierOptionGuid: "a4a5b6c7-d8e9-0123-4567-890123abcdee", name: "Pesto Sauce", description: "Basil pesto sauce", price: "2.00", calories: 25, isDefault: false, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdeb"] },

  { modifierOptionGuid: "f6a7b8c9-d0e1-2345-6789-012345abcded", name: "Arugula", description: "Fresh arugula leaves", price: "2.00", calories: 10, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcd"] },
  { modifierOptionGuid: "a7a8b9c0-d1e2-3456-7890-123456abcded", name: "Pepperoni", description: "Spicy pepperoni slices", price: "2.00", calories: 50, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcd"] },
  { modifierOptionGuid: "b8a9b0c1-d2e3-4567-8901-234567abcded", name: "Italian Sausage", description: "Seasoned Italian sausage", price: "2.00", calories: 80, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcd"] },
  { modifierOptionGuid: "c9a0b1c2-d3e4-5678-9012-345678abcded", name: "Onions", description: "Caramelized onions", price: "2.00", calories: 15, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcd"] },
  { modifierOptionGuid: "d0a1b2c3-d4e5-6789-0123-456789abcded", name: "Black Olives", description: "Sliced black olives", price: "2.00", calories: 20, isDefault: false, modifierGroupReferences: ["e5f6a7b8-c9d0-1234-5678-901234efabcd"] },
  
  { modifierOptionGuid: "e2a3b4c5-d6e7-8901-2345-678901abcded", name: "Pomodoro Sauce", description: "Classic tomato sauce", price: "0.00", calories: 10, isDefault: true, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdef"] },
  { modifierOptionGuid: "f3a4b5c6-d7e8-9012-3456-789012abcded", name: "Marinara Sauce", description: "Traditional marinara", price: "0.00", calories: 15, isDefault: false, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdef"] },
  { modifierOptionGuid: "a4a5b6c7-d8e9-0123-4567-890123abcded", name: "Pesto Sauce", description: "Basil pesto sauce", price: "2.00", calories: 25, isDefault: false, modifierGroupReferences: ["a1a2b3c4-d5e6-7890-1234-567890abcdef"] },

];

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
  await db.execute(sql.raw(`DELETE FROM ${tableName}`));

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
    "qr_codes",           // Depends on hotels
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
    INSERT INTO menus (restaurant_id, menu_guid, name, description, metadata, created_at, updated_at)
    VALUES (${restaurantId}, ${menuData.menuGuid}, ${menuData.name}, ${menuData.description}, ${JSON.stringify(menuData.metadata)}, NOW(), NOW())
    RETURNING id
  `);
  const menuId = insertedMenu.rows[0].id;
  console.log(`Inserted menu with ID: ${menuId}`);

  // Insert menu groups
  const insertedMenuGroups = [];
  for (const group of menuGroups) {
    const imageUrlsArray = `{${group.imageUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const result = await db.execute(sql`
      INSERT INTO menu_groups (menu_id, menu_group_guid, name, image_urls, description, metadata, created_at, updated_at)
      VALUES (${menuId}, ${group.menuGroupGuid}, ${group.name}, ${imageUrlsArray}::text[], ${group.description}, ${JSON.stringify(group.metadata)}, NOW(), NOW())
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
      INSERT INTO menu_items (menu_group_id, menu_item_guid, name, description, price, calories, image_urls, allergens, modifier_groups_references, sort_order, metadata, created_at, updated_at)
      VALUES (${menuGroupId}, ${itemWithoutRefs.menuItemGuid}, ${itemWithoutRefs.name}, ${itemWithoutRefs.description}, ${itemWithoutRefs.price}, ${itemWithoutRefs.calories}, ${imageUrlsArray}::text[], ${allergensArray}::text[], ARRAY[]::integer[], ${itemWithoutRefs.sortOrder}, ${JSON.stringify(itemWithoutRefs.metadata)}, NOW(), NOW())
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
    item.modifierGroupsReferences.forEach(modifierGroupGuid => {
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
      INSERT INTO modifier_groups (menu_item_id, modifier_group_guid, name, description, min_selections, max_selections, is_required, is_multi_select, metadata, created_at, updated_at)
      VALUES (${menuItemId}, ${groupWithoutRefs.modifierGroupGuid}, ${groupWithoutRefs.name}, ${groupWithoutRefs.description}, ${groupWithoutRefs.minSelections}, ${groupWithoutRefs.maxSelections}, ${groupWithoutRefs.isRequired}, ${groupWithoutRefs.isMultiSelect}, ${JSON.stringify(groupWithoutRefs.metadata)}, NOW(), NOW())
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
      .map(guid => modifierGroupIdMap.get(guid))
      .filter(id => id !== undefined) as number[];

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
    group.modifierOptionsReferences.forEach(modifierOptionGuid => {
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
      INSERT INTO modifier_options (modifier_group_id, modifier_option_guid, name, description, price, calories, is_default, metadata, created_at, updated_at)
      VALUES (${modifierGroupId}, ${optionWithoutRefs.modifierOptionGuid}, ${optionWithoutRefs.name}, ${optionWithoutRefs.description}, ${optionWithoutRefs.price}, ${optionWithoutRefs.calories}, ${optionWithoutRefs.isDefault}, '{}', NOW(), NOW())
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
  for (let amenity of DEMO_AMENITIES) {
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
    INSERT INTO hotels (name, address, latitude, longitude, metadata, created_at, updated_at)
    VALUES (${DEMO_HOTEL.name}, ${DEMO_HOTEL.address}, ${DEMO_HOTEL.latitude}, ${DEMO_HOTEL.longitude}, ${JSON.stringify(DEMO_HOTEL.metadata)}, NOW(), NOW())
    RETURNING id
  `);
  const hotelId = insertedHotel.rows[0].id;
  console.log(`Inserted hotel with ID: ${hotelId}`);

  // Insert QR code using direct SQL
  const insertedQrCode = await db.execute(sql`
    INSERT INTO qr_codes (hotel_id, code, expires_at, created_at, updated_at)
    VALUES (${hotelId}, ${DEMO_QR_CODE.code}, ${DEMO_QR_CODE.expiresAt}, NOW(), NOW())
    RETURNING id
  `);
  const qrCodeId = insertedQrCode.rows[0].id;
  console.log(`Inserted QR code with ID: ${qrCodeId}`);

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
        city, state, zip_code, country, phone_number, metadata, created_at, updated_at
      )
      VALUES (
        ${hotelId}, ${restaurant.restaurantGuid}, ${restaurant.name},
        ${restaurant.description}, ${restaurant.cuisine},
        ${imageUrlsArray}::text[],   
        ${restaurant.rating},
        ${restaurant.addressLine1}, '', ${restaurant.city}, ${restaurant.state},
        ${restaurant.zipCode}, ${restaurant.country}, ${restaurant.phoneNumber},
        ${JSON.stringify(restaurant.metadata)}::jsonb,
        NOW(), NOW()
      )
      RETURNING id
    `);

    const restaurantId = restaurantResult.rows[0].id as number;
    console.log(`Inserted restaurant with ID: ${restaurantId}`);

    // Insert menu for this restaurant
    await insertedMenu(
      restaurantId,
      DEMO_MENU,
      DEMO_MENU_GROUPS,
      DEMO_MENU_ITEMS,
      DEMO_MODIFIER_GROUPS,
      DEMO_MODIFIER_OPTIONS
    );
  }

  console.log(`- Hotel: ${hotelId}`);
  console.log(`- QR Code: ${qrCodeId}`);
  console.log(`- Amenities: ${DEMO_AMENITIES.length}`);
  console.log(`- Restaurants: ${DEMO_RESTAURANTS.length}`);
  console.log("Comprehensive seed completed successfully!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
