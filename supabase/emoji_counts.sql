-- Emoji counters for the homepage.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.

create table if not exists public.emoji_counts (
  emoji      text primary key,
  count      bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.emoji_counts (emoji)
values ('🚀'), ('💯'), ('😐'), ('🤢'), ('💩'), ('☠️')
on conflict (emoji) do nothing;

-- Visitors can read the counts but never write the table directly.
alter table public.emoji_counts enable row level security;

drop policy if exists "Anyone can read emoji counts" on public.emoji_counts;
create policy "Anyone can read emoji counts"
  on public.emoji_counts for select
  to anon, authenticated
  using (true);

-- The only way to change a count: this function. It accepts our six emojis only,
-- and at most 10 taps per emoji per call, so nobody can add a million in one go.
create or replace function public.add_emoji_taps(taps jsonb)
returns setof public.emoji_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  n int;
begin
  if jsonb_typeof(taps) <> 'object' then
    return query select * from public.emoji_counts;
    return;
  end if;

  for k, n in
    select key, least(greatest(floor((value #>> '{}')::numeric), 0), 10)::int
    from jsonb_each(taps)
    where key in ('🚀', '💯', '😐', '🤢', '💩', '☠️')
      and jsonb_typeof(value) = 'number'
  loop
    if n > 0 then
      update public.emoji_counts
        set count = count + n, updated_at = now()
        where emoji = k;
    end if;
  end loop;

  return query select * from public.emoji_counts;
end;
$$;

revoke all on function public.add_emoji_taps(jsonb) from public;
grant execute on function public.add_emoji_taps(jsonb) to anon, authenticated;
