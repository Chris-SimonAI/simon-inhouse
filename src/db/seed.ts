import { hotels } from "@/db/schemas/hotels";
import { amenities } from "@/db/schemas/amenities";
import { drizzle } from "drizzle-orm/node-postgres";
import "dotenv/config";

export const db = drizzle({
    connection: process.env.DATABASE_URL as string,
});


const DEMO_HOTEL = {
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
    },
    parking_fee: {
      amount: 15,
      currency: "USD",
      notes: "Per night",
    },
    wifi: {
      available: true,
      description: "Complimentary Wi-Fi throughout hotel",
    },
  },
};

const DEMO_AMENITIES = [
  {
    name: "Standard King Room",
    description: "Standard King Room (~400 ft²), 1 King Bed",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637251/riuerab7aiggthbggjjg.jpg",
    ],
    tags: ["room", "king"],
    metadata: { price: 200, currency: "USD", beds: "1 King" },
  },
  {
    name: "Standard Two Queen Room",
    description: "Standard Two Queen Room (~400 ft²), 2 Queen Beds",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637267/ur1mizfg3xy58vjlrjjb.jpg",
    ],
    tags: ["room", "queen"],
    metadata: { price: 220, currency: "USD", beds: "2 Queens" },
  },
  {
    name: "Premium King Room",
    description: "Premium King Room (~400 ft²), 1 King Bed",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637073/ywio18nhbrzhj3d1vy90.jpg",
    ],
    tags: ["room", "king", "premium"],
    metadata: { price: 240, currency: "USD", beds: "1 King" },
  },
  {
    name: "Graze Bistro",
    description:
      "On-site dining, breakfast available 7:00 am - 11:00 am on select weekends (summer/high season)",
    imageUrls: [
      "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/1d/80/39/the-anza-hotel.jpg?w=2000&h=-1&s=1",
    ],
    tags: ["dining", "restaurant"],
    metadata: {},
  },
  {
    name: "Outdoor Heated Pool",
    description: "Heated outdoor pool with cabanas and lounge seating",
    imageUrls: [
      "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/17/34/8a/52/the-anza-hotel.jpg?w=1400&h=-1&s=1",
    ],
    tags: ["pool"],
    metadata: {},
  },
  {
    name: "Fitness Center",
    description: "Fully equipped onsite fitness center",
    imageUrls: [
      "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/1d/7f/da/the-anza-hotel.jpg?w=2000&h=-1&s=1",
    ],
    tags: ["fitness", "gym"],
    metadata: {},
  },
  {
    name: "Business Center",
    description:
      "24/7 business center with marketplace and boarding pass printing kiosk",
    imageUrls: [
      "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/1d/80/85/the-anza-hotel.jpg?w=2000&h=-1&s=1",
    ],
    tags: ["business"],
    metadata: { hours: "24/7" },
  },
  {
    name: "Flexible Meeting Space",
    description: "Meeting space for up to 30 guests with AV setup",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637519/zzvkkok6rs2xms7xrfki.jpg",
    ],
    tags: ["meeting", "conference"],
    metadata: { capacity: 30 },
  },
  {
    name: "Lobby Library",
    description: "Library/lounge area in lobby with seating",
    imageUrls: [
      "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/470164316.jpg?k=b76efbfbebbf25864a66c3f7521ea4fb9c9c75e9bfcf4278a0a79d5c4b82c8fd&o=&s=1024x",
    ],
    tags: ["entertainment", "library"],
    metadata: {},
  },
  {
    name: "Marketplace",
    description: "Convenience marketplace with snacks and essentials",
    imageUrls: [
      "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/466098561.jpg?k=cd896f2d0c9cce2e76080f3fe2a00e438a9ee614d24aa3eb48a2c9b5652d3400&o=&s=1024x",
    ],
    tags: ["retail", "shop"],
    metadata: {},
  },
  {
    name: "Room Service",
    description: "In-room dining available",
    imageUrls: [
      "https://images.unsplash.com/photo-1641924676093-42e61835bbe2?q=80&w=1742&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    ],
    tags: ["room service", "dining"],
    metadata: { available: true },
  },
  {
    name: "Contactless Robot Delivery",
    description: "Service robot for contactless delivery to rooms",
    imageUrls: [
      "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/470164241.jpg?k=6cb49533afb29c9a901b992ebf0bab95dcc8815fe3cc15835f666f64ba8ed295&o=&s=1024x",
    ],
    tags: ["room service", "robot"],
    metadata: { type: "robotic" },
  },
];

async function main() {
  console.log("Starting seed...");

  // Clear existing
  await db.delete(amenities);
  await db.delete(hotels);

  // Insert hotel
  const insertedHotel = await db.insert(hotels).values(DEMO_HOTEL).returning();
  const hotelId = insertedHotel[0].id;

  // Insert amenities linked to hotel
  const amenitiesToInsert = DEMO_AMENITIES.map((a) => ({
    ...a,
    hotelId,
  }));

  const insertedAmenities = await db.insert(amenities).values(amenitiesToInsert).returning();

  console.log(`Inserted ${insertedAmenities?.length} amenities`);

  console.log("Seed completed successfully!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
