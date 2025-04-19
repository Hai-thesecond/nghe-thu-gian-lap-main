-- Create vocabulary_items table
CREATE TABLE IF NOT EXISTS public.vocabulary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  part_of_speech TEXT DEFAULT 'noun',
  meaning_vi TEXT NOT NULL,
  audio_start_time INTEGER DEFAULT 0,
  audio_end_time INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up RLS for vocabulary_items
ALTER TABLE public.vocabulary_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read vocabulary items
CREATE POLICY "Everyone can view vocabulary items"
  ON public.vocabulary_items FOR SELECT
  USING (true);

-- Allow teachers to insert vocabulary items
CREATE POLICY "Teachers can insert vocabulary items"
  ON public.vocabulary_items FOR INSERT
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Allow teachers to update vocabulary items
CREATE POLICY "Teachers can update vocabulary items"
  ON public.vocabulary_items FOR UPDATE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Allow teachers to delete vocabulary items
CREATE POLICY "Teachers can delete vocabulary items"
  ON public.vocabulary_items FOR DELETE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Grant access to authenticated users
GRANT ALL ON public.vocabulary_items TO authenticated;
GRANT ALL ON public.vocabulary_items TO service_role;

-- Create vocabulary_progress table
CREATE TABLE IF NOT EXISTS public.vocabulary_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES public.vocabulary_items(id) ON DELETE CASCADE,
  attempts INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_practiced TIMESTAMP WITH TIME ZONE,
  mastery_level INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(student_id, vocabulary_id)
);

-- Set up RLS for vocabulary_progress
ALTER TABLE public.vocabulary_progress ENABLE ROW LEVEL SECURITY;

-- Students can view their own progress
CREATE POLICY "Students can view their own vocabulary progress"
  ON public.vocabulary_progress FOR SELECT
  USING (student_id = auth.uid());

-- Students can update their own progress
CREATE POLICY "Students can update their own vocabulary progress"
  ON public.vocabulary_progress FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Students can update their own progress
CREATE POLICY "Students can modify their own vocabulary progress"
  ON public.vocabulary_progress FOR UPDATE
  USING (student_id = auth.uid());

-- Grant access to authenticated users
GRANT ALL ON public.vocabulary_progress TO authenticated;
GRANT ALL ON public.vocabulary_progress TO service_role;

-- Create migration procedure for existing data if needed
DO $$
BEGIN
  -- Check if 'vocabulary' table exists and migrate data if needed
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vocabulary') THEN
    INSERT INTO vocabulary_items (question_id, word, part_of_speech, meaning_vi, audio_start_time, audio_end_time, image_url, created_at, updated_at)
    SELECT question_id, word, part_of_speech, meaning_vi, audio_start_time, audio_end_time, image_url, created_at, updated_at
    FROM vocabulary
    ON CONFLICT DO NOTHING;
  END IF;
END
$$; 