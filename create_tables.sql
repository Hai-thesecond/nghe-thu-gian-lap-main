-- Create student_answers table
CREATE TABLE IF NOT EXISTS public.student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  answers TEXT[] DEFAULT ARRAY[]::TEXT[],
  attempt_count INTEGER DEFAULT 1,
  cheating_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(student_id, question_id)
);

-- Set up RLS for student_answers
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- Create policies for student_answers
CREATE POLICY "Students can manage their own answers"
  ON public.student_answers
  USING (student_id = auth.uid());

-- Grant access to authenticated users
GRANT ALL ON public.student_answers TO authenticated;
GRANT ALL ON public.student_answers TO service_role; 