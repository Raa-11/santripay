import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { ledgerEntries, studentSavings, students, savingPlans, user as userTable, reversals } from '$lib/server/db/schema';
import { eq, desc, isNull } from 'drizzle-orm';
import { Effect } from 'effect';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) return { transactions: [] };

	return Effect.runPromise(
		Effect.gen(function* () {
			const rows = yield* Effect.promise(() =>
				db
					.select({
						referenceNo: ledgerEntries.referenceNo,
						entryId: ledgerEntries.id,
						createdAt: ledgerEntries.createdAt,
						type: ledgerEntries.type,
						amount: ledgerEntries.amount,
						description: ledgerEntries.description,
						isReversed: ledgerEntries.isReversed,
						studentName: students.name,
						studentNis: students.nis,
						studentClass: students.class,
						planName: savingPlans.name,
						planCode: savingPlans.code,
						operatorName: userTable.name,
						reversalReason: reversals.reason,
					})
					.from(ledgerEntries)
					.innerJoin(studentSavings, eq(ledgerEntries.studentSavingsId, studentSavings.id))
					.innerJoin(students, eq(studentSavings.studentId, students.id))
					.innerJoin(savingPlans, eq(studentSavings.savingPlanId, savingPlans.id))
					.leftJoin(userTable, eq(ledgerEntries.createdBy, userTable.id))
					.leftJoin(reversals, eq(reversals.transferId, ledgerEntries.id))
					.where(isNull(ledgerEntries.deletedAt))
					.orderBy(desc(ledgerEntries.createdAt))
					.limit(200),
			);

			return {
				transactions: rows.map((r) => ({
					referenceNo: r.referenceNo,
					entryId: r.entryId,
					createdAt: r.createdAt.toISOString(),
					type: r.type,
					amount: Number(r.amount),
					description: r.description,
					isReversed: r.isReversed,
					studentName: r.studentName,
					studentNis: r.studentNis,
					studentClass: r.studentClass,
					planName: r.planName,
					planCode: r.planCode,
					operatorName: r.operatorName,
					reversalReason: r.reversalReason,
				})),
			};
		}),
	);
};
