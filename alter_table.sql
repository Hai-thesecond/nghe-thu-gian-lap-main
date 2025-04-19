-- Add a answers_json column to store answers as JSON string
-- This helps avoid the "upper bound of FOR loop cannot be null" error
ALTER TABLE public.student_answers
ADD COLUMN IF NOT EXISTS answers_json TEXT;

-- Update existing records to set answers_json from answers
UPDATE public.student_answers
SET answers_json = array_to_json(answers)::text
WHERE answers IS NOT NULL AND answers_json IS NULL;

-- Create or replace function to handle student answers without using FOR loops
CREATE OR REPLACE FUNCTION update_student_answer_safe(
  answer_id UUID,
  answers_data TEXT[], -- Array of strings
  answers_json TEXT,   -- JSON string backup
  completed_time TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if answers_data is NULL or empty
  IF answers_data IS NULL OR array_length(answers_data, 1) IS NULL THEN
    -- Use the JSON string instead
    UPDATE public.student_answers
    SET 
      answers_json = answers_json,
      completed_at = completed_time
    WHERE id = answer_id;
  ELSE
    -- Use the array directly
    UPDATE public.student_answers
    SET 
      answers = answers_data,
      answers_json = array_to_json(answers_data)::text,
      completed_at = completed_time
    WHERE id = answer_id;
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql; 