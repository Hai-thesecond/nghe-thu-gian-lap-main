-- Kiểm tra bảng error_analysis
CREATE TABLE IF NOT EXISTS public.error_analysis (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id),
  question_id UUID REFERENCES public.questions(id),
  assignment_id UUID REFERENCES public.student_answers(id),
  error_types JSONB,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE public.error_analysis ENABLE ROW LEVEL SECURITY;

-- Tạo policy tạm thời cho phép mọi người dùng đã xác thực
CREATE POLICY "Allow all operations for authenticated users on error_analysis" 
ON public.error_analysis
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true); 