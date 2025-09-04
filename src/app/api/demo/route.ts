import { NextResponse } from "next/server";
import { createAmenities } from "@/actions/amenities";
import { createHotel } from "@/actions/hotels";
import { amenities, db, hotels } from "@/db";

const DEMO_HOTEL = {
  name: "The Anza Hotel",
  address: "23627 Calabasas Road, Calabasas, CA 91302, USA",
  latitude: 34.15667,
  longitude: -118.64204,
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

const DEMO_AMENITIES = {
  hotelId: "",
  roomTypes: [
    {
      name: "Standard King Room",
      description: "Standard King Room (~400 ft²)",
      beds: "1 King",
      price: 200,
      currency: "USD",
      image_url: "URL_to_image_standard_king_room",
    },
    {
      name: "Standard Two Queen Room",
      description: "Standard Two Queen Room (~400 ft²)",
      beds: "2 Queens",
      price: 220,
      currency: "USD",
      image_url: "URL_to_image_standard_two_queen_room",
    },
    {
      name: "Premium King Room",
      description: "Premium King Room (~400 ft²)",
      beds: "1 King",
      price: 240,
      currency: "USD",
      image_url: "URL_to_image_premium_king_room",
    },
  ],
  diningOptions: [
    {
      name: "Graze Bistro",
      description:
        "On-site dining, breakfast available 7:00 am - 11:00 am on select weekends (summer/high season)",
      image_url: "URL_to_image_cafe_graze",
    },
  ],
  poolOptions: [
    {
      name: "Outdoor Heated Pool",
      description: "Heated outdoor pool with cabanas and lounge seating",
      image_url: "URL_to_image_pool",
    },
  ],
  fitnessCenters: [
    {
      name: "Fitness Center",
      description: "Fully equipped onsite fitness center",
      image_url: "URL_to_image_gym",
    },
  ],
  businessCenters: [
    {
      name: "Business Center",
      description:
        "24/7 business center with marketplace and boarding pass printing kiosk",
      image_url: "URL_to_image_business_center",
    },
  ],
  meetingSpaces: [
    {
      name: "Flexible Meeting Space",
      description: "Meeting space for up to 30 guests with AV setup",
      image_url: "URL_to_image_meeting_space",
    },
  ],
  entertainment: [
    {
      name: "Lobby Library",
      description: "Library/lounge area in lobby with seating",
      image_url: "URL_to_image_lobby_lounge",
    },
  ],
  transportServices: [
    {
      name: "Self-Parking",
      description: "Onsite self-parking available",
      beds: null,
      price: 15,
      currency: "USD",
      image_url: null,
    },
    {
      name: "Valet Dry-Cleaning",
      description: "Valet dry-cleaning service",
      beds: null,
      price: null,
      currency: null,
      image_url: null,
    },
  ],
  retailShops: [
    {
      name: "Marketplace",
      description: "Convenience marketplace with snacks and essentials",
      beds: null,
      price: null,
      currency: null,
      image_url: null,
    },
  ],
  laundryServices: [
    {
      name: "Dry Cleaning",
      description: "Professional dry-cleaning service",
      beds: null,
      price: null,
      currency: null,
      image_url: null,
    },
    {
      name: "Laundry Facilities",
      description: "Coin-operated laundry facilities available onsite",
      beds: null,
      price: null,
      currency: null,
      image_url: null,
    },
  ],
  conciergeServices: [
    {
      name: "24/7 Concierge",
      description: "Multilingual front desk and concierge services",
      beds: null,
      price: null,
      currency: null,
      image_url: null,
    },
  ],
  roomServices: [
    {
      name: "Room Service",
      description: "In-room dining available",
      beds: null,
      price: null,
      currency: null,
      image_url: null,
    },
    {
      name: "Contactless Robot Delivery",
      description: "Service robot for contactless delivery to rooms",
      beds: null,
      price: null,
      currency: null,
      image_url: null,
    },
  ],
};

export async function POST() {
  try {
    console.log("Initializing demo database...");

    // Clear existing demo data
    await db.delete(amenities);
    await db.delete(hotels);

    // Insert hotel
    const result = await createHotel(DEMO_HOTEL, false);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: "Hotel creation failed", details: result.message },
        { status: 500 }
      );
    }

    // Insert amenities
    DEMO_AMENITIES.hotelId = result.data?.id || "";
    const resultAmenities = await createAmenities(DEMO_AMENITIES, false);
    if (!resultAmenities.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Amenities creation failed",
          details: resultAmenities.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Demo data seeded successfully",
      hotel: result.data,
      amenities: resultAmenities.data,
    });
  } catch (error) {
    console.error("Demo database init failed:", error);
    return NextResponse.json(
      { ok: false, message: "Unexpected error", error: String(error) },
      { status: 500 }
    );
  }
}
