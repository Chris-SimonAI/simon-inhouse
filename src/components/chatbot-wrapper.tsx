'use client';

import { useSession } from '@/contexts/session-context';
import { processChatMessageStream, getThreadMessages } from '@/actions/chatbot';
import ChatbotClient from '@/components/chatbot';
import { Loader } from '@/components/ai-elements/loader';

export function ChatbotWrapper() {
  const { sessionData, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader />
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Hotel Not Found</h1>
          <p className="text-gray-600">Please scan a QR code to access the concierge service.</p>
        </div>
      </div>
    );
  }

  return (
    <ChatbotClient
      processChatMessageStream={processChatMessageStream}
      getThreadMessages={getThreadMessages}
      threadId={sessionData.threadId}
      hotel={sessionData.hotel}
      hotelContext={sessionData.hotelContext}
    />
  );
}
