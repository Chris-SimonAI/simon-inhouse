'use client';

import { useSession } from '@/contexts/SessionContext';
import { processChatMessageStream, getThreadMessages } from '@/actions/chatbot';
import ChatbotClient from '@/components/Chatbot';
import WelcomeClient from '@/components/WelcomeClient';
import VoiceIntroClient from '@/components/VoiceIntroClient';
import { Loader } from '@/components/ai-elements/loader';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function HomeContent() {
  const { sessionData, isLoading } = useSession();
  const searchParams = useSearchParams();
  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);

  // Check if voice parameter is present
  const showVoiceIntro = searchParams.get('voice') === 'true';

  // Check if intro has been played (using cookies)
  useEffect(() => {
    const checkIntroCookie = () => {
      const hasPlayed = document.cookie.includes('simon-intro-played=true');
      setHasPlayedIntro(hasPlayed);
    };
    
    checkIntroCookie();
  }, [searchParams]); // Re-check when searchParams change (including navigation)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader />
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="h-dvh w-full bg-gray-50">
        <div className="h-dvh w-full flex justify-center">
          <div className="h-dvh w-full max-w-md flex items-center justify-center bg-white">
            <div className="text-center px-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">No Hotel Found</h1>
              <p className="text-gray-600">Please scan a QR code to access the concierge service.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If voice parameter is present, show voice intro
  if (showVoiceIntro) {
    return <VoiceIntroClient hotel={sessionData.hotel} />;
  }

  // If intro hasn't been played, show welcome flow
  if (!hasPlayedIntro) {
    return <WelcomeClient hotel={sessionData.hotel} />;
  }

  // Show main chatbot interface
  return (
    <div className="h-dvh w-full bg-gray-50">
      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md">
          <ChatbotClient
            processChatMessageStream={processChatMessageStream}
            getThreadMessages={getThreadMessages}
            threadId={sessionData.threadId}
            hotel={sessionData.hotel}
            hotelContext={sessionData.hotelContext}
          />
        </div>
      </div>
    </div>
  );
}
