-- =============================================
-- ROTARY FUN QUIZ - DATABASE SCHEMA
-- Safe to re-run (uses IF NOT EXISTS)
-- =============================================

-- =============================================
-- CORE TABLES
-- =============================================

-- Profiles table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'teacher')) DEFAULT 'teacher',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Classes
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  section TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Students
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  roll_no TEXT,
  class_id UUID REFERENCES public.classes ON DELETE CASCADE NOT NULL,
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Topics
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Subtopics
CREATE TABLE IF NOT EXISTS public.subtopics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  topic_id UUID REFERENCES public.topics ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- QUESTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  image_url TEXT,
  type TEXT CHECK (type IN ('mcq', 'integer', 'subjective', 'case_based', 'image_based')) NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  solution_text TEXT,
  solution_image_url TEXT,
  points INTEGER DEFAULT 10,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  subtopic_id UUID REFERENCES public.subtopics ON DELETE SET NULL,
  topic_id UUID REFERENCES public.topics ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects ON DELETE SET NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- QUESTION-CLASS LINKS (Many-to-Many)
-- Links questions to multiple classes
-- =============================================

CREATE TABLE IF NOT EXISTS public.question_class_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(question_id, class_id)
);

-- =============================================
-- GAME SESSIONS & RESULTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,  -- Custom name for saved games (e.g., "Class 7 Physics - Period 3")
  teacher_id UUID REFERENCES public.profiles(id),
  class_id UUID REFERENCES public.classes(id),
  subject_id UUID REFERENCES public.subjects(id),
  topic_ids UUID[],
  subtopic_ids UUID[],
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled', 'paused')) DEFAULT 'active',
  total_questions INTEGER DEFAULT 0,
  num_tabs INTEGER DEFAULT 1,
  used_student_ids UUID[] DEFAULT '{}',
  used_question_ids UUID[] DEFAULT '{}',
  game_score INTEGER DEFAULT 0,  -- Total score for the game session
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Game tabs for parallel multi-student play
CREATE TABLE IF NOT EXISTS public.game_tabs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE NOT NULL,
  tab_number INTEGER NOT NULL,
  current_student_id UUID REFERENCES public.students(id),
  current_question_id UUID REFERENCES public.questions(id),
  status TEXT CHECK (status IN ('waiting', 'spinning', 'answering', 'scored')) DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id),
  question_id UUID REFERENCES public.questions(id),
  student_answer TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  time_taken_seconds INTEGER,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- LEVELS & REWARDS
-- =============================================

CREATE TABLE IF NOT EXISTS public.levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level_number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  reward_description TEXT,
  badge_url TEXT
);

-- Insert default levels (ignore if exist)
INSERT INTO public.levels (level_number, name, min_points, reward_description) VALUES
(1, 'Beginner', 0, 'Welcome to the quiz!'),
(2, 'Explorer', 100, 'Certificate of Participation'),
(3, 'Scholar', 300, 'Bronze Badge'),
(4, 'Expert', 600, 'Silver Badge + Small Prize'),
(5, 'Champion', 1000, 'Gold Badge + Special Gift')
ON CONFLICT (level_number) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_class_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to allow re-running
DO $$ 
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.profiles;
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
  DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
  
  -- Classes
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.classes;
  DROP POLICY IF EXISTS "Public read classes" ON public.classes;
  
  -- Students
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.students;
  DROP POLICY IF EXISTS "Public read students" ON public.students;
  DROP POLICY IF EXISTS "Public update students" ON public.students;
  
  -- Subjects
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.subjects;
  DROP POLICY IF EXISTS "Public read subjects" ON public.subjects;
  
  -- Topics
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.topics;
  DROP POLICY IF EXISTS "Public read topics" ON public.topics;
  
  -- Subtopics
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.subtopics;
  DROP POLICY IF EXISTS "Public read subtopics" ON public.subtopics;
  
  -- Questions
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.questions;
  DROP POLICY IF EXISTS "Public read questions" ON public.questions;
  
  -- Question class links
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.question_class_links;
  DROP POLICY IF EXISTS "Public read question_class_links" ON public.question_class_links;
  
  -- Game sessions
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.game_sessions;
  
  -- Game tabs
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.game_tabs;
  DROP POLICY IF EXISTS "Public all game_tabs" ON public.game_tabs;
  
  -- Game results
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.game_results;
  
  -- Levels
  DROP POLICY IF EXISTS "Allow read for all" ON public.levels;
  
  -- Public game policies
  DROP POLICY IF EXISTS "Public read game_sessions" ON public.game_sessions;
  DROP POLICY IF EXISTS "Public insert game_sessions" ON public.game_sessions;
  DROP POLICY IF EXISTS "Public update game_sessions" ON public.game_sessions;
  DROP POLICY IF EXISTS "Public read game_results" ON public.game_results;
  DROP POLICY IF EXISTS "Public insert game_results" ON public.game_results;
END $$;

-- Create fresh policies
CREATE POLICY "Allow all for authenticated" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.classes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.students FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.subjects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.topics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.subtopics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.questions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.question_class_links FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.game_sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.game_tabs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.game_results FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read for all" ON public.levels FOR SELECT USING (true);

-- Public read access (for game without login)
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public read classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Public read topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Public read subtopics" ON public.subtopics FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Public read question_class_links" ON public.question_class_links FOR SELECT USING (true);

-- Public access for game sessions and results (allows teachers on any device)
CREATE POLICY "Public read game_sessions" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Public insert game_sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update game_sessions" ON public.game_sessions FOR UPDATE USING (true);
CREATE POLICY "Public read game_results" ON public.game_results FOR SELECT USING (true);
CREATE POLICY "Public insert game_results" ON public.game_results FOR INSERT WITH CHECK (true);

-- Public access for game tabs (allows multi-tab play)
CREATE POLICY "Public all game_tabs" ON public.game_tabs FOR ALL USING (true);

-- Public update for students (allows game to update total_points without authentication)
CREATE POLICY "Public update students" ON public.students FOR UPDATE USING (true);

-- ============================================================
-- STORAGE BUCKET for Question Images
-- ============================================================
-- Note: Run this in Supabase SQL Editor or set up bucket manually in Dashboard
-- Insert bucket if it doesn't exist (Supabase may already have it)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for question-images bucket
DROP POLICY IF EXISTS "Allow public read for question-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload for question-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update for question-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete for question-images" ON storage.objects;

CREATE POLICY "Allow public read for question-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

CREATE POLICY "Allow authenticated upload for question-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'question-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update for question-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete for question-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');

-- Done!
SELECT 'Schema created/updated successfully!' as status;
