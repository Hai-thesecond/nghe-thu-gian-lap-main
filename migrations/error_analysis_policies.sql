-- Enable RLS on error_analysis table
ALTER TABLE public.error_analysis ENABLE ROW LEVEL SECURITY;

-- Students can view their own error analysis
CREATE POLICY "Students can view their own error analysis"
ON public.error_analysis
FOR SELECT
TO authenticated
USING (
  ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'student') 
  AND student_id = auth.uid()
);

-- Teachers can view error analysis for their students
CREATE POLICY "Teachers can view error analysis for their students"
ON public.error_analysis
FOR SELECT
TO authenticated
USING (
  ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'teacher')
  AND (EXISTS (
    SELECT 1 FROM student_classes sc
    JOIN classes c ON sc.class_id = c.id
    WHERE sc.student_id = error_analysis.student_id
    AND c.teacher_id = auth.uid()
  ))
);

-- Teachers and students can insert/update error analysis data
CREATE POLICY "Teachers and students can insert error analysis data"
ON public.error_analysis
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) IN ('teacher', 'student')
);

-- Students can update their own error analysis
CREATE POLICY "Students can update their own error analysis"
ON public.error_analysis
FOR UPDATE
TO authenticated
USING (
  ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'student')
  AND student_id = auth.uid()
)
WITH CHECK (
  ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'student')
  AND student_id = auth.uid()
);

-- Teachers can update error analysis for their students
CREATE POLICY "Teachers can update error analysis for their students"
ON public.error_analysis
FOR UPDATE
TO authenticated
USING (
  ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'teacher')
  AND (EXISTS (
    SELECT 1 FROM student_classes sc
    JOIN classes c ON sc.class_id = c.id
    WHERE sc.student_id = error_analysis.student_id
    AND c.teacher_id = auth.uid()
  ))
)
WITH CHECK (
  ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'teacher')
  AND (EXISTS (
    SELECT 1 FROM student_classes sc
    JOIN classes c ON sc.class_id = c.id
    WHERE sc.student_id = error_analysis.student_id
    AND c.teacher_id = auth.uid()
  ))
);

-- Admins have full access to error analysis data
CREATE POLICY "Admins can manage all error analysis data"
ON public.error_analysis
FOR ALL
TO authenticated
USING (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'
); 