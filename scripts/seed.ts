import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import "dotenv/config";
import { type ClientConfig } from "pg";
import fs from "fs";


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

async function main() {
  console.log("Starting seed...");

  await resetTable("amenities", "id");
  await resetTable("hotels", "id");

  // Insert hotel using direct SQL
  const insertedHotel = await db.execute(sql`
    INSERT INTO hotels (name, address, latitude, longitude, metadata, created_at, updated_at)
    VALUES (${DEMO_HOTEL.name}, ${DEMO_HOTEL.address}, ${DEMO_HOTEL.latitude}, ${DEMO_HOTEL.longitude}, ${JSON.stringify(DEMO_HOTEL.metadata)}, NOW(), NOW())
    RETURNING id
  `);
  const hotelId = insertedHotel.rows[0].id;

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

  const insertedAmenities = DEMO_AMENITIES;

  console.log(`Inserted ${insertedAmenities?.length} amenities`);

  console.log("Seed completed successfully!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
