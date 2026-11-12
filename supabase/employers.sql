-- Employers: claiming a job (free) and featured jobs (paid).
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.
--
-- CLAIMS: an employer states the pay range and interview process for one of their jobs.
-- Every claim starts as 'pending'. Check the work email matches the company, then:
--   Table Editor → employer_claims → change status to 'approved' (or 'rejected').
-- The sift uses approved claims; interview reports from candidates still outrank them.
--
-- FEATURED: after a payment comes in on Polar, add a row to featured_jobs:
--   job_id = the order's reference_id in Polar (Orders → the order → Metadata): the job's slug, the last part of
--   its page address: fullstackjobbies.com/job/<slug>), ends_at = 30 days later.
-- The sift pins featured jobs (only ones with an approved claim) until ends_at.
-- Keep the allowed values in sync with src/reports.js.

create table if not exists public.employer_claims (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  claimant       uuid not null,  -- random id from the browser, only for the rate limit
  job_id         text check (job_id is null or job_id ~ '^[A-Za-z0-9:._%-]{3,200}$'),
  job_url        text not null check (job_url ~ '^https?://' and char_length(job_url) <= 2000),
  title          text check (char_length(title) <= 200),
  company        text check (char_length(company) <= 200),
  work_email     text not null check (work_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' and char_length(work_email) <= 320),
  pay_min        integer check (pay_min between 1 and 2000000),
  pay_max        integer check (pay_max between 1 and 2000000 and pay_max >= pay_min),
  pay_currency   text check (pay_currency in ('USD', 'CAD', 'GBP', 'EUR', 'AUD')),
  pay_interval   text check (pay_interval in ('year', 'hour')),
  work_style     text check (work_style in ('remote', 'hybrid', 'onsite')),
  steps          text[] not null default '{}' check (steps <@ array['recruiter_call','live_algorithm','take_home_paid','take_home_unpaid','pairing','system_design','team_chat','behavioral']),
  rounds         smallint check (rounds between 1 and 15),
  duration       text check (duration in ('under_2w', '2_4w', '1_2m', 'over_2m'))
);
create index if not exists employer_claims_status_idx on public.employer_claims (status);
create index if not exists employer_claims_claimant_time_idx on public.employer_claims (claimant, created_at);
alter table public.employer_claims enable row level security;
-- No policies on purpose: only the functions below can touch it.

create table if not exists public.featured_jobs (
  job_id     text primary key,  -- the job's slug (or its id)
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null default now() + interval '30 days',
  note       text  -- e.g. the Polar order id, for your own records
);
alter table public.featured_jobs enable row level security;

create or replace function public.submit_employer_claim(
  p_claimant uuid, p_job_url text, p_job_id text, p_title text, p_company text, p_work_email text,
  p_pay_min int, p_pay_max int, p_pay_currency text, p_pay_interval text, p_work_style text,
  p_steps text[], p_rounds int, p_duration text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if (select count(*) from public.employer_claims c
        where c.claimant = p_claimant and c.created_at > now() - interval '1 day') >= 10 then
    raise exception 'slow down';
  end if;
  insert into public.employer_claims (claimant, job_url, job_id, title, company, work_email, pay_min, pay_max,
                                      pay_currency, pay_interval, work_style, steps, rounds, duration)
  values (p_claimant, p_job_url, nullif(p_job_id, ''), left(p_title, 200), left(p_company, 200), lower(trim(p_work_email)),
          p_pay_min, p_pay_max, nullif(p_pay_currency, ''), nullif(p_pay_interval, ''), nullif(p_work_style, ''),
          coalesce(p_steps, '{}'), p_rounds, nullif(p_duration, ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- Approved claims without the email, newest first. The daily sift reads this.
create or replace function public.approved_employer_claims()
returns table (
  id uuid, created_at timestamptz, job_id text, job_url text, title text, company text,
  pay_min int, pay_max int, pay_currency text, pay_interval text, work_style text,
  steps text[], rounds smallint, duration text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.created_at, c.job_id, c.job_url, c.title, c.company, c.pay_min, c.pay_max, c.pay_currency,
         c.pay_interval, c.work_style, c.steps, c.rounds, c.duration
  from public.employer_claims c
  where c.status = 'approved'
  order by c.created_at desc
  limit 5000;
$$;

-- Job ids featured right now.
create or replace function public.active_featured_jobs()
returns table (job_id text, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select f.job_id, f.ends_at from public.featured_jobs f
  where f.starts_at <= now() and f.ends_at > now();
$$;

revoke all on function public.submit_employer_claim(uuid, text, text, text, text, text, int, int, text, text, text, text[], int, text) from public;
revoke all on function public.approved_employer_claims() from public;
revoke all on function public.active_featured_jobs() from public;
grant execute on function public.submit_employer_claim(uuid, text, text, text, text, text, int, int, text, text, text, text[], int, text) to anon, authenticated;
grant execute on function public.approved_employer_claims() to anon, authenticated;
grant execute on function public.active_featured_jobs() to anon, authenticated;
