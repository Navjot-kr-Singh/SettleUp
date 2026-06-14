# Public User Registration: Implementation Report

This report outlines the technical and architectural details of the Phase 8 **Self-Service Authentication & Public Registration** feature added to SettleUp.

---

## 1. Feature Specifications

The self-service registration allows any new visitor to register for an account on the SettleUp platform and start using all visual workflows independently.

### User Interface: `/signup`
- **Location**: `src/app/signup/page.tsx`
- **Fields**:
  - Full Name (`name`)
  - Email Address (`email`)
  - Password (`password`)
  - Confirm Password (`confirmPassword`)
- **Visual Design**: Styled with premium HSL-derived colors, glassmorphism visual aesthetics, and custom inputs matching the `/login` portal layout.

### Client-Side Validation
- **Name**: Required field, minimum 2 characters.
- **Email**: Required field, validated against standard email format pattern.
- **Password**: Required field, minimum 8 characters.
- **Confirm Password**: Required, must exactly match Password.
- **Feedback**: Rendered as dynamic red warning blocks underneath inputs or as form-level error frames.

---

## 2. API Endpoint: `POST /api/auth/register`
- **Location**: `src/app/api/auth/register/route.ts`
- **Validation**: Enforces strict backend boundaries using `zod` schema checks.
- **Duplicate Protection**: Querying existing email records in `User` table to reject duplicates with a 400 Bad Request and an explicit warning.
- **Security Hashing**: Passes raw passwords through `bcryptjs` with **12 hashing rounds** before writing the resulting digest to the database.
- **Database Entity**: Saves the record with:
  - `passwordHash` populated with the bcrypt hash.
  - `isGuest` explicitly set to `false`.
  - Standard database identifier uuid.

---

## 3. Safe Schema Migration
To support credentials validation without corrupting existing database states, the schema update:
1. Kept `email` and `name` nullable or non-unique where necessary to prevent seeding conflicts.
2. Introduced `passwordHash String?` to replace the old plain-text `password` property.
3. Added `isGuest Boolean @default(false)` to distinguish transient guests from registered accounts.
4. Ran the migration cleanly:
   ```bash
   npx prisma migrate dev --name add_user_registration
   ```
5. Preserved the integrity of Aisha, Rohan, and other seeded users by updating the seed script (`prisma/seed.ts`) to hash passwords using 12-round bcrypt hashes and set `isGuest: false`.

---

## 4. Auto-Login Redirection Flow
On successful registration, the signup handler:
1. Receives a successful 201 response from the registration API.
2. Automatically triggers NextAuth client-side sign-in:
   ```javascript
   const res = await signIn('credentials', {
     email,
     password,
     redirect: false
   });
   ```
3. Checks for authentication errors.
4. If successful, performs client-side routing using `router.push('/dashboard')`, providing a frictionless, single-click signup-to-onboarding pipeline.
