import { HotelForm } from "../hotel-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewHotelPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/admin/hotels">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hotels
          </Link>
        </Button>
        <h1 className="text-3xl font-bold text-slate-900">Add New Hotel</h1>
        <p className="text-slate-500 mt-1">
          Create a new hotel location for guests to order from.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-8 max-w-2xl">
        <HotelForm />
      </div>
    </div>
  );
}
