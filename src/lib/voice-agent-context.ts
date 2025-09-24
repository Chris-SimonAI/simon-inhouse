import { getHotelById } from '@/actions/hotels';
import { DEFAULT_HOTEL_ID } from '@/constants';

function getMetaValue(meta: unknown, path: string): string {
  const keys = path.split('.');
  let current: unknown = meta;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return 'Data not available';
    }
  }
  
  return current?.toString() || 'Data not available';
}

function formatHotelData(hotel: { id: number; name: string; address: string | null; latitude: string; longitude: string; metadata: unknown }) {
  const meta = hotel.metadata;
  return `
HOTEL INFORMATION:
- Hotel ID: ${hotel.id}
- Name: ${hotel.name}
- Address: ${hotel.address || 'Not available'}
- Total Rooms: ${getMetaValue(meta, 'rooms_total')}
- Pet Friendly: ${getMetaValue(meta, 'pet_friendly') === 'true' ? 'Yes' : getMetaValue(meta, 'pet_friendly') === 'false' ? 'No' : 'Data not available'}
- Check-in: ${getMetaValue(meta, 'check_in.time')} (Minimum age: ${getMetaValue(meta, 'check_in.age_requirement')})
- Check-out: ${getMetaValue(meta, 'check_out.time')}
- Early Check-in Fee: $${getMetaValue(meta, 'check_in.early_check_in_fee.amount')} ${getMetaValue(meta, 'check_in.early_check_in_fee.currency')} ${getMetaValue(meta, 'check_in.early_check_in_fee.notes')}
- Late Check-out Fee: $${getMetaValue(meta, 'check_out.late_check_out_fee.amount')} ${getMetaValue(meta, 'check_out.late_check_out_fee.currency')} ${getMetaValue(meta, 'check_out.late_check_out_fee.notes')}
- Parking: $${getMetaValue(meta, 'parking_fee.amount')} ${getMetaValue(meta, 'parking_fee.currency')} ${getMetaValue(meta, 'parking_fee.notes')}
- Wi-Fi: ${getMetaValue(meta, 'wifi.available') === 'true' ? getMetaValue(meta, 'wifi.description') : 'Not available'}
- Location: ${hotel.latitude}, ${hotel.longitude}
  `.trim();
}

export async function getVoiceAgentHotelContext(hotelId: number = DEFAULT_HOTEL_ID): Promise<string> {
  try {
    const result = await getHotelById(hotelId);
    
    if (!result.ok || !result.data) {
      return 'Hotel information not available.';
    }
    
    const formattedData = formatHotelData(result.data);
    return formattedData;
  } catch (error) {
    console.error('Failed to fetch hotel context:', error);
    return 'Hotel information not available.';
  }
}
