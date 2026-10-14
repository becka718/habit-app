-- Habit Tracker database. Paste this whole file into Supabase > SQL Editor > Run (safe to run again).

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sequence_items jsonb not null default '[]' check (jsonb_typeof(sequence_items) = 'array' and jsonb_array_length(sequence_items) <= 50),
  schedule jsonb not null default '{}' check (jsonb_typeof(schedule) = 'object'),
  image_path text,
  image_full_path text,
  proof_prompt text check (proof_prompt is null or char_length(proof_prompt) between 1 and 100),
  position int not null default 0,
  created_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_pos on public.habits (user_id, position);

create table if not exists public.habit_logs (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  status text not null check (status in ('pending','done','skipped')),
  sequence_progress int not null default 0,
  minutes int not null default 0,
  primary key (habit_id, day)
);
create index if not exists habit_logs_user_day on public.habit_logs (user_id, day);

create table if not exists public.moods (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  mood smallint not null check (mood between 0 and 4),
  primary key (user_id, day)
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 120),
  done boolean not null default false,
  scope text not null default 'day' check (scope in ('day','week','month')),
  due date,
  rank int,
  remind_at timestamptz,
  done_on date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists todos_user on public.todos (user_id, created_at desc);

create table if not exists public.celebrations (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  kind text not null,
  primary key (user_id, day)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  q text not null check (char_length(q) <= 2000),
  a text not null check (char_length(a) <= 2000),
  bad boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_user on public.chat_messages (user_id, created_at desc);

-- Gems, unfreezes, quests (these tables can only be changed by the functions further down)
create table if not exists public.wallet (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  gems int not null default 0,        -- can dip below zero if a reward you already spent is reversed
  unfreezes int not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.gem_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_user on public.gem_ledger (user_id, created_at desc);
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('day','week','month','life','recovery')),
  title text not null,
  description text not null default '',
  metric text not null check (metric in ('habit_completions','habit_days','todos_done','mood_days','photo')),
  target int not null check (target > 0),
  difficulty smallint not null check (difficulty between 1 and 3),
  reward_gems int not null default 0,
  starts_on date not null,
  ends_on date not null,
  ends_at timestamptz not null,
  gap_from date,
  gap_to date,
  lost_len int,
  proof_prompt text,
  proof_ok boolean not null default false,
  gap_key date not null default date '1970-01-01',
  status text not null default 'active' check (status in ('active','claimed')),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, starts_on, gap_key)
);
create table if not exists public.streak_restores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_day date not null,
  to_day date not null,
  method text not null check (method in ('unfreeze','quest')),
  quest_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.todo_rewards (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  reward text not null,
  active boolean not null default true,
  done_count int not null default 0,
  primary key (user_id, day)
);

-- Row Level Security: every person can only ever see and change their own rows
alter table public.habits          enable row level security;
alter table public.habit_logs      enable row level security;
alter table public.moods           enable row level security;
alter table public.todos           enable row level security;
alter table public.celebrations    enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.wallet          enable row level security;
alter table public.gem_ledger      enable row level security;
alter table public.quests          enable row level security;
alter table public.streak_restores enable row level security;
alter table public.todo_rewards    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['habits','moods','todos','celebrations','chat_messages'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
  -- read-only for the person: only the functions below can write these
  foreach t in array array['wallet','gem_ledger','quests','streak_restores','todo_rewards'] loop
    execute format('drop policy if exists "read own" on public.%I', t);
    execute format('create policy "read own" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "own rows" on public.habit_logs;
create policy "own rows" on public.habit_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())));

-- ───────── Gem economy. Prices, limits and rewards live here: change the numbers to tune it. ─────────
create or replace function public._wallet() returns public.wallet
language plpgsql security definer set search_path = public as $$
declare w public.wallet;
begin
  insert into public.wallet (user_id) values (auth.uid()) on conflict do nothing;
  select * into w from public.wallet where user_id = auth.uid() for update;
  return w;
end $$;

