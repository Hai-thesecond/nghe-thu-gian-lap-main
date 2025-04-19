-- ============================================
-- PART 1: Create necessary extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ============================================
-- PART 2: Create custom word similarity function
-- ============================================
DROP FUNCTION IF EXISTS student_word_distance(text, text);
CREATE OR REPLACE FUNCTION student_word_distance(word1 text, word2 text) 
RETURNS integer AS $$
DECLARE
  dist_matrix integer[][];
  i integer;
  j integer;
  len1 integer;
  len2 integer;
BEGIN
  -- Handle empty strings
  IF word1 IS NULL OR word2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  len1 := length(word1);
  len2 := length(word2);
  
  IF len1 = 0 THEN
    RETURN len2;
  END IF;
  
  IF len2 = 0 THEN
    RETURN len1;
  END IF;
  
  -- Initialize matrix
  dist_matrix := array_fill(0, ARRAY[len2 + 1, len1 + 1]);
  
  -- Fill first row and column
  FOR i IN 0..len2 LOOP
    dist_matrix[i+1][1] := i;
  END LOOP;
  
  FOR j IN 0..len1 LOOP
    dist_matrix[1][j+1] := j;
  END LOOP;
  
  -- Fill the rest of the matrix
  FOR i IN 1..len2 LOOP
    FOR j IN 1..len1 LOOP
      IF substring(word2 FROM i FOR 1) = substring(word1 FROM j FOR 1) THEN
        dist_matrix[i+1][j+1] := dist_matrix[i][j];
      ELSE
        dist_matrix[i+1][j+1] := LEAST(
          dist_matrix[i][j] + 1,     -- substitution
          dist_matrix[i+1][j] + 1,   -- insertion
          dist_matrix[i][j+1] + 1    -- deletion
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN dist_matrix[len2+1][len1+1];
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- ============================================
-- PART 3: Update error analysis function
-- ============================================
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
    IF student_word_distance(normalized_user_answer, normalized_correct_answer) <= 2 THEN
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

-- ============================================
-- PART 4: Enable RLS and create policies
-- ============================================
-- Enable RLS on error_analysis table
ALTER TABLE public.error_analysis ENABLE ROW LEVEL SECURITY;

-- First, drop existing policies to avoid conflicts
DO $$
BEGIN
    -- Try to drop policies if they exist
    BEGIN
        DROP POLICY IF EXISTS "Students can view their own error analysis" ON public.error_analysis;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Teachers can view error analysis for their students" ON public.error_analysis;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Teachers and students can insert error analysis data" ON public.error_analysis;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Students can update their own error analysis" ON public.error_analysis;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Teachers can update error analysis for their students" ON public.error_analysis;
    EXCEPTION WHEN OTHERS THEN END;
    
    BEGIN
        DROP POLICY IF EXISTS "Admins can manage all error analysis data" ON public.error_analysis;
    EXCEPTION WHEN OTHERS THEN END;
END;
$$;

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

-- ============================================
-- PART 5: Test functions
-- ============================================
-- Test word distance function
SELECT student_word_distance('hello', 'hallo') as test_distance_1; -- Should return 1
SELECT student_word_distance('hello', 'world') as test_distance_2; -- Should return 4

-- Test error analysis
SELECT analyze_student_errors(
  '00000000-0000-0000-0000-000000000000'::UUID,
  '00000000-0000-0000-0000-000000000000'::UUID,
  ARRAY['hallo', 'wrld', ''],
  ARRAY['hello', 'world', 'test']
) as error_analysis_test; 