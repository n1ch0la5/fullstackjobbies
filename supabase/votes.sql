-- Developer votes on job ratings.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.
--
-- Each browser gets a random voter id (no accounts). One vote per job per
-- browser; voting again changes your vote. Visitors can't read or write the
-- table directly, only through the two functions below.

create table if not exists public.job_votes (
  job_id     text     not null check (char_length(job_id) between 3 and 200),
  voter      uuid     not null,
  level      smallint not null check (level between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_id, voter)
);
create index if not exists job_votes_job_idx on public.job_votes (job_id);
create index if not exists job_votes_voter_time_idx on public.job_votes (voter, updated_at);

alter table public.job_votes enable row level security;
-- No policies on purpose: all access goes through the functions.

-- Cast or change a vote. Returns the job's new totals.
create or replace function public.cast_job_vote(p_job_id text, p_voter uuid, p_level int)
returns table (job_id text, votes bigint, avg_level numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_level < 0 or p_level > 5 then
    raise exception 'level must be 0 to 5';
  end if;
  if p_job_id is null or p_job_id !~ '^[A-Za-z0-9:._%-]{3,200}$' then
    raise exception 'bad job id';
  end if;
  -- Gentle brake on scripts: at most 30 votes per voter per 10 minutes.
  if (select count(*) from public.job_votes v
        where v.voter = p_voter and v.updated_at > now() - interval '10 minutes') >= 30 then
    raise exception 'slow down';
  end if;

  insert into public.job_votes as v (job_id, voter, level)
  values (p_job_id, p_voter, p_level)
  on conflict (job_id, voter) do update
    set level = excluded.level, updated_at = now();

  return query
    select v.job_id, count(*)::bigint, round(avg(v.level), 2)
    from public.job_votes v
    where v.job_id = p_job_id
    group by v.job_id;
end;
$$;

-- Totals for a batch of jobs (the jobs page asks for all of its jobs at once).
create or replace function public.job_vote_summaries(p_job_ids text[])
returns table (job_id text, votes bigint, avg_level numeric)
language sql
stable
security definer
set search_path = public
as $$
  select v.job_id, count(*)::bigint, round(avg(v.level), 2)
  from public.job_votes v
  where v.job_id = any (p_job_ids[1:500])
  group by v.job_id;
$$;

revoke all on function public.cast_job_vote(text, uuid, int) from public;
revoke all on function public.job_vote_summaries(text[]) from public;
grant execute on function public.cast_job_vote(text, uuid, int) to anon, authenticated;
grant execute on function public.job_vote_summaries(text[]) to anon, authenticated;
