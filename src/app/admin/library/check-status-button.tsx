'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  restaurantId: number;
  restaurantName: string;
};

export function CheckStatusButton({ restaurantId, restaurantName }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleCheckStatus() {
    setLoading(true);

    try {
      const response = await fetch(`/api/bot/status?restaurantId=${restaurantId}`);
      const result = await response.json();

      if (result.ok) {
        const status = result.data;
        const statusText = status.isOpen ? "Open" : "Closed";
        const etaText = status.deliveryEta ? `, Delivery: ${status.deliveryEta}` : "";
        const cacheText = status.fromCache ? ` (cached ${status.cacheAge}s ago)` : " (fresh)";

        toast.success(`${restaurantName}: ${statusText}${etaText}${cacheText}`);
      } else {
        toast.error(result.message || "Failed to check status");
      }
    } catch (error) {
      console.error("Status check error:", error);
      toast.error("Failed to check status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCheckStatus}
      disabled={loading}
      title="Check live status"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Activity className="w-4 h-4" />
      )}
    </Button>
  );
}
