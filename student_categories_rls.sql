-- Check if student_categories table exists, if not create it
CREATE TABLE IF NOT EXISTS public.student_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('good', 'average', 'poor')),
  average_score NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id)
);

-- Enable RLS on the table
ALTER TABLE public.student_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Students can view their own category" ON public.student_categories;
DROP POLICY IF EXISTS "Teachers can view all student categories" ON public.student_categories;
DROP POLICY IF EXISTS "Students can insert their own category" ON public.student_categories;
DROP POLICY IF EXISTS "Students can update their own category" ON public.student_categories;
DROP POLICY IF EXISTS "Teachers can manage all student categories" ON public.student_categories;

-- Create policies for student_categories

-- Students can view their own category
CREATE POLICY "Students can view their own category"
  ON public.student_categories FOR SELECT
  USING (student_id = auth.uid());

-- Teachers can view all student categories
CREATE POLICY "Teachers can view all student categories"
  ON public.student_categories FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Students can insert their own category (if it doesn't exist yet)
CREATE POLICY "Students can insert their own category"
  ON public.student_categories FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Students can update their own category
CREATE POLICY "Students can update their own category"
  ON public.student_categories FOR UPDATE
  USING (student_id = auth.uid());

-- Teachers can manage all student categories (insert, update, delete)
CREATE POLICY "Teachers can manage all student categories"
  ON public.student_categories 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');

-- Create a view that makes it easier to query student categories with their profile info
CREATE OR REPLACE VIEW public.student_categories_view AS
SELECT 
  sc.id,
  sc.student_id,
  sc.category,
  sc.average_score,
  sc.last_updated,
  sc.created_at,
  p.full_name,
  p.avatar_url
FROM 
  public.student_categories sc
JOIN 
  public.profiles p ON sc.student_id = p.id; 