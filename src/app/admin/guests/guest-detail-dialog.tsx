'use client';

import { useState, useEffect } from "react";
import { getGuestProfileById, updateGuestProfileAdmin } from "@/actions/guest-profiles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-slate-100">
              <User className="w-5 h-5 text-slate-600" />
            </div>
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
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-700">
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-lg bg-slate-900 hover:bg-slate-800">
                      {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="rounded-lg border-slate-200 hover:bg-slate-50">
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Preferences */}
            <div className="grid grid-cols-2 gap-3">
              <PreferenceSection
                icon={AlertTriangle}
                iconColor="text-red-600"
                bgColor="bg-red-100"
                label="Allergies"
                items={editing ? undefined : (guest.allergies || [])}
                editing={editing}
                value={editForm.allergies}
                onChange={(v) => setEditForm({ ...editForm, allergies: v })}
              />
              <PreferenceSection
                icon={Utensils}
                iconColor="text-blue-600"
                bgColor="bg-blue-100"
                label="Dietary Preferences"
                items={editing ? undefined : (guest.dietaryPreferences || [])}
                editing={editing}
                value={editForm.dietaryPreferences}
                onChange={(v) => setEditForm({ ...editForm, dietaryPreferences: v })}
              />
              <PreferenceSection
                icon={Heart}
                iconColor="text-pink-600"
                bgColor="bg-pink-100"
                label="Favorite Cuisines"
                items={editing ? undefined : (guest.favoriteCuisines || [])}
                editing={editing}
                value={editForm.favoriteCuisines}
                onChange={(v) => setEditForm({ ...editForm, favoriteCuisines: v })}
              />
              <PreferenceSection
                icon={ThumbsDown}
                iconColor="text-slate-600"
                bgColor="bg-slate-200"
                label="Disliked Foods"
                items={editing ? undefined : (guest.dislikedFoods || [])}
                editing={editing}
                value={editForm.dislikedFoods}
                onChange={(v) => setEditForm({ ...editForm, dislikedFoods: v })}
              />
            </div>

            {/* Notes */}
            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-amber-100">
                  <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Notes</span>
              </div>
              {editing ? (
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
                  rows={3}
                  placeholder="Add notes about this guest..."
                />
              ) : (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {guest.notes || <span className="text-slate-400 italic">No notes yet</span>}
                </p>
              )}
            </div>

            {/* Order History */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-slate-100">
                  <History className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Order History</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  {guest.orderHistory.length}
                </span>
              </div>
              {guest.orderHistory.length > 0 ? (
                <div className="space-y-2">
                  {guest.orderHistory.map((order) => (
                    <div key={order.id} className="bg-slate-50/70 rounded-xl p-4 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-slate-900">
                          {order.restaurantName || "Unknown Restaurant"}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">${order.totalAmount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <span>{formatDate(order.createdAt)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{order.orderStatus}</span>
                      </div>
                      <div className="text-xs text-slate-500">
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
                <p className="text-sm text-slate-400 italic">No orders yet</p>
              )}
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-4 border-t border-slate-100">
              <span>Created {formatDate(guest.createdAt)}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>Updated {formatDate(guest.updatedAt)}</span>
              {guest.hasBeenIntroduced && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-emerald-600">SMS introduced</span>
                </>
              )}
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
  bgColor,
  label,
  items,
  editing,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  label: string;
  items?: string[];
  editing?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${bgColor}`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      {editing && onChange !== undefined && value !== undefined ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}, comma-separated`}
          className="text-sm rounded-lg border-slate-200"
        />
      ) : items && items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-slate-400">None specified</span>
      )}
    </div>
  );
}
