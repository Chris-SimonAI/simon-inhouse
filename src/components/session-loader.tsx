'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/contexts/session-context';
import { getHotelSession } from '@/actions/sessions';
import { getHotelById } from '@/actions/hotels';
import { getVoiceAgentHotelContextAction } from '@/actions/voice-agent';

export function SessionLoader() {
  const { setSessionData, setIsLoading } = useSession();
  const searchParams = useSearchParams();
  const qrCode = searchParams.get('qrCode');

  useEffect(() => {
    // Don't load session if QR code is being processed
    if (qrCode) {
      return;
    }

    const loadSessionData = async () => {
      try {
        // Check if there's an existing better-auth session
        const sessionResult = await getHotelSession();
        
        if (sessionResult.ok && sessionResult.data) {
          const { qrData } = sessionResult.data;
          const hotelId = parseInt(qrData.hotelId);
          const threadId = qrData.threadId;
          
          // Fetch hotel data and context
          const hotelResult = await getHotelById(hotelId);
          const hotelContextResult = await getVoiceAgentHotelContextAction(hotelId);
          
          if (hotelResult.ok && hotelResult.data) {
            setSessionData({
              threadId,
              hotel: hotelResult.data,
              hotelContext: hotelContextResult.ok ? hotelContextResult.data.context : '',
              isLoaded: true,
            });
          } else {
            console.error("Failed to fetch hotel data for existing session");
            setSessionData(null);
          }
        } else {
          console.error("No valid session found");
          setSessionData(null);
        }
      } catch (error) {
        console.error("Error loading session data:", error);
        setSessionData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionData();
  }, [setSessionData, setIsLoading, qrCode]);

  return null;
}
