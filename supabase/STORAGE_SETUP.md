# Profile & event images – Supabase setup

## 1. Create the Storage buckets

Images uploaded from the app use two buckets. Create both once:

**Event images (event organizer):**
1. Open **Supabase Dashboard** → **Storage**.
2. Click **New bucket**.
3. **Name:** `event-images`
4. Turn **Public bucket** ON.
5. Click **Create bucket**.

**Profile images (client/business image):**
1. Click **New bucket** again.
2. **Name:** `gobahrain-profile-images`
3. Turn **Public bucket** ON.
4. Click **Create bucket**.

(Optional) In **Policies** for each bucket, allow uploads: add a policy for `INSERT` and `SELECT` for anon or authenticated if needed.

## 2. Events table – `image` column

If the `events` table doesn’t have an `image` column yet, run in **SQL Editor**:

```sql
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image text DEFAULT NULL;
```

Or run the migration: `supabase/migrations/add_events_image_column.sql`

## 3. Save event image in the database

The backend and RPC must persist the event image. Ensure you’ve run the updated `update_client_profile` function that writes `image` to `public.events` (see `supabase/functions/update_client_profile.sql`). In **SQL Editor**, run the full contents of that file to update the function.

After this, uploading an image and saving the profile will store the file in Storage and the URL in `events.image`.
