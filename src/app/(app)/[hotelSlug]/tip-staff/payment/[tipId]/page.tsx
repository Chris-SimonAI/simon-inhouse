import { requireHotelSession } from "@/utils/require-hotel-session";
import { PaymentProcessingScreen } from "@/components/payment-processing-screen";

interface PageProps {
  params: Promise<{ hotelSlug: string; tipId: string }>;
}

export default async function PaymentProcessingPage({ params }: PageProps) {
  const { hotelSlug, tipId } = await params;
  await requireHotelSession({
    hotelSlug,
    redirectTo: `/${hotelSlug}/tip-staff/payment/${tipId}`,
  });

  const tipIdNumber = parseInt(tipId, 10);

  return <PaymentProcessingScreen tipId={tipIdNumber} />;
}

