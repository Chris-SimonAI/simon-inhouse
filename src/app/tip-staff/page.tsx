import { requireHotelSession } from "@/utils/require-hotel-session";
import TipStaffClient from "./tip-staff-client.tsx";

export default async function TipStaffPage() {
  // ✅ Server-side session validation only
  const { hotel } = await requireHotelSession();

  // ✅ Pass minimal info to client
  return <TipStaffClient hotel={hotel} />;
}
