import { createAmenities } from "@/actions/amenities";
import { createHotel } from "@/actions/hotels";

// Demo data - can be easily removed after demo
const DEMO_HOTEL = 
{
    "name": "The Anza Hotel",
    "address": "23627 Calabasas Road, Calabasas, CA 91302, USA",
    "latitude": 34.156670,
    "longitude": -118.642040,
    "metadata": {
        "rooms_total": 122,
        "pet_friendly": true,
        "check_in": {
            "time": "16:00",
            "age_requirement": 18,
            "early_check_in_fee": {
            "amount": 45,
            "currency": "USD",
            "notes": "Plus tax, upon availability"
            }
        },
        "check_out": {
            "time": "11:00",
            "late_check_out_fee": {
            "amount": 45,
            "currency": "USD",
            "notes": "Plus tax, upon availability"
            }
        },
        "parking_fee": {
            "amount": 15,
            "currency": "USD",
            "notes": "Per night"
        },
        "wifi": {
            "available": true,
            "description": "Complimentary Wi-Fi throughout hotel"
        },
    }
};

const DEMO_AMENITIES = {
      "hotelId": "",
      "roomTypes": [
        {
          "name": "Standard King Room",
          "description": "Standard King Room (~400 ft²)",
          "beds": "1 King",
          "price": 200,
          "currency": "USD",
          "image_url": "URL_to_image_standard_king_room"
        },
        {
          "name": "Standard Two Queen Room",
          "description": "Standard Two Queen Room (~400 ft²)",
          "beds": "2 Queens",
          "price": 220,
          "currency": "USD",
          "image_url": "URL_to_image_standard_two_queen_room"
        },
        {
          "name": "Premium King Room",
          "description": "Premium King Room (~400 ft²)",
          "beds": "1 King",
          "price": 240,
          "currency": "USD",
          "image_url": "URL_to_image_premium_king_room"
        },
        {
          "name": "Premium Two Queen Room",
          "description": "Premium Two Queen Room (~400 ft²)",
          "beds": "2 Queens",
          "price": 260,
          "currency": "USD",
          "image_url": "URL_to_image_premium_two_queen_room"
        },
        {
          "name": "Two-Bedroom Suite",
          "description": "Two-Bedroom Suite (~900 ft²) with living room",
          "beds": "2 Bedrooms (1 King + 2 Queens)",
          "price": 400,
          "currency": "USD",
          "image_url": "URL_to_image_two_bedroom_suite"
        },
        {
          "name": "Three-Bedroom Suite",
          "description": "Three-Bedroom Suite (~1015 ft²) with full kitchen",
          "beds": "3 Bedrooms (1 King + 2 Queens + Sofa Bed)",
          "price": 550,
          "currency": "USD",
          "image_url": "URL_to_image_three_bedroom_suite"
        },
        {
          "name": "Accessible King Premium Room",
          "description": "ADA Accessible King Premium Room",
          "beds": "1 King",
          "price": 240,
          "currency": "USD",
          "image_url": "URL_to_image_accessible_king_room"
        }
      ],
      "diningOptions": [
        {
          "name": "Graze Bistro",
          "description": "On-site dining, breakfast available 7:00 am - 11:00 am on select weekends (summer/high season)",
          "image_url": "URL_to_image_cafe_graze"
        }
      ],
      "poolOptions": [
        {
          "name": "Outdoor Heated Pool",
          "description": "Heated outdoor pool with cabanas and lounge seating",
          "image_url": "URL_to_image_pool"
        }
      ],
      "spaServices": [],
      "fitnessCenters": [
        {
          "name": "Fitness Center",
          "description": "Fully equipped onsite fitness center",
          "image_url": "URL_to_image_gym"
        }
      ],
      "businessCenters": [
        {
          "name": "Business Center",
          "description": "24/7 business center with marketplace and boarding pass printing kiosk",
          "image_url": "URL_to_image_business_center"
        }
      ],
      "meetingSpaces": [
        {
          "name": "Flexible Meeting Space",
          "description": "Meeting space for up to 30 guests with AV setup",
          "image_url": "URL_to_image_meeting_space"
        }
      ],
      "accessibilityFeatures": [
      ],
      "entertainment": [
        {
          "name": "Lobby Library",
          "description": "Library/lounge area in lobby with seating",
          "image_url": "URL_to_image_lobby_lounge"
        }
      ],
      "kidsFacilities": [

      ],
      "outdoorActivities": [],
      "transportServices": [
        {
          "name": "Self-Parking",
          "description": "Onsite self-parking available",
          "beds": null,
          "price": 15,
          "currency": "USD",
          "image_url": null
        },
        {
          "name": "Valet Dry-Cleaning",
          "description": "Valet dry-cleaning service",
          "beds": null,
          "price": null,
          "currency": null,
          "image_url": null
        }
      ],
      "retailShops": [
        {
          "name": "Marketplace",
          "description": "Convenience marketplace with snacks and essentials",
          "beds": null,
          "price": null,
          "currency": null,
          "image_url": null
        }
      ],
      "laundryServices": [
        {
          "name": "Dry Cleaning",
          "description": "Professional dry-cleaning service",
          "beds": null,
          "price": null,
          "currency": null,
          "image_url": null
        },
        {
          "name": "Laundry Facilities",
          "description": "Coin-operated laundry facilities available onsite",
          "beds": null,
          "price": null,
          "currency": null,
          "image_url": null
        }
      ],
      "conciergeServices": [
        {
          "name": "24/7 Concierge",
          "description": "Multilingual front desk and concierge services",
          "beds": null,
          "price": null,
          "currency": null,
          "image_url": null
        }
      ],
      "roomServices": [
        {
          "name": "Room Service",
          "description": "In-room dining available",
          "beds": null,
          "price": null,
          "currency": null,
          "image_url": null
        },
        {
          "name": "Contactless Robot Delivery",
          "description": "Service robot for contactless delivery to rooms",
          "beds": null,
          "price": null,
          "currency": null,
          "image_url": null
        }
      ]
    }
  
  

export async function initDemoDatabase() {
  try {
    console.log("Initializing demo database...");
    
    // seed demo hotel data
    const result = await createHotel(DEMO_HOTEL, false);
    if (!result.ok) {
      console.error("Demo hotel creation failed:", result.message);
      return false;
    }
    console.log(`Seeded ${DEMO_HOTEL.name} demo hotel with id ${result?.data?.id}`);
    

    // seed demo amenities data
    DEMO_AMENITIES.hotelId = result?.data?.id || "";
    const resultAmenities = await createAmenities(DEMO_AMENITIES, false);
    if (!resultAmenities.ok) {
      console.error("Demo amenities creation failed:", resultAmenities.message);
      return false;
    }
    console.log(`Seeded ${DEMO_AMENITIES.hotelId} demo amenities with id ${resultAmenities?.data?.id}`);
    console.log("Demo database initialized successfully", JSON.stringify(result, null, 2), JSON.stringify(resultAmenities, null, 2));

    return true;
  } catch (error) {
    console.error("Demo database init failed:", error);
    return false;
  }
}
