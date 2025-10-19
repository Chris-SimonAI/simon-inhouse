import { getHotelById } from '@/actions/hotels';
import { DEFAULT_HOTEL_ID } from '@/constants';
import { getAmenitiesByHotelId } from '@/actions/amenities';


function formatHotelData(hotel: { id: number; name: string; address: string | null; latitude: string; longitude: string; metadata: unknown }, availableAmenities: string) {
  const meta = hotel.metadata;
  return `
HOTEL INFORMATION:
- Hotel ID: ${hotel.id}
- Name: ${hotel.name}
- Address: ${hotel.address || 'Not available'}
- Location: ${hotel.latitude}, ${hotel.longitude}
- Hotel Metadata: ${JSON.stringify(meta)}
- Hotel Facilities: ${availableAmenities}
  `.trim();
}

export async function getVoiceAgentHotelContext(hotelId: number): Promise<string> {
  try {
    const result = await getHotelById(hotelId);
    
    if (!result.ok || !result.data) {
      return 'Hotel information not available.';
    }

    const amenities = await getAmenitiesByHotelId(hotelId);
    if (!amenities.ok || !amenities.data) {
      return 'Amenities information not available.';
    }
    const amenitiesData = amenities.data;
    const availableAmenities = amenitiesData.map((amenity) => `${amenity.name}: ${amenity.description}`).join(", ");
    
    const formattedData = formatHotelData(result.data, availableAmenities);
    return formattedData;
  } catch (error) {
    console.error('Failed to fetch hotel context:', error);
    return 'Hotel information not available.';
  }
}
