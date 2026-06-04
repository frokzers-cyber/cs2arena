create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  country text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_display_name_idx on public.profiles (lower(display_name));

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tag text not null unique,
  description text,
  region text not null default 'EU',
  logo_url text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  looking_for_players boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teams_owner_id_idx on public.teams (owner_id);
create index if not exists teams_created_at_idx on public.teams (created_at desc);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists team_members_team_id_idx on public.team_members (team_id);
create index if not exists team_members_user_id_idx on public.team_members (user_id);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_username text not null,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists team_invites_team_id_idx on public.team_invites (team_id);
create index if not exists team_invites_invited_user_id_idx on public.team_invites (invited_user_id);
create index if not exists team_invites_status_idx on public.team_invites (status);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null,
  prize_pool text not null,
  game_mode text not null,
  start_at timestamptz not null,
  checkin_at timestamptz,
  max_teams integer not null default 16,
  banner_url text,
  status text not null default 'upcoming',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_status_idx on public.tournaments (status);
create index if not exists tournaments_start_at_idx on public.tournaments (start_at desc);

create table if not exists public.tournament_applications (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tournament_id, team_id)
);

create index if not exists tournament_applications_tournament_id_idx on public.tournament_applications (tournament_id);
create index if not exists tournament_applications_team_id_idx on public.tournament_applications (team_id);
create index if not exists tournament_applications_status_idx on public.tournament_applications (status);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  seed integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(tournament_id, team_id)
);

create index if not exists tournament_entries_tournament_id_idx on public.tournament_entries (tournament_id);
create index if not exists tournament_entries_team_id_idx on public.tournament_entries (team_id);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_no integer not null,
  match_no integer not null,
  team1_id uuid references public.teams(id) on delete set null,
  team2_id uuid references public.teams(id) on delete set null,
  winner_team_id uuid references public.teams(id) on delete set null,
  score1 integer not null default 0,
  score2 integer not null default 0,
  status text not null default 'scheduled',
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tournament_id, round_no, match_no)
);

create index if not exists tournament_matches_tournament_id_idx on public.tournament_matches (tournament_id);
create index if not exists tournament_matches_round_idx on public.tournament_matches (tournament_id, round_no);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  content text not null,
  cover_url text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_posts_published_idx on public.news_posts (published, published_at desc);
create index if not exists news_posts_author_id_idx on public.news_posts (author_id);

create table if not exists public.global_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists global_chat_messages_created_at_idx on public.global_chat_messages (created_at desc);

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists team_chat_messages_team_id_idx on public.team_chat_messages (team_id);
create index if not exists team_chat_messages_created_at_idx on public.team_chat_messages (created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_id_idx on public.notifications (recipient_id);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_read_idx on public.notifications (read_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_display_name text;
begin
  v_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, 'player'), '@', 1), 'player'), '[^a-z0-9а-яё_]+', '_', 'gi'));
  v_username := trim(both '_' from v_username);
  if v_username is null or length(v_username) < 3 then
    v_username := 'player_' || substr(new.id::text, 1, 8);
  end if;

  if exists(select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := v_username || '_' || substr(new.id::text, 1, 4);
  end if;

  v_display_name := coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(coalesce(new.email, 'player'), '@', 1));

  insert into public.profiles(id, username, display_name, avatar_url, bio, country, is_admin)
  values (
    new.id,
    v_username,
    v_display_name,
    coalesce(new.raw_user_meta_data->>'avatar_url', null),
    '',
    '',
    false
  )
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create trigger set_tournaments_updated_at
before update on public.tournaments
for each row execute function public.set_updated_at();

create trigger set_news_posts_updated_at
before update on public.news_posts
for each row execute function public.set_updated_at();

create trigger set_tournament_matches_updated_at
before update on public.tournament_matches
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(is_admin, false) = true
  )
$$;

create or replace function public.is_team_owner(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams
    where id = _team_id
      and owner_id = auth.uid()
  )
$$;

create or replace function public.is_team_member(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = _team_id
      and user_id = auth.uid()
      and status = 'active'
  )
$$;

