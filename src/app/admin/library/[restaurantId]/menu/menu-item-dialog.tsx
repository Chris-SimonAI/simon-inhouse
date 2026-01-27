'use client';

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, ImageOff, DollarSign } from "lucide-react";
import { getMenuItemWithModifiers, toggleMenuItemAvailability, toggleModifierOptionAvailability } from "@/actions/admin-restaurants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: string | null;
  imageUrls: string[] | null;
  isAvailable: boolean;
};

type ModifierOption = {
  id: number;
  name: string;
  price: string | null;
  isAvailable: boolean;
  isDefault: boolean | null;
};

type ModifierGroup = {
  id: number;
  name: string;
  description: string | null;
  minSelections: number | null;
  maxSelections: number | null;
  isRequired: boolean | null;
  options: ModifierOption[];
};

type MenuItemDialogProps = {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MenuItemDialog({ item, open, onOpenChange }: MenuItemDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [togglingModifiers, setTogglingModifiers] = useState<Set<number>>(new Set());
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [currentItem, setCurrentItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (open && item) {
      setCurrentItem(item);
      loadModifiers(item.id);
    } else {
      setModifierGroups([]);
      setCurrentItem(null);
    }
  }, [open, item]);

  async function loadModifiers(itemId: number) {
    setLoading(true);
    const result = await getMenuItemWithModifiers(itemId);
    if (result.ok) {
      setModifierGroups(result.data.modifierGroups);
    }
    setLoading(false);
  }

  async function handleToggleAvailability() {
    if (!currentItem) return;
    setToggling(true);
    const result = await toggleMenuItemAvailability(currentItem.id);
    if (result.ok) {
      setCurrentItem({ ...currentItem, isAvailable: result.data.isAvailable });
      toast.success(result.data.isAvailable ? "Item marked as in stock" : "Item marked as out of stock");
      router.refresh();
    } else {
      toast.error(result.message);
    }
    setToggling(false);
  }

  async function handleToggleModifierOption(optionId: number) {
    setTogglingModifiers(prev => new Set(prev).add(optionId));
    const result = await toggleModifierOptionAvailability(optionId);
    if (result.ok) {
      // Update local state
      setModifierGroups(groups =>
        groups.map(group => ({
          ...group,
          options: group.options.map(opt =>
            opt.id === optionId ? { ...opt, isAvailable: result.data.isAvailable } : opt
          )
        }))
      );
      toast.success(result.data.isAvailable ? "Modifier available" : "Modifier unavailable");
    } else {
      toast.error(result.message);
    }
    setTogglingModifiers(prev => {
      const next = new Set(prev);
      next.delete(optionId);
      return next;
    });
  }

  if (!currentItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{currentItem.name}</DialogTitle>
          {currentItem.description && (
            <DialogDescription className="text-base">
              {currentItem.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Item image and price */}
          <div className="flex gap-4">
            {currentItem.imageUrls && currentItem.imageUrls.length > 0 ? (
              <img
                src={currentItem.imageUrls[0]}
                alt={currentItem.name}
                className="w-32 h-32 rounded-lg object-cover"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg bg-slate-100 flex items-center justify-center">
                <ImageOff className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-slate-500" />
                <span className="text-2xl font-bold">${currentItem.price}</span>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="availability"
                  checked={currentItem.isAvailable}
                  onCheckedChange={handleToggleAvailability}
                  disabled={toggling}
                />
                <Label htmlFor="availability" className="cursor-pointer">
                  {toggling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : currentItem.isAvailable ? (
                    <span className="text-green-600 font-medium">In Stock</span>
                  ) : (
                    <span className="text-red-600 font-medium">Out of Stock</span>
                  )}
                </Label>
              </div>
            </div>
          </div>

          {/* Modifier Groups */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-lg mb-4">Modifiers</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : modifierGroups.length > 0 ? (
              <div className="space-y-4">
                {modifierGroups.map((group) => (
                  <div key={group.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{group.name}</h4>
                        {group.description && (
                          <p className="text-sm text-slate-500">{group.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {group.isRequired && (
                          <Badge variant="destructive">Required</Badge>
                        )}
                        {group.minSelections !== null && group.maxSelections !== null && (
                          <Badge variant="outline">
                            {group.minSelections === group.maxSelections
                              ? `Select ${group.minSelections}`
                              : `${group.minSelections}-${group.maxSelections}`}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.options.map((option) => (
                        <div
                          key={option.id}
                          className={`flex items-center justify-between py-2 px-3 rounded ${option.isAvailable ? 'bg-slate-50' : 'bg-red-50'}`}
                        >
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={option.isAvailable}
                              onCheckedChange={() => handleToggleModifierOption(option.id)}
                              disabled={togglingModifiers.has(option.id)}
                              className="scale-75"
                            />
                            <span className={!option.isAvailable ? 'text-slate-400 line-through' : ''}>
                              {option.name}
                            </span>
                            {option.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {option.price && parseFloat(option.price) > 0 && (
                              <span className="text-slate-600">+${option.price}</span>
                            )}
                            {togglingModifiers.has(option.id) && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                          </div>
                        </div>
                      ))}
                      {group.options.length === 0 && (
                        <p className="text-sm text-slate-500 italic">No options</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No modifiers for this item</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
