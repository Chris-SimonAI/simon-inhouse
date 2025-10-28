import { VoiceStatus } from '@/hooks/use-voice-agent-connection';

/**
 * Get the appropriate status text for the voice agent based on connection state and status
 */
export function getVoiceStatusText(
  status: VoiceStatus,
  isConnecting: boolean,
  isConnected: boolean
): string {
  if (isConnecting) return 'Simon is connecting...';
  if (isConnected) {
    switch (status) {
      case 'listening': return 'Simon is listening...';
      case 'speaking': return 'Simon is speaking...';
      case 'processing': return 'Simon is processing...';
      default: return 'Simon is ready';
    }
  }
  return 'Simon is disconnected';
}

/**
 * Get the appropriate tap instruction for the voice agent based on connection state and status
 */
export function getVoiceTapInstruction(
  status: VoiceStatus,
  isConnecting: boolean,
  isConnected: boolean
): string {
  if (isConnecting) return 'Please wait...';
  if (isConnected) {
    switch (status) {
      case 'listening': return 'Tap anywhere to stop';
      case 'processing': return 'Tap to close';
      case 'speaking': return 'Tap to close';
      default: return 'Tap to close';
    }
  }
  return 'Tap to close';
}
