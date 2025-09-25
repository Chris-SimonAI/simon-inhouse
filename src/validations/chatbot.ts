import { z } from 'zod';
import { generateId } from '@/lib/utils';

export const ChatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  threadId: z.string().default(() => generateId('thread')),
});

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
