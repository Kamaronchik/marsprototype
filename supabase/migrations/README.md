# Database migrations

All database changes live here, as numbered SQL files. They are applied in number order.

Rule: **a change of the schema is a new file** (`014_...`, `015_...`). Never edit a file that was already
applied to a real database.

## Deploy the database from scratch

1. Create a project at https://supabase.com (the region closest to Tashkent).
2. Open **SQL Editor -> New query**.
3. Run the files one by one, in this order. Copy the whole file, press Run, wait for "Success":

| # | File | What it makes |
|---|------|---------------|
| 001 | `001_schema.sql` | users, sessions, trusted devices, 2FA codes |
| 002 | `002_rpc_verify_2fa.sql` | SQL function that checks a 2FA code |
| 003 | `003_academic.sql` | groups, students in groups, attendance, payments |
| 004 | `004_shop.sql` | wallets, products, orders, coin transactions, audit_log |
| 005 | `005_rpc_shop.sql` | shop functions (award, purchase, cancel) |
| 006 | `006_platform.sql` | rooms and time of groups, notifications, teacher salaries |
| 007 | `007_battle.sql` | battles, question bank, translation overrides |
| 008 | `008_allow_shared_email.sql` | one e-mail may be used by several accounts |
| 009 | `009_telegram.sql` | Telegram links and messages |
| 010 | `010_fix_teacher_pool.sql` | teacher coin pool and the monthly top up |
| 011 | `011_learning.sql` | homework, submissions, grades |
| 012 | `012_balance.sql` | student balance and the lesson price |
| 013 | `013_academic_manager.sql` | AcademicManager role, schedule, lessons, ratings, AI reports |
| 014 | `014_subjects.sql` | subjects and groups.subject_id |
| 015 | `015_expenses.sql` | school expenses |
| 016 | `016_careers.sql` | job applications, notes, private "resumes" bucket |
| 017 | `017_audit_indexes.sql` | indexes for the audit page |
| 018 | `018_audit_system.sql` | Owner role, richer audit_log with DB triggers, rules, violations |
| 019+ | later files | see the list in this folder |

4. Put the keys into `.env` (see `.env.example`): `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
   (Project settings -> API -> `service_role`). The secret key stays on the server only.
5. Fill the battle question bank: `npm run seed-battle`.
6. Create the first admin: `npm run create-admin` (the password is written to `.admin-credentials.txt`,
   which is in `.gitignore`).
7. Check: `npm run test`. It uses accounts called `zz_test_*` and blocks them again at the end.

## Security model

Every table has Row Level Security turned on and **no policies**. The browser never talks to Supabase:
it talks to our server, and the server uses the `service_role` key, which skips RLS.
So the `anon` key can read and write nothing. Rights are checked on the server
(`requireRole` in the routes and the checks inside the controllers).

## Safe to run twice

Files use `IF NOT EXISTS`, `OR REPLACE` or `DROP ... IF EXISTS`, so running a file again does no harm.
Still, on a database that already works, run only the new files.
