'use client';

import { useState, useEffect } from "react";
import { getGuestProfileById, updateGuestProfileAdmin } from "@/actions/guest-profiles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Phone, Mail, MapPin, AlertTriangle, Utensils, Heart, ThumbsDown, StickyNote, History, Save, X, Pencil } from "lucide-react";

interface GuestDetailDialogProps {
  guestId: number | null;
  onClose: () => void;
}

interface GuestDetail {
  id: number;
  phone: string;
  email: string | null;
  name: string | null;
  roomNumber: string | null;
  dietaryPreferences: string[] | null;
  allergies: string[] | null;
  favoriteCuisines: string[] | null;
  dislikedFoods: string[] | null;
  notes: string | null;
  hotelId: number | null;
  hotelName: string | null;
  hasBeenIntroduced: boolean;
  lastOrderAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  orderHistory: Array<{
    id: number;
    restaurantName: string | null;
    totalAmount: string;
    orderStatus: string;
    createdAt: Date;
    items: Array<{
      itemName: string;
      quantity: number;
      totalPrice: string;
    }>;
  }>;
}

export function GuestDetailDialog({ guestId, onClose }: GuestDetailDialogProps) {
  const [guest, setGuest] = useState<GuestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    roomNumber: "",
    allergies: "",
    dietaryPreferences: "",
    favoriteCuisines: "",
    dislikedFoods: "",
    notes: "",
  });

  useEffect(() => {
    if (guestId) {
      setLoading(true);
      getGuestProfileById(guestId)
        .then((data) => {
          setGuest(data);
          if (data) {
            setEditForm({
              name: data.name || "",
              email: data.email || "",
              roomNumber: data.roomNumber || "",
              allergies: (data.allergies || []).join(", "),
              dietaryPreferences: (data.dietaryPreferences || []).join(", "),
              favoriteCuisines: (data.favoriteCuisines || []).join(", "),
              dislikedFoods: (data.dislikedFoods || []).join(", "),
              notes: data.notes || "",
            });
          }
        })
        .finally(() => setLoading(false));
    } else {
      setGuest(null);
      setEditing(false);
    }
  }, [guestId]);

  const handleSave = async () => {
    if (!guest) return;

    setSaving(true);
    try {
      const updated = await updateGuestProfileAdmin(guest.id, {
        name: editForm.name || undefined,
        email: editForm.email || undefined,
        roomNumber: editForm.roomNumber || undefined,
        allergies: editForm.allergies ? editForm.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
        dietaryPreferences: editForm.dietaryPreferences ? editForm.dietaryPreferences.split(",").map(s => s.trim()).filter(Boolean) : [],
        favoriteCuisines: editForm.favoriteCuisines ? editForm.favoriteCuisines.split(",").map(s => s.trim()).filter(Boolean) : [],
        dislikedFoods: editForm.dislikedFoods ? editForm.dislikedFoods.split(",").map(s => s.trim()).filter(Boolean) : [],
        notes: editForm.notes || undefined,
      });
      if (updated) {
        setGuest(updated);
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={guestId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Guest Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : guest ? (
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editing ? (
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Name"
                      className="font-semibold"
                    />
                  ) : (
                    guest.name || "Unknown Guest"
                  )}
                </h3>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {guest.phone}
                  </div>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <Input
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="Email"
                        className="h-8"
                      />
                    </div>
                  ) : guest.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {guest.email}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {guest.hotelName || "No hotel"}{" "}
                    {editing ? (
                      <Input
                        value={editForm.roomNumber}
                        onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                        placeholder="Room"
                        className="h-8 w-24"
                      />
                    ) : (
                      guest.roomNumber && `• Room ${guest.roomNumber}`
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Preferences */}
            <div className="grid grid-cols-2 gap-4">
              <PreferenceSection
                icon={AlertTriangle}
                iconColor="text-red-500"
                label="Allergies"
                items={editing ? undefined : (guest.allergies || [])}
                editing={editing}
                value={editForm.allergies}
                onChange={(v) => setEditForm({ ...editForm, allergies: v })}
              />
              <PreferenceSection
                icon={Utensils}
                iconColor="text-blue-500"
                label="Dietary Preferences"
                items={editing ? undefined : (guest.dietaryPreferences || [])}
                editing={editing}
                value={editForm.dietaryPreferences}
                onChange={(v) => setEditForm({ ...editForm, dietaryPreferences: v })}
              />
              <PreferenceSection
                icon={Heart}
                iconColor="text-pink-500"
                label="Favorite Cuisines"
                items={editing ? undefined : (guest.favoriteCuisines || [])}
                editing={editing}
                value={editForm.favoriteCuisines}
                onChange={(v) => setEditForm({ ...editForm, favoriteCuisines: v })}
              />
              <PreferenceSection
                icon={ThumbsDown}
                iconColor="text-slate-500"
                label="Disliked Foods"
                items={editing ? undefined : (guest.dislikedFoods || [])}
                editing={editing}
                value={editForm.dislikedFoods}
                onChange={(v) => setEditForm({ ...editForm, dislikedFoods: v })}
              />
            </div>

            {/* Notes */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-700">Notes</span>
              </div>
              {editing ? (
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full p-2 border rounded text-sm"
                  rows={3}
                  placeholder="Add notes about this guest..."
                />
              ) : (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {guest.notes || "No notes"}
                </p>
              )}
            </div>

            {/* Order History */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-700">Order History</span>
                <Badge variant="secondary">{guest.orderHistory.length}</Badge>
              </div>
              {guest.orderHistory.length > 0 ? (
                <div className="space-y-2">
                  {guest.orderHistory.map((order) => (
                    <div key={order.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {order.restaurantName || "Unknown Restaurant"}
                        </span>
                        <span className="text-sm font-medium">${order.totalAmount}</span>
                      </div>
                      <div className="text-xs text-slate-500 mb-2">
                        {formatDate(order.createdAt)} • {order.orderStatus}
                      </div>
                      <div className="text-xs text-slate-600">
                        {order.items.map((item, i) => (
                          <span key={i}>
                            {item.quantity}x {item.itemName}
                            {i < order.items.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No orders yet</p>
              )}
            </div>

            {/* Meta info */}
            <div className="text-xs text-slate-400 pt-4 border-t">
              Created: {formatDate(guest.createdAt)} • Updated: {formatDate(guest.updatedAt)}
              {guest.hasBeenIntroduced && " • SMS introduced"}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            Guest not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreferenceSection({
  icon: Icon,
  iconColor,
  label,
  items,
  editing,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  items?: string[];
  editing?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      {editing && onChange !== undefined && value !== undefined ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}, comma-separated`}
          className="text-sm"
        />
      ) : items && items.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-xs text-slate-400">None</span>
      )}
    </div>
  );
}
