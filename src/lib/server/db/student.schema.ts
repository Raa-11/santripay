import { relations } from "drizzle-orm";
import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { studentSavings } from "./student-saving.schema";

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    nis: text("nis").unique().notNull(),
    name: text("name").notNull(),

    gender: text("gender"),
    class: text("class"),
    address: text("address"),

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
    nisIndex: index("students_nis_idx").on(table.nis),
    activeIndex: index("students_active_idx").on(table.isActive),
    classIndex: index("students_class_idx").on(table.class),
    nameIndex: index("students_name_idx").on(table.name),
    deletedAtIndex: index("students_deleted_at_idx").on(table.deletedAt),
  })
);

export const studentsRelations = relations(students, ({ many }) => ({
  savings: many(studentSavings),
}));
