import { hotels } from "@/db/schemas/hotels";
import { amenities } from "@/db/schemas/amenities";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
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
    }
  },
};

const DEMO_AMENITIES = [
  {
    name: "Outdoor Pool",
    description: "Heated outdoor pool with cabanas and lounge seating.",
    longDescription: "The hotel's fitness center is open 24 hours a day, allowing guests to fit a workout into their schedule at any time.\n\n\n\n**The Setting**  \n\nEquipped with modern cardio and strength-training equipment, including Peloton bikes for cycling enthusiasts. The space is bright, contemporary, and reflects the hotel’s stylish design.\n\n\n\n**The Experience**  \n\nGuests can enjoy a workout at any time of day or night. Whether you prefer cardio, weight training, or cycling, the fitness center provides a convenient and comfortable environment.\n\n\n\n**Good To Know**  \n\n* **Hours:** Open 24 hours daily\n* **Equipment:** Cardio machines, strength-training equipment, and Peloton bikes\n* **Amenities:** Towels and water available nearby\n* **Ideal For:** Business and leisure travelers who want to stay active",
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
    longDescription: "The hotel's fitness center is open 24 hours a day, allowing guests to fit a workout into their schedule at any time.\n\n\n\n### The Setting\n\nEquipped with modern cardio and strength-training equipment, including Peloton bikes for cycling enthusiasts. The space is bright, contemporary, and reflects the hotel’s stylish design.\n\n\n\n### The Experience\n\nStay active on the road with a workout that suits your routine. Whether you prefer cardio, strength training, or cycling, the center provides a comfortable environment for all fitness levels.\n\n\n\n### Good To Know\n\n* **Hours:** Open 24 hours daily\n* **Equipment:** Cardio machines, strength-training equipment, and Peloton bikes\n* **Amenities:** Towels and water provided nearby\n* **Ideal For:** Business and leisure travelers looking to stay active",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1684185771/hy3cieskbf656vpvjh71.jpg",
    ],
    tags: ["fitness", "gym"],
    metadata: {},
  },
  {
    name: "Meeting & Event Space",
    description: "Private meeting room ~800 sq ft; up to 50 guests.",
    longDescription: "The Anza offers a flexible meeting room designed for small to mid-sized gatherings. At approximately 800 square feet, the room can host up to 50 guests depending on setup (theater, classroom, conference, or U-shape). It is equipped with audiovisual support upon request and is ideal for interviews, training sessions, or celebrations. The contemporary design ensures a bright, welcoming environment that aligns with the hotel's modern aesthetic.",
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
    longDescription: "Graze Bistro is the hotel's on-site dining venue, offering a contemporary space for meals and drinks. Breakfast service is available every day, and the menu emphasizes fresh, approachable dishes. The modern setting makes it an inviting spot to start the day.",
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
    longDescription: "High-speed Wi-Fi is available throughout The Anza, ensuring seamless connectivity in guest rooms, public spaces, and meeting areas. Whether guests are streaming, attending video calls, or browsing casually, the network is included at no extra cost. This makes the hotel especially attractive for business travelers and families who rely on reliable internet access.",
    imageUrls: [
      "https://www.pembrokeshirepc.co.uk/images/2022/01/16/this-hotel-has-wi-fi-access.jpg",
    ],
    tags: ["wifi", "internet"],
    metadata: {},
  },
  {
    name: "Parking",
    description: "On-site parking available; $15/night.",
    longDescription: "Guests have access to convenient on-site parking, just steps away from the hotel entrance. The daily rate is $15 per night, making it more affordable than many Los Angeles-area parking locations. Parking is available for both standard vehicles and accessible vehicles, with ADA-designated spots provided. This ensures a hassle-free experience for guests arriving by car.",
    imageUrls: [
      "https://hospitalityrisksolutions.files.wordpress.com/2010/07/hotel-parking-theft-1.jpg",
    ],
    tags: ["parking", "car", "parking lot"],
    metadata: {},
  },
  {
    name: "Pet-Friendly",
    description: "Dogs welcome at The Anza!",
    longDescription: "The Anza welcomes four-legged companions, making it a great choice for pet owners. Select rooms and floors are designated as pet-friendly to ensure comfort for both pets and guests, with an additional fee of $35 per pet and a maximum of 2 dogs per room. Guests are encouraged to contact the hotel in advance for full details. This amenity ensures that pets can join in on family vacations or extended stays.",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1695637061/hfugoixcvrxhe6f542b9.jpg",
    ],
    tags: ["pet-friendly", "dogs", "pets"],
    metadata: {},
  },
  {
    name: "Marketplace & Boarding Pass Kiosk",
    description: "24/7 marketplace and boarding pass printing kiosk.",
    longDescription: "For added convenience, guests can use the 24/7 marketplace in the lobby to grab snacks, drinks, or essentials at any time. There is also a boarding pass kiosk, allowing travelers to print their flight passes quickly before heading to the airport. Together, these amenities make The Anza especially convenient for business travelers or guests catching early flights.",
    imageUrls: [
      "https://res.cloudinary.com/traveltripperweb/image/upload/c_fit,f_auto,h_1200,q_auto,w_1200/v1684185710/zjkufqqi2mzenpzluorw.jpg",
    ],
    tags: ["marketplace", "boarding pass", "kiosk"],
    metadata: {},
  }
];

async function resetTable(tableName: string, idColumn: string) {
  await db.execute(sql.raw(`DELETE FROM ${tableName}`));

  // Fetch the sequence name for the given table + column
  const result: any = await db.execute(
    sql`SELECT pg_get_serial_sequence(${tableName}, ${idColumn}) as seq;`
  );
  const seqName = result[0]?.seq ?? result.rows?.[0]?.seq;

  if (seqName) {
    await db.execute(sql.raw(`ALTER SEQUENCE ${seqName} RESTART WITH 1`));
    console.log(`Reset sequence for ${tableName}.${idColumn}: ${seqName}`);
  } else {
    console.warn(`No sequence found for ${tableName}.${idColumn}`);
  }
}

async function main() {
  console.log("Starting seed...");

  await resetTable("amenities", "id");
  await resetTable("hotels", "id");

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
