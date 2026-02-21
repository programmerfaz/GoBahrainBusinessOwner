# Go Bahrain — Business & Tourism Platform

A React + Vite web application for tourism in Bahrain. Clients can create profiles, manage them, and add posts.

## Setup

1. Copy `.env.example` to `.env` and add your Supabase URL and anon key:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Ensure `public.account` table has columns: `account_uuid`, `email`, `password`, `name`, `phone`, `created_at`. Allow INSERT and SELECT via RLS (or disable RLS for testing).

3. Run:

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run preview` — Preview production build

## Profile Submit (Supabase + Pinecone)

On profile submit:
- **Supabase** — Inserts into `client`; for Restaurant → `restaurant_client`; Place → `place_client` + `place`; Event → `event_clients`.
- **Pinecone** — Merged client + entity data is sent to Edge Function, embedded via OpenAI, and upserted.

Deploy the Edge Function and set secrets:
```bash
supabase functions deploy upsert-to-pinecone --no-verify-jwt
supabase secrets set OPENAI_API_KEY=... PINECONE_API_KEY=... PINECONE_HOST=...
```

## Structure

- **Home** — Landing page
- **Profile** — Client profile form (creates client in Supabase + Pinecone)
- **Posts** — Add and manage posts
- **Sign In / Sign Up** — Auth via `public.account` table