create or replace function public._progress(p_user uuid, p_metric text, p_from date, p_to date) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(case p_metric
    when 'habit_completions' then (select count(*) from public.habit_logs where user_id = p_user and status = 'done' and day between p_from and p_to)
    when 'habit_days'        then (select count(distinct day) from public.habit_logs where user_id = p_user and status = 'done' and day between p_from and p_to)
    when 'todos_done'        then (select count(*) from public.todos where user_id = p_user and done and done_on between p_from and p_to)
    when 'mood_days'         then (select count(*) from public.moods where user_id = p_user and day between p_from and p_to)
  end, 0)::int
$$;

-- Saves a quest chosen by the AI. Rewards are decided HERE by difficulty, never by the AI or the app.
create or replace function public.create_quest(
  p_kind text, p_title text, p_desc text, p_metric text, p_target int, p_difficulty int,
  p_starts date, p_ends date, p_ends_at timestamptz,
  p_gap_from date default null, p_gap_to date default null, p_lost int default null, p_proof text default null)
returns public.quests language plpgsql security definer set search_path = public as $$
declare q public.quests; cap int; rw int; proof text := nullif(left(btrim(coalesce(p_proof, '')), 100), ''); d int := greatest(1, least(3, coalesce(p_difficulty, 2)));
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('day','week','month','life','recovery') then raise exception 'bad_kind'; end if;
  if p_metric not in ('habit_completions','habit_days','todos_done','mood_days','photo') then raise exception 'bad_metric'; end if;
  if (p_kind = 'life') <> (p_metric = 'photo') then raise exception 'bad_metric'; end if;
  if p_starts > current_date + 1 or p_ends < current_date - 1 or p_starts < current_date - 31 or p_ends < p_starts or p_ends > p_starts + 31 then raise exception 'bad_dates'; end if;
  if p_kind = 'day' and p_ends <> p_starts then raise exception 'bad_dates'; end if;
  if p_kind in ('week','life') and p_ends > p_starts + 6 then raise exception 'bad_dates'; end if;
  if p_kind = 'recovery' and (p_starts < current_date - 1 or p_ends > p_starts + 9 or p_gap_from is null or p_gap_to is null or p_gap_from > p_gap_to) then raise exception 'bad_dates'; end if;
  cap := case p_kind when 'day' then 12 when 'week' then 50 when 'month' then 200 when 'life' then 1 else 40 end;
  -- gems: day 0-1, week 2/3/5, month 6/10/15, real-life photo quest 5/10/20 (easy/medium/hard)
  rw  := case p_kind when 'day' then (array[0,1,1])[d] when 'week' then (array[2,3,5])[d] when 'month' then (array[6,10,15])[d] when 'life' then (array[5,10,20])[d] else 0 end;
  if p_kind = 'life' and proof is null then proof := 'a photo showing you finished it'; end if;
  delete from public.quests where user_id = auth.uid() and ends_on < current_date - 120; -- keep the table small for long-time users
  insert into public.quests (user_id, kind, title, description, metric, target, difficulty, reward_gems, starts_on, ends_on, ends_at, gap_from, gap_to, lost_len, proof_prompt, gap_key)
  values (auth.uid(), p_kind, left(coalesce(p_title, 'Quest'), 80), left(coalesce(p_desc, ''), 200), p_metric,
          greatest(1, least(cap, coalesce(p_target, 1))), d, rw, p_starts, p_ends, p_ends_at, p_gap_from, p_gap_to, p_lost, proof, coalesce(p_gap_from, date '1970-01-01'))
  on conflict (user_id, kind, starts_on, gap_key) do nothing
  returning * into q;
  if q.id is null then
    select * into q from public.quests where user_id = auth.uid() and kind = p_kind and starts_on = p_starts and gap_key = coalesce(p_gap_from, date '1970-01-01');
  end if;
  return q;
end $$;

