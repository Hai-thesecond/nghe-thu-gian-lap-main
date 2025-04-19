-- Reset the RLS policies for student_categories table

-- First, drop existing policies
DROP POLICY IF EXISTS "Students can view their own category" ON public.student_categories;
DROP POLICY IF EXISTS "Teachers can view all student categories" ON public.student_categories;
DROP POLICY IF EXISTS "Students can insert their own category" ON public.student_categories;
DROP POLICY IF EXISTS "Students can update their own category" ON public.student_categories;
DROP POLICY IF EXISTS "Teachers can manage all student categories" ON public.student_categories;

-- Make sure RLS is enabled
ALTER TABLE public.student_categories ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows everyone to use the table (for testing only)
CREATE POLICY "Allow all operations for authenticated users" 
ON public.student_categories
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- After testing, you can replace with these more secure policies:
/*
-- Students can view their own category
CREATE POLICY "Students can view their own category"
  ON public.student_categories FOR SELECT
  USING (student_id = auth.uid());

-- Teachers can view all student categories
CREATE POLICY "Teachers can view all student categories"
  ON public.student_categories FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Students can insert their own category
CREATE POLICY "Students can insert their own category"
  ON public.student_categories FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Students can update their own category
CREATE POLICY "Students can update their own category"
  ON public.student_categories FOR UPDATE
  USING (student_id = auth.uid());

-- Teachers can manage all student categories
CREATE POLICY "Teachers can manage all student categories"
  ON public.student_categories FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');
*/ 