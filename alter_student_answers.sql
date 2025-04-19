-- Modify the student_answers table to better handle arrays
BEGIN;

-- Temporarily modify the answers column to allow null values
ALTER TABLE public.student_answers 
  ALTER COLUMN answers DROP NOT NULL;

-- Set any existing NULL answers to empty arrays
UPDATE public.student_answers 
  SET answers = ARRAY[]::TEXT[] 
  WHERE answers IS NULL;

-- Add a default empty array to the answers column
ALTER TABLE public.student_answers 
  ALTER COLUMN answers SET DEFAULT ARRAY[]::TEXT[];

-- Change the function to handle NULL arrays more gracefully
CREATE OR REPLACE FUNCTION handle_student_answers() 
RETURNS TRIGGER AS $$
BEGIN
  -- If answers is NULL, set to empty array
  IF NEW.answers IS NULL THEN
    NEW.answers := ARRAY[]::TEXT[];
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to ensure answers is never NULL
CREATE TRIGGER ensure_valid_answers
  BEFORE INSERT OR UPDATE ON public.student_answers
  FOR EACH ROW
  EXECUTE FUNCTION handle_student_answers();

COMMIT; 