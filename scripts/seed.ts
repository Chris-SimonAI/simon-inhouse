import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import "dotenv/config";
import { type ClientConfig } from "pg";
import fs from "fs";

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
  }
];


export const DEMO_RESTAURANTS = [{ name: "Main Street Cafe", restaurantGuid: "78fb2c86-22ae-4468-9689-1a46c95360c6", addressLine1: "123 Main Street", cuisine: "American", rating: "4.5", imageUrls: ["https://s3-media0.fl.yelpcdn.com/bphoto/tE86IN4rFHilPn37wiOWFA/l.jpg"], description: "Elevating the classic cheeseburger with **New Zealand, grass-fed wagyu beef** and artisanal ingredients. This isn't your average burger — each component is separately packed to maintain restaurant quality and expertly packaged for delivery.\n\n\n\n### Must-Try\n* **HiHo Double:** Two crispy-edged wagyu patties, house onion jam, premium cheese  \n* **Hand-cut twice-fried fries** (packed separately)  \n\n\n\n### Delivery Details\n* **Delivery time:** 30–35 minutes  \n* **Availability:** Daily, 11:30am – 9pm  \n\n\n\n### The Deal\nUpscale ingredients meet accessible pricing – perfect for food enthusiasts who want **premium quality without the pretense**.", phoneNumber: "+1-555-0123", metadata: {}, city: "San Francisco", state: "CA", zipCode: "94102", country: "USA" }];
export const DEMO_MENU = { menuGuid: "b7962d75-3194-4526-8b98-7c591c07460e", name: "Main Street Cafe Menu", description: "Fresh, locally-sourced ingredients crafted into delicious meals", imageUrls: ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=60"], lastUpdated: new Date(), metadata: { version: "1.0", lastUpdated: new Date().toISOString() } };
export const DEMO_MENU_GROUPS = [
  { menuGroupGuid: "d92871f2-5576-4127-9313-7321337d3906", name: "Burgers", description: "Freshly grilled burgers made with premium ingredients", imageUrls: ["https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60"], metadata: { category: "main", featured: true } },
  { menuGroupGuid: "73799739-fd24-4bc0-bf6b-860ab6cc078a", name: "Appetizers", description: "Start your meal right with these delicious appetizers", imageUrls: ["https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60"], metadata: { category: "starter", featured: false } },
  { menuGroupGuid: "80838a0b-b7af-4859-a1b6-99571d1c95e8", name: "Beverages", description: "Refresh yourself with our drink selection", imageUrls: ["https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60"], metadata: { category: "drink", featured: false } },
];
export const DEMO_MENU_ITEMS = [
  { menuItemGuid: "462b7387-cabf-42be-92ea-65ce7f5c04ff", menuGroupGuid: "d92871f2-5576-4127-9313-7321337d3906", name: "Classic Cheeseburger", description: "Juicy beef patty with cheddar cheese, lettuce, tomato, and our signature sauce", price: "8.99", calories: 650, imageUrls: ['https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=60'], allergens: ['Dairy', 'Gluten'], sortOrder: 1, modifierGroupsReferences: ["1a443ac3-2ebf-4799-b23d-256989c97127", "51e49ea0-d1ed-4d3b-8953-cdc043ef5ccf"], metadata: { popular: true, spicy: false } },
  { menuItemGuid: "2c1bdb17-7186-4482-82c8-02127b45c0e8", menuGroupGuid: "d92871f2-5576-4127-9313-7321337d3906", name: "BBQ Burger", description: "Smoky BBQ sauce, onion rings, and pepper jack cheese", price: "10.99", calories: 720, imageUrls: ['https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=800&auto=format&fit=crop&q=60'], allergens: ['Dairy', 'Gluten'], sortOrder: 2, modifierGroupsReferences: ["f37c5a1c-1539-4283-8edf-0857e8aafbdb"], metadata: { popular: true, spicy: true } },
  { menuItemGuid: "583e0da6-eccf-4bed-947c-9ff613a7a661", menuGroupGuid: "d92871f2-5576-4127-9313-7321337d3906", name: "Veggie Burger", description: "Grilled plant-based patty with lettuce, tomato, and vegan aioli", price: "9.49", calories: 580, imageUrls: ['https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=2072&auto=format&fit=crop'], allergens: ['Gluten'], sortOrder: 3, modifierGroupsReferences: ["e9c1d7d5-d56b-4332-b701-c8cf0b9b34df"], metadata: { popular: false, spicy: false, vegetarian: true } },
  { menuItemGuid: "94804ccd-a4c9-44e5-8ff6-937769feb92e", menuGroupGuid: "d92871f2-5576-4127-9313-7321337d3906", name: "Bacon Double Burger", description: "Two beef patties, cheddar, bacon, and special sauce", price: "12.99", calories: 950, imageUrls: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60'], allergens: ['Dairy', 'Gluten'], sortOrder: 4, modifierGroupsReferences: ["2b7948fc-ce15-49f7-be53-5b848ad63e49", "f59fe2ab-bfff-46cc-8e63-cea6d28ecc59"], metadata: { popular: true, spicy: false } },
  { menuItemGuid: "d1a52dcd-70a3-4716-9a18-92a61d4759bd", menuGroupGuid: "73799739-fd24-4bc0-bf6b-860ab6cc078a", name: "Loaded Nachos", description: "Crispy tortilla chips topped with cheese, jalapeños, and sour cream", price: "7.99", calories: 850, imageUrls: ['https://images.unsplash.com/photo-1582169296194-e4d644c48063?q=80&w=1600&auto=format&fit=crop'], allergens: ['Dairy'], sortOrder: 1, modifierGroupsReferences: ["f12a43fe-eb3f-4bbb-b08a-c62efead7c45"], metadata: { popular: true, spicy: true } },
  { menuItemGuid: "33c7e8d5-2c6c-420e-9b67-44826b52d0d5", menuGroupGuid: "73799739-fd24-4bc0-bf6b-860ab6cc078a", name: "Mozzarella Sticks", description: "Golden fried mozzarella served with marinara sauce", price: "6.99", calories: 620, imageUrls: ['https://images.unsplash.com/photo-1734774924912-dcbb467f8599?q=80&w=2070&auto=format&fit=crop'], allergens: ['Dairy', 'Gluten'], sortOrder: 2, modifierGroupsReferences: ["ff111aee-43a9-44c7-8643-cca3bb64694f"], metadata: { popular: false, spicy: false } },
  { menuItemGuid: "e0449746-c3c4-406c-99ab-ec70cbe4a039", menuGroupGuid: "73799739-fd24-4bc0-bf6b-860ab6cc078a", name: "Buffalo Wings", description: "Spicy buffalo wings served with blue cheese dip", price: "9.99", calories: 780, imageUrls: ['https://images.unsplash.com/photo-1608039755401-742074f0548d?q=80&w=1035&auto=format&fit=crop'], allergens: ['Dairy'], sortOrder: 3, modifierGroupsReferences: ["66aace4a-d504-4e33-ac4f-3a46c65d4d49", "982538ea-60c6-4b21-ac27-9529404f102a"], metadata: { popular: true, spicy: true } },
  { menuItemGuid: "eef2c4f7-5ce8-46c9-bfec-3f0386e5897a", menuGroupGuid: "80838a0b-b7af-4859-a1b6-99571d1c95e8", name: "Fresh Lemonade", description: "Made fresh daily with real lemons", price: "3.99", calories: 120, imageUrls: ['https://images.unsplash.com/photo-1507281549113-040fcfef650e?q=80&w=2070&auto=format&fit=crop'], allergens: [], sortOrder: 1, modifierGroupsReferences: ["57846b82-f73c-4ea6-9770-67934410f835"], metadata: { popular: true, spicy: false } },
  { menuItemGuid: "17fa48b8-19df-43f2-b8cf-fc7885f67161", menuGroupGuid: "80838a0b-b7af-4859-a1b6-99571d1c95e8", name: "Iced Coffee", description: "Chilled brewed coffee with ice, milk optional", price: "4.49", calories: 90, imageUrls: ['https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?q=80&w=987&auto=format&fit=crop'], allergens: ['Dairy'], sortOrder: 2, modifierGroupsReferences: ["18f05a2f-6877-4270-8617-565bc8415909", "453f0843-5937-4f85-887c-54f07abd99c6"], metadata: { popular: false, spicy: false } },
  { menuItemGuid: "18377557-8218-45b1-996a-0c0f9e9a2144", menuGroupGuid: "80838a0b-b7af-4859-a1b6-99571d1c95e8", name: "Sparkling Water", description: "Refreshing carbonated water with a hint of lime", price: "2.49", calories: 0, imageUrls: ['https://images.unsplash.com/photo-1613424168901-b69f533bfb11?q=80&w=2070&auto=format&fit=crop'], allergens: [], sortOrder: 3, modifierGroupsReferences: ["02bae306-b30e-4130-9dfa-366a285cb8a2"], metadata: { popular: false, spicy: false } },
];
export const DEMO_MODIFIER_GROUPS = [
  { modifierGroupGuid: "1a443ac3-2ebf-4799-b23d-256989c97127", name: "Cheese Options", description: "Choose your cheese", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["028a1daa-2513-41ce-a28f-6ac185dd41c0", "d149d3d6-bea7-44bd-85b8-21b583b966b8", "b588b159-6dbc-465c-87a3-d1f870e425c6"], metadata: { category: "cheeseOptions" } },
  { modifierGroupGuid: "51e49ea0-d1ed-4d3b-8953-cdc043ef5ccf", name: "Toppings", description: "Customize your burger", minSelections: 0, maxSelections: 5, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["38ce88f6-3353-4cc5-b814-410338b06471", "2696d454-e005-46a8-9453-c958797645ab", "c360f568-efd9-4e2d-b463-36c3232a1ae4", "c3970b4e-923a-4e91-8fa3-db43355f8888"], metadata: { category: "toppings" } },
  { modifierGroupGuid: "f37c5a1c-1539-4283-8edf-0857e8aafbdb", name: "Spice Level", description: "How spicy do you want it?", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["8efb69ae-074e-4dd6-996d-534749e255f2", "51782b65-fec7-4f65-a585-e6c9b2b12b9d", "fcf3b226-360f-4110-b27c-831c522a4c0d"], metadata: { category: "spiceLevel" } },
  { modifierGroupGuid: "e9c1d7d5-d56b-4332-b701-c8cf0b9b34df", name: "Cheese Options", description: "Choose a vegan cheese option", minSelections: 0, maxSelections: 1, isRequired: false, isMultiSelect: false, modifierOptionsReferences: ["50637222-acf0-4dc5-b4c3-dc4cf0d0162d", "3348d7fb-dd3f-463d-b9d4-8a123d20c00c"], metadata: { category: "veganCheese" } },
  { modifierGroupGuid: "2b7948fc-ce15-49f7-be53-5b848ad63e49", name: "Extra Patty?", description: "Add another patty", minSelections: 0, maxSelections: 1, isRequired: false, isMultiSelect: false, modifierOptionsReferences: ["803edd33-8a87-46fb-8c1e-3f915623af37"], metadata: { category: "extraPatty" } },
  { modifierGroupGuid: "f59fe2ab-bfff-46cc-8e63-cea6d28ecc59", name: "Bun Options", description: "Choose your bun", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["2f35fb4c-2351-491b-8223-80228afd5154", "5c9991b3-995f-4b50-895d-003609202758"], metadata: { category: "bunOptions" } },
  { modifierGroupGuid: "f12a43fe-eb3f-4bbb-b08a-c62efead7c45", name: "Add Protein", description: "Make it a meal", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["a39d3fc3-663e-4af5-9232-95483a98a730", "03853d3a-1880-4750-91ff-6c1a83fcf218"], metadata: { category: "addProtein" } },
  { modifierGroupGuid: "ff111aee-43a9-44c7-8643-cca3bb64694f", name: "Extra Dip", description: "Choose additional dipping sauce", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["6a490520-8ad1-402f-93c6-a508ccf345c3", "d5df5fec-5bf0-4b4c-af15-2b00a7dc4ab5"], metadata: { category: "extraDip" } },
  { modifierGroupGuid: "66aace4a-d504-4e33-ac4f-3a46c65d4d49", name: "Wing Sauce", description: "Select your wing sauce", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["8fd6782d-8412-4058-9aa4-6790ac66fda3", "9d804cec-f05c-420e-821b-84fb06bc308f", "c9f17142-74c6-4627-93c2-cb169f02019b"], metadata: { category: "wingSauce" } },
  { modifierGroupGuid: "982538ea-60c6-4b21-ac27-9529404f102a", name: "Ranch or Blue Cheese", description: "Pick your dipping sauce", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["b1356df1-388a-4e76-a6f9-4ee3b71b515a", "a9df3482-9bd3-4fff-b682-567451b604b8"], metadata: { category: "ranchOrBlueCheese" } },
  { modifierGroupGuid: "57846b82-f73c-4ea6-9770-67934410f835", name: "Size", description: "Choose your size", minSelections: 1, maxSelections: 1, isRequired: true, isMultiSelect: false, modifierOptionsReferences: ["af670aea-0e4a-4d97-9120-774d587f3207", "13aa6f2d-45b6-4f63-80ac-7bfca3db8773", "f61806cb-10e1-4f20-b61a-07b941a1f1d0"], metadata: { category: "size" } },
  { modifierGroupGuid: "18f05a2f-6877-4270-8617-565bc8415909", name: "Milk Options", description: "Choose your milk", minSelections: 0, maxSelections: 1, isRequired: false, isMultiSelect: false, modifierOptionsReferences: ["ff35e089-6ccd-4749-a9e3-03ac0a172f4a", "5ae110ff-8225-40f3-b8a7-cda8e2b9560c", "19224bfb-df46-4dc9-ab16-b32cfe9a4278"], metadata: { category: "milkOptions" } },
  { modifierGroupGuid: "453f0843-5937-4f85-887c-54f07abd99c6", name: "Sweetener", description: "Add some sweetness", minSelections: 0, maxSelections: 2, isRequired: false, isMultiSelect: true, modifierOptionsReferences: ["25125ddc-cfb1-4b68-a7fe-e84f9789261d", "337d0c51-68c8-4840-843d-fc67ee19e159"], metadata: { category: "sweetener" } },
  { modifierGroupGuid: "02bae306-b30e-4130-9dfa-366a285cb8a2", name: "Flavor Options", description: "Choose your flavor", minSelections: 0, maxSelections: 1, isRequired: false, isMultiSelect: false, modifierOptionsReferences: ["f31c5722-d613-4a92-ac4d-0605ae1af236", "b10c1eaf-5610-4549-ad33-4c046bdbb5c2", "1fd461fa-7da4-4615-bfeb-2001e6d3bec4"], metadata: { category: "flavorOptions" } },
];
export const DEMO_MODIFIER_OPTIONS = [
  { modifierOptionGuid: "028a1daa-2513-41ce-a28f-6ac185dd41c0", name: "Cheddar", description: "Sharp cheddar cheese", price: "1.00", calories: 120, isDefault: true, modifierGroupReferences: ["1a443ac3-2ebf-4799-b23d-256989c97127"] },
  { modifierOptionGuid: "d149d3d6-bea7-44bd-85b8-21b583b966b8", name: "Swiss", description: "Creamy swiss cheese", price: "1.25", calories: 110, isDefault: false, modifierGroupReferences: ["1a443ac3-2ebf-4799-b23d-256989c97127"] },
  { modifierOptionGuid: "b588b159-6dbc-465c-87a3-d1f870e425c6", name: "American", description: "Classic American cheese", price: "0.75", calories: 100, isDefault: false, modifierGroupReferences: ["1a443ac3-2ebf-4799-b23d-256989c97127"] },
  { modifierOptionGuid: "38ce88f6-3353-4cc5-b814-410338b06471", name: "Lettuce", description: "Crisp iceberg lettuce", price: "0.00", calories: 10, isDefault: true, modifierGroupReferences: ["51e49ea0-d1ed-4d3b-8953-cdc043ef5ccf"] },
  { modifierOptionGuid: "2696d454-e005-46a8-9453-c958797645ab", name: "Tomato", description: "Fresh sliced tomato", price: "0.00", calories: 5, isDefault: true, modifierGroupReferences: ["51e49ea0-d1ed-4d3b-8953-cdc043ef5ccf"] },
  { modifierOptionGuid: "c360f568-efd9-4e2d-b463-36c3232a1ae4", name: "Bacon", description: "Crispy bacon strips", price: "2.50", calories: 150, isDefault: false, modifierGroupReferences: ["51e49ea0-d1ed-4d3b-8953-cdc043ef5ccf"] },
  { modifierOptionGuid: "c3970b4e-923a-4e91-8fa3-db43355f8888", name: "Avocado", description: "Fresh sliced avocado", price: "1.50", calories: 80, isDefault: false, modifierGroupReferences: ["51e49ea0-d1ed-4d3b-8953-cdc043ef5ccf"] },
  { modifierOptionGuid: "8efb69ae-074e-4dd6-996d-534749e255f2", name: "Mild", description: "Easy on the heat", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["f37c5a1c-1539-4283-8edf-0857e8aafbdb"] },
  { modifierOptionGuid: "51782b65-fec7-4f65-a585-e6c9b2b12b9d", name: "Medium", description: "Just right", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["f37c5a1c-1539-4283-8edf-0857e8aafbdb"] },
  { modifierOptionGuid: "fcf3b226-360f-4110-b27c-831c522a4c0d", name: "Hot", description: "Bring the heat!", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["f37c5a1c-1539-4283-8edf-0857e8aafbdb"] },
  { modifierOptionGuid: "50637222-acf0-4dc5-b4c3-dc4cf0d0162d", name: "Vegan Cheddar", description: "Plant-based cheddar-style cheese", price: "1.50", calories: 90, isDefault: false, modifierGroupReferences: ["e9c1d7d5-d56b-4332-b701-c8cf0b9b34df"] },
  { modifierOptionGuid: "3348d7fb-dd3f-463d-b9d4-8a123d20c00c", name: "No Cheese", description: "Skip the cheese", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["e9c1d7d5-d56b-4332-b701-c8cf0b9b34df"] },
  { modifierOptionGuid: "803edd33-8a87-46fb-8c1e-3f915623af37", name: "Add Beef Patty", description: "One extra beef patty", price: "3.50", calories: 320, isDefault: false, modifierGroupReferences: ["2b7948fc-ce15-49f7-be53-5b848ad63e49"] },
  { modifierOptionGuid: "2f35fb4c-2351-491b-8223-80228afd5154", name: "Sesame Bun", description: "Classic sesame seed bun", price: "0.00", calories: 150, isDefault: true, modifierGroupReferences: ["f59fe2ab-bfff-46cc-8e63-cea6d28ecc59"] },
  { modifierOptionGuid: "5c9991b3-995f-4b50-895d-003609202758", name: "Gluten-Free Bun", description: "Made with gluten-free ingredients", price: "1.50", calories: 140, isDefault: false, modifierGroupReferences: ["f59fe2ab-bfff-46cc-8e63-cea6d28ecc59"] },
  { modifierOptionGuid: "a39d3fc3-663e-4af5-9232-95483a98a730", name: "Grilled Chicken", description: "Seasoned grilled chicken breast", price: "3.00", calories: 200, isDefault: false, modifierGroupReferences: ["f12a43fe-eb3f-4bbb-b08a-c62efead7c45"] },
  { modifierOptionGuid: "03853d3a-1880-4750-91ff-6c1a83fcf218", name: "Ground Beef", description: "Seasoned ground beef", price: "3.50", calories: 250, isDefault: false, modifierGroupReferences: ["f12a43fe-eb3f-4bbb-b08a-c62efead7c45"] },
  { modifierOptionGuid: "6a490520-8ad1-402f-93c6-a508ccf345c3", name: "Ranch", description: "Creamy ranch dip", price: "0.75", calories: 120, isDefault: false, modifierGroupReferences: ["ff111aee-43a9-44c7-8643-cca3bb64694f"] },
  { modifierOptionGuid: "d5df5fec-5bf0-4b4c-af15-2b00a7dc4ab5", name: "Spicy Marinara", description: "Kick it up a notch", price: "0.75", calories: 100, isDefault: false, modifierGroupReferences: ["ff111aee-43a9-44c7-8643-cca3bb64694f"] },
  { modifierOptionGuid: "8fd6782d-8412-4058-9aa4-6790ac66fda3", name: "Classic Buffalo", description: "Traditional spicy buffalo", price: "0.00", calories: 50, isDefault: true, modifierGroupReferences: ["66aace4a-d504-4e33-ac4f-3a46c65d4d49"] },
  { modifierOptionGuid: "9d804cec-f05c-420e-821b-84fb06bc308f", name: "Honey BBQ", description: "Sweet and smoky BBQ sauce", price: "0.00", calories: 70, isDefault: false, modifierGroupReferences: ["66aace4a-d504-4e33-ac4f-3a46c65d4d49"] },
  { modifierOptionGuid: "c9f17142-74c6-4627-93c2-cb169f02019b", name: "Garlic Parmesan", description: "Savory garlic parmesan coating", price: "0.50", calories: 80, isDefault: false, modifierGroupReferences: ["66aace4a-d504-4e33-ac4f-3a46c65d4d49"] },
  { modifierOptionGuid: "b1356df1-388a-4e76-a6f9-4ee3b71b515a", name: "Ranch", description: "Creamy ranch dressing", price: "0.00", calories: 120, isDefault: false, modifierGroupReferences: ["982538ea-60c6-4b21-ac27-9529404f102a"] },
  { modifierOptionGuid: "a9df3482-9bd3-4fff-b682-567451b604b8", name: "Blue Cheese", description: "Classic blue cheese dip", price: "0.00", calories: 130, isDefault: true, modifierGroupReferences: ["982538ea-60c6-4b21-ac27-9529404f102a"] },
  { modifierOptionGuid: "af670aea-0e4a-4d97-9120-774d587f3207", name: "Small", description: "12 oz", price: "0.00", calories: 0, isDefault: false, modifierGroupReferences: ["57846b82-f73c-4ea6-9770-67934410f835"] },
  { modifierOptionGuid: "13aa6f2d-45b6-4f63-80ac-7bfca3db8773", name: "Medium", description: "16 oz", price: "0.50", calories: 0, isDefault: true, modifierGroupReferences: ["57846b82-f73c-4ea6-9770-67934410f835"] },
  { modifierOptionGuid: "f61806cb-10e1-4f20-b61a-07b941a1f1d0", name: "Large", description: "20 oz", price: "1.00", calories: 0, isDefault: false, modifierGroupReferences: ["57846b82-f73c-4ea6-9770-67934410f835"] },
  { modifierOptionGuid: "ff35e089-6ccd-4749-a9e3-03ac0a172f4a", name: "Whole Milk", description: "Rich dairy milk", price: "0.50", calories: 80, isDefault: false, modifierGroupReferences: ["18f05a2f-6877-4270-8617-565bc8415909"] },
  { modifierOptionGuid: "5ae110ff-8225-40f3-b8a7-cda8e2b9560c", name: "Oat Milk", description: "Creamy oat-based milk", price: "0.75", calories: 60, isDefault: false, modifierGroupReferences: ["18f05a2f-6877-4270-8617-565bc8415909"] },
  { modifierOptionGuid: "19224bfb-df46-4dc9-ab16-b32cfe9a4278", name: "No Milk", description: "Black coffee, just ice", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["18f05a2f-6877-4270-8617-565bc8415909"] },
  { modifierOptionGuid: "25125ddc-cfb1-4b68-a7fe-e84f9789261d", name: "Sugar", description: "Classic sugar", price: "0.00", calories: 30, isDefault: false, modifierGroupReferences: ["453f0843-5937-4f85-887c-54f07abd99c6"] },
  { modifierOptionGuid: "337d0c51-68c8-4840-843d-fc67ee19e159", name: "Vanilla Syrup", description: "Vanilla-flavored syrup", price: "0.50", calories: 40, isDefault: false, modifierGroupReferences: ["453f0843-5937-4f85-887c-54f07abd99c6"] },
  { modifierOptionGuid: "f31c5722-d613-4a92-ac4d-0605ae1af236", name: "Lime", description: "Citrusy and refreshing", price: "0.00", calories: 0, isDefault: true, modifierGroupReferences: ["02bae306-b30e-4130-9dfa-366a285cb8a2"] },
  { modifierOptionGuid: "b10c1eaf-5610-4549-ad33-4c046bdbb5c2", name: "Berry", description: "Mixed berry flavor", price: "0.50", calories: 5, isDefault: false, modifierGroupReferences: ["02bae306-b30e-4130-9dfa-366a285cb8a2"] },
  { modifierOptionGuid: "1fd461fa-7da4-4615-bfeb-2001e6d3bec4", name: "Cucumber Mint", description: "Cool cucumber with fresh mint", price: "0.50", calories: 0, isDefault: false, modifierGroupReferences: ["02bae306-b30e-4130-9dfa-366a285cb8a2"] },
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
    const imageUrlsArray = `{${itemWithoutRefs.imageUrls.map(img => `"${img.replace(/"/g, '\\"')}"`).join(',')}}`;
    const allergensArray = `{${itemWithoutRefs.allergens.map(allergen => `"${allergen.replace(/"/g, '\\"')}"`).join(',')}}`;
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
  for (const amenity of DEMO_AMENITIES) {
    // Convert arrays to PostgreSQL array format
    const imageUrlsArray = `{${amenity.imageUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
    const tagsArray = `{${amenity.tags.map(tag => `"${tag.replace(/"/g, '\\"')}"`).join(',')}}`;

    await db.execute(sql`
      INSERT INTO amenities (hotel_id, name, description, long_description, image_urls, tags, metadata, created_at, updated_at)
      VALUES (${hotelId}, ${amenity.name}, ${amenity.description}, ${amenity.longDescription}, ${imageUrlsArray}::text[], ${tagsArray}::varchar[], ${JSON.stringify(amenity.metadata)}, NOW(), NOW())
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