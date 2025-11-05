import { requireHotelSession } from "@/utils/require-hotel-session";
import PaymentProcessingClient from "./payment-processing-client.tsx";

export default async function PaymentProcessingPage({
  params,
}: {
  params: { tipId: string };
}) {
  // ✅ Run session validation server-side
  await requireHotelSession();

  // ✅ Pass the tipId as a prop to the client component
  const tipId = parseInt(params.tipId);

  return <PaymentProcessingClient tipId={tipId} />;
}
