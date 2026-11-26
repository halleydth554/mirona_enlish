-- Fixed teacher dashboard account:
-- Create Auth user admin@alphabet.local with Auto Confirm.
-- Insert that Auth UUID as teacher: insert into public.teachers(id) values ('UUID_ADMIN');

-- Run once in a new Supabase project.
create table if not exists public.teachers(id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.students(id uuid primary key, display_name text not null, class_name text not null default 'Alphabet', teacher_id uuid references public.teachers(id));
alter table public.students add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists students_auth_user_id_idx on public.students(auth_user_id) where auth_user_id is not null;

do $$
begin
  if to_regclass('public.students') is not null then
    alter table public.students drop constraint if exists students_id_fkey;
    alter table public.students alter column teacher_id drop not null;
  end if;
end $$;

create table if not exists public.game_attempts(id uuid primary key, student_id uuid not null references public.students(id) on delete cascade, challenge text not null check(challenge in ('matching','picture','missing')), started_at timestamptz not null, completed_at timestamptz, score integer not null default 0, rounds integer not null, results jsonb not null default '[]', stars integer not null default 0);
create index if not exists game_attempts_student_id_started_at_idx on public.game_attempts(student_id,started_at desc);
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.game_attempts enable row level security;

drop policy if exists teacher_self on public.teachers;
drop policy if exists student_read on public.students;
drop policy if exists attempt_read on public.game_attempts;
drop policy if exists attempt_insert on public.game_attempts;
drop policy if exists attempt_update on public.game_attempts;
drop policy if exists clip_insert on storage.objects;
drop policy if exists clip_read on storage.objects;
drop policy if exists clip_update on storage.objects;
drop policy if exists clip_delete_teacher on storage.objects;

create policy teacher_self on public.teachers for select to authenticated using(id=auth.uid());
create policy student_read on public.students for select to authenticated using(auth_user_id=auth.uid() or teacher_id=auth.uid());
create policy attempt_read on public.game_attempts for select to authenticated using(exists(select 1 from public.students s where s.id=student_id and (s.auth_user_id=auth.uid() or s.teacher_id=auth.uid())));
create policy attempt_insert on public.game_attempts for insert to authenticated with check(exists(select 1 from public.students s where s.id=student_id and s.auth_user_id=auth.uid()));
create policy attempt_update on public.game_attempts for update to authenticated using(exists(select 1 from public.students s where s.id=student_id and s.auth_user_id=auth.uid())) with check(exists(select 1 from public.students s where s.id=student_id and s.auth_user_id=auth.uid()));

-- Student profiles use persistent device IDs.

create or replace function public.register_student(p_device_id text, p_name text)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_student public.students;
  v_auth_user_id uuid := case
    when coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then auth.uid()
    else null
  end;
  v_clean_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if length(p_device_id) < 8 then
    raise exception 'Thiết bị không hợp lệ';
  end if;
  if length(v_clean_name) < 1 then
    raise exception 'Vui lòng nhập tên học sinh';
  end if;

  select id into v_teacher_id
  from public.teachers
  order by id
  limit 1;

  if v_teacher_id is null then
    -- Không bắt buộc: học sinh vẫn được tạo, giáo viên có thể gán sau.
    null;
  end if;

  select * into v_student
  from public.students
  where id::text = p_device_id;

  if v_student.id is null then
    begin
      insert into public.students(id, display_name, class_name, teacher_id, auth_user_id)
      values(p_device_id::uuid, v_clean_name, 'Alphabet', v_teacher_id, v_auth_user_id)
      returning * into v_student;
    exception when invalid_text_representation then
      raise exception 'Thiết bị không hợp lệ';
    end;
  else
    if v_student.auth_user_id is not null and v_auth_user_id is not null and v_student.auth_user_id <> v_auth_user_id then
      raise exception 'Hồ sơ học sinh đã được liên kết với thiết bị khác';
    end if;
    update public.students
    set display_name = v_clean_name,
        auth_user_id = coalesce(auth_user_id, v_auth_user_id)
    where id = v_student.id
    returning * into v_student;
  end if;

  update public.students
  set teacher_id = v_teacher_id
  where teacher_id is null
    and v_teacher_id is not null;

  return v_student;
end;
$$;

create or replace function public.get_student(p_device_id text)
returns public.students
language sql
security definer
set search_path = public
as $$
  select *
  from public.students
  where id::text = p_device_id
  limit 1;
$$;

create or replace function public.save_game_attempt(p_device_id text, p_attempt jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
  v_student_exists boolean;
begin
  select exists(select 1 from public.students where id::text = p_device_id)
  into v_student_exists;

  if not v_student_exists then
    raise exception 'Học sinh chưa được đăng ký trên thiết bị này';
  end if;

  v_attempt_id := (p_attempt->>'id')::uuid;

  insert into public.game_attempts as existing_attempt(
    id, student_id, challenge, started_at, completed_at,
    score, rounds, results, stars
  ) values (
    v_attempt_id,
    p_device_id::uuid,
    p_attempt->>'challenge',
    (p_attempt->>'started_at')::timestamptz,
    nullif(p_attempt->>'completed_at','')::timestamptz,
    coalesce((p_attempt->>'score')::integer,0),
    coalesce((p_attempt->>'rounds')::integer,0),
    coalesce(p_attempt->'results','[]'::jsonb),
    coalesce((p_attempt->>'stars')::integer,0)
  )
  on conflict(id) do update set
    completed_at = excluded.completed_at,
    score = excluded.score,
    rounds = excluded.rounds,
    results = excluded.results,
    stars = excluded.stars
  where existing_attempt.student_id = excluded.student_id
    and existing_attempt.challenge = excluded.challenge
  returning id into v_attempt_id;

  if v_attempt_id is null then
    raise exception 'Bài làm không thuộc học sinh hoặc thử thách này';
  end if;

  return v_attempt_id;
end;
$$;

create or replace function public.get_student_progress(p_device_id text)
returns table(challenge text, score integer, stars integer)
language sql
security definer
set search_path = public
as $$
  select distinct on (a.challenge) a.challenge, a.score, a.stars
  from public.game_attempts a
  where a.student_id::text = p_device_id
    and a.completed_at is not null
  order by a.challenge, a.stars desc, a.score desc, a.started_at desc;
$$;

revoke all on function public.register_student(text,text) from public, anon, authenticated;
revoke all on function public.get_student(text) from public, anon, authenticated;
revoke all on function public.save_game_attempt(text,jsonb) from public, anon, authenticated;
revoke all on function public.get_student_progress(text) from public, anon, authenticated;
grant execute on function public.register_student(text,text) to anon, authenticated;
grant execute on function public.get_student(text) to anon, authenticated;
grant execute on function public.save_game_attempt(text,jsonb) to anon, authenticated;
grant execute on function public.get_student_progress(text) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.teachers to authenticated;
grant select on table public.students to authenticated;
grant select, insert, update on table public.game_attempts to authenticated;

-- Tự động lấy UUID của tài khoản admin và đưa vào bảng teachers.
insert into public.teachers(id)
select id
from auth.users
where email = 'admin@alphabet.local'
on conflict (id) do nothing;

-- Gán giáo viên hiện có cho các học sinh chưa gán.
update public.students s
set teacher_id = t.id
from (select id from public.teachers order by id limit 1) t
where s.teacher_id is null;

-- Bắt buộc sau khi tạo/sửa function; làm mới PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
