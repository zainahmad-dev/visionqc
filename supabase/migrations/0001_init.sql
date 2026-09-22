-- VisionQC — Phase 10 schema
--
-- Run this once in the Supabase dashboard: Project -> SQL Editor -> New query
-- -> paste this whole file -> Run. Safe to re-run (every statement is
-- idempotent) if something fails partway through.
--
-- The `inspection-images` Storage bucket (public read) already exists —
-- created separately via the Storage API, since bucket creation isn't DDL.

create extension if not exists pgcrypto; -- gen_random_uuid()

create table if not exists inspections (
  id text primary key,
  created_at timestamptz not null default now(),
  status text not null,
  category text,
  category_confidence real,
  ai_recommendation text,
  raw_output jsonb,
  error_code text,
  file_name text,
  image_path text,
  reviewer_category text,
  result_mode text not null default 'auto',
  notes text default '',
  reviewed_at timestamptz
);

create table if not exists defects (
  id uuid primary key default gen_random_uuid(),
  inspection_id text not null references inspections(id) on delete cascade,
  ai_type text,
  ai_severity text,
  ai_confidence real,
  ai_bbox jsonb,
  review text not null default 'pending',
  edited_type text,
  edited_severity text,
  edited_bbox jsonb
);

create index if not exists defects_inspection_id_idx on defects (inspection_id);
create index if not exists inspections_created_at_idx on inspections (created_at desc);

-- ---------------------------------------------------------------------------
-- ai_* columns are immutable once written. A reviewer's changes only ever go
-- to edited_*; this trigger makes that a database-level guarantee rather than
-- an application-level convention, and it fires for every role including the
-- service role (RLS can be bypassed by a privileged connection; a trigger
-- cannot).
-- ---------------------------------------------------------------------------

create or replace function reject_ai_column_update()
returns trigger
language plpgsql
as $$
begin
  if new.ai_type is distinct from old.ai_type
     or new.ai_severity is distinct from old.ai_severity
     or new.ai_confidence is distinct from old.ai_confidence
     or new.ai_bbox is distinct from old.ai_bbox
  then
    raise exception 'ai_* columns are immutable and cannot be modified (defect %)', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists defects_reject_ai_column_update on defects;
create trigger defects_reject_ai_column_update
  before update on defects
  for each row
  execute function reject_ai_column_update();

-- ---------------------------------------------------------------------------
-- Row Level Security. The app itself never uses these policies — its server
-- actions connect with the service role key, which bypasses RLS by design, and
-- that key never reaches the browser. These policies are what a signed-in
-- Supabase Auth user (the "authenticated" role) would be allowed once the app
-- grows real login; today nothing connects as anon or authenticated, so with
-- RLS on and no anon policy, both tables are unreadable and unwritable from
-- the browser's own credentials.
-- ---------------------------------------------------------------------------

alter table inspections enable row level security;
alter table defects enable row level security;

drop policy if exists "Authenticated reviewers can read inspections" on inspections;
create policy "Authenticated reviewers can read inspections"
  on inspections for select
  to authenticated
  using (true);

drop policy if exists "Authenticated reviewers can insert inspections" on inspections;
create policy "Authenticated reviewers can insert inspections"
  on inspections for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated reviewers can update inspections" on inspections;
create policy "Authenticated reviewers can update inspections"
  on inspections for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated reviewers can read defects" on defects;
create policy "Authenticated reviewers can read defects"
  on defects for select
  to authenticated
  using (true);

drop policy if exists "Authenticated reviewers can insert defects" on defects;
create policy "Authenticated reviewers can insert defects"
  on defects for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated reviewers can update defects" on defects;
create policy "Authenticated reviewers can update defects"
  on defects for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy, for either table or role, and none for "anon" anywhere:
-- nothing the app does ever deletes a saved record, and the anon key (used
-- nowhere in this app) gets no access at all.