-- Checks the real progress from your saved data, then pays out (gems) or restores the streak (hard quest)
create or replace function public.claim_quest(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.quests; prog int;
begin
  select * into q from public.quests where id = p_id and user_id = auth.uid() for update;
  if q.id is null then raise exception 'not_found'; end if;
  if q.status <> 'active' then raise exception 'already_claimed'; end if;
  if q.metric = 'photo' then
    prog := case when q.proof_ok then 1 else 0 end;   -- proof_ok is set only by the AI photo check
  else
    if q.proof_prompt is not null and not q.proof_ok then raise exception 'proof_required'; end if;
    prog := public._progress(auth.uid(), q.metric, q.starts_on, q.ends_on);
  end if;
  if prog < q.target then raise exception 'not_complete'; end if;
  update public.quests set status = 'claimed', claimed_at = now() where id = q.id;
  if q.kind = 'recovery' then
    insert into public.streak_restores (user_id, from_day, to_day, method, quest_id) values (auth.uid(), q.gap_from, q.gap_to, 'quest', q.id);
    return jsonb_build_object('kind', 'recovery', 'restored', true, 'from', q.gap_from, 'to', q.gap_to);
  end if;
  perform public._wallet();
  if q.reward_gems > 0 then
    update public.wallet set gems = gems + q.reward_gems, updated_at = now() where user_id = auth.uid();
    insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), q.reward_gems, 'quest_' || q.kind);
  end if;
  return jsonb_build_object('kind', q.kind, 'gems', q.reward_gems, 'restored', false);
end $$;

-- Swap an unfinished quest for a new one: 5 gems each, at most 3 per month
create or replace function public.reroll_quest(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.wallet; q public.quests; used int; price constant int := 5; lim constant int := 3;
begin
  w := public._wallet();
  select * into q from public.quests where id = p_id and user_id = auth.uid() for update;
  if q.id is null then raise exception 'not_found'; end if;
  if q.status <> 'active' or q.kind = 'recovery' or q.proof_ok then raise exception 'cannot_reroll'; end if;
  if q.metric <> 'photo' and public._progress(auth.uid(), q.metric, q.starts_on, q.ends_on) >= q.target then raise exception 'cannot_reroll'; end if;
  select count(*) into used from public.gem_ledger where user_id = auth.uid() and reason = 'reroll_quest' and created_at >= date_trunc('month', now());
  if used >= lim then raise exception 'reroll_limit'; end if;
  if w.gems < price then raise exception 'not_enough_gems'; end if;
  update public.wallet set gems = gems - price, updated_at = now() where user_id = auth.uid();
  insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), -price, 'reroll_quest');
  delete from public.quests where id = q.id;
  return jsonb_build_object('ok', true);
end $$;

-- Shop: 25 gems per unfreeze, at most 2 bought per month, at most 3 held at once
create or replace function public.buy_unfreeze() returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.wallet; bought int; price constant int := 25; lim constant int := 2; hold constant int := 3;
begin
  w := public._wallet();
  select count(*) into bought from public.gem_ledger where user_id = auth.uid() and reason = 'buy_unfreeze' and created_at >= date_trunc('month', now());
  if bought >= lim then raise exception 'monthly_limit'; end if;
  if w.unfreezes >= hold then raise exception 'inventory_full'; end if;
  if w.gems < price then raise exception 'not_enough_gems'; end if;
  update public.wallet set gems = gems - price, unfreezes = unfreezes + 1, updated_at = now() where user_id = auth.uid();
  insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), -price, 'buy_unfreeze');
  return jsonb_build_object('ok', true);
end $$;

-- Spend one unfreeze to bring a frozen streak back exactly where it was
create or replace function public.use_unfreeze(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.wallet;
begin
  w := public._wallet();
  if p_from is null or p_to is null or p_from > p_to or p_to > current_date + 1 or p_to - p_from > 120 then raise exception 'bad_dates'; end if;
  if w.unfreezes < 1 then raise exception 'no_unfreeze'; end if;
  update public.wallet set unfreezes = unfreezes - 1, updated_at = now() where user_id = auth.uid();
  insert into public.streak_restores (user_id, from_day, to_day, method) values (auth.uid(), p_from, p_to, 'unfreeze');
  insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), 0, 'use_unfreeze');
  return jsonb_build_object('ok', true);
end $$;

