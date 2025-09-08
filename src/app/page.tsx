import ChatbotClient from '@/components/Chatbot';
import { processChatMessageStream, getThreadMessages } from '@/actions/chatbot';
import { readThreadId } from '@/actions/thread';
import EnsureThreadCookie from '@/components/EnsureThreadCookie';

export default async function Home() {
  // TODO: existing and threadId code is temporary and will be removed we plan cookies via better-auth
  const existing = await readThreadId();
  const threadId =
    existing ?? Math.random().toString(36).substring(2, 15);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* TODO: This component is temporary and will be removed we plan cookies via better-auth */}
      <EnsureThreadCookie threadId={threadId} hasCookie={!!existing} />

      <div className="flex justify-center">
        <ChatbotClient
          processChatMessageStream={processChatMessageStream}
          getThreadMessages={getThreadMessages}
          threadId={threadId}
        />
      </div>
    </div>
  );
}
