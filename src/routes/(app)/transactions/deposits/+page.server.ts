import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { ledgerEntries, studentSavings } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

function generateRefNo(): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10).replace(/-/g, '');
	const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
	return `DEP-${date}-${rand}`;
}

export const load: PageServerLoad = ({ locals }) => {
	return { user: locals.user ?? null };
};

export const actions: Actions = {
	deposit: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const data = await request.formData();
		const studentSavingsId = data.get('studentSavingsId') as string;
		const amountRaw = data.get('amount') as string;
		const description = (data.get('description') as string) || null;

		const amount = Number(amountRaw);
		if (!studentSavingsId) return fail(400, { error: 'Missing savings account' });
		if (!amount || amount <= 0) return fail(400, { error: 'Amount must be greater than zero' });

		const referenceNo = generateRefNo();

		await db.insert(ledgerEntries).values({
			studentSavingsId,
			referenceNo,
			type: 'DEPOSIT',
			amount: String(amount),
			description,
			isReversed: false,
			createdBy: locals.user.id,
		});

		await db
			.update(studentSavings)
			.set({
				currentAmount: sql`${studentSavings.currentAmount}::numeric + ${amount}`,
				updatedBy: locals.user.id,
			})
			.where(eq(studentSavings.id, studentSavingsId));

		return { success: true, referenceNo };
	},
};