-- Finishing a whole day's to-do list (at least 3 tasks) can drop a gem, or rarely an unfreeze. Once a day.
-- The prize is rolled once per day and never re-rolled: if you un-check a task the reward is taken back
-- (reconcile_rewards), and finishing the list again gives the SAME prize back.
create or replace function public.claim_todo_reward(p_day date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.wallet; done_n int; open_n int; r text; act boolean; have boolean;
begin
  w := public._wallet();
  if p_day < current_date - 1 or p_day > current_date + 1 then raise exception 'bad_dates'; end if;
  select reward, active, true into r, act, have from public.todo_rewards where user_id = auth.uid() and day = p_day;
  if have and act then raise exception 'already_claimed'; end if;
  select count(*) into done_n from public.todos where user_id = auth.uid() and scope = 'day' and done and done_on = p_day;
  select count(*) into open_n from public.todos where user_id = auth.uid() and scope = 'day' and not done and not archived and (due is null or due <= p_day);
  if done_n < 3 or open_n > 0 then raise exception 'not_eligible'; end if;
  if not coalesce(have, false) then
    r := 'gem';
    if random() < 0.15 and w.unfreezes < 3 then r := 'unfreeze'; end if;
    insert into public.todo_rewards (user_id, day, reward, active, done_count) values (auth.uid(), p_day, r, true, done_n);
  else
    update public.todo_rewards set active = true, done_count = done_n where user_id = auth.uid() and day = p_day;
  end if;
  if r = 'gem' then
    update public.wallet set gems = gems + 1, updated_at = now() where user_id = auth.uid();
    insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), 1, 'todo_list');
  else
    update public.wallet set unfreezes = unfreezes + 1, updated_at = now() where user_id = auth.uid();
    insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), 0, 'todo_unfreeze');
  end if;
  return jsonb_build_object('reward', r, 'amount', 1);
end $$;

revoke all on function public._wallet() from public, anon, authenticated;
revoke all on function public._progress(uuid, text, date, date) from public, anon, authenticated;
revoke all on function public.create_quest(text, text, text, text, int, int, date, date, timestamptz, date, date, int, text) from public, anon;
revoke all on function public.reroll_quest(uuid) from public, anon;
revoke all on function public.claim_quest(uuid) from public, anon;
revoke all on function public.buy_unfreeze() from public, anon;
revoke all on function public.use_unfreeze(date, date) from public, anon;
revoke all on function public.claim_todo_reward(date) from public, anon;
grant execute on function public.create_quest(text, text, text, text, int, int, date, date, timestamptz, date, date, int, text) to authenticated;
grant execute on function public.reroll_quest(uuid) to authenticated;
grant execute on function public.claim_quest(uuid) to authenticated;
grant execute on function public.buy_unfreeze() to authenticated;
grant execute on function public.use_unfreeze(date, date) to authenticated;
grant execute on function public.claim_todo_reward(date) to authenticated;

