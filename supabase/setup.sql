-- Fixed teacher dashboard account:
-- Create Auth user admin@alphabet.local with password admin1234 and Auto Confirm.
-- Insert that Auth UUID as teacher: insert into public.teachers(id) values ('UUID_ADMIN');

-- Run once in a new Supabase project.
create table if not exists public.teachers(id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.students(id uuid primary key, display_name text not null, class_name text not null default 'Alphabet', teacher_id uuid references public.teachers(id), recording_consent boolean not null default false);

do $$
begin
  if to_regclass('public.students') is not null then
    alter table public.students drop constraint if exists students_id_fkey;
    alter table public.students alter column teacher_id drop not null;
  end if;
end $$;

create table if not exists public.game_attempts(id uuid primary key, student_id uuid not null references public.students(id) on delete cascade, challenge text not null check(challenge in ('matching','picture','missing','speaking')), started_at timestamptz not null, completed_at timestamptz, score integer not null default 0, rounds integer not null, results jsonb not null default '[]', stars integer not null default 0);
create index if not exists game_attempts_student_id_started_at_idx on public.game_attempts(student_id,started_at desc);
create table if not exists public.teacher_reviews(attempt_id uuid primary key references public.game_attempts(id) on delete cascade, rating integer check(rating between 1 and 5), feedback text not null default '');
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.game_attempts enable row level security;
alter table public.teacher_reviews enable row level security;

drop policy if exists teacher_self on public.teachers;
drop policy if exists student_read on public.students;
drop policy if exists attempt_read on public.game_attempts;
drop policy if exists attempt_insert on public.game_attempts;
drop policy if exists attempt_update on public.game_attempts;
drop policy if exists review_teacher on public.teacher_reviews;
drop policy if exists clip_insert on storage.objects;
drop policy if exists clip_read on storage.objects;
drop policy if exists clip_update on storage.objects;
drop policy if exists clip_delete_teacher on storage.objects;

create policy teacher_self on public.teachers for select to authenticated using(id=auth.uid());
create policy student_read on public.students for select to authenticated using(id=auth.uid() or teacher_id=auth.uid());
create policy attempt_read on public.game_attempts for select to authenticated using(exists(select 1 from public.students s where s.id=student_id and (s.id=auth.uid() or s.teacher_id=auth.uid())));
create policy attempt_insert on public.game_attempts for insert to authenticated with check(student_id=auth.uid());
create policy attempt_update on public.game_attempts for update to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy review_teacher on public.teacher_reviews for all to authenticated using(exists(select 1 from public.game_attempts a join public.students s on s.id=a.student_id where a.id=attempt_id and s.teacher_id=auth.uid())) with check(exists(select 1 from public.game_attempts a join public.students s on s.id=a.student_id where a.id=attempt_id and s.teacher_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('speaking','speaking',false,10000000,array['video/webm','video/mp4','audio/webm','audio/mp4'])
on conflict (id) do update set
  name=excluded.name,
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
create policy clip_insert on storage.objects for insert to authenticated with check(bucket_id='speaking' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.students s where s.id=auth.uid() and s.recording_consent));
create policy clip_read on storage.objects for select to authenticated using(bucket_id='speaking' and exists(select 1 from public.students s where s.id::text=(storage.foldername(name))[1] and (s.id=auth.uid() or s.teacher_id=auth.uid())));
create policy clip_update on storage.objects for update to authenticated using(bucket_id='speaking' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='speaking' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.students s where s.id=auth.uid() and s.recording_consent));
create policy clip_delete_teacher on storage.objects for delete to authenticated using(bucket_id='speaking' and exists(select 1 from public.students s where s.id::text=(storage.foldername(name))[1] and s.teacher_id=auth.uid()));

-- Name-only student access (no Supabase Anonymous Auth required).
-- Each browser has a persistent device ID in localStorage.

create or replace function public.register_student(p_device_id text, p_name text)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_student public.students;
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
      insert into public.students(id, display_name, class_name, teacher_id, recording_consent)
      values(p_device_id::uuid, v_clean_name, 'Alphabet', v_teacher_id, false)
      returning * into v_student;
    exception when invalid_text_representation then
      raise exception 'Thiết bị không hợp lệ';
    end;
  else
    update public.students
    set display_name = v_clean_name
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

  insert into public.game_attempts(
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
    stars = excluded.stars;

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
  order by a.challenge, a.started_at desc;
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
grant select, insert, update, delete on table public.teacher_reviews to authenticated;

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
