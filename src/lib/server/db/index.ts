import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

if (!building && !env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const client = neon(env.DATABASE_URL || 'postgresql://db_user:db_password@db_host.neon.tech/db_name');

export const db = drizzle(client, { schema });