-- Private image bucket (jpeg only, 5 MB max), one folder per user
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('habit-images', 'habit-images', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "images read own"   on storage.objects;
drop policy if exists "images upload own" on storage.objects;
drop policy if exists "images delete own" on storage.objects;
create policy "images read own"   on storage.objects for select to authenticated
  using (bucket_id = 'habit-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "images upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'habit-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'habit-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Live sync between your phone and laptop
do $$
declare t text;
begin
  foreach t in array array['habits','habit_logs','moods','todos','celebrations','wallet','quests','streak_restores','todo_rewards'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ───────── Built for many users and years of use ─────────
create index if not exists quests_user on public.quests (user_id, created_at desc);

-- One request returns every habit's full history (3000 days x many habits stays fast).
-- Runs as the signed-in person, so Row Level Security still applies.
create or replace function public.get_history(p_since date default null)
returns table (habit_id uuid, h jsonb) language sql stable set search_path = public as $$
  select l.habit_id, jsonb_object_agg(l.day, jsonb_build_array(l.status, l.minutes, l.sequence_progress))
  from public.habit_logs l
  where p_since is null or l.day >= p_since
  group by l.habit_id
$$;
revoke all on function public.get_history(date) from public, anon;
grant execute on function public.get_history(date) to authenticated;

-- Sensible size limits so one account can't fill the database
create or replace function public._limit_habits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.habits where user_id = new.user_id) >= 40 then raise exception 'limit_habits'; end if;
  return new;
end $$;
drop trigger if exists habits_limit on public.habits;
create trigger habits_limit before insert on public.habits for each row execute function public._limit_habits();

create or replace function public._todo_housekeeping() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.todos where user_id = new.user_id and archived and created_at < now() - interval '60 days';
  if (select count(*) from public.todos where user_id = new.user_id) >= 600 then raise exception 'limit_todos'; end if;
  return new;
end $$;
drop trigger if exists todos_housekeeping on public.todos;
create trigger todos_housekeeping before insert on public.todos for each row execute function public._todo_housekeeping();

create or replace function public._chat_prune() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chat_messages where user_id = new.user_id and id in
    (select id from public.chat_messages where user_id = new.user_id order by created_at desc offset 200);
  return null;
end $$;
drop trigger if exists chat_prune on public.chat_messages;
create trigger chat_prune after insert on public.chat_messages for each row execute function public._chat_prune();

-- Daily AI limits per person (protects your Groq key from one heavy user)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  bucket text not null,
  n int not null default 0,
  primary key (user_id, day, bucket)
);
alter table public.ai_usage enable row level security;
create or replace function public.ai_hit(p_user uuid, p_bucket text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  delete from public.ai_usage where user_id = p_user and day < current_date - 3;
  insert into public.ai_usage (user_id, day, bucket, n) values (p_user, current_date, p_bucket, 1)
  on conflict (user_id, day, bucket) do update set n = public.ai_usage.n + 1
  returning n into c;
  return c <= p_limit;
end $$;
revoke all on function public.ai_hit(uuid, text, int) from public, anon, authenticated;
grant execute on function public.ai_hit(uuid, text, int) to service_role;

-- "Delete my account": removes the login and, through cascading, every row you own
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────── Un-checking takes the reward back ─────────
-- Looks at your real data. If a task you finished is no longer finished, or a claimed quest no longer meets its
-- target, the reward is reversed. If you already spent it, your balance goes below zero until you earn it back.
create or replace function public.reconcile_rewards(p_day date default current_date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.todo_rewards; q public.quests; done_n int; prog int;
        gems_removed int := 0; unf_removed int := 0; qn int := 0; todo_rev boolean := false;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  perform public._wallet();
  select * into t from public.todo_rewards where user_id = auth.uid() and day = p_day and active for update;
  if t.user_id is not null then
    select count(*) into done_n from public.todos where user_id = auth.uid() and scope = 'day' and done and done_on = p_day;
    if done_n < t.done_count or done_n < 3 then
      update public.todo_rewards set active = false where user_id = t.user_id and day = t.day;
      if t.reward = 'gem' then
        update public.wallet set gems = gems - 1, updated_at = now() where user_id = auth.uid();
        insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), -1, 'todo_list_reversed');
        gems_removed := gems_removed + 1;
      else
        update public.wallet set unfreezes = unfreezes - 1, updated_at = now() where user_id = auth.uid();
        insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), 0, 'todo_unfreeze_reversed');
        unf_removed := 1;
      end if;
      todo_rev := true;
    end if;
  end if;
  for q in select * from public.quests where user_id = auth.uid() and status = 'claimed' and metric <> 'photo' and ends_on >= current_date - 45 for update loop
    prog := public._progress(auth.uid(), q.metric, q.starts_on, q.ends_on);
    if prog < q.target then
      update public.quests set status = 'active', claimed_at = null where id = q.id;
      if q.kind = 'recovery' then
        delete from public.streak_restores where quest_id = q.id and user_id = auth.uid();
      elsif q.reward_gems > 0 then
        update public.wallet set gems = gems - q.reward_gems, updated_at = now() where user_id = auth.uid();
        insert into public.gem_ledger (user_id, delta, reason) values (auth.uid(), -q.reward_gems, 'quest_reversed_' || q.kind);
        gems_removed := gems_removed + q.reward_gems;
      end if;
      qn := qn + 1;
    end if;
  end loop;
  return jsonb_build_object('todo_reversed', todo_rev, 'quests_reversed', qn, 'gems_removed', gems_removed, 'unfreezes_removed', unf_removed);
end $$;
revoke all on function public.reconcile_rewards(date) from public, anon;
grant execute on function public.reconcile_rewards(date) to authenticated;

-- For databases created before this update (safe to run again)
alter table public.wallet drop constraint if exists wallet_gems_check;
alter table public.wallet drop constraint if exists wallet_unfreezes_check;
alter table public.todo_rewards add column if not exists active boolean not null default true;
alter table public.todo_rewards add column if not exists done_count int not null default 0;
alter table public.streak_restores add column if not exists quest_id uuid;
