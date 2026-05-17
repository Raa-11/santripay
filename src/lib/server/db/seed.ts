import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema.ts';
import { students } from './student.schema.ts';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET!;
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';

const client = neon(DATABASE_URL);
const db = drizzle(client, { schema });

const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true }
});

const studentData = [
	{ nis: '2024001', name: 'Ahmad Fauzi', gender: 'L', class: '1A', address: 'Jl. Mawar No. 1' },
	{ nis: '2024002', name: 'Budi Santoso', gender: 'L', class: '1A', address: 'Jl. Melati No. 2' },
	{ nis: '2024003', name: 'Citra Dewi', gender: 'P', class: '1A', address: 'Jl. Anggrek No. 3' },
	{ nis: '2024004', name: 'Dina Rahayu', gender: 'P', class: '1A', address: 'Jl. Kenanga No. 4' },
	{ nis: '2024005', name: 'Eko Prasetyo', gender: 'L', class: '1A', address: 'Jl. Dahlia No. 5' },
	{ nis: '2024006', name: 'Faisal Ramadan', gender: 'L', class: '1B', address: 'Jl. Tulip No. 6' },
	{ nis: '2024007', name: 'Ghina Maulida', gender: 'P', class: '1B', address: 'Jl. Flamboyan No. 7' },
	{ nis: '2024008', name: 'Hasan Basri', gender: 'L', class: '1B', address: 'Jl. Sakura No. 8' },
	{ nis: '2024009', name: 'Indah Permata', gender: 'P', class: '1B', address: 'Jl. Seroja No. 9' },
	{ nis: '2024010', name: 'Joko Widodo', gender: 'L', class: '1B', address: 'Jl. Kamboja No. 10' },
	{ nis: '2024011', name: 'Khairul Umam', gender: 'L', class: '2A', address: 'Jl. Wijaya No. 11' },
	{ nis: '2024012', name: 'Laila Nurhayati', gender: 'P', class: '2A', address: 'Jl. Palem No. 12' },
	{ nis: '2024013', name: 'Muhammad Ridwan', gender: 'L', class: '2A', address: 'Jl. Cemara No. 13' },
	{ nis: '2024014', name: 'Nadia Safitri', gender: 'P', class: '2A', address: 'Jl. Pinus No. 14' },
	{ nis: '2024015', name: 'Omar Faruk', gender: 'L', class: '2A', address: 'Jl. Beringin No. 15' },
	{ nis: '2024016', name: 'Putri Maharani', gender: 'P', class: '2B', address: 'Jl. Bambu No. 16' },
	{ nis: '2024017', name: 'Qodir Jailani', gender: 'L', class: '2B', address: 'Jl. Rambutan No. 17' },
	{ nis: '2024018', name: 'Rina Wulandari', gender: 'P', class: '2B', address: 'Jl. Mangga No. 18' },
	{ nis: '2024019', name: 'Samsul Arifin', gender: 'L', class: '2B', address: 'Jl. Jambu No. 19' },
	{ nis: '2024020', name: 'Tiara Agustina', gender: 'P', class: '2B', address: 'Jl. Jeruk No. 20' },
	{ nis: '2024021', name: 'Umar Hakim', gender: 'L', class: '3A', address: 'Jl. Apel No. 21' },
	{ nis: '2024022', name: 'Vivi Anggraini', gender: 'P', class: '3A', address: 'Jl. Salak No. 22' },
	{ nis: '2024023', name: 'Wahyu Setiawan', gender: 'L', class: '3A', address: 'Jl. Nangka No. 23' },
	{ nis: '2024024', name: 'Xena Fitriani', gender: 'P', class: '3A', address: 'Jl. Durian No. 24' },
	{ nis: '2024025', name: 'Yusuf Hidayat', gender: 'L', class: '3A', address: 'Jl. Sirsak No. 25' },
	{ nis: '2024026', name: 'Zahra Mardiah', gender: 'P', class: '3B', address: 'Jl. Pepaya No. 26' },
	{ nis: '2024027', name: 'Aldi Firmansyah', gender: 'L', class: '3B', address: 'Jl. Pisang No. 27' },
	{ nis: '2024028', name: 'Bella Savitri', gender: 'P', class: '3B', address: 'Jl. Semangka No. 28' },
	{ nis: '2024029', name: 'Chairul Anwar', gender: 'L', class: '3B', address: 'Jl. Melon No. 29' },
	{ nis: '2024030', name: 'Desi Kurniawati', gender: 'P', class: '3B', address: 'Jl. Markisa No. 30' },
	{ nis: '2024031', name: 'Erfan Maulana', gender: 'L', class: '4A', address: 'Jl. Stroberi No. 31' },
	{ nis: '2024032', name: 'Fitri Handayani', gender: 'P', class: '4A', address: 'Jl. Anggur No. 32' },
	{ nis: '2024033', name: 'Gilang Pratama', gender: 'L', class: '4A', address: 'Jl. Leci No. 33' },
	{ nis: '2024034', name: 'Hesti Nurjanah', gender: 'P', class: '4A', address: 'Jl. Kiwi No. 34' },
	{ nis: '2024035', name: 'Ilham Saputra', gender: 'L', class: '4A', address: 'Jl. Alpukat No. 35' },
	{ nis: '2024036', name: 'Julia Ramadhani', gender: 'P', class: '4B', address: 'Jl. Kurma No. 36' },
	{ nis: '2024037', name: 'Kevin Ardianto', gender: 'L', class: '4B', address: 'Jl. Zaitun No. 37' },
	{ nis: '2024038', name: 'Lisa Amalia', gender: 'P', class: '4B', address: 'Jl. Delima No. 38' },
	{ nis: '2024039', name: 'Maulana Ibrahim', gender: 'L', class: '4B', address: 'Jl. Tin No. 39' },
	{ nis: '2024040', name: 'Nurul Aini', gender: 'P', class: '4B', address: 'Jl. Bidara No. 40' },
	{ nis: '2024041', name: 'Octavia Sari', gender: 'P', class: '5A', address: 'Jl. Murbei No. 41' },
	{ nis: '2024042', name: 'Pandu Wicaksono', gender: 'L', class: '5A', address: 'Jl. Ceri No. 42' },
	{ nis: '2024043', name: 'Qonita Azizah', gender: 'P', class: '5A', address: 'Jl. Persik No. 43' },
	{ nis: '2024044', name: 'Rendi Kurniawan', gender: 'L', class: '5A', address: 'Jl. Pir No. 44' },
	{ nis: '2024045', name: 'Siti Aminah', gender: 'P', class: '5A', address: 'Jl. Plum No. 45' },
	{ nis: '2024046', name: 'Taufik Hidayat', gender: 'L', class: '5B', address: 'Jl. Kesemek No. 46' },
	{ nis: '2024047', name: 'Ulfah Khoiriyah', gender: 'P', class: '5B', address: 'Jl. Blewah No. 47' },
	{ nis: '2024048', name: 'Vicky Andrean', gender: 'L', class: '5B', address: 'Jl. Tomat No. 48' },
	{ nis: '2024049', name: 'Winda Lestari', gender: 'P', class: '5B', address: 'Jl. Terong No. 49' },
	{ nis: '2024050', name: 'Yoga Pratama', gender: 'L', class: '5B', address: 'Jl. Wortel No. 50' },
];

async function seed() {
	console.log('Seeding admin...');
	await auth.api.signUpEmail({
		body: {
			email: 'admin@santripay.com',
			password: 'admin123',
			name: 'Admin'
		}
	}).catch(() => console.log('Admin already exists, skipping.'));

	console.log('\nSeeding 50 students...');
	try {
		await db.insert(students)
			.values(studentData.map(s => ({ ...s, isActive: true })))
			.onConflictDoNothing();
		console.log('Students seeded (duplicates skipped).');
	} catch (err) {
		console.error('Student seed error:', err);
	}

	console.log('\nDone! Login with admin@santripay.com / admin123');
}

seed();
