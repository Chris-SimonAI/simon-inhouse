import { requireHotelSession } from "@/utils/require-hotel-session";
import { TipStripePaymentForm } from "@/components/tip-stripe-payment-form";

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

  return <TipStripePaymentForm tipId={tipIdNumber} />;
}

