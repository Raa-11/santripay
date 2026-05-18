import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { studentSavings, students } from '$lib/server/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const results = await db
		.select({
			id: studentSavings.id,
			name: students.name,
			nis: students.nis,
			class: students.class,
			currentAmount: studentSavings.currentAmount,
		})
		.from(studentSavings)
		.innerJoin(students, eq(studentSavings.studentId, students.id))
		.where(
			and(
				eq(studentSavings.savingPlanId, params.planId),
				isNull(studentSavings.deletedAt),
				sql`${studentSavings.currentAmount}::numeric > 0`,
			),
		)
		.orderBy(students.name);

	return json(results.map((r) => ({ ...r, currentAmount: Number(r.currentAmount) })));
};
