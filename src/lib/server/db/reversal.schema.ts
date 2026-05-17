import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { ledgerEntries } from "./ledger-entry.schema";

export const reversals = pgTable("reversals", {
  id: uuid("id").primaryKey().defaultRandom(),

  transferId: uuid("ledger_entries_id").notNull().references(() => ledgerEntries.id),

  reason: text("reason"),

  reversedBy: text("reversed_by"),

  reversedAt: timestamp("reversed_at").defaultNow().notNull(),
});

export const reversalsRelations = relations(reversals, ({ one }) => ({
  ledgerEntry: one(ledgerEntries, {
    fields: [reversals.transferId],
    references: [ledgerEntries.id],
  }),
}));
