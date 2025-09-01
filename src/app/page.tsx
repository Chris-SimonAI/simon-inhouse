import ChatbotClient from '@/components/Chatbot';
import { processChatMessageStream } from '@/actions/chatbot';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
    
        <div className="flex justify-center">
          <ChatbotClient
            processChatMessageStream={processChatMessageStream}
          />
        </div>

    </div>
  );
}
