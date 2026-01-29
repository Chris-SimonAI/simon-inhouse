import { pgTable, bigserial, bigint, jsonb, index } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";
import { guestProfiles } from "./guest-profiles";
import { hotels } from "./hotels";

// Message structure stored in the messages JSONB array
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string; // ISO date string
  metadata?: {
    preferencesDetected?: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
    orderIntent?: {
      restaurantId: number;
      items: Array<{
        menuItemId: number;
        name: string;
        price: number;
        quantity: number;
        modifiers?: string[];
      }>;
      readyToConfirm: boolean;
    } | null;
  };
};

export const chatConversations = pgTable("chat_conversations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  guestId: bigint("guest_id", { mode: "number" })
    .notNull()
    .references(() => guestProfiles.id, { onDelete: "cascade" }),
  hotelId: bigint("hotel_id", { mode: "number" })
    .notNull()
    .references(() => hotels.id, { onDelete: "cascade" }),
  messages: jsonb("messages").$type<ChatMessage[]>().notNull().default([]),
  ...timestamps,
}, (table) => [
  index("chat_conversations_guest_id_idx").on(table.guestId),
  index("chat_conversations_hotel_id_idx").on(table.hotelId),
]);

export type ChatConversation = typeof chatConversations.$inferSelect;
export type NewChatConversation = typeof chatConversations.$inferInsert;
