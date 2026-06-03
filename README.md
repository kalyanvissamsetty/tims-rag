# TIMS AI Studio

A production-ready full-stack RAG application with a ChatGPT-style interface that answers from your uploaded documents, supports admin-managed knowledge ingestion, and ships cleanly on `Vercel + Supabase`.

## Stack

- `Next.js 15` + `React 19` + `TypeScript`
- `Tailwind CSS`
- `Supabase` for auth, Postgres, storage, and pgvector-backed retrieval
- `OpenAI` for chat generation, embeddings, OCR fallback, and routing
- `Vercel` for frontend and backend deployment

## Features

- Email/password signup and login
- Role-based admin and viewer experiences
- Dark/light mode
- ChatGPT-style chat with multi-session history
- Streaming responses
- Conversational memory for follow-up questions
- Strict document-grounded answering for knowledge questions
- Admin-configurable response behavior
- PDF, DOCX, PPTX, TXT, Markdown, and image ingestion
- Table-aware extraction improvements
- OCR fallback for scanned PDFs and image-heavy uploads
- Rename/delete chat sessions

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in `.env.local`:

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
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run the Supabase schema from:

- [supabase/migrations/001_init.sql](/Users/kalyan/Documents/RAG/supabase/migrations/001_init.sql)

5. Start the app:

```bash
npm run dev
```

## Supabase setup

Use a Supabase project for:

- Auth
- Postgres
- pgvector
- Storage

After running the migration, promote one user to admin:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

## Production deployment

Deploy this app with:

- `Vercel` for the app
- `Supabase` for auth/database/storage
- `OpenAI` for AI services

You do not need EC2 for the current architecture.

For the exact production checklist, see:

- [DEPLOYMENT.md](/Users/kalyan/Documents/RAG/DEPLOYMENT.md)

## Important production notes

- Set `NEXT_PUBLIC_APP_URL` to your real deployed domain in production.
- Update Supabase `Site URL` and `Redirect URLs` to match your deployed domain.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` server-side only.
- Uploaded documents are stored in the Supabase bucket named by `SUPABASE_STORAGE_BUCKET`.
- Large uploads and OCR work run through Next.js API routes, so Vercel is suitable for this version, but very heavy ingestion may later benefit from background workers.

## Production hardening included

- Explicit Node.js runtime on API routes that need it
- Extended function duration for chat and document ingestion
- Security headers via Next config
- Safer auth redirect handling using `NEXT_PUBLIC_APP_URL`
- Environment readiness checks
- Browser text selection and polished auth UX
