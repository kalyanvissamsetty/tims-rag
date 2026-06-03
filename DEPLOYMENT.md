# Deployment Guide

## Architecture

Production architecture for this repo:

- `Vercel` runs:
  - the React frontend
  - Next.js server routes under `src/app/api`
- `Supabase` runs:
  - authentication
  - Postgres
  - storage
  - pgvector search
- `OpenAI` runs:
  - chat generation
  - embeddings
  - OCR fallback

You do not need EC2 for this version.

## 1. Prepare Supabase

Create a Supabase project and configure:

1. `Settings` -> `API`
2. collect:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

Run the SQL from:

- [supabase/migrations/001_init.sql](/Users/kalyan/Documents/RAG/supabase/migrations/001_init.sql)

Create or verify the storage bucket:

- `documents`

Promote your first admin:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

## 2. Configure Supabase Auth URLs

In Supabase:

- `Authentication`
- `URL Configuration`

Set:

- `Site URL`
- `Redirect URLs`

### Local development

- `Site URL`: `http://localhost:3000`
- Redirect URL:
  - `http://localhost:3000/login`
  - or `http://localhost:3000/**`

### Production

If deploying to Vercel:

- `Site URL`: `https://your-app.vercel.app`
- Redirect URL:
  - `https://your-app.vercel.app/login`
  - or `https://your-app.vercel.app/**`

If using a custom domain:

- `Site URL`: `https://yourdomain.com`
- Redirect URL:
  - `https://yourdomain.com/login`
  - or `https://yourdomain.com/**`

## 3. Deploy to Vercel

1. Push this repo to GitHub
2. Import it into Vercel
3. Set the framework to `Next.js`
4. Add the environment variables below

## 4. Required Vercel environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=documents
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_OCR_MODEL=gpt-4o-mini
OPENAI_DOCUMENT_MODEL=gpt-4o-mini
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

## 5. Deploy and verify

After the first deploy:

1. visit `/signup`
2. create a test user
3. verify email confirmation redirects to your deployed site
4. sign in
5. log in as admin
6. upload a small document
7. ask one grounded question in chat

## 6. Production checklist

- Supabase migration applied
- storage bucket available
- admin user promoted
- Vercel env vars set
- Supabase auth URLs updated
- `NEXT_PUBLIC_APP_URL` points to the correct production domain
- upload and chat tested

## 7. Notes

- This repo already includes longer function windows for streaming chat and document ingestion.
- API routes that depend on Node libraries are pinned to the Node runtime.
- If ingestion volume grows significantly later, add a background worker or queue, but that is not required for the current deployment model.
