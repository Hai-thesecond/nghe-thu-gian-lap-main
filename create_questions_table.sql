-- Create questions table with all required fields
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  script TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) NOT NULL,
  blanks_count INTEGER DEFAULT 5,
  time_limit INTEGER,
  enable_anti_cheating BOOLEAN DEFAULT true,
  differentiate_levels BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up RLS for questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Create policies for questions
-- Everyone can view questions
CREATE POLICY "Everyone can view questions"
  ON public.questions FOR SELECT
  USING (true);

-- Teachers can insert questions
CREATE POLICY "Teachers can insert questions"
  ON public.questions FOR INSERT
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Teachers can update their own questions
CREATE POLICY "Teachers can update their own questions"
  ON public.questions FOR UPDATE
  USING (created_by = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Teachers can delete their own questions
CREATE POLICY "Teachers can delete their own questions"
  ON public.questions FOR DELETE
  USING (created_by = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Create storage bucket for dictation audio files
-- Run this in Supabase dashboard if storage bucket doesn't exist
INSERT INTO storage.buckets (id, name) 
VALUES ('dictation', 'dictation')
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy to allow authenticated uploads
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Authenticated users can upload files',
  'dictation',
  jsonb_build_object(
    'role', 'authenticated',
    'operation', 'INSERT',
    'check', 'true'
  )
) ON CONFLICT (name, bucket_id) DO NOTHING;

-- Set up storage policy to allow public access to files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Public access to files',
  'dictation',
  jsonb_build_object(
    'role', 'authenticated',
    'operation', 'SELECT',
    'check', 'true'
  )
) ON CONFLICT (name, bucket_id) DO NOTHING;

-- Bảng lưu chi tiết phân tích lỗi
CREATE TABLE error_analysis (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id),
  question_id UUID REFERENCES questions(id),
  assignment_id UUID REFERENCES student_answers(id),
  error_types JSONB, -- Lưu các loại lỗi: {"spelling": 2, "grammar": 1, ...}
  error_details JSONB, -- Lưu chi tiết từng lỗi
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng lưu gợi ý cải thiện
CREATE TABLE improvement_suggestions (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id),
  strengths TEXT[], -- Điểm mạnh
  weaknesses TEXT[], -- Điểm yếu
  suggested_exercises JSONB, -- Bài tập đề xuất
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng theo dõi tiến độ cải thiện
CREATE TABLE improvement_tracking (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id),
  skill_type VARCHAR(50), -- Loại kỹ năng: vocabulary, grammar, etc.
  initial_score FLOAT, -- Điểm ban đầu
  current_score FLOAT, -- Điểm hiện tại
  improvement_rate FLOAT, -- Tỷ lệ cải thiện
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng từ vựng chuyên ngành
CREATE TABLE specialized_vocabulary (
  id SERIAL PRIMARY KEY,
  word TEXT,
  field VARCHAR(50), -- Lĩnh vực: medical, technical, business, etc.
  difficulty INTEGER, -- Độ khó: 1-5
  common_mistakes TEXT[] -- Các lỗi thường gặp
);

-- Cho phép giáo viên đọc tất cả hồ sơ học sinh
CREATE POLICY "Allow teachers to read all profiles" 
ON profiles FOR SELECT 
TO authenticated
USING (auth.uid() IN (
  SELECT id FROM profiles WHERE role = 'teacher'
)); 