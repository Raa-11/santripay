import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { studentSavings, savingPlans } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const results = await db
		.select({
			id: studentSavings.id,
			currentAmount: studentSavings.currentAmount,
			status: studentSavings.status,
			planId: savingPlans.id,
			planName: savingPlans.name,
			planCode: savingPlans.code,
			planType: savingPlans.savingType,
			defaultTargetAmount: savingPlans.defaultTargetAmount,
		})
		.from(studentSavings)
		.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
		.where(
			and(
				eq(studentSavings.studentId, params.studentId),
				isNull(studentSavings.deletedAt),
				eq(savingPlans.isActive, true),
			),
		)
		.orderBy(savingPlans.name);

	return json(
		results.map((r) => ({
			...r,
			currentAmount: Number(r.currentAmount),
			defaultTargetAmount: r.defaultTargetAmount ? Number(r.defaultTargetAmount) : null,
		})),
	);
};