create or replace function public.create_team_invite(_team_id uuid, _username text, _message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
  v_target_user_id uuid;
  v_team_name text;
begin
  if not (public.is_team_owner(_team_id) or public.is_admin()) then
    raise exception 'forbidden';
  end if;

  select id into v_target_user_id
  from public.profiles
  where lower(username) = lower(_username)
  limit 1;

  if v_target_user_id is null then
    raise exception 'user_not_found';
  end if;

  select name into v_team_name
  from public.teams
  where id = _team_id;

  insert into public.team_invites(team_id, invited_by, invited_user_id, invited_username, message, status)
  values (_team_id, auth.uid(), v_target_user_id, _username, _message, 'pending')
  returning id into v_invite_id;

  insert into public.notifications(recipient_id, type, title, body, entity_type, entity_id)
  values (
    v_target_user_id,
    'team_invite',
    'Приглашение в команду',
    'Команда ' || v_team_name || ' пригласила вас в состав.',
    'team_invite',
    v_invite_id::text
  );

  return v_invite_id;
end;
$$;

create or replace function public.accept_team_invite(_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_invited_user_id uuid;
  v_invited_by uuid;
  v_team_name text;
begin
  select team_id, invited_user_id, invited_by into v_team_id, v_invited_user_id, v_invited_by
  from public.team_invites
  where id = _invite_id
    and status = 'pending';

  if v_team_id is null then
    raise exception 'invite_not_found';
  end if;

  if v_invited_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  update public.team_invites
  set status = 'accepted',
      responded_at = now()
  where id = _invite_id;

  insert into public.team_members(team_id, user_id, role, status)
  values (v_team_id, auth.uid(), 'player', 'active')
  on conflict (team_id, user_id) do update
    set status = 'active';

  select name into v_team_name
  from public.teams
  where id = v_team_id;

  insert into public.notifications(recipient_id, type, title, body, entity_type, entity_id)
  values (
    v_invited_by,
    'team_invite',
    'Приглашение принято',
    'Игрок принял приглашение в команду ' || coalesce(v_team_name, ''),
    'team_invite',
    _invite_id::text
  );
end;
$$;

create or replace function public.apply_for_tournament(_tournament_id uuid, _team_id uuid, _note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_id uuid;
  v_exists integer;
begin
  if not (public.is_team_owner(_team_id) or public.is_team_member(_team_id) or public.is_admin()) then
    raise exception 'forbidden';
  end if;

  select count(*) into v_exists
  from public.tournament_applications
  where tournament_id = _tournament_id
    and team_id = _team_id;

  if v_exists > 0 then
    raise exception 'already_applied';
  end if;

  insert into public.tournament_applications(tournament_id, team_id, submitted_by, note, status)
  values (_tournament_id, _team_id, auth.uid(), _note, 'pending')
  returning id into v_application_id;

  return v_application_id;
end;
$$;

create or replace function public.review_tournament_application(_application_id uuid, _decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_team_id uuid;
  v_seed integer;
  v_owner_id uuid;
  v_tournament_title text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select tournament_id, team_id into v_tournament_id, v_team_id
  from public.tournament_applications
  where id = _application_id;

  if v_tournament_id is null then
    raise exception 'application_not_found';
  end if;

  update public.tournament_applications
  set status = _decision,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = _application_id;

  if _decision = 'approved' then
    select coalesce(max(seed), 0) + 1 into v_seed
    from public.tournament_entries
    where tournament_id = v_tournament_id;

    insert into public.tournament_entries(tournament_id, team_id, seed, status)
    values (v_tournament_id, v_team_id, v_seed, 'active')
    on conflict (tournament_id, team_id) do nothing;

    select owner_id into v_owner_id
    from public.teams
    where id = v_team_id;

    select title into v_tournament_title
    from public.tournaments
    where id = v_tournament_id;

    insert into public.notifications(recipient_id, type, title, body, entity_type, entity_id)
    values (
      v_owner_id,
      'tournament_application',
      'Заявка одобрена',
      'Команда допущена к турниру ' || coalesce(v_tournament_title, ''),
      'tournament_application',
      _application_id::text
    );
  else
    select owner_id into v_owner_id
    from public.teams
    where id = v_team_id;

    select title into v_tournament_title
    from public.tournaments
    where id = v_tournament_id;

    insert into public.notifications(recipient_id, type, title, body, entity_type, entity_id)
    values (
      v_owner_id,
      'tournament_application',
      'Заявка отклонена',
      'Команда не прошла отбор в турнир ' || coalesce(v_tournament_title, ''),
      'tournament_application',
      _application_id::text
    );
  end if;
end;
$$;

create or replace function public.generate_tournament_bracket(_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teams uuid[];
  i integer := 1;
  v_match_no integer := 1;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  delete from public.tournament_matches where tournament_id = _tournament_id and round_no = 1;

  select array_agg(team_id order by seed asc, created_at asc) into v_teams
  from public.tournament_entries
  where tournament_id = _tournament_id;

  if v_teams is null or array_length(v_teams, 1) is null then
    return;
  end if;

  while i <= array_length(v_teams, 1) loop
    if i = array_length(v_teams, 1) then
      insert into public.tournament_matches(
        tournament_id,
        round_no,
        match_no,
        team1_id,
        team2_id,
        winner_team_id,
        score1,
        score2,
        status,
        scheduled_at
      )
      values (
        _tournament_id,
        1,
        v_match_no,
        v_teams[i],
        null,
        v_teams[i],
        0,
        0,
        'bye',
        null
      )
      on conflict (tournament_id, round_no, match_no) do update
        set team1_id = excluded.team1_id,
            team2_id = excluded.team2_id,
            winner_team_id = excluded.winner_team_id,
            status = excluded.status;
    else
      insert into public.tournament_matches(
        tournament_id,
        round_no,
        match_no,
        team1_id,
        team2_id,
        winner_team_id,
        score1,
        score2,
        status,
        scheduled_at
      )
      values (
        _tournament_id,
        1,
        v_match_no,
        v_teams[i],
        v_teams[i + 1],
        null,
        0,
        0,
        'scheduled',
        null
      )
      on conflict (tournament_id, round_no, match_no) do update
        set team1_id = excluded.team1_id,
            team2_id = excluded.team2_id,
            winner_team_id = excluded.winner_team_id,
            status = excluded.status;
    end if;

    i := i + 2;
    v_match_no := v_match_no + 1;
  end loop;
end;
$$;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_delete" on public.profiles;
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id or public.is_admin());
create policy "profiles_delete" on public.profiles for delete using (auth.uid() = id or public.is_admin());
grant select, insert, update, delete on public.profiles to anon, authenticated;

drop policy if exists "teams_select" on public.teams;
drop policy if exists "teams_insert" on public.teams;
drop policy if exists "teams_update" on public.teams;
drop policy if exists "teams_delete" on public.teams;
alter table public.teams enable row level security;
create policy "teams_select" on public.teams for select using (true);
create policy "teams_insert" on public.teams for insert with check (auth.uid() = owner_id);
create policy "teams_update" on public.teams for update using (auth.uid() = owner_id or public.is_admin()) with check (auth.uid() = owner_id or public.is_admin());
create policy "teams_delete" on public.teams for delete using (auth.uid() = owner_id or public.is_admin());
grant select, insert, update, delete on public.teams to anon, authenticated;

drop policy if exists "team_members_select" on public.team_members;
drop policy if exists "team_members_insert" on public.team_members;
drop policy if exists "team_members_update" on public.team_members;
drop policy if exists "team_members_delete" on public.team_members;
alter table public.team_members enable row level security;
create policy "team_members_select" on public.team_members for select using (true);
create policy "team_members_insert" on public.team_members for insert with check (auth.uid() = user_id or public.is_admin());
create policy "team_members_update" on public.team_members for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "team_members_delete" on public.team_members for delete using (auth.uid() = user_id or public.is_admin());
grant select, insert, update, delete on public.team_members to authenticated;

drop policy if exists "team_invites_select" on public.team_invites;
drop policy if exists "team_invites_insert" on public.team_invites;
drop policy if exists "team_invites_update" on public.team_invites;
drop policy if exists "team_invites_delete" on public.team_invites;
alter table public.team_invites enable row level security;
create policy "team_invites_select" on public.team_invites for select using (
  invited_by = auth.uid()
  or invited_user_id = auth.uid()
  or exists(select 1 from public.teams where id = team_invites.team_id and owner_id = auth.uid())
  or public.is_admin()
);
create policy "team_invites_insert" on public.team_invites for insert with check (
  invited_by = auth.uid()
  or public.is_admin()
);
create policy "team_invites_update" on public.team_invites for update using (
  invited_by = auth.uid()
  or invited_user_id = auth.uid()
  or exists(select 1 from public.teams where id = team_invites.team_id and owner_id = auth.uid())
  or public.is_admin()
) with check (
  invited_by = auth.uid()
  or invited_user_id = auth.uid()
  or exists(select 1 from public.teams where id = team_invites.team_id and owner_id = auth.uid())
  or public.is_admin()
);
create policy "team_invites_delete" on public.team_invites for delete using (
  invited_by = auth.uid()
  or exists(select 1 from public.teams where id = team_invites.team_id and owner_id = auth.uid())
  or public.is_admin()
);
grant select, insert, update, delete on public.team_invites to authenticated;

drop policy if exists "tournaments_select" on public.tournaments;
drop policy if exists "tournaments_insert" on public.tournaments;
drop policy if exists "tournaments_update" on public.tournaments;
drop policy if exists "tournaments_delete" on public.tournaments;
alter table public.tournaments enable row level security;
create policy "tournaments_select" on public.tournaments for select using (true);
create policy "tournaments_insert" on public.tournaments for insert with check (public.is_admin() and auth.uid() = created_by);
create policy "tournaments_update" on public.tournaments for update using (public.is_admin() or auth.uid() = created_by) with check (public.is_admin() or auth.uid() = created_by);
create policy "tournaments_delete" on public.tournaments for delete using (public.is_admin() or auth.uid() = created_by);
grant select, insert, update, delete on public.tournaments to authenticated, anon;

drop policy if exists "tournament_applications_select" on public.tournament_applications;
drop policy if exists "tournament_applications_insert" on public.tournament_applications;
drop policy if exists "tournament_applications_update" on public.tournament_applications;
drop policy if exists "tournament_applications_delete" on public.tournament_applications;
alter table public.tournament_applications enable row level security;
create policy "tournament_applications_select" on public.tournament_applications for select using (
  public.is_admin()
  or submitted_by = auth.uid()
  or exists(select 1 from public.teams where id = tournament_applications.team_id and owner_id = auth.uid())
  or public.is_team_member(tournament_applications.team_id)
);
create policy "tournament_applications_insert" on public.tournament_applications for insert with check (
  submitted_by = auth.uid()
  or public.is_admin()
);
create policy "tournament_applications_update" on public.tournament_applications for update using (public.is_admin()) with check (public.is_admin());
create policy "tournament_applications_delete" on public.tournament_applications for delete using (public.is_admin());
grant select, insert, update, delete on public.tournament_applications to authenticated;

drop policy if exists "tournament_entries_select" on public.tournament_entries;
drop policy if exists "tournament_entries_insert" on public.tournament_entries;
drop policy if exists "tournament_entries_update" on public.tournament_entries;
drop policy if exists "tournament_entries_delete" on public.tournament_entries;
alter table public.tournament_entries enable row level security;
create policy "tournament_entries_select" on public.tournament_entries for select using (true);
create policy "tournament_entries_insert" on public.tournament_entries for insert with check (public.is_admin());
create policy "tournament_entries_update" on public.tournament_entries for update using (public.is_admin()) with check (public.is_admin());
create policy "tournament_entries_delete" on public.tournament_entries for delete using (public.is_admin());
grant select, insert, update, delete on public.tournament_entries to authenticated, anon;

drop policy if exists "tournament_matches_select" on public.tournament_matches;
drop policy if exists "tournament_matches_insert" on public.tournament_matches;
drop policy if exists "tournament_matches_update" on public.tournament_matches;
drop policy if exists "tournament_matches_delete" on public.tournament_matches;
alter table public.tournament_matches enable row level security;
create policy "tournament_matches_select" on public.tournament_matches for select using (true);
create policy "tournament_matches_insert" on public.tournament_matches for insert with check (public.is_admin());
create policy "tournament_matches_update" on public.tournament_matches for update using (public.is_admin()) with check (public.is_admin());
create policy "tournament_matches_delete" on public.tournament_matches for delete using (public.is_admin());
grant select, insert, update, delete on public.tournament_matches to authenticated, anon;

drop policy if exists "news_posts_select" on public.news_posts;
drop policy if exists "news_posts_insert" on public.news_posts;
drop policy if exists "news_posts_update" on public.news_posts;
drop policy if exists "news_posts_delete" on public.news_posts;
alter table public.news_posts enable row level security;
create policy "news_posts_select" on public.news_posts for select using (published = true or public.is_admin() or auth.uid() = author_id);
create policy "news_posts_insert" on public.news_posts for insert with check (public.is_admin() and auth.uid() = author_id);
create policy "news_posts_update" on public.news_posts for update using (public.is_admin() or auth.uid() = author_id) with check (public.is_admin() or auth.uid() = author_id);
create policy "news_posts_delete" on public.news_posts for delete using (public.is_admin() or auth.uid() = author_id);
grant select, insert, update, delete on public.news_posts to authenticated, anon;

drop policy if exists "global_chat_messages_select" on public.global_chat_messages;
drop policy if exists "global_chat_messages_insert" on public.global_chat_messages;
drop policy if exists "global_chat_messages_update" on public.global_chat_messages;
drop policy if exists "global_chat_messages_delete" on public.global_chat_messages;
alter table public.global_chat_messages enable row level security;
create policy "global_chat_messages_select" on public.global_chat_messages for select using (true);
create policy "global_chat_messages_insert" on public.global_chat_messages for insert with check (auth.uid() = user_id);
create policy "global_chat_messages_update" on public.global_chat_messages for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "global_chat_messages_delete" on public.global_chat_messages for delete using (auth.uid() = user_id or public.is_admin());
grant select, insert, update, delete on public.global_chat_messages to authenticated, anon;

drop policy if exists "team_chat_messages_select" on public.team_chat_messages;
drop policy if exists "team_chat_messages_insert" on public.team_chat_messages;
drop policy if exists "team_chat_messages_update" on public.team_chat_messages;
drop policy if exists "team_chat_messages_delete" on public.team_chat_messages;
alter table public.team_chat_messages enable row level security;
create policy "team_chat_messages_select" on public.team_chat_messages for select using (
  public.is_admin()
  or public.is_team_owner(team_id)
  or public.is_team_member(team_id)
);
create policy "team_chat_messages_insert" on public.team_chat_messages for insert with check (
  auth.uid() = user_id
  and (public.is_admin() or public.is_team_owner(team_id) or public.is_team_member(team_id))
);
create policy "team_chat_messages_update" on public.team_chat_messages for update using (
  auth.uid() = user_id or public.is_admin()
) with check (
  auth.uid() = user_id or public.is_admin()
);
create policy "team_chat_messages_delete" on public.team_chat_messages for delete using (
  auth.uid() = user_id or public.is_admin()
);
grant select, insert, update, delete on public.team_chat_messages to authenticated;

drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
alter table public.notifications enable row level security;
create policy "notifications_select" on public.notifications for select using (recipient_id = auth.uid() or public.is_admin());
create policy "notifications_insert" on public.notifications for insert with check (recipient_id is not null);
create policy "notifications_update" on public.notifications for update using (recipient_id = auth.uid() or public.is_admin()) with check (recipient_id = auth.uid() or public.is_admin());
create policy "notifications_delete" on public.notifications for delete using (recipient_id = auth.uid() or public.is_admin());
grant select, insert, update, delete on public.notifications to authenticated;

grant usage on schema public to anon, authenticated;
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.handle_new_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_team_owner(uuid) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.create_team_invite(uuid, text, text) to authenticated;
grant execute on function public.accept_team_invite(uuid) to authenticated;
grant execute on function public.apply_for_tournament(uuid, uuid, text) to authenticated;
grant execute on function public.review_tournament_application(uuid, text) to authenticated;
grant execute on function public.generate_tournament_bracket(uuid) to authenticated;

insert into storage.buckets(id, name, public)
values
  ('team-logos', 'team-logos', true),
  ('news-covers', 'news-covers', true),
  ('tournament-banners', 'tournament-banners', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "storage_objects_select" on storage.objects;
drop policy if exists "storage_objects_insert" on storage.objects;
drop policy if exists "storage_objects_update" on storage.objects;
drop policy if exists "storage_objects_delete" on storage.objects;
alter table storage.objects enable row level security;
create policy "storage_objects_select" on storage.objects for select using (bucket_id in ('team-logos', 'news-covers', 'tournament-banners'));
create policy "storage_objects_insert" on storage.objects for insert with check (auth.role() = 'authenticated' and bucket_id in ('team-logos', 'news-covers', 'tournament-banners'));
create policy "storage_objects_update" on storage.objects for update using (auth.role() = 'authenticated' and bucket_id in ('team-logos', 'news-covers', 'tournament-banners')) with check (auth.role() = 'authenticated' and bucket_id in ('team-logos', 'news-covers', 'tournament-banners'));
create policy "storage_objects_delete" on storage.objects for delete using (auth.role() = 'authenticated' and bucket_id in ('team-logos', 'news-covers', 'tournament-banners'));
grant select, insert, update, delete on storage.objects to authenticated, anon;
