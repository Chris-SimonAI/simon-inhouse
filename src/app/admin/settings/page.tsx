import { getSettings } from "@/actions/settings";
import { SettingsForm } from "./settings-form";
import { TwilioSettingsForm } from "./twilio-settings-form";

export const dynamic = 'force-dynamic';

const CARD_KEYS = [
  'bot_card_number',
  'bot_card_expiry',
  'bot_card_cvv',
  'bot_card_zip',
];

const TWILIO_KEYS = [
  'twilio_account_sid',
  'twilio_auth_token',
  'twilio_phone_number',
];

export default async function SettingsPage() {
  const [cardSettings, twilioSettings] = await Promise.all([
    getSettings(CARD_KEYS),
    getSettings(TWILIO_KEYS),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage bot payment card, Twilio SMS, and application configuration</p>
      </div>

      <div className="space-y-8">
        <SettingsForm initialSettings={cardSettings} />
        <TwilioSettingsForm initialSettings={twilioSettings} />
      </div>
    </div>
  );
}
