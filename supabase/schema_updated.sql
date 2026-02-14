-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  section text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT classes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.extracted_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  page_number integer,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['diagram'::text, 'text'::text, 'formula'::text, 'table'::text, 'chart'::text])),
  image_url text,
  text_content text,
  ai_analysis jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT extracted_content_pkey PRIMARY KEY (id),
  CONSTRAINT extracted_content_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.teacher_materials(id)
);
CREATE TABLE public.files (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  original_name text NOT NULL,
  size bigint NOT NULL,
  mime_type text NOT NULL,
  extension text,
  storage_path text NOT NULL,
  folder_id uuid,
  owner_id uuid NOT NULL,
  is_trashed boolean DEFAULT false,
  trashed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_starred boolean DEFAULT false,
  CONSTRAINT files_pkey PRIMARY KEY (id),
  CONSTRAINT files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id),
  CONSTRAINT files_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.flavinsa_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  extracted_content_id uuid,
  question text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  question_type text NOT NULL CHECK (question_type = ANY (ARRAY['mcq'::text, 'integer'::text, 'case_based'::text, 'assertion_reason'::text, 'diagram'::text, 'very_short'::text, 'short_answer'::text, 'long_answer'::text])),
  image_url text,
  difficulty text DEFAULT 'medium'::text CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  subject text NOT NULL,
  class_name text,
  topic text,
  lesson text,
  usage_count integer DEFAULT 0,
  teacher_rating real,
  edit_count integer DEFAULT 0,
  is_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT flavinsa_questions_pkey PRIMARY KEY (id),
  CONSTRAINT flavinsa_questions_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.teacher_materials(id),
  CONSTRAINT flavinsa_questions_content_id_fkey FOREIGN KEY (extracted_content_id) REFERENCES public.extracted_content(id)
);
CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  parent_id uuid,
  owner_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id),
  CONSTRAINT folders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.game_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  student_id uuid,
  question_id uuid,
  student_answer text,
  is_correct boolean,
  points_earned integer DEFAULT 0,
  time_taken_seconds integer,
  answered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_results_pkey PRIMARY KEY (id),
  CONSTRAINT game_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT game_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT game_results_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.game_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid,
  class_id uuid,
  subject_id uuid,
  topic_ids ARRAY,
  subtopic_ids ARRAY,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text, 'paused'::text])),
  total_questions integer DEFAULT 0,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  num_tabs integer DEFAULT 1,
  used_student_ids ARRAY DEFAULT '{}'::uuid[],
  used_question_ids ARRAY DEFAULT '{}'::uuid[],
  name text,
  game_score integer DEFAULT 0,
  game_state jsonb,
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT game_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT game_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT game_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.game_tabs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  tab_number integer NOT NULL,
  current_student_id uuid,
  current_question_id uuid,
  status text DEFAULT 'waiting'::text CHECK (status = ANY (ARRAY['waiting'::text, 'spinning'::text, 'answering'::text, 'scored'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_tabs_pkey PRIMARY KEY (id),
  CONSTRAINT game_tabs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT game_tabs_current_student_id_fkey FOREIGN KEY (current_student_id) REFERENCES public.students(id),
  CONSTRAINT game_tabs_current_question_id_fkey FOREIGN KEY (current_question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject_id uuid NOT NULL,
  chapter_number integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lessons_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level_number integer NOT NULL UNIQUE,
  name text NOT NULL,
  min_points integer NOT NULL,
  reward_description text,
  badge_url text,
  CONSTRAINT levels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.login_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  role text,
  login_time timestamp with time zone DEFAULT now(),
  user_agent text,
  CONSTRAINT login_history_pkey PRIMARY KEY (id),
  CONSTRAINT login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.model_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  question_id uuid NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type = ANY (ARRAY['rating'::text, 'edit'::text, 'accept'::text, 'reject'::text, 'use'::text])),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  edited_question text,
  edited_options jsonb,
  edited_answer text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT model_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT model_feedback_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT model_feedback_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.flavinsa_questions(id)
);
CREATE TABLE public.paper_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL,
  question_order integer NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type = ANY (ARRAY['mcq'::text, 'integer'::text, 'case_based'::text, 'assertion_reason'::text, 'diagram'::text, 'very_short'::text, 'short_answer'::text, 'long_answer'::text])),
  content text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  topic_id uuid,
  subtopic_id uuid,
  difficulty text DEFAULT 'medium'::text,
  passage text,
  assertion text,
  reason text,
  image_url text,
  image_caption text,
  image_description text,
  created_at timestamp with time zone DEFAULT now(),
  topic_name text,
  lesson_name text,
  CONSTRAINT paper_questions_pkey PRIMARY KEY (id),
  CONSTRAINT paper_questions_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id),
  CONSTRAINT paper_questions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT paper_questions_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.subtopics(id)
);
CREATE TABLE public.papers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Paper'::text,
  class_id uuid,
  subject_id uuid,
  topic_ids ARRAY DEFAULT '{}'::uuid[],
  difficulty text DEFAULT 'medium'::text CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  question_counts jsonb DEFAULT '{"mcq": 0, "diagram": 0, "integer": 0, "caseBased": 0, "assertionReason": 0}'::jsonb,
  ai_model text DEFAULT 'openai'::text CHECK (ai_model = ANY (ARRAY['openai'::text, 'gemini'::text, 'question_bank'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  class_name text,
  subject_name text,
  lessons ARRAY DEFAULT '{}'::text[],
  topics ARRAY DEFAULT '{}'::text[],
  teacher_email text,
  exam_type text DEFAULT 'IIT Foundation'::text CHECK (exam_type = ANY (ARRAY['IIT Foundation'::text, 'Mid-Term'::text, 'Pre/Post Mid-term'::text, 'Final'::text])),
  CONSTRAINT papers_pkey PRIMARY KEY (id),
  CONSTRAINT papers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT papers_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT papers_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role text DEFAULT 'teacher'::text CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  avatar_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.question_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['mcq'::text, 'integer'::text, 'case_based'::text, 'assertion_reason'::text, 'diagram'::text, 'very_short'::text, 'short_answer'::text, 'long_answer'::text])),
  options jsonb,
  correct_answer text NOT NULL,
  complexity text DEFAULT 'medium'::text CHECK (complexity = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  difficulty text DEFAULT 'medium'::text,
  class_name text,
  subject_name text,
  topic_name text,
  lesson_name text,
  image_url text,
  explanation text,
  passage text,
  assertion text,
  reason text,
  image_description text,
  image_caption text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  subtopic_name text,
  lesson_id uuid,
  topic_id uuid,
  subtopic_id uuid,
  CONSTRAINT question_bank_pkey PRIMARY KEY (id),
  CONSTRAINT question_bank_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT question_bank_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT question_bank_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.subtopics(id),
  CONSTRAINT question_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.question_class_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid,
  class_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_class_links_pkey PRIMARY KEY (id),
  CONSTRAINT question_class_links_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT question_class_links_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content text NOT NULL,
  image_url text,
  type text NOT NULL CHECK (type = ANY (ARRAY['mcq'::text, 'integer'::text, 'subjective'::text])),
  options jsonb,
  correct_answer text NOT NULL,
  points integer DEFAULT 10,
  complexity text DEFAULT 'medium'::text CHECK (complexity = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  subtopic_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  difficulty text DEFAULT 'medium'::text,
  explanation text,
  solution_text text,
  solution_image_url text,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT questions_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.subtopics(id)
);
CREATE TABLE public.share_links (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  file_id uuid,
  folder_id uuid,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone,
  password text,
  download_count integer DEFAULT 0,
  max_downloads integer,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT share_links_pkey PRIMARY KEY (id),
  CONSTRAINT share_links_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id),
  CONSTRAINT share_links_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id),
  CONSTRAINT share_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.shared_access (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  file_id uuid,
  folder_id uuid,
  shared_with uuid NOT NULL,
  permission text DEFAULT 'view'::text CHECK (permission = ANY (ARRAY['view'::text, 'edit'::text])),
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shared_access_pkey PRIMARY KEY (id),
  CONSTRAINT shared_access_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id),
  CONSTRAINT shared_access_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id),
  CONSTRAINT shared_access_shared_with_fkey FOREIGN KEY (shared_with) REFERENCES auth.users(id),
  CONSTRAINT shared_access_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  roll_no text,
  class_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  total_points integer DEFAULT 0,
  current_level integer DEFAULT 1,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.subtopics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  topic_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subtopics_pkey PRIMARY KEY (id),
  CONSTRAINT subtopics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id)
);
CREATE TABLE public.teacher_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  file_url text,
  original_filename text,
  file_type text NOT NULL CHECK (file_type = ANY (ARRAY['pdf'::text, 'image'::text, 'link'::text])),
  file_size_bytes bigint,
  subject text NOT NULL,
  class_name text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  total_pages integer,
  processed_pages integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teacher_materials_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_materials_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  lesson_id uuid,
  CONSTRAINT topics_pkey PRIMARY KEY (id),
  CONSTRAINT topics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT topics_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);