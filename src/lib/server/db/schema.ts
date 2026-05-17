import { pgTable, serial, integer, text } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export * from './auth.schema';
export * from './student.schema';
export * from './saving-plan.schema';
export * from './student-saving.schema';
export * from './ledger-entry.schema';
export * from './reversal.schema';
