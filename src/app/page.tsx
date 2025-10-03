import ChatbotClient from '@/components/Chatbot';
import { processChatMessageStream, getThreadMessages } from '@/actions/chatbot';
import { readThreadId } from '@/actions/thread';
import { getHotelById } from '@/actions/hotels';
import { getVoiceAgentHotelContextAction } from '@/actions/voice-agent';
import { DEFAULT_HOTEL_ID } from '@/constants';
import EnsureThreadCookie from '@/components/EnsureThreadCookie';
import WelcomeClient from '@/components/WelcomeClient';
import VoiceIntroClient from '@/components/VoiceIntroClient';
import { cookies } from 'next/headers';

type HomePageProps = {
  searchParams: Promise<{ voice?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {

  const cookieStore = await cookies();
  const hasPlayedIntro = cookieStore.get('simon-intro-played')?.value === 'true';

  // Check if voice parameter is present
  const params = await searchParams;
  const showVoiceIntro = params.voice === 'true';

  // TODO: existing and threadId code is temporary and will be removed we plan cookies via better-auth
  const existing = await readThreadId();
  const threadId =
    existing ?? Math.random().toString(36).substring(2, 15);

  // Fetch hotel data using the default hotel ID
  const hotelResult = await getHotelById(DEFAULT_HOTEL_ID);
  if (!hotelResult.ok || !hotelResult.data) {
    throw new Error(`Failed to fetch hotel: ${hotelResult.message}`);
  }

  const hotelContextResult = await getVoiceAgentHotelContextAction(DEFAULT_HOTEL_ID);
  const hotelContext = hotelContextResult.ok ? hotelContextResult.data.context : '';

  if (!hotelContextResult.ok) {
    console.error('Failed to fetch hotel context:', hotelContextResult.message);
  }

  // If voice parameter is present, show voice intro
  if (showVoiceIntro) {
    return <VoiceIntroClient hotel={hotelResult.data} />;
  }

  // If intro hasn't been played, show welcome flow
  if (!hasPlayedIntro) {
    return <WelcomeClient hotel={hotelResult.data} />;
  }

  return (
    <div className="h-dvh w-full bg-gray-50">
      {/* TODO: This component is temporary and will be removed we plan cookies via better-auth */}
      <EnsureThreadCookie threadId={threadId} hasCookie={!!existing} />

      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md">
          <ChatbotClient
            processChatMessageStream={processChatMessageStream}
            getThreadMessages={getThreadMessages}
            threadId={threadId}
            hotel={hotelResult.data}
            hotelContext={hotelContext}
          />
        </div>
      </div>
    </div>
  );
}
