'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2, Check, Clock, Archive } from "lucide-react";
import { updateRestaurantStatus } from "@/actions/admin-restaurants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  restaurantId: number;
  currentStatus: string;
};

const statusOptions = [
  { value: "approved", label: "Approved", icon: Check, description: "Visible to guests" },
  { value: "pending", label: "Pending", icon: Clock, description: "Hidden, awaiting review" },
  { value: "archived", label: "Archived", icon: Archive, description: "Hidden, no longer active" },
] as const;

export function ToggleRestaurantStatus({ restaurantId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStatusChange(newStatus: "pending" | "approved" | "archived") {
    if (newStatus === currentStatus) return;

    setLoading(true);

    const result = await updateRestaurantStatus(restaurantId, newStatus);

    setLoading(false);

    if (result.ok) {
      const statusLabel = statusOptions.find(s => s.value === newStatus)?.label;
      toast.success(`Status changed to ${statusLabel}`);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to update status");
    }
  }

  const _currentOption = statusOptions.find(s => s.value === currentStatus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Status
              <ChevronDown className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className="flex items-start gap-2 py-2"
          >
            <option.icon className={`w-4 h-4 mt-0.5 ${
              option.value === currentStatus ? "text-primary" : "text-muted-foreground"
            }`} />
            <div>
              <div className={option.value === currentStatus ? "font-medium" : ""}>
                {option.label}
                {option.value === currentStatus && " (current)"}
              </div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
