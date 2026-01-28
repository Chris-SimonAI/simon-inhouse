import { pgTable, bigserial, varchar, text } from "drizzle-orm/pg-core";
import { timestamps } from "../columns.helpers";

export const appSettings = pgTable("app_settings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  ...timestamps,
});

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
