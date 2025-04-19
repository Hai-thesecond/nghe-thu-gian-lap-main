-- Create function to update student answers
CREATE OR REPLACE FUNCTION update_student_answer_safe(
  answer_id UUID,
  answer_data TEXT[],
  completed_timestamp TIMESTAMPTZ,
  cheating_count INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  -- Simple update without FOR loops
  UPDATE public.student_answers
  SET 
    answers = answer_data,
    completed_at = completed_timestamp,
    cheating_attempts = cheating_count
  WHERE id = answer_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a more comprehensive function for submitting answers
CREATE OR REPLACE FUNCTION submit_student_answer(
  student_id UUID,
  question_id UUID,
  answer_data TEXT[],
  completed_timestamp TIMESTAMPTZ,
  cheating_count INTEGER
) RETURNS JSONB AS $$
DECLARE
  answer_record RECORD;
  result JSONB;
BEGIN
  -- Find the most recent answer record
  SELECT * INTO answer_record
  FROM public.student_answers sa
  WHERE sa.student_id = submit_student_answer.student_id
    AND sa.question_id = submit_student_answer.question_id
  ORDER BY sa.created_at DESC
  LIMIT 1;
  
  -- If no record found, return error
  IF answer_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No answer record found'
    );
  END IF;
  
  -- Ensure answer_data is not null
  IF answer_data IS NULL THEN
    answer_data := ARRAY[]::TEXT[];
  END IF;
  
  -- Update the record
  UPDATE public.student_answers
  SET 
    answers = answer_data,
    completed_at = completed_timestamp,
    cheating_attempts = cheating_count
  WHERE id = answer_record.id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'id', answer_record.id
  );
END;
$$ LANGUAGE plpgsql; 