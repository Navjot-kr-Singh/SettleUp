# Deployment Guide: SettleUp Platform

This guide outlines the step-by-step instructions to deploy the SettleUp platform. We will host the **PostgreSQL Database** on **Render** (or Neon/Supabase) and deploy the **Next.js Web Application** on **Vercel**.

---

## Prerequisites
- A **GitHub** account with your SettleUp repository pushed.
- A **Vercel** account (linked to GitHub).
- A **Render** account.

---

## Step 1: Deploy PostgreSQL Database on Render

Since Vercel is a serverless platform, it does not host database state. We will deploy a managed PostgreSQL database on Render.

1. **Log in** to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** (top right) and select **PostgreSQL**.
3. Configure the database details:
   - **Name**: `settleup-db`
   - **Database**: `settleup`
   - **User**: `settleup_user`
   - **Region**: Choose the region closest to you (e.g., US East, Singapore).
   - **Instance Type**: Select **Free**.
4. Click **Create Database**.
5. Once database provisioning completes, locate the **Connection Info** section:
   - Copy the **External Connection String**. It will look like:
     `postgresql://settleup_user:password@dpg-xxxx-a.singapore-postgres.render.com/settleup`
   - Copy this URL; you will need it for both your local setup (to run migrations/seeds) and your Vercel configuration.

---

## Step 2: Initialize the Remote Database (Migrations & Seed)

Before building the frontend, we must create the schema tables and seed the demo users in the Render database.

1. Open a terminal in your local project workspace.
2. Run the Prisma migrations pointing to your Render PostgreSQL database connection string:
   ```bash
   DATABASE_URL="<YOUR_RENDER_EXTERNAL_CONNECTION_STRING>" npx prisma migrate deploy
   ```
3. Run the database seed script to populate the demo users (Aisha, Rohan, etc.) and exchange rates:
   ```bash
   DATABASE_URL="<YOUR_RENDER_EXTERNAL_CONNECTION_STRING>" npx prisma db seed
   ```

---

## Step 3: Deploy Next.js Web App on Vercel

1. **Log in** to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your SettleUp GitHub repository.
4. In the **Configure Project** settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
5. Expand the **Build and Development Settings**:
   - **Build Command**: Change to include Prisma generation:
     ```bash
     npx prisma generate && next build
     ```
     > [!IMPORTANT]
     > Running `npx prisma generate` during the Vercel build step is mandatory to ensure the Prisma client is correctly compiled inside Vercel's serverless runtime.
6. Expand the **Environment Variables** section and add the following keys:
   - `DATABASE_URL`: Paste the **External Connection String** copied from Render (append `?sslmode=require` to enforce secure SSL, e.g., `postgresql://.../settleup?sslmode=require`).
   - `NEXTAUTH_SECRET`: Generate a secure random 32-character string. You can run `openssl rand -base64 32` in your local terminal to get one.
   - `NEXTAUTH_URL`: Enter the production Vercel app URL (e.g., `https://settleup-xxxx.vercel.app`).
     *Note: During initial build, if you do not know the assigned Vercel URL, you can leave this blank or update it after Vercel assigns the domain, then trigger a redeploy.*
7. Click **Deploy**.

---

## Step 4: Verification

1. Once the Vercel deployment completes, open the assigned production URL.
2. Verify that you are redirected to `/login` if unauthenticated.
3. Test **Quick Login** using Aisha or Rohan to confirm that NextAuth successfully queries the database hosted on Render.
4. Try registering a new user at `/signup` to verify the self-service authentication flow.
5. Create a group, log an expense, and check that database writes succeed in the live production system.
