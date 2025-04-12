-- Modify student_answers table if needed
DO $$
BEGIN
  -- Check if the old constraint exists before trying to drop it
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_answers_student_id_question_id_key') THEN
    ALTER TABLE public.student_answers 
      DROP CONSTRAINT student_answers_student_id_question_id_key;
  END IF;
  
  -- Check if the new constraint doesn't exist before creating it
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_answers_student_id_question_id_attempt_count_key') THEN
    ALTER TABLE public.student_answers
      ADD CONSTRAINT student_answers_student_id_question_id_attempt_count_key 
      UNIQUE (student_id, question_id, attempt_count);
  END IF;
  
  -- Recreate policy regardless
  DROP POLICY IF EXISTS "Students can manage their own answers" ON public.student_answers;
  CREATE POLICY "Students can manage their own answers"
    ON public.student_answers
    USING (student_id = auth.uid());
END
$$; 