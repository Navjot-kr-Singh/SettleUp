# Database Alignment Report

This report analyzes the mismatch between the local SettleUp migration history and the active schema found in the Neon PostgreSQL database.

---

## 1. Migration History vs. Neon Database Status

An analysis of the local migration files and the remote Neon database (`neondb` on host `ep-late-scene-aqgkap8a-pooler`) revealed the following alignment issues:

### A. Pending Migrations
None of SettleUp's local migrations have been applied to this database instance. The following 9 migrations are completely unapplied:
1. `20260613080411_init` (core schema)
2. `20260613083347_add_soft_delete`
3. `20260613084118_expand_audit_log`
4. `20260613084955_version_balance_snapshot`
5. `20260613085028_add_performance_indexes`
6. `20260613090324_expand_import_session`
7. `20260613092400_harden_import_engine`
8. `20260613100000_add_commit_engine`
9. `20260614142700_add_user_registration`

### B. Conflicting Database Content
The remote database contains 11 active tables from another application (such as B2B pharmacy products, orders, categories, and users). 

---

## 2. Risk Assessment & Safe Alignment Strategy

Running `npx prisma migrate dev` or `npx prisma db push` against the current remote database URL is **extremely dangerous** and NOT recommended:
- **Risk**: A database reset or model push could drop or damage the existing tables of the other project sharing this database.
- **Safety Rule**: **Do not generate destructive SQL** and **Do not delete existing data** from the conflicting project.

### Recommended Fix (100% Safe)

To resolve the database misalignment without destructive data loss on the other project, we must separate the database namespaces:

1. **Create a separate database instance** in your Neon project dashboard:
   - Go to your Neon console.
   - Under the "Databases" section, click **New Database**.
   - Name it `settleup`.
2. **Update your local `.env` configuration file**:
   - Change the database name in your `DATABASE_URL` connection string from `/neondb` to `/settleup`.
   - Update line 2 in `.env` to:
     ```text
     DATABASE_URL="postgresql://neondb_owner:npg_j1U0PkSBAFaK@ep-late-scene-aqgkap8a-pooler.c-8.us-east-1.aws.neon.tech/settleup?sslmode=require&channel_binding=require"
     ```
3. **Apply the migration history to the new database**:
   - Once `.env` is updated, run the migrations safely in your terminal:
     ```bash
     npx prisma migrate dev
     ```
   - Seed the database with SettleUp's default users and exchange rates:
     ```bash
     npx prisma db seed
     ```

This guarantees a clean separation of concerns, ensures SettleUp's models map properly, and preserves the pharmacy application tables from any deletion.
