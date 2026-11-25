-- Fixed teacher dashboard account:
-- Create Auth user admin@alphabet.local with password admin1234 and Auto Confirm.
-- Insert that Auth UUID as teacher: insert into public.teachers(id) values ('UUID_ADMIN');

-- Run once in a new Supabase project. Create Auth users separately in dashboard.
create table public.teachers(id uuid primary key references auth.users(id) on delete cascade);
create table public.students(id uuid primary key references auth.users(id) on delete cascade, display_name text not null, class_name text not null default 'Alphabet', teacher_id uuid not null references public.teachers(id), recording_consent boolean not null default false);
create table public.game_attempts(id uuid primary key, student_id uuid not null references public.students(id) on delete cascade, challenge text not null check(challenge in ('matching','picture','missing','speaking')), started_at timestamptz not null, completed_at timestamptz, score integer not null default 0, rounds integer not null, results jsonb not null default '[]', stars integer not null default 0);
create index on public.game_attempts(student_id,started_at desc);
create table public.teacher_reviews(attempt_id uuid primary key references public.game_attempts(id) on delete cascade, rating integer check(rating between 1 and 5), feedback text not null default '');
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.game_attempts enable row level security;
alter table public.teacher_reviews enable row level security;
create policy teacher_self on public.teachers for select to authenticated using(id=auth.uid());
create policy student_read on public.students for select to authenticated using(id=auth.uid() or teacher_id=auth.uid());
create policy attempt_read on public.game_attempts for select to authenticated using(exists(select 1 from public.students s where s.id=student_id and (s.id=auth.uid() or s.teacher_id=auth.uid())));
create policy attempt_insert on public.game_attempts for insert to authenticated with check(student_id=auth.uid());
create policy attempt_update on public.game_attempts for update to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create policy review_teacher on public.teacher_reviews for all to authenticated using(exists(select 1 from public.game_attempts a join public.students s on s.id=a.student_id where a.id=attempt_id and s.teacher_id=auth.uid())) with check(exists(select 1 from public.game_attempts a join public.students s on s.id=a.student_id where a.id=attempt_id and s.teacher_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('speaking','speaking',false,10000000,array['video/webm','video/mp4','audio/webm','audio/mp4']);
create policy clip_insert on storage.objects for insert to authenticated with check(bucket_id='speaking' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.students s where s.id=auth.uid() and s.recording_consent));
create policy clip_read on storage.objects for select to authenticated using(bucket_id='speaking' and exists(select 1 from public.students s where s.id::text=(storage.foldername(name))[1] and (s.id=auth.uid() or s.teacher_id=auth.uid())));
create policy clip_update on storage.objects for update to authenticated using(bucket_id='speaking' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='speaking' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.students s where s.id=auth.uid() and s.recording_consent));
create policy clip_delete_teacher on storage.objects for delete to authenticated using(bucket_id='speaking' and exists(select 1 from public.students s where s.id::text=(storage.foldername(name))[1] and s.teacher_id=auth.uid()));

-- Name-only student sign-in: enable Anonymous Sign-ins in Supabase Auth.
create or replace function public.create_student_for_name(p_name text)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_student public.students;
begin
  if auth.uid() is null then
    raise exception 'Vui lòng đăng nhập danh tính học sinh';
  end if;

  select id into v_teacher_id
  from public.teachers
  order by id
  limit 1;

  if v_teacher_id is null then
    raise exception 'Chưa tạo tài khoản quản trị trong bảng teachers';
  end if;

  select * into v_student
  from public.students
  where id = auth.uid();

  if v_student.id is null then
    insert into public.students(id, display_name, class_name, teacher_id, recording_consent)
    values(auth.uid(), trim(p_name), 'Alphabet', v_teacher_id, false)
    returning * into v_student;
  else
    update public.students
    set display_name = trim(p_name)
    where id = auth.uid()
    returning * into v_student;
  end if;

  return v_student;
end;
$$;

revoke all on function public.create_student_for_name(text) from public;
grant execute on function public.create_student_for_name(text) to authenticated;
