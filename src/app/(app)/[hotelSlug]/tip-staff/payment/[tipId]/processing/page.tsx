import { requireHotelSession } from "@/utils/require-hotel-session";
import { TipPaymentProcessing } from "@/components/tip-payment-processing";
import { hotelPath } from "@/utils/hotel-path";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ hotelSlug: string; tipId: string }>;
}

export default async function TipProcessingPage({ params }: PageProps) {
  const { hotelSlug, tipId } = await params;
  const tipIdNumber = Number(tipId);
  if (Number.isNaN(tipIdNumber)) {
    notFound();
  }
  await requireHotelSession({
	hotelSlug,
	redirectTo: `/${hotelSlug}/tip-staff/payment/${tipId}/processing`,
  });

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


