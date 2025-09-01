import { z } from 'zod';

export const ChatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  threadId: z.string().default(crypto.randomUUID()),
});

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
