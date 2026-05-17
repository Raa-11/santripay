import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { students } from '$lib/server/db/schema';
import { and, or, ilike, isNull } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) return json([]);

	const results = await db
		.select({
			id: students.id,
			nis: students.nis,
			name: students.name,
			class: students.class,
			gender: students.gender,
		})
		.from(students)
		.where(
			and(
				isNull(students.deletedAt),
				or(ilike(students.nis, `%${q}%`), ilike(students.name, `%${q}%`)),
			),
		)
		.orderBy(students.name)
		.limit(10);

	return json(results);
};
