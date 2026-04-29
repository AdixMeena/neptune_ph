-- =============================================================================
-- PHOENIX-AI  —  Supabase SQL Setup
-- Paste this entire file into: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- =============================================================================
-- 1. PROFILES  (extends auth.users — one row per registered user)
-- =============================================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            text not null check (role in ('doctor', 'patient')),
  name            text not null,
  specialization  text,          -- doctors only  (e.g. "Physiotherapist")
  created_at      timestamptz default now()
);

-- Auto-create a profile row whenever a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, name, specialization)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role',           'patient'),
    coalesce(new.raw_user_meta_data->>'name',           'Unknown User'),
    coalesce(new.raw_user_meta_data->>'specialization', null)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
-- Doctors can view all profiles to find their patients
drop policy if exists "Doctors can view all profiles" on public.profiles;
create policy "Doctors can view all profiles" on public.profiles for select using (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor'
);
-- Patients can view doctor profiles for discovery
create policy "Patients can view doctor profiles" on public.profiles for select using (
  auth.role() = 'authenticated' and role = 'doctor'
);

-- =============================================================================
-- 2. PATIENTS  (clinical data, separate from auth)
-- =============================================================================
create table if not exists public.patients (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null, -- linked auth account
  doctor_id   uuid references auth.users(id) on delete set null, -- treating doctor
  name        text not null,
  condition   text not null,
  age         int,
  score       int default 0 check (score >= 0 and score <= 100),
  streak      int default 0,
  progress    int[] default '{}',   -- last 7 daily scores
  notes       text,
  created_at  timestamptz default now()
);

alter table public.patients enable row level security;
create policy "Doctors can view their patients" on public.patients for select using (
  auth.uid() = doctor_id
);
create policy "Patients can view own record" on public.patients for select using (
  auth.uid() = user_id
);
create policy "Doctors can insert patients"  on public.patients for insert with check (auth.uid() = doctor_id);
create policy "Doctors can update patients"  on public.patients for update using (auth.uid() = doctor_id);

-- =============================================================================
-- 2.1 CONNECTIONS (patient ↔ doctor requests)
-- =============================================================================
create table if not exists public.connections (
  id          uuid primary key default uuid_generate_v4(),
  patient_id  uuid not null references auth.users(id) on delete cascade,
  doctor_id   uuid not null references auth.users(id) on delete cascade,
  status      text not null check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz default now(),
  unique (patient_id, doctor_id)
);

alter table public.connections enable row level security;
create policy "Patients can create requests" on public.connections for insert with check (
  auth.uid() = patient_id
);
create policy "Doctors can create connections" on public.connections for insert with check (
  auth.uid() = doctor_id
);
create policy "Patients can view their connections" on public.connections for select using (
  auth.uid() = patient_id
);
create policy "Patients can delete their connections" on public.connections for delete using (
  auth.uid() = patient_id
);
create policy "Doctors can view their connections" on public.connections for select using (
  auth.uid() = doctor_id
);
create policy "Doctors can delete their connections" on public.connections for delete using (
  auth.uid() = doctor_id
);
create policy "Doctors can update request status" on public.connections for update using (
  auth.uid() = doctor_id
);

-- =============================================================================
-- 3. EXERCISES  (exercise library — readable by everyone logged in)
-- =============================================================================
create table if not exists public.exercises (
  id            serial primary key,
  name          text not null,
  category      text not null,
  duration      text not null,
  difficulty    text not null check (difficulty in ('Easy', 'Moderate', 'Hard')),
  instructions  text not null,
  target_angle  text,
  joints        text[] default '{}',
  created_at    timestamptz default now()
);

alter table public.exercises enable row level security;
create policy "Authenticated users can view exercises" on public.exercises for select using (auth.role() = 'authenticated');
create policy "Doctors can manage exercises"           on public.exercises for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'doctor')
);

-- =============================================================================
-- 4. PATIENT_EXERCISES  (assignment join table)
-- =============================================================================
create table if not exists public.patient_exercises (
  id          uuid primary key default uuid_generate_v4(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  exercise_id int  not null references public.exercises(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'completed', 'overdue')),
  assigned_at timestamptz default now(),
  unique (patient_id, exercise_id)
);

alter table public.patient_exercises enable row level security;
create policy "Doctors can manage assignments" on public.patient_exercises for all using (
  exists (
    select 1 from public.patients pat
    where pat.id = patient_id and pat.doctor_id = auth.uid()
  )
);
create policy "Patients can view own assignments" on public.patient_exercises for select using (
  exists (
    select 1 from public.patients pat
    where pat.id = patient_id and pat.user_id = auth.uid()
  )
);
create policy "Patients can update own assignment status" on public.patient_exercises for update using (
  exists (
    select 1 from public.patients pat
    where pat.id = patient_id and pat.user_id = auth.uid()
  )
);

-- =============================================================================
-- 5. SESSIONS  (recorded exercise sessions with AI scores)
-- =============================================================================
create table if not exists public.sessions (
  id          uuid primary key default uuid_generate_v4(),
  patient_id  text not null,   -- auth user id (uuid stored as text for flexibility)
  exercise_id int  references public.exercises(id) on delete set null,
  score       int  not null check (score >= 0 and score <= 100),
  reps        int  default 0,
  duration    int  default 0,  -- seconds
  joint_scores jsonb default '[]',
  label       text,
  created_at  timestamptz default now()
);

