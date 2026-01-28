'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { upsertSettings } from "@/actions/settings";
import { toast } from "sonner";

interface Props {
  initialSettings: Record<string, string>;
}

function maskCardNumber(value: string): string {
  if (!value || value.length < 4) return value;
  return '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ' + value.slice(-4);
}

function maskCvv(value: string): string {
  if (!value) return '';
  return '\u2022'.repeat(value.length);
}

export function SettingsForm({ initialSettings }: Props) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState(initialSettings.bot_card_expiry || '');
  const [cvv, setCvv] = useState('');
  const [zip, setZip] = useState(initialSettings.bot_card_zip || '');
  const [saving, setSaving] = useState(false);

  const hasExistingCard = !!initialSettings.bot_card_number;
  const maskedCard = hasExistingCard ? maskCardNumber(initialSettings.bot_card_number) : '';
  const maskedCvv = hasExistingCard ? maskCvv(initialSettings.bot_card_cvv) : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const entries: { key: string; value: string }[] = [];

      if (cardNumber) entries.push({ key: 'bot_card_number', value: cardNumber });
      if (expiry) entries.push({ key: 'bot_card_expiry', value: expiry });
      if (cvv) entries.push({ key: 'bot_card_cvv', value: cvv });
      if (zip) entries.push({ key: 'bot_card_zip', value: zip });

      if (entries.length === 0) {
        toast.error('No changes to save');
        setSaving(false);
        return;
      }

      await upsertSettings(entries);
      toast.success('Card details saved');

      // Clear sensitive fields after save
      setCardNumber('');
      setCvv('');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="w-5 h-5" />
          Bot Payment Card
        </CardTitle>
        <p className="text-sm text-slate-500">
          Card used by the ordering bot to place orders on Toast. Stored securely in the database and takes priority over environment variables.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              placeholder={hasExistingCard ? maskedCard : '4242424242424242'}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
              className="mt-1 font-mono"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="expiry">Expiry (MM/YY)</Label>
              <Input
                id="expiry"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d/]/g, '');
                  if (val.length === 2 && !val.includes('/') && expiry.length < val.length) {
                    val += '/';
                  }
                  setExpiry(val.slice(0, 5));
                }}
                className="mt-1 font-mono"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder={hasExistingCard ? maskedCvv : '123'}
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="mt-1 font-mono"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="zip">Billing ZIP</Label>
              <Input
                id="zip"
                placeholder="10001"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="mt-1 font-mono"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Card Details'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
