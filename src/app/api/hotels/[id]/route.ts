import { NextRequest, NextResponse } from 'next/server';
import { getHotelById } from '@/actions/hotels';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hotelId = parseInt(id);

    if (isNaN(hotelId)) {
      return NextResponse.json(
        { error: 'Invalid hotel ID' },
        { status: 400 }
      );
    }

    const result = await getHotelById(hotelId);

    if (!result.ok || !result.data) {
      return NextResponse.json(
        { error: 'Hotel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error fetching hotel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}