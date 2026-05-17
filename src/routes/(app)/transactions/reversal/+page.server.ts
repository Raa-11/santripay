import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { ledgerEntries, studentSavings, students, savingPlans, reversals } from '$lib/server/db/schema';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { superValidate, message } from 'sveltekit-superforms';
import { effect } from 'sveltekit-superforms/adapters';
import { fail } from '@sveltejs/kit';

const ReversalSchema = Schema.Struct({
	entryId: Schema.String.pipe(Schema.minLength(1)),
	reason: Schema.optional(Schema.String),
});

const reversalAdapter = effect(ReversalSchema);

export const load: PageServerLoad = ({ locals }) => {
	return Effect.runPromise(
		Effect.gen(function* () {
			const reversalForm = yield* Effect.promise(() =>
				superValidate(reversalAdapter, { id: 'reversal' }),
			);

			if (!locals.user) return { transactions: [], reversalForm };

			const rows = yield* Effect.promise(() =>
				db
					.select({
						entryId: ledgerEntries.id,
						referenceNo: ledgerEntries.referenceNo,
						createdAt: ledgerEntries.createdAt,
						type: ledgerEntries.type,
						amount: ledgerEntries.amount,
						description: ledgerEntries.description,
						studentName: students.name,
						studentNis: students.nis,
						studentClass: students.class,
						planName: savingPlans.name,
						planCode: savingPlans.code,
					})
					.from(ledgerEntries)
					.innerJoin(studentSavings, eq(ledgerEntries.studentSavingsId, studentSavings.id))
					.innerJoin(students, eq(studentSavings.studentId, students.id))
					.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
					.where(and(eq(ledgerEntries.isReversed, false), isNull(ledgerEntries.deletedAt)))
					.orderBy(desc(ledgerEntries.createdAt))
					.limit(500),
			);

			return {
				transactions: rows.map((r) => ({
					entryId: r.entryId,
					referenceNo: r.referenceNo,
					createdAt: r.createdAt.toISOString(),
					type: r.type,
					amount: Number(r.amount),
					description: r.description,
					studentName: r.studentName,
					studentNis: r.studentNis,
					studentClass: r.studentClass,
					planName: r.planName,
					planCode: r.planCode,
				})),
				reversalForm,
			};
		}),
	);
};

export const actions: Actions = {
	reverse: async ({ request, locals }) => {
		const form = await superValidate(request, reversalAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				if (!locals.user) return message(form, 'Unauthorized', { status: 401 });

				const [entry] = yield* Effect.promise(() =>
					db
						.select({
							id: ledgerEntries.id,
							type: ledgerEntries.type,
							amount: ledgerEntries.amount,
							isReversed: ledgerEntries.isReversed,
							studentSavingsId: ledgerEntries.studentSavingsId,
						})
						.from(ledgerEntries)
						.where(eq(ledgerEntries.id, form.data.entryId)),
				);

				if (!entry) return message(form, 'Transaction not found', { status: 404 });
				if (entry.isReversed) return message(form, 'Transaction is already reversed', { status: 400 });

				const amount = Number(entry.amount);

				if (entry.type === 'DEPOSIT') {
					const [ss] = yield* Effect.promise(() =>
						db
							.select({ currentAmount: studentSavings.currentAmount })
							.from(studentSavings)
							.where(eq(studentSavings.id, entry.studentSavingsId)),
					);
					if (Number(ss?.currentAmount ?? 0) < amount) {
						return message(
							form,
							`Insufficient balance — student has already withdrawn part of this deposit. Current balance: Rp ${new Intl.NumberFormat('id-ID').format(Number(ss?.currentAmount ?? 0))}`,
							{ status: 400 },
						);
					}
				}

				yield* Effect.promise(() =>
					db.insert(reversals).values({
						transferId: entry.id,
						reason: form.data.reason || null,
						reversedBy: locals.user!.id,
					}),
				);

				yield* Effect.promise(() =>
					db.update(ledgerEntries).set({ isReversed: true }).where(eq(ledgerEntries.id, entry.id)),
				);

				yield* Effect.promise(() =>
					db
						.update(studentSavings)
						.set({
							currentAmount:
								entry.type === 'DEPOSIT'
									? sql`${studentSavings.currentAmount}::numeric - ${amount}`
									: sql`${studentSavings.currentAmount}::numeric + ${amount}`,
							updatedBy: locals.user!.id,
						})
						.where(eq(studentSavings.id, entry.studentSavingsId)),
				);

				return message(form, 'Transaction reversed successfully');
			}).pipe(
				Effect.catchAll((err: any) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					console.error('Reversal error:', err);
					return Effect.succeed(message(form, 'Reversal failed', { status: 500 }));
				}),
			),
		);
	},
};
