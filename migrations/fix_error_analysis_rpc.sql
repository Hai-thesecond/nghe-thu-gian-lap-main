-- Update the analyze_student_errors function to use text_distance
CREATE OR REPLACE FUNCTION analyze_student_errors(
  p_student_id UUID,
  p_question_id UUID,
  p_student_answers TEXT[],
  p_correct_answers TEXT[]
) RETURNS JSONB AS $$
DECLARE
  error_counts JSONB;
  error_types JSONB;
  wrong_answers JSONB;
  normalized_user_answer TEXT;
  normalized_correct_answer TEXT;
  error_type TEXT;
  i INTEGER;
BEGIN
  -- Initialize error counts
  error_counts := '{"spelling": 0, "grammar": 0, "missing": 0, "meaning": 0, "blank": 0, "tense": 0}'::JSONB;
  error_types := '{}'::JSONB;
  wrong_answers := '[]'::JSONB;
  
  -- Analyze each answer
  FOR i IN 1..array_length(p_student_answers, 1) LOOP
    -- Skip if index out of range for correct answers
    IF i > array_length(p_correct_answers, 1) THEN
      CONTINUE;
    END IF;
    
    -- Get the answers
    normalized_user_answer := lower(trim(regexp_replace(COALESCE(p_student_answers[i], ''), '[.,\/#!$%\^&\*;:{}=\-_`~()?]', '', 'g')));
    normalized_correct_answer := lower(trim(regexp_replace(COALESCE(p_correct_answers[i], ''), '[.,\/#!$%\^&\*;:{}=\-_`~()?]', '', 'g')));
    
    -- Skip correct answers
    IF normalized_user_answer = normalized_correct_answer THEN
      CONTINUE;
    END IF;
    
    -- Handle blank answers
    IF normalized_user_answer = '' THEN
      error_counts := jsonb_set(error_counts, '{blank}', (error_counts->>'blank')::INTEGER + 1);
      error_types := jsonb_set(error_types, format('{%s}', i)::TEXT[], '"blank"');
      wrong_answers := wrong_answers || jsonb_build_object(
        'index', i,
        'userAnswer', '',
        'correctAnswer', p_correct_answers[i],
        'type', 'blank'
      );
      CONTINUE;
    END IF;
    
    -- Check for spelling errors (1-2 characters different)
    IF text_distance(normalized_user_answer, normalized_correct_answer) <= 2 THEN
      error_counts := jsonb_set(error_counts, '{spelling}', (error_counts->>'spelling')::INTEGER + 1);
      error_type := 'spelling';
    -- Check for grammar errors (similar words or one contains the other)
    ELSIF (
      -- Word similarity check would go here but we skip it for now
      (normalized_user_answer LIKE '%' || normalized_correct_answer || '%') OR 
      (normalized_correct_answer LIKE '%' || normalized_user_answer || '%')
    ) THEN
      error_counts := jsonb_set(error_counts, '{grammar}', (error_counts->>'grammar')::INTEGER + 1);
      error_type := 'grammar';
    -- Check for tense errors
    ELSIF (
      (normalized_user_answer LIKE '%will%' AND normalized_correct_answer LIKE '%would%') OR
      (normalized_user_answer LIKE '%is%' AND normalized_correct_answer LIKE '%was%') OR
      (normalized_user_answer LIKE '%has%' AND normalized_correct_answer LIKE '%had%') OR
      (normalized_user_answer LIKE '%do%' AND normalized_correct_answer LIKE '%did%') OR
      (normalized_user_answer LIKE '%are%' AND normalized_correct_answer LIKE '%were%')
    ) THEN
      error_counts := jsonb_set(error_counts, '{tense}', (error_counts->>'tense')::INTEGER + 1);
      error_type := 'tense';
    -- Check for missing words
    ELSIF array_length(string_to_array(normalized_user_answer, ' '), 1) < array_length(string_to_array(normalized_correct_answer, ' '), 1) - 1 THEN
      error_counts := jsonb_set(error_counts, '{missing}', (error_counts->>'missing')::INTEGER + 1);
      error_type := 'missing';
    -- Other errors (meaning)
    ELSE
      error_counts := jsonb_set(error_counts, '{meaning}', (error_counts->>'meaning')::INTEGER + 1);
      error_type := 'meaning';
    END IF;
    
    -- Save error type and wrong answer details
    error_types := jsonb_set(error_types, format('{%s}', i)::TEXT[], to_jsonb(error_type));
    wrong_answers := wrong_answers || jsonb_build_object(
      'index', i,
      'userAnswer', p_student_answers[i],
      'correctAnswer', p_correct_answers[i],
      'type', error_type
    );
  END LOOP;
  
  -- Return the analysis results
  RETURN jsonb_build_object(
    'error_counts', error_counts,
    'error_types', error_types,
    'wrong_answers', wrong_answers
  );
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT analyze_student_errors(
  '00000000-0000-0000-0000-000000000000'::UUID,
  '00000000-0000-0000-0000-000000000000'::UUID,
  ARRAY['hallo', 'wrld', ''],
  ARRAY['hello', 'world', 'test']
); 