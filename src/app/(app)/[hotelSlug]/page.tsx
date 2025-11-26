import { requireHotelSession } from "@/utils/require-hotel-session";
import { getVoiceAgentHotelContextAction } from "@/actions/voice-agent";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ChatbotClient from "@/components/chatbot";
import WelcomeClient from "@/components/welcome-client";
import VoiceIntroClient from "@/components/voice-intro-client";
import OrderSuccessToast from "@/components/order-success-toast";
import { TipNotification } from "@/components/tip-notification";
import {
  processChatMessageStream,
  getThreadMessages,
} from "@/actions/chatbot";

interface PageProps {
  params: Promise<{ hotelSlug: string }>;
  searchParams: Promise<{ voice?: string }>;
}

export default async function HotelHomePage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { hotel, threadId } = await requireHotelSession({
    hotelSlug: resolvedParams.hotelSlug,
    redirectTo: `/${resolvedParams.hotelSlug}`,
  });

  const hotelContextResult = await getVoiceAgentHotelContextAction(hotel.id);
  if (!hotelContextResult.ok || !hotelContextResult.data) {
    redirect("/hotel-not-found");
  }

  const hotelContext = hotelContextResult.data.context;

  const hasPlayedIntro =
    (await cookies()).get("simon-intro-played")?.value === "true";
  const showVoiceIntro = resolvedSearchParams?.voice === "true";

  if (showVoiceIntro) {
    return <VoiceIntroClient hotel={hotel} />;
  }

  if (!hasPlayedIntro) {
    return <WelcomeClient hotel={hotel} />;
  }

  return (
    <main className="h-dvh w-full bg-gray-50">
      <OrderSuccessToast />
      <TipNotification />
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

