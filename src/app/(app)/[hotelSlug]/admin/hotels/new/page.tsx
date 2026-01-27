import { HotelForm } from "../hotel-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewHotelPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="../hotels">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hotels
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Add New Hotel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new hotel location for guests to order from.
        </p>
      </div>

      <HotelForm />
    </main>
  );
}
