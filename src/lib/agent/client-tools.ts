import { tool } from '@openai/agents-realtime';
import { z } from 'zod';

export const handoffToVisualTool = tool({
  name: 'handoff_to_visual',
  description: 'Transfer the conversation to the visual interface for displaying information, recommendations, or detailed data. Use this when the user asks for lists, recommendations, or information that would be better displayed as cards/UI (like "show me restaurants", "what attractions are nearby", "recommend dining options"). The tool will trigger a handoff to the visual interface.',
  parameters: z.object({
    userQuestion: z.string().describe('The user\'s original question that triggered the handoff'),
    reason: z.string().optional().nullable().describe('Brief reason for the handoff (e.g., "showing restaurants", "displaying attractions")'),
  }),
  strict: true,
  execute: async ({ userQuestion, reason }: { userQuestion: string; reason?: string | null }) => {
    // This tool is just for signaling - it doesn't need to do anything
    // The frontend will detect the tool call and handle the handoff
    return JSON.stringify({
      handoff: true,
      userQuestion,
      reason: reason || "User requested visual information display"
    });
  },
});
