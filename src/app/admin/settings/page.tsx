import { getSettings } from "@/actions/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = 'force-dynamic';

const CARD_KEYS = [
  'bot_card_number',
  'bot_card_expiry',
  'bot_card_cvv',
  'bot_card_zip',
];

export default async function SettingsPage() {
  const settings = await getSettings(CARD_KEYS);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage bot payment card and application configuration</p>
      </div>

      <SettingsForm initialSettings={settings} />
    </div>
  );
}
