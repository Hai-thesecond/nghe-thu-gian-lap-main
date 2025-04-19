-- Kiểm tra bảng improvement_suggestions
CREATE TABLE IF NOT EXISTS public.improvement_suggestions (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id),
  strengths TEXT[],
  weaknesses TEXT[],
  suggested_exercises JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE public.improvement_suggestions ENABLE ROW LEVEL SECURITY;

-- Tạo policy tạm thời cho phép mọi người dùng đã xác thực
CREATE POLICY "Allow all operations for authenticated users on improvement_suggestions" 
ON public.improvement_suggestions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true); 