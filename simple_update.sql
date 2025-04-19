-- Simple function to update student_answers without using FOR loops
CREATE OR REPLACE FUNCTION simple_update(
  record_id UUID,
  answer_array TEXT[] DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Update student_answers record with a non-loop approach
  -- First handle NULL arrays by setting a default empty array
  IF answer_array IS NULL THEN
    answer_array := ARRAY[]::TEXT[];
  END IF;

  UPDATE public.student_answers
  SET 
    answers = answer_array,
    completed_at = NOW()
  WHERE id = record_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql; 