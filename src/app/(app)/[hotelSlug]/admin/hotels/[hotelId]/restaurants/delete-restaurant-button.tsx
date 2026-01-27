'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { deleteRestaurant } from "@/actions/admin-restaurants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  restaurantId: number;
  restaurantName: string;
};

export function DeleteRestaurantButton({ restaurantId, restaurantName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);

    const result = await deleteRestaurant(restaurantId);

    setLoading(false);

    if (result.ok) {
      toast.success(`"${restaurantName}" deleted`);
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message || "Failed to delete restaurant");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Restaurant</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{restaurantName}"? This will also delete the menu and all associated orders. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Restaurant"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
