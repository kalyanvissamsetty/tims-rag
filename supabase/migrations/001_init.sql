create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null default 0,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  chunk_count integer not null default 0,
  metadata jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  metadata jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);
create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_id_idx on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_id_idx on public.chat_messages (session_id, created_at);

create table if not exists public.rag_settings (
  id integer primary key,
  system_prompt text not null,
  response_style text not null check (response_style in ('strict', 'balanced', 'concise', 'detailed')),
  top_k integer not null default 6,
  temperature numeric(3,2) not null default 0.20,
  allow_citations boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.rag_settings (id, system_prompt, response_style, top_k, temperature, allow_citations)
values (
  1,
  'You are a retrieval-first assistant. Answer only from the uploaded documents. If the answer is not in the provided context, say you do not know.',
  'balanced',
  6,
  0.20,
  true
)
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_new_user$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, profiles.full_name);

  return new;
end;
$handle_new_user$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $touch_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$touch_updated_at$;

do $documents_trigger$
begin
  if to_regclass('public.documents') is not null then
    drop trigger if exists documents_updated_at on public.documents;
    create trigger documents_updated_at
    before update on public.documents
    for each row execute procedure public.touch_updated_at();
  end if;
end
$documents_trigger$;

do $chat_sessions_trigger$
begin
  if to_regclass('public.chat_sessions') is not null then
    drop trigger if exists chat_sessions_updated_at on public.chat_sessions;
    create trigger chat_sessions_updated_at
    before update on public.chat_sessions
    for each row execute procedure public.touch_updated_at();
  end if;
end
$chat_sessions_trigger$;

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
as $is_admin$
  select exists (
    select 1 from public.profiles where id = user_id and role = 'admin'
  );
$is_admin$;

create or replace function public.match_document_chunks(query_embedding vector(1536), match_count int default 6)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  file_name text,
  title text
)
language sql
stable
as $match_document_chunks$
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity,
    d.file_name,
    d.title
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where d.status = 'ready'
  order by dc.embedding <=> query_embedding
  limit match_count;
$match_document_chunks$;

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.rag_settings enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "Admins manage documents" on public.documents;
create policy "Admins manage documents"
on public.documents for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins manage chunks" on public.document_chunks;
create policy "Admins manage chunks"
on public.document_chunks for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Authenticated users can read ready documents" on public.documents;
create policy "Authenticated users can read ready documents"
on public.documents for select
using (auth.uid() is not null and status = 'ready');

drop policy if exists "Authenticated users can read chunks" on public.document_chunks;
create policy "Authenticated users can read chunks"
on public.document_chunks for select
using (auth.uid() is not null);

drop policy if exists "Users manage own sessions" on public.chat_sessions;
create policy "Users manage own sessions"
on public.chat_sessions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own messages" on public.chat_messages;
create policy "Users manage own messages"
on public.chat_messages for all
using (
  exists (
    select 1 from public.chat_sessions cs
    where cs.id = session_id and cs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.chat_sessions cs
    where cs.id = session_id and cs.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read rag settings" on public.rag_settings;
create policy "Authenticated users can read rag settings"
on public.rag_settings for select
using (auth.uid() is not null);

drop policy if exists "Admins manage rag settings" on public.rag_settings;
create policy "Admins manage rag settings"
on public.rag_settings for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
