import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { studentSavings } from "./student-saving.schema";

export const savingPlans = pgTable(
  "saving_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    code: text("code").unique().notNull(),
    name: text("name").notNull(),

    savingType: text("saving_type").notNull(), // GOAL | FLEXIBLE

    defaultTargetAmount: numeric("default_target_amount"),
    defaultContributionType: text("default_contribution_type"),
    defaultContributionValue: numeric("default_contribution_value"),

    startDate: date("start_date"),
    endDate: date("end_date"),

    isActive: boolean("is_active").default(true).notNull(),

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
    codeIndex: index("saving_plans_code_idx").on(table.code),
    activeIndex: index("saving_plans_active_idx").on(table.isActive),
    typeIndex: index("saving_plans_type_idx").on(table.savingType),
    startDateIndex: index("saving_plans_start_date_idx").on(table.startDate),
    endDateIndex: index("saving_plans_end_date_idx").on(table.endDate),
    createdByIndex: index("saving_plans_created_by_idx").on(table.createdBy),
    deletedAtIndex: index("saving_plans_deleted_at_idx").on(table.deletedAt),
  }),
);

export const savingPlansRelations = relations(savingPlans, ({ many }) => ({
  studentSavings: many(studentSavings),
}));
