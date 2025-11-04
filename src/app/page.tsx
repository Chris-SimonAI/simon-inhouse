import { requireHotelSession } from "@/utils/require-hotel-session";
import { getVoiceAgentHotelContextAction } from "@/actions/voice-agent";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ChatbotClient from "@/components/chatbot";
import WelcomeClient from "@/components/welcome-client";
import VoiceIntroClient from "@/components/voice-intro-client";
import OrderSuccessToast from "@/components/order-success-toast";
import { processChatMessageStream, getThreadMessages } from "@/actions/chatbot";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { voice?: string };
}) {
  // ✅ 1. Get validated session (hotel + threadId)
  const { hotel, hotelId, threadId } = await requireHotelSession();

  // ✅ 2. Fetch hotel context (specific to this page)
  const hotelContextResult = await getVoiceAgentHotelContextAction(hotelId);
  if (!hotelContextResult.ok || !hotelContextResult.data) {
    redirect("/hotel-not-found");
  }

  const hotelContext = hotelContextResult.data.context;

  // ✅ 3. Handle cookies and intro flow
  const hasPlayedIntro =
    (await cookies()).get("simon-intro-played")?.value === "true";
  const showVoiceIntro = searchParams?.voice === "true";

  if (showVoiceIntro) {
    return <VoiceIntroClient hotel={hotel} />;
  }

  if (!hasPlayedIntro) {
    return <WelcomeClient hotel={hotel} />;
  }

  // ✅ 4. Main chatbot interface
  return (
    <main className="h-dvh w-full bg-gray-50">
      <OrderSuccessToast />
      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md">
          <ChatbotClient
            processChatMessageStream={processChatMessageStream}
            getThreadMessages={getThreadMessages}
            threadId={threadId}
            hotel={hotel}
            hotelContext={hotelContext}
          />
        </div>
      </div>
    </main>
  );
}
