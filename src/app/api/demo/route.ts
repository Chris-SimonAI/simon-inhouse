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
      image_url: "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637251/riuerab7aiggthbggjjg.jpg"
    },
    {
      name: "Standard Two Queen Room",
      description: "Standard Two Queen Room (~400 ft²)",
      beds: "2 Queens",
      price: 220,
      currency: "USD",
      image_url: "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637267/ur1mizfg3xy58vjlrjjb.jpg"
    },
    {
      name: "Premium King Room",
      description: "Premium King Room (~400 ft²)",
      beds: "1 King",
      price: 240,
      currency: "USD",
      image_url: "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637073/ywio18nhbrzhj3d1vy90.jpg"
    },
  ],
  diningOptions: [
    {
      name: "Graze Bistro",
      description:
        "On-site dining, breakfast available 7:00 am - 11:00 am on select weekends (summer/high season)",
      image_url: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/1d/80/39/the-anza-hotel.jpg?w=2000&h=-1&s=1"
    },
  ],
  poolOptions: [
    {
      name: "Outdoor Heated Pool",
      description: "Heated outdoor pool with cabanas and lounge seating",
      image_url: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/17/34/8a/52/the-anza-hotel.jpg?w=1400&h=-1&s=1"
    },
  ],
  fitnessCenters: [
    {
      name: "Fitness Center",
      description: "Fully equipped onsite fitness center",
      image_url: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/1d/7f/da/the-anza-hotel.jpg?w=2000&h=-1&s=1"
    },
  ],
  businessCenters: [
    {
      name: "Business Center",
      description:
        "24/7 business center with marketplace and boarding pass printing kiosk",
      image_url: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/1d/80/85/the-anza-hotel.jpg?w=2000&h=-1&s=1"
    },
  ],
  meetingSpaces: [
    {
      name: "Flexible Meeting Space",
      description: "Meeting space for up to 30 guests with AV setup",
      image_url: "https://res.cloudinary.com/traveltripperweb/image/upload/c_limit,f_auto,h_2500,q_auto,w_2500/v1695637519/zzvkkok6rs2xms7xrfki.jpg"
    },
  ],
  entertainment: [
    {
      name: "Lobby Library",
      description: "Library/lounge area in lobby with seating",
      image_url: "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/470164316.jpg?k=b76efbfbebbf25864a66c3f7521ea4fb9c9c75e9bfcf4278a0a79d5c4b82c8fd&o=&s=1024x"
    },
  ],
  retailShops: [
    {
      name: "Marketplace",
      description: "Convenience marketplace with snacks and essentials",
      image_url: "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/466098561.jpg?k=cd896f2d0c9cce2e76080f3fe2a00e438a9ee614d24aa3eb48a2c9b5652d3400&o=&s=1024x"
    },
  ],
  roomServices: [
    {
      name: "Room Service",
      description: "In-room dining available",
      image_url: "https://images.unsplash.com/photo-1641924676093-42e61835bbe2?q=80&w=1742&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      name: "Contactless Robot Delivery",
      description: "Service robot for contactless delivery to rooms",
      image_url: "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/470164241.jpg?k=6cb49533afb29c9a901b992ebf0bab95dcc8815fe3cc15835f666f64ba8ed295&o=&s=1024x",
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