alter table public.sessions enable row level security;
create policy "Patients can view own sessions" on public.sessions for select using (
  patient_id = auth.uid()::text
);
create policy "Backend service role can insert sessions" on public.sessions for insert with check (true);
create policy "Doctors can view patient sessions" on public.sessions for select using (
  exists (
    select 1 from public.patients pat
    where pat.user_id::text = patient_id and pat.doctor_id = auth.uid()
  )
);

-- =============================================================================
-- 6. FEEDBACK  (doctor → patient messages)
-- =============================================================================
create table if not exists public.feedback (
  id         uuid primary key default uuid_generate_v4(),
  patient_id text not null,  -- auth user id
  doctor_id  text not null,  -- auth user id
  message    text not null,
  is_read    boolean default false,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;
create policy "Patients can view own feedback" on public.feedback for select using (
  patient_id = auth.uid()::text
);
create policy "Patients can mark feedback read" on public.feedback for update using (
  patient_id = auth.uid()::text
);
create policy "Doctors can insert feedback" on public.feedback for insert with check (
  doctor_id = auth.uid()::text
);
create policy "Doctors can view feedback they sent" on public.feedback for select using (
  doctor_id = auth.uid()::text
);

-- =============================================================================
-- 7. SEED DATA — Exercises (from data.js)
-- =============================================================================
insert into public.exercises (name, category, duration, difficulty, instructions, target_angle, joints) values
('Knee flexion stretch',       'Knee',        '3 sets × 12 reps',  'Moderate', 'Sit on the edge of a chair. Slowly bend your knee as far as comfortable, hold for 3 seconds, then straighten. Keep your back straight throughout the movement. Focus on a smooth, controlled motion — do not bounce or force the stretch.',             '90–120°',            array['Left Knee','Right Knee','Left Hip']),
('Straight leg raise',         'Knee',        '3 sets × 10 reps',  'Easy',     'Lie on your back. Keep one leg straight and lift it to approximately 45°. Hold for 2 seconds at the top. Lower slowly. Keep your core engaged and lower back flat against the surface.',                                                                '45°',                array['Left Hip','Right Hip','Core']),
('Terminal knee extension',    'Knee',        '2 sets × 15 reps',  'Easy',     'Stand with a resistance band looped behind your knee. Start with a slight bend in the knee. Contract your quad and straighten the knee fully. Hold 2 seconds and return slowly.',                                                                        '0–15°',              array['Left Knee','Right Knee']),
('Shoulder pendulum',          'Shoulder',    '3 × 60 seconds',    'Easy',     'Lean forward supporting yourself with the unaffected arm on a table. Let the affected arm hang freely. Use momentum from your body to create small circular movements. Do not actively swing — let gravity do the work.',                               'Free range',         array['Left Shoulder','Right Shoulder']),
('Shoulder blade squeeze',     'Shoulder',    '3 sets × 10 reps',  'Moderate', 'Sit or stand tall. Pull your shoulder blades together as if trying to hold a pencil between them. Hold for 5 seconds. Keep your shoulders down, away from your ears. Do not arch your lower back.',                                                     'Retraction',         array['Both Shoulders','Upper Back']),
('Pelvic tilt',                'Lower Back',  '3 sets × 20 reps',  'Easy',     'Lie on your back with knees bent. Flatten your lower back against the floor by tightening your abdominal muscles. Hold 5 seconds. Breathe normally throughout — do not hold your breath.',                                                             'Neutral spine',      array['Lumbar Spine','Pelvis']),
('Cat-camel stretch',          'Lower Back',  '2 sets × 10 reps',  'Easy',     'Start on all fours. Arch your back upward toward the ceiling (cat). Then let it sag toward the floor (camel). Move slowly and smoothly between positions. Keep the movement in your spine, not your hips.',                                           'Full spinal range',  array['Cervical Spine','Thoracic Spine','Lumbar Spine']),
('Wrist flexion and extension','Wrist',       '3 sets × 15 reps',  'Easy',     'Hold your arm extended in front of you, palm down. Bend your wrist downward, then upward. Move through the full pain-free range. Keep elbow straight throughout.',                                                                                     '70° flex / 70° ext', array['Left Wrist','Right Wrist']),
('Grip strengthening',         'Wrist',       '3 sets × 12 reps',  'Moderate', 'Hold a soft stress ball or rolled towel. Squeeze firmly, hold 3 seconds, then fully release. Ensure complete relaxation between reps. Work within comfortable limits — mild discomfort is acceptable, sharp pain is not.',                             'Max grip',           array['Hand','Wrist','Forearm'])
on conflict do nothing;

-- =============================================================================
-- DONE ✅
-- Next steps:
--  1. Go to Supabase Dashboard → Authentication → Users → Invite user
--  2. Create a doctor account:  email + password, user_metadata: {"role":"doctor","name":"Dr. Rajesh Kumar","specialization":"Physiotherapist"}
--  3. Create a patient account: email + password, user_metadata: {"role":"patient","name":"Arjun Mehta"}
--  4. Copy SUPABASE_URL + ANON_KEY into phoenix-ai/.env
--  5. Copy SUPABASE_URL + SERVICE_ROLE_KEY into phoenix-ai/backend/.env
-- ========================================
