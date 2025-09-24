'use client';

import { VoiceStatus as VoiceStatusType } from '@/hooks/useVoiceAgentConnection';
import { getVoiceStatusText, getVoiceTapInstruction } from '@/lib/voice-utils';

interface VoiceStatusDisplayProps {
  status: VoiceStatusType;
  isConnecting: boolean;
  isConnected: boolean;
  error?: string | null;
}

export function VoiceStatus({ status, isConnecting, isConnected, error }: VoiceStatusDisplayProps) {

  return (
    <>
      {/* Status text */}
      <p className="text-gray-600 text-base leading-relaxed mb-4">
        {getVoiceStatusText(status, isConnecting, isConnected)}
      </p>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Tap instruction */}
      <p className="text-gray-500 text-sm mb-8">
        {getVoiceTapInstruction(status, isConnecting, isConnected)}
      </p>
    </>
  );
}
