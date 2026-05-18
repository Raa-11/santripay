import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { ilike, or, desc, asc, count, sql, eq, inArray } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { superValidate, message } from 'sveltekit-superforms';
import { effect } from 'sveltekit-superforms/adapters';

// ── 1. SCHEMAS ──
const UserSchema = Schema.Struct({
	id: Schema.optional(Schema.String),
	name: Schema.String.pipe(Schema.minLength(2)),
	email: Schema.String.pipe(Schema.pattern(/^[^@]+@[^@]+\.[^@]+$/)),
	password: Schema.optional(Schema.String),
	confirmPassword: Schema.optional(Schema.String)
}).pipe(
	Schema.filter((s) => !s.password || s.password === s.confirmPassword, {
		message: "Passwords do not match", path: ["confirmPassword"]
	})
);

const PasswordSchema = Schema.Struct({
	id: Schema.String,
	oldPassword: Schema.String.pipe(Schema.minLength(1)),
	newPassword: Schema.String.pipe(Schema.minLength(8)),
	confirmPassword: Schema.String
}).pipe(
	Schema.filter((s) => s.newPassword === s.confirmPassword, {
		message: "Passwords do not match", path: ["confirmPassword"]
	})
);

const DeleteSchema = Schema.Struct({ ids: Schema.Array(Schema.String) });

// ── 1.5 ADAPTERS (Best Practice: Define at top level for caching) ──
const userAdapter = effect(UserSchema);
const passwordAdapter = effect(PasswordSchema);
const deleteAdapter = effect(DeleteSchema);


// ── 2. LOAD ──
export const load: PageServerLoad = ({ locals }) => {
	return Effect.runPromise(Effect.gen(function* () {
		const [users, addForm, editForm, passwordForm, deleteForm] = yield* Effect.all([
			Effect.promise(() => db.select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt }).from(user).orderBy(desc(user.createdAt))),
			Effect.promise(() => superValidate(userAdapter, { id: 'add' })),
			Effect.promise(() => superValidate(userAdapter, { id: 'edit' })),
			Effect.promise(() => superValidate(passwordAdapter, { id: 'password' })),
			Effect.promise(() => superValidate(deleteAdapter, { id: 'delete' }))
		]);

		return { users, addForm, editForm, passwordForm, deleteForm, currentUserId: locals.user?.id };
	}));
};

// ── 3. ACTIONS ──
export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, userAdapter);
		if (!form.valid) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.promise(() =>
					auth.api.signUpEmail({
						body: {
							email: form.data.email,
							password: form.data.password || 'password123',
							name: form.data.name
						},
						headers: new Headers()
					})
				);

				yield* Effect.promise(() =>
					db.update(user).set({ emailVerified: true }).where(eq(user.email, form.data.email))
				);

				return message(form, 'User created successfully');
			}).pipe(
				Effect.catchAll((err) => {
					console.error('Create Error:', err);
					return Effect.succeed(fail(500, { form, message: 'Failed to create user' }));
				})
			)
		);
	},

	update: async ({ request }) => {
		const form = await superValidate(request, userAdapter);
		if (!form.valid || !form.data.id) return fail(400, { form });

		return Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.promise(() =>
					db
						.update(user)
						.set({ name: form.data.name, email: form.data.email })
						.where(eq(user.id, form.data.id))
				);
				return message(form, 'Profile updated');
			}).pipe(
				Effect.catchAll(() => Effect.succeed(fail(500, { form, message: 'Update failed' })))
			)
		);
	},

	updatePassword: async ({ request }) => {
		const form = await superValidate(request, passwordAdapter);
		if (!form.valid) return fail(400, { form });

		return message(form, 'Password feature coming soon');
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

				const idsToDelete = form.data.ids.filter((id) => id !== session.user.id);
				if (idsToDelete.length > 0) {
					yield* Effect.promise(() => db.delete(user).where(inArray(user.id, idsToDelete)));
				}

				return message(
					form,
					idsToDelete.length < form.data.ids.length
						? 'Self-account skipped.'
						: 'Deleted successfully'
				);
			}).pipe(
				Effect.catchAll((err) => {
					if (err && typeof err === 'object' && 'type' in err) return Effect.succeed(err);
					return Effect.succeed(fail(500, { form, message: 'Deletion failed' }));
				})
			)
		);
	}
};
