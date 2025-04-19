-- First create our text similarity function if it doesn't exist
DROP FUNCTION IF EXISTS dictation_text_similarity(text, text);
CREATE OR REPLACE FUNCTION dictation_text_similarity(str1 text, str2 text) 
RETURNS integer AS $$
DECLARE
  matrix integer[][];
  len1 integer := length(str1);
  len2 integer := length(str2);
  i integer;
  j integer;
BEGIN
  -- Handle empty strings
  IF str1 IS NULL OR str2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF len1 = 0 THEN
    RETURN len2;
  END IF;
  
  IF len2 = 0 THEN
    RETURN len1;
  END IF;
  
  -- Initialize matrix
  matrix := array_fill(0, ARRAY[len2 + 1, len1 + 1]);
  
  -- Fill first row and column
  FOR i IN 0..len2 LOOP
    matrix[i+1][1] := i;
  END LOOP;
  
  FOR j IN 0..len1 LOOP
    matrix[1][j+1] := j;
  END LOOP;
  
  -- Fill the rest of the matrix
  FOR i IN 1..len2 LOOP
    FOR j IN 1..len1 LOOP
      IF substring(str2 FROM i FOR 1) = substring(str1 FROM j FOR 1) THEN
        matrix[i+1][j+1] := matrix[i][j];
      ELSE
        matrix[i+1][j+1] := LEAST(
          matrix[i][j] + 1,     -- substitution
          matrix[i+1][j] + 1,   -- insertion
          matrix[i][j+1] + 1    -- deletion
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN matrix[len2+1][len1+1];
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Now create a fixed error analysis function
DROP FUNCTION IF EXISTS analyze_student_errors(UUID, UUID, TEXT[], TEXT[]);
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
  count_value INTEGER;
  i INTEGER;
BEGIN
  -- Initialize error counts with proper JSONB format
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
      count_value := (error_counts->>'blank')::INTEGER + 1;
      error_counts := jsonb_set(error_counts, '{blank}', to_jsonb(count_value));
      error_types := jsonb_set(error_types, format('{%s}', i)::TEXT[], to_jsonb('blank'));
      wrong_answers := wrong_answers || jsonb_build_object(
        'index', i,
        'userAnswer', '',
        'correctAnswer', p_correct_answers[i],
        'type', 'blank'
      );
      CONTINUE;
    END IF;
    
    -- Check for spelling errors (1-2 characters different)
    IF dictation_text_similarity(normalized_user_answer, normalized_correct_answer) <= 2 THEN
      count_value := (error_counts->>'spelling')::INTEGER + 1;
      error_counts := jsonb_set(error_counts, '{spelling}', to_jsonb(count_value));
      error_type := 'spelling';
    -- Check for grammar errors (similar words or one contains the other)
    ELSIF (
      -- Word similarity check would go here but we skip it for now
      (normalized_user_answer LIKE '%' || normalized_correct_answer || '%') OR 
      (normalized_correct_answer LIKE '%' || normalized_user_answer || '%')
    ) THEN
      count_value := (error_counts->>'grammar')::INTEGER + 1;
      error_counts := jsonb_set(error_counts, '{grammar}', to_jsonb(count_value));
      error_type := 'grammar';
    -- Check for tense errors
    ELSIF (
      (normalized_user_answer LIKE '%will%' AND normalized_correct_answer LIKE '%would%') OR
      (normalized_user_answer LIKE '%is%' AND normalized_correct_answer LIKE '%was%') OR
      (normalized_user_answer LIKE '%has%' AND normalized_correct_answer LIKE '%had%') OR
      (normalized_user_answer LIKE '%do%' AND normalized_correct_answer LIKE '%did%') OR
      (normalized_user_answer LIKE '%are%' AND normalized_correct_answer LIKE '%were%')
    ) THEN
      count_value := (error_counts->>'tense')::INTEGER + 1;
      error_counts := jsonb_set(error_counts, '{tense}', to_jsonb(count_value));
      error_type := 'tense';
    -- Check for missing words
    ELSIF array_length(string_to_array(normalized_user_answer, ' '), 1) < array_length(string_to_array(normalized_correct_answer, ' '), 1) - 1 THEN
      count_value := (error_counts->>'missing')::INTEGER + 1;
      error_counts := jsonb_set(error_counts, '{missing}', to_jsonb(count_value));
      error_type := 'missing';
    -- Other errors (meaning)
    ELSE
      count_value := (error_counts->>'meaning')::INTEGER + 1;
      error_counts := jsonb_set(error_counts, '{meaning}', to_jsonb(count_value));
      error_type := 'meaning';
    END IF;
    
    -- Save error type and wrong answer details - ensure consistent JSONB handling
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
) as error_analysis_test; 