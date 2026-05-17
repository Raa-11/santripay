import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, index, numeric, date } from "drizzle-orm/pg-core";
import { students } from "./student.schema";
import { savingPlans } from "./saving-plan.schema";
import { ledgerEntries } from "./ledger-entry.schema";

export const studentSavings = pgTable(
  "student_savings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    studentId: uuid("student_id").notNull().references(() => students.id),
    savingPlanId: uuid("saving_plan_id").notNull().references(() => savingPlans.id),

    targetAmount: numeric("target_amount"),
    currentAmount: numeric("current_amount").default("0").notNull(),

    contributionType: text("contribution_type"),
    contributionValue: numeric("contribution_value"),

    status: text("status").default("ACTIVE").notNull(),

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
    studentIdx: index("student_savings_student_idx").on(table.studentId),
    planIdx: index("student_savings_plan_idx").on(table.savingPlanId),
    statusIdx: index("student_savings_status_idx").on(table.status),
  })
);

export const studentSavingsRelations = relations(studentSavings, ({ one, many }) => ({
  student: one(students, {
    fields: [studentSavings.studentId],
    references: [students.id],
  }),
  savingPlan: one(savingPlans, {
    fields: [studentSavings.savingPlanId],
    references: [savingPlans.id],
  }),
  ledgerEntries: many(ledgerEntries),
}));
