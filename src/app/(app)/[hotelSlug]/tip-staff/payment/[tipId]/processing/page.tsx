import { requireHotelSession } from "@/utils/require-hotel-session";
import { TipPaymentProcessing } from "@/components/tip-payment-processing";
import { hotelPath } from "@/utils/hotel-path";

interface PageProps {
  params: Promise<{ hotelSlug: string; tipId: string }>;
}

export default async function TipProcessingPage({ params }: PageProps) {
  const { hotelSlug, tipId } = await params;
  await requireHotelSession({
	hotelSlug,
	redirectTo: `/${hotelSlug}/tip-staff/payment/${tipId}/processing`,
  });

  const tipIdNumber = parseInt(tipId, 10);

  const successPath = hotelPath(hotelSlug, `?tipping_success=true&tipId=${tipIdNumber}`);
  const failurePath = hotelPath(hotelSlug, `?tipping_success=false&tipId=${tipIdNumber}`);

  return (
	<TipPaymentProcessing
    tipId={tipIdNumber}
	  onSuccessPath={successPath}
	  onFailurePath={failurePath}
	/>
  );
}


