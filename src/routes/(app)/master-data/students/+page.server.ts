import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { students } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { ilike, or, desc, asc, count, sql, eq, inArray } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { superValidate, message } from 'sveltekit-superforms';
import { effect } from 'sveltekit-superforms/adapters';

const StudentSchema = Schema.Struct({
	id: Schema.optional(Schema.String),
	nis: Schema.String.pipe(Schema.minLength(1)),
	name: Schema.String.pipe(Schema.minLength(2)),
	gender: Schema.optional(Schema.String),
	class: Schema.optional(Schema.String),
	address: Schema.optional(Schema.String),
	isActive: Schema.optional(Schema.Boolean)
});

const DeleteSchema = Schema.Struct({ ids: Schema.Array(Schema.String) });

const studentAdapter = effect(StudentSchema);
const deleteAdapter = effect(DeleteSchema);

const BulkStatusSchema = Schema.Struct({ ids: Schema.Array(Schema.String), isActive: Schema.Boolean });
const bulkStatusAdapter = effect(BulkStatusSchema);

export const load: PageServerLoad = ({ url, locals }) => {
	return Effect.runPromise(Effect.gen(function* () {
		const [items, addForm, editForm, deleteForm, bulkStatusForm] = yield* Effect.all([
			Effect.promise(() => db.select().from(students).orderBy(desc(students.createdAt))),
			Effect.promise(() => superValidate({ isActive: true }, studentAdapter, { id: 'add' })),
			Effect.promise(() => superValidate({ isActive: true }, studentAdapter, { id: 'edit' })),
			Effect.promise(() => superValidate(deleteAdapter, { id: 'delete' })),
			Effect.promise(() => superValidate(bulkStatusAdapter, { id: 'bulkStatus' }))
		]);

		return { items, addForm, editForm, deleteForm, bulkStatusForm, currentUserId: locals.user?.id };
	}));
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, studentAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.promise(() =>
					db.insert(students).values({
						nis: form.data.nis,
						name: form.data.name,
						gender: form.data.gender || null,
						class: form.data.class || null,
						address: form.data.address || null,
						isActive: form.data.isActive ?? true
					})
				);

				return message(form, 'Student created successfully');
			}).pipe(
				Effect.catchAll((err: any) => {
					console.error('Create Error:', err);
					const isUnique = err?.message?.includes('23505') || err?.message?.includes('unique');
					return Effect.succeed(
						fail(isUnique ? 400 : 500, {
							form,
							message: isUnique ? 'NIS must be unique' : 'Failed to create student'
						})
					);
				})
			)
		);
	},

	update: async ({ request }) => {
		const form = await superValidate(request, studentAdapter);
		if (!form.valid || !form.data.id) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.promise(() =>
					db
						.update(students)
						.set({ 
                            nis: form.data.nis,
                            name: form.data.name,
                            gender: form.data.gender || null,
                            class: form.data.class || null,
                            address: form.data.address || null,
                            isActive: form.data.isActive ?? true 
                        })
						.where(eq(students.id, form.data.id as string))
				);
				return message(form, 'Student updated successfully');
			}).pipe(
				Effect.catchAll((err: any) => {
					console.error('Update Error:', err);
					const isUnique = err?.message?.includes('23505') || err?.message?.includes('unique');
					return Effect.succeed(
						fail(isUnique ? 400 : 500, {
							form,
							message: isUnique ? 'NIS must be unique' : 'Update failed'
						})
					);
				})
			)
		);
	},

	delete: async ({ request }) => {
		const form = await superValidate(request, deleteAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				const session = yield* Effect.promise(() =>
					auth.api.getSession({ headers: request.headers })
				);
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				const idsToDelete = form.data.ids;
				if (idsToDelete.length > 0) {
					yield* Effect.promise(() => db.delete(students).where(inArray(students.id, idsToDelete)));
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
				const session = yield* Effect.promise(() =>
					auth.api.getSession({ headers: request.headers })
				);
				if (!session) return yield* Effect.fail(fail(401, { form, message: 'Unauthorized' }));

				const idsToUpdate = form.data.ids;
				if (idsToUpdate.length > 0) {
					yield* Effect.promise(() => db.update(students).set({ isActive: form.data.isActive }).where(inArray(students.id, idsToUpdate)));
				}

				return message(form, 'Status updated successfully');
			}).pipe(
				Effect.catchAll((err) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Update failed' }));
				})
			)
		);
	}
};
