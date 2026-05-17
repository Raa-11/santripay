import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

if (!building && !env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const client = neon(env.DATABASE_URL || 'postgres://mock-db-url-for-build');

export const db = drizzle(client, { schema });
