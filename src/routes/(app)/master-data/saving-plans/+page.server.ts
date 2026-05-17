import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { savingPlans, studentSavings, students } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { desc, asc, count, eq, inArray, and, isNull, sql, getTableColumns } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { superValidate, message } from 'sveltekit-superforms';
import { effect } from 'sveltekit-superforms/adapters';

const SavingPlanSchema = Schema.Struct({
	id: Schema.optional(Schema.String),
	code: Schema.String.pipe(Schema.minLength(1)),
	name: Schema.String.pipe(Schema.minLength(2)),
	savingType: Schema.Literal('GOAL', 'FLEXIBLE'),
	defaultTargetAmount: Schema.optional(Schema.String),
	defaultContributionType: Schema.optional(Schema.String),
	defaultContributionValue: Schema.optional(Schema.String),
	startDate: Schema.optional(Schema.String),
	endDate: Schema.optional(Schema.String),
	isActive: Schema.optional(Schema.Boolean),
});

const DeleteSchema = Schema.Struct({ ids: Schema.Array(Schema.String) });
const BulkStatusSchema = Schema.Struct({ ids: Schema.Array(Schema.String), isActive: Schema.Boolean });
const EnrollStudentSchema = Schema.Struct({
	planId: Schema.String.pipe(Schema.minLength(1)),
	studentIds: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
});
const RemoveStudentsSchema = Schema.Struct({
	planId: Schema.String.pipe(Schema.minLength(1)),
	studentIds: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
});

const planAdapter = effect(SavingPlanSchema);
const deleteAdapter = effect(DeleteSchema);
const bulkStatusAdapter = effect(BulkStatusSchema);
const enrollAdapter = effect(EnrollStudentSchema);
const removeAdapter = effect(RemoveStudentsSchema);

