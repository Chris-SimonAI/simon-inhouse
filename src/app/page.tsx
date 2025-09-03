import ChatbotClient from '@/components/Chatbot';
import { processChatMessageStream } from '@/actions/chatbot';

export default function Home() {
  const threadId = Math.random().toString(36).substring(2, 15);
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
    
        <div className="flex justify-center">
          <ChatbotClient
            processChatMessageStream={processChatMessageStream}
            threadId={threadId}
          />
        </div>

    </div>
  );
}
