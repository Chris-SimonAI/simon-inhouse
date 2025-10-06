'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSession } from '@/contexts/SessionContext';
import { getHotelById } from '@/actions/hotels';
import { getVoiceAgentHotelContextAction } from '@/actions/voice-agent';

export function QRCodeHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const qrCode = searchParams.get('qrCode');
  const { setSessionData, setIsLoading } = useSession();
  
  useEffect(() => {
    // Don't process QR codes on hotel-specific pages
    if (pathname.startsWith('/hotel')) return;
    
    if (!qrCode) return;
  
    setIsLoading(true);
    
    const processQRCode = async () => {
      try {
        const response = await fetch(`/api/auth/qr-scan?qrCode=${qrCode}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Browser will automatically send/receive cookies
        });
        
        if (response.ok) {
          const result = await response.json();         
          if (result.ok && result.data) {
            
            // Extract hotelId and threadId from the session data
            const sessionData = result.data;
            const hotelId = sessionData.hotelId || sessionData.qrData?.hotelId;
            const threadId = sessionData.threadId || sessionData.qrData?.threadId;
            
            if (hotelId && threadId) {
              // Fetch hotel data and context
              try {
                const hotelResult = await getHotelById(parseInt(hotelId));
                const hotelContextResult = await getVoiceAgentHotelContextAction(parseInt(hotelId));
                
                if (hotelResult.ok && hotelResult.data) {
                  setSessionData({
                    threadId,
                    hotel: hotelResult.data,
                    hotelContext: hotelContextResult.ok ? hotelContextResult.data.context : '',
                    isLoaded: true,
                  });
                  setIsLoading(false);
                  router.push('/');
                 } else {
                   console.error("Failed to fetch hotel data");
                   router.push('/404');
                 } 
               } catch (error) {
                 console.error("Error fetching hotel data:", error);
                 router.push('/404');
               }
             } else {
               console.error("Missing hotelId or threadId in session data");
               router.push('/404');
             }
           } else {
             console.error("Session creation failed despite 200 response");
             router.push('/404');
           }
         } else {
           console.error("QR session failed with status:", response.status);
           router.push('/404');
         }
       } catch (error) {
         console.error("Error processing QR code:", error);
         router.push('/404');
       }
    };
    
    processQRCode();
  }, [qrCode, router, pathname, setSessionData, setIsLoading]);
  
  return null;
}