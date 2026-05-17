import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { studentSavings } from "./student-saving.schema";
import { reversals } from "./reversal.schema";

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    studentSavingsId: uuid("student_savings_id").notNull().references(() => studentSavings.id),

    referenceNo: text("reference_no").notNull(),

    type: text("type").notNull(), // DEPOSIT | WITHDRAW

    amount: numeric("amount").notNull(),

    description: text("description"),

    isReversed: boolean("is_reversed").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: text("updated_by"),

    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by"),
  },
  (table) => ({
    ssIdx: index("transfers_student_savings_idx").on(table.studentSavingsId),
    refIdx: index("transfers_reference_idx").on(table.referenceNo),
    typeIdx: index("transfers_type_idx").on(table.type),
    createdAtIdx: index("transfers_created_at_idx").on(table.createdAt),
  }),
);

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  studentSaving: one(studentSavings, {
    fields: [ledgerEntries.studentSavingsId],
    references: [studentSavings.id],
  }),
  reversal: one(reversals, {
    fields: [ledgerEntries.id],
    references: [reversals.transferId],
  }),
}));