export const load: PageServerLoad = ({ request }) => {
	return Effect.runPromise(Effect.gen(function* () {
		const session = yield* Effect.promise(() => auth.api.getSession({ headers: request.headers }));

		const [items, activeStudents, enrolledPairs, addForm, editForm, deleteForm, bulkStatusForm, enrollForm, removeForm] =
			yield* Effect.all([
				Effect.promise(() =>
					db
						.select({
							...getTableColumns(savingPlans),
							studentCount: count(studentSavings.id),
							totalBalance: sql<string>`COALESCE(SUM(${studentSavings.currentAmount}::numeric), 0)`,
						})
						.from(savingPlans)
						.leftJoin(
							studentSavings,
							and(eq(savingPlans.id, studentSavings.savingPlanId), isNull(studentSavings.deletedAt)),
						)
						.groupBy(savingPlans.id)
						.orderBy(desc(savingPlans.createdAt))
				),
				Effect.promise(() =>
					db
						.select({ id: students.id, nis: students.nis, name: students.name, class: students.class })
						.from(students)
						.where(eq(students.isActive, true))
						.orderBy(asc(students.name))
				),
				// enrolled students WITH details, for the "Enrolled" tab
				Effect.promise(() =>
					db
						.select({
							planId: studentSavings.savingPlanId,
							studentId: studentSavings.studentId,
							name: students.name,
							nis: students.nis,
							class: students.class,
							currentAmount: studentSavings.currentAmount,
						})
						.from(studentSavings)
						.innerJoin(students, eq(studentSavings.studentId, students.id))
						.where(isNull(studentSavings.deletedAt))
						.orderBy(asc(students.name))
				),
				Effect.promise(() => superValidate({ isActive: true }, planAdapter, { id: 'add' })),
				Effect.promise(() => superValidate({ isActive: true }, planAdapter, { id: 'edit' })),
				Effect.promise(() => superValidate(deleteAdapter, { id: 'delete' })),
				Effect.promise(() => superValidate(bulkStatusAdapter, { id: 'bulkStatus' })),
				Effect.promise(() => superValidate(enrollAdapter, { id: 'enroll' })),
				Effect.promise(() => superValidate(removeAdapter, { id: 'remove' })),
			]);

		return {
			items, activeStudents, enrolledPairs,
			addForm, editForm, deleteForm, bulkStatusForm, enrollForm, removeForm,
			currentUserId: session?.user.id,
		};
	}));
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, planAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.promise(() =>
					db.insert(savingPlans).values({
						code: form.data.code,
						name: form.data.name,
						savingType: form.data.savingType,
						defaultTargetAmount: form.data.defaultTargetAmount || null,
						defaultContributionType: form.data.defaultContributionType || null,
						defaultContributionValue: form.data.defaultContributionValue || null,
						startDate: form.data.startDate || null,
						endDate: form.data.endDate || null,
						isActive: form.data.isActive ?? true,
					})
				);
				return message(form, 'Saving plan created successfully');
			}).pipe(
				Effect.catchAll((err: any) => {
					const isUnique = err?.message?.includes('23505') || err?.message?.includes('unique');
					return Effect.succeed(fail(isUnique ? 400 : 500, { form, message: isUnique ? 'Code must be unique' : 'Failed to create plan' }));
				})
			)
		);
	},

	update: async ({ request }) => {
		const form = await superValidate(request, planAdapter);
		if (!form.valid || !form.data.id) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.promise(() =>
					db.update(savingPlans).set({
						code: form.data.code,
						name: form.data.name,
						savingType: form.data.savingType,
						defaultTargetAmount: form.data.defaultTargetAmount || null,
						defaultContributionType: form.data.defaultContributionType || null,
						defaultContributionValue: form.data.defaultContributionValue || null,
						startDate: form.data.startDate || null,
						endDate: form.data.endDate || null,
						isActive: form.data.isActive ?? true,
					}).where(eq(savingPlans.id, form.data.id as string))
				);
				return message(form, 'Saving plan updated successfully');
			}).pipe(
				Effect.catchAll((err: any) => {
					const isUnique = err?.message?.includes('23505') || err?.message?.includes('unique');
					return Effect.succeed(fail(isUnique ? 400 : 500, { form, message: isUnique ? 'Code must be unique' : 'Update failed' }));
				})
			)
		);
	},

	delete: async ({ request }) => {
		const form = await superValidate(request, deleteAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				const session = yield* Effect.promise(() => auth.api.getSession({ headers: request.headers }));
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				if (form.data.ids.length > 0) {
					const withBalance = yield* Effect.promise(() =>
						db
							.select({ planId: studentSavings.savingPlanId })
							.from(studentSavings)
							.where(
								and(
									inArray(studentSavings.savingPlanId, form.data.ids),
									isNull(studentSavings.deletedAt),
									sql`${studentSavings.currentAmount}::numeric > 0`,
								),
							)
							.limit(1),
					);

					if (withBalance.length > 0) {
						return message(
							form,
							'Cannot delete: one or more plans still have student balances. Clear all balances first.',
							{ status: 400 },
						);
					}

					yield* Effect.promise(() => db.delete(savingPlans).where(inArray(savingPlans.id, form.data.ids)));
				}
				return message(form, 'Deleted successfully');
			}).pipe(
				Effect.catchAll((err) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Deletion failed' }));
				})
			)
		);
	},

	bulkStatus: async ({ request }) => {
		const form = await superValidate(request, bulkStatusAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				const session = yield* Effect.promise(() => auth.api.getSession({ headers: request.headers }));
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				if (form.data.ids.length > 0) {
					yield* Effect.promise(() =>
						db.update(savingPlans).set({ isActive: form.data.isActive }).where(inArray(savingPlans.id, form.data.ids))
					);
				}
				return message(form, 'Status updated successfully');
			}).pipe(
				Effect.catchAll((err) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Update failed' }));
				})
			)
		);
	},

	enrollStudent: async ({ request }) => {
		const form = await superValidate(request, enrollAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				const session = yield* Effect.promise(() => auth.api.getSession({ headers: request.headers }));
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				const [plan] = yield* Effect.promise(() =>
					db.select().from(savingPlans).where(eq(savingPlans.id, form.data.planId)).limit(1)
				);
				if (!plan) return fail(404, { form, message: 'Plan not found' });

				const alreadyEnrolled = yield* Effect.promise(() =>
					db.select({ studentId: studentSavings.studentId })
						.from(studentSavings)
						.where(and(
							eq(studentSavings.savingPlanId, form.data.planId),
							inArray(studentSavings.studentId, form.data.studentIds as string[])
						))
				);

				const enrolledSet = new Set(alreadyEnrolled.map(r => r.studentId));
				const toInsert = (form.data.studentIds as string[]).filter(id => !enrolledSet.has(id));

				if (toInsert.length > 0) {
					yield* Effect.promise(() =>
						db.insert(studentSavings).values(
							toInsert.map(studentId => ({
								studentId,
								savingPlanId: form.data.planId,
								targetAmount: plan.defaultTargetAmount ?? null,
								currentAmount: '0',
								contributionType: plan.defaultContributionType ?? null,
								contributionValue: plan.defaultContributionValue ?? null,
								startDate: plan.startDate ?? null,
								endDate: plan.endDate ?? null,
								status: 'ACTIVE',
								createdBy: session.user.id,
							}))
						)
					);
				}

				const skipped = enrolledSet.size;
				const enrolled = toInsert.length;
				const msg = skipped > 0
					? `${enrolled} enrolled, ${skipped} already registered`
					: `${enrolled} student${enrolled !== 1 ? 's' : ''} enrolled successfully`;

				return message(form, msg);
			}).pipe(
				Effect.catchAll((err: any) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Failed to enroll students' }));
				})
			)
		);
	},

	removeStudents: async ({ request }) => {
		const form = await superValidate(request, removeAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				const session = yield* Effect.promise(() => auth.api.getSession({ headers: request.headers }));
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				const withBalance = yield* Effect.promise(() =>
					db
						.select({ studentId: studentSavings.studentId })
						.from(studentSavings)
						.where(
							and(
								eq(studentSavings.savingPlanId, form.data.planId),
								inArray(studentSavings.studentId, form.data.studentIds as string[]),
								isNull(studentSavings.deletedAt),
								sql`${studentSavings.currentAmount}::numeric > 0`,
							),
						)
						.limit(1),
				);

				if (withBalance.length > 0) {
					return message(
						form,
						'Cannot unenroll: one or more students still have a balance. Withdraw their balance first.',
						{ status: 400 },
					);
				}

				yield* Effect.promise(() =>
					db.delete(studentSavings).where(
						and(
							eq(studentSavings.savingPlanId, form.data.planId),
							inArray(studentSavings.studentId, form.data.studentIds as string[])
						)
					)
				);

				const n = (form.data.studentIds as string[]).length;
				return message(form, `${n} student${n !== 1 ? 's' : ''} removed`);
			}).pipe(
				Effect.catchAll((err: any) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Failed to remove students' }));
				})
			)
		);
	},
};
