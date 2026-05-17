import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { ledgerEntries, studentSavings, savingPlans } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const typeFilter = url.searchParams.get('type'); // 'DEPOSIT' | 'WITHDRAW' | null = all

	const results = await db
		.select({
			id: ledgerEntries.id,
			amount: ledgerEntries.amount,
			type: ledgerEntries.type,
			isReversed: ledgerEntries.isReversed,
			createdAt: ledgerEntries.createdAt,
			planCode: savingPlans.code,
			planName: savingPlans.name,
		})
		.from(ledgerEntries)
		.innerJoin(studentSavings, eq(ledgerEntries.studentSavingsId, studentSavings.id))
		.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
		.where(
			typeFilter
				? and(eq(studentSavings.studentId, params.studentId), eq(ledgerEntries.type, typeFilter))
				: eq(studentSavings.studentId, params.studentId),
		)
		.orderBy(desc(ledgerEntries.createdAt))
		.limit(10);

	return json(
		results.map((r) => ({
			...r,
			amount: Number(r.amount),
			createdAt: r.createdAt.toISOString(),
		})),
	);
};
