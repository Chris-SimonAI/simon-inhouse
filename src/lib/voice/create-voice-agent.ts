import { RealtimeAgent } from '@openai/agents-realtime';
import { handoffToVisualTool } from '@/lib/agent/client-tools';
import { VOICE_AGENT_CONFIG, createAgentInstructions } from './voice-agent-config';

export const createVoiceAgent = (hotelContext: string): RealtimeAgent => {
  return new RealtimeAgent({
    name: VOICE_AGENT_CONFIG.name,
    instructions: createAgentInstructions(hotelContext),
    tools: [handoffToVisualTool],
    voice: 'echo',
  });
};
