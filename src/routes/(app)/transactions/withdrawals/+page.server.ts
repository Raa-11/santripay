import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { ledgerEntries, studentSavings, savingPlans } from '$lib/server/db/schema';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import Decimal from 'decimal.js';

function generateRefNo(prefix: string): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10).replace(/-/g, '');
	const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
	return `${prefix}-${date}-${rand}`;
}

export const load: PageServerLoad = async ({ locals }) => {
	const plans = await db
		.select({ id: savingPlans.id, name: savingPlans.name, code: savingPlans.code })
		.from(savingPlans)
		.where(and(eq(savingPlans.isActive, true), isNull(savingPlans.deletedAt)))
		.orderBy(savingPlans.name);

	return { user: locals.user ?? null, plans };
};

export const actions: Actions = {
	withdraw: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const data = await request.formData();
		const studentSavingsId = data.get('studentSavingsId') as string;
		const amountRaw = data.get('amount') as string;
		const description = (data.get('description') as string) || null;

		const amount = Number(amountRaw);
		if (!studentSavingsId) return fail(400, { error: 'Missing savings account' });
		if (!amount || amount <= 0) return fail(400, { error: 'Amount must be greater than zero' });

		const [ss] = await db
			.select({ currentAmount: studentSavings.currentAmount })
			.from(studentSavings)
			.where(eq(studentSavings.id, studentSavingsId));

		if (!ss) return fail(400, { error: 'Savings account not found' });

		const currentBalance = Number(ss.currentAmount);
		if (amount > currentBalance) {
			return fail(400, {
				error: `Insufficient balance. Available: Rp ${new Intl.NumberFormat('id-ID').format(currentBalance)}`,
			});
		}

		const referenceNo = generateRefNo('WTH');

		await db.insert(ledgerEntries).values({
			studentSavingsId,
			referenceNo,
			type: 'WITHDRAW',
			amount: String(amount),
			description,
			isReversed: false,
			createdBy: locals.user.id,
		});

		await db
			.update(studentSavings)
			.set({
				currentAmount: sql`${studentSavings.currentAmount}::numeric - ${amount}`,
				updatedBy: locals.user.id,
			})
			.where(eq(studentSavings.id, studentSavingsId));

		return { success: true, referenceNo };
	},

	bulkWithdraw: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const data = await request.formData();
		const savingPlanId = data.get('savingPlanId') as string;
		const totalAmountRaw = data.get('totalAmount') as string;

		if (!savingPlanId) return fail(400, { error: 'Missing saving plan' });

		const totalAmount = new Decimal(totalAmountRaw || '0');
		if (totalAmount.lte(0)) return fail(400, { error: 'Amount must be greater than zero' });

		const savings = await db
			.select({ id: studentSavings.id, currentAmount: studentSavings.currentAmount })
			.from(studentSavings)
			.where(
				and(
					eq(studentSavings.savingPlanId, savingPlanId),
					isNull(studentSavings.deletedAt),
					sql`${studentSavings.currentAmount}::numeric > 0`,
				),
			)
			.orderBy(studentSavings.id);

		if (savings.length === 0) return fail(400, { error: 'No students with balance in this saving plan' });

		const count = savings.length;
		const base = totalAmount.divToInt(count);
		const remainderCount = totalAmount.mod(count).toNumber();

		const distributions = savings
			.map((s, i) => {
				const balance = new Decimal(s.currentAmount);
				let share = i < remainderCount ? base.plus(1) : base;
				if (share.greaterThan(balance)) share = balance;
				return { id: s.id, share };
			})
			.filter((d) => d.share.greaterThan(0));

		if (distributions.length === 0) return fail(400, { error: 'No eligible students to process' });

		const referenceNo = generateRefNo('BWTH');
		const actualTotal = distributions.reduce((s, d) => s.plus(d.share), new Decimal(0));

		await db.insert(ledgerEntries).values(
			distributions.map((d) => ({
				studentSavingsId: d.id,
				referenceNo,
				type: 'WITHDRAW' as const,
				amount: d.share.toString(),
				isReversed: false,
				createdBy: locals.user!.id,
			})),
		);

		for (const d of distributions) {
			await db
				.update(studentSavings)
				.set({
					currentAmount: sql`${studentSavings.currentAmount}::numeric - ${d.share.toString()}`,
					updatedBy: locals.user!.id,
				})
				.where(eq(studentSavings.id, d.id));
		}

		return {
			success: true,
			referenceNo,
			processedCount: distributions.length,
			actualTotal: actualTotal.toString(),
		};
	},
};
