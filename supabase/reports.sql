-- Interview reports: "I interviewed here" and "Add a job".
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.
--
-- Fixed choices only, no free text. Every report starts as 'pending' and nothing
-- shows on the site until you approve it:
--   Table Editor → job_reports → change status to 'approved' (or 'rejected').
-- The daily sift reads approved reports and adds them to the site.
-- Keep the allowed values in sync with src/reports.js.

create table if not exists public.job_reports (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reporter       uuid not null,  -- random id from the browser, only for the rate limit
  job_id         text check (job_id is null or job_id ~ '^[A-Za-z0-9:._%-]{3,200}$'),
  job_url        text not null check (job_url ~ '^https?://' and char_length(job_url) <= 2000),
  title          text check (char_length(title) <= 200),
  company        text check (char_length(company) <= 200),
  description    text check (char_length(description) <= 20000), -- the job's own text, if the link can't be read
  stage          text not null check (stage in ('applied', 'recruiter', 'interviewed', 'offer')),
  steps          text[] not null default '{}' check (steps <@ array['recruiter_call','live_algorithm','take_home_paid','take_home_unpaid','pairing','system_design','team_chat','behavioral']),
  rounds         smallint check (rounds between 1 and 15),
  duration       text check (duration in ('under_2w', '2_4w', '1_2m', 'over_2m')),
  salary_upfront boolean,
  tags           text[] not null default '{}' check (tags <@ array['respected_time','clear_steps','prepared','gave_feedback','ghosted','moved_goalposts','pay_changed'])
);
create index if not exists job_reports_status_idx on public.job_reports (status);
create index if not exists job_reports_reporter_time_idx on public.job_reports (reporter, created_at);

alter table public.job_reports enable row level security;
-- No policies on purpose: visitors can't read or write the table, only use the functions below.

create or replace function public.submit_job_report(
  p_reporter uuid, p_job_url text, p_job_id text, p_title text, p_company text, p_description text,
  p_stage text, p_steps text[], p_rounds int, p_duration text, p_salary_upfront boolean, p_tags text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  -- Gentle brake on scripts: at most 5 reports per browser per day.
  if (select count(*) from public.job_reports r
        where r.reporter = p_reporter and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'slow down';
  end if;
  insert into public.job_reports (reporter, job_url, job_id, title, company, description,
                                  stage, steps, rounds, duration, salary_upfront, tags)
  values (p_reporter, p_job_url, nullif(p_job_id, ''), left(p_title, 200), left(p_company, 200),
          left(nullif(p_description, ''), 20000), p_stage, coalesce(p_steps, '{}'), p_rounds,
          nullif(p_duration, ''), p_salary_upfront, coalesce(p_tags, '{}'))
  returning id into new_id;
  return new_id;
end;
$$;

-- Approved reports only, without the reporter id. The daily sift reads this.
create or replace function public.approved_job_reports()
returns table (
  id uuid, created_at timestamptz, job_id text, job_url text, title text, company text, description text,
  stage text, steps text[], rounds smallint, duration text, salary_upfront boolean, tags text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.created_at, r.job_id, r.job_url, r.title, r.company, r.description,
         r.stage, r.steps, r.rounds, r.duration, r.salary_upfront, r.tags
  from public.job_reports r
  where r.status = 'approved'
  order by r.created_at
  limit 5000;
$$;

revoke all on function public.submit_job_report(uuid, text, text, text, text, text, text, text[], int, text, boolean, text[]) from public;
revoke all on function public.approved_job_reports() from public;
grant execute on function public.submit_job_report(uuid, text, text, text, text, text, text, text[], int, text, boolean, text[]) to anon, authenticated;
grant execute on function public.approved_job_reports() to anon, authenticated;
