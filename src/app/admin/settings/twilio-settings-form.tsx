'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Phone, Loader2, Eye, EyeOff } from "lucide-react";
import { upsertSettings } from "@/actions/settings";
import { toast } from "sonner";

interface Props {
  initialSettings: Record<string, string>;
}

export function TwilioSettingsForm({ initialSettings }: Props) {
  const [accountSid, setAccountSid] = useState(initialSettings.twilio_account_sid || '');
  const [authToken, setAuthToken] = useState(initialSettings.twilio_auth_token || '');
  const [phoneNumber, setPhoneNumber] = useState(initialSettings.twilio_phone_number || '');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const entries: { key: string; value: string }[] = [];

      if (accountSid !== (initialSettings.twilio_account_sid || '')) {
        entries.push({ key: 'twilio_account_sid', value: accountSid });
      }
      if (authToken !== (initialSettings.twilio_auth_token || '')) {
        entries.push({ key: 'twilio_auth_token', value: authToken });
      }
      if (phoneNumber !== (initialSettings.twilio_phone_number || '')) {
        entries.push({ key: 'twilio_phone_number', value: phoneNumber });
      }

      if (entries.length === 0) {
        toast.error('No changes to save');
        setSaving(false);
        return;
      }

      await upsertSettings(entries);
      toast.success('Twilio settings saved');
    } catch (error) {
      console.error('Failed to save Twilio settings:', error);
      toast.error('Failed to save Twilio settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Phone className="w-5 h-5" />
          Twilio SMS
        </CardTitle>
        <p className="text-sm text-slate-500">
          Twilio credentials for receiving Toast order updates and forwarding status SMS to guests. The phone number is entered on Toast checkout so order updates come to your Twilio number.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="twilioSid">Account SID</Label>
            <Input
              id="twilioSid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              className="mt-1 font-mono"
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="twilioToken">Auth Token</Label>
            <div className="relative mt-1">
              <Input
                id="twilioToken"
                type={showToken ? 'text' : 'password'}
                placeholder="Your Twilio auth token"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="font-mono pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="twilioPhone">Phone Number</Label>
            <Input
              id="twilioPhone"
              placeholder="+14155551234"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-1 font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-slate-500 mt-1">
              E.164 format. This number is used on Toast checkout so order SMS updates come to your Twilio number.
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Twilio Settings'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
