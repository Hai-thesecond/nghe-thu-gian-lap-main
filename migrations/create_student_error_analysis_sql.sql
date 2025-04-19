-- 1. Đảm bảo extension pg_trgm đã được bật
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tạo hàm wordoverlap để phục vụ cho phân tích lỗi
CREATE OR REPLACE FUNCTION public.wordoverlap(a text, b text) 
RETURNS float AS $$
DECLARE
  a_words text[];
  b_words text[];
  common_count int := 0;
BEGIN
  a_words := regexp_split_to_array(lower(a), '\s+');
  b_words := regexp_split_to_array(lower(b), '\s+');
  
  SELECT COUNT(*) INTO common_count
  FROM (SELECT unnest(a_words) AS word) as a_table
  WHERE word IN (SELECT unnest(b_words));
  
  IF array_length(a_words, 1) IS NULL OR array_length(b_words, 1) IS NULL THEN
    RETURN 0;
  END IF;
  
  RETURN common_count::float / GREATEST(array_length(a_words, 1), array_length(b_words, 1));
END;
$$ LANGUAGE plpgsql;

-- 3. Tạo function để phân tích lỗi từ đáp án của học sinh
CREATE OR REPLACE FUNCTION public.analyze_student_errors(
  p_student_id UUID, 
  p_question_id UUID,
  p_student_answers TEXT[],
  p_correct_answers TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  i INTEGER;
  user_answer TEXT;
  correct_answer TEXT;
  norm_user_answer TEXT;
  norm_correct_answer TEXT;
  error_type TEXT;
  error_counts JSONB := jsonb_build_object(
    'spelling', 0,
    'grammar', 0,
    'missing', 0,
    'meaning', 0,
    'blank', 0,
    'tense', 0
  );
  error_types JSONB := '{}'::JSONB;
  wrong_answers JSONB := '[]'::JSONB;
  distance INTEGER;
  overlap_threshold FLOAT := 0.7;
BEGIN
  -- Kiểm tra đầu vào
  IF p_student_answers IS NULL OR p_correct_answers IS NULL THEN
    RETURN jsonb_build_object(
      'error_counts', error_counts,
      'error_types', error_types,
      'wrong_answers', wrong_answers
    );
  END IF;
  
  -- Duyệt qua từng cặp đáp án
  FOR i IN 1..LEAST(array_length(p_student_answers, 1), array_length(p_correct_answers, 1)) LOOP
    user_answer := COALESCE(p_student_answers[i], '');
    correct_answer := COALESCE(p_correct_answers[i], '');
    
    -- Chuẩn hóa đáp án để so sánh
    norm_user_answer := LOWER(TRIM(REGEXP_REPLACE(user_answer, '[.,\/#!$%\^&\*;:{}=\-_`~()?]', '', 'g')));
    norm_correct_answer := LOWER(TRIM(REGEXP_REPLACE(correct_answer, '[.,\/#!$%\^&\*;:{}=\-_`~()?]', '', 'g')));
    
    -- Bỏ qua nếu đáp án đúng
    IF norm_user_answer = norm_correct_answer THEN
      CONTINUE;
    END IF;
    
    -- Nếu học sinh không điền gì
    IF norm_user_answer = '' THEN
      error_counts := jsonb_set(error_counts, '{blank}', to_jsonb((error_counts->>'blank')::INTEGER + 1));
      error_types := jsonb_set(error_types, ARRAY[(i-1)::TEXT], '"blank"');
      wrong_answers := wrong_answers || jsonb_build_object(
        'index', i-1,
        'userAnswer', '',
        'correctAnswer', correct_answer,
        'type', 'blank'
      );
      CONTINUE;
    END IF;
    
    -- Kiểm tra lỗi chính tả (sai 1-2 ký tự)
    distance := levenshtein(norm_user_answer, norm_correct_answer);
    IF distance <= 2 THEN
      error_counts := jsonb_set(error_counts, '{spelling}', to_jsonb((error_counts->>'spelling')::INTEGER + 1));
      error_type := 'spelling';
    
    -- Kiểm tra lỗi ngữ pháp
    ELSIF wordoverlap(norm_user_answer, norm_correct_answer) > overlap_threshold OR 
          position(norm_user_answer in norm_correct_answer) > 0 OR 
          position(norm_correct_answer in norm_user_answer) > 0 THEN
      error_counts := jsonb_set(error_counts, '{grammar}', to_jsonb((error_counts->>'grammar')::INTEGER + 1));
      error_type := 'grammar';
    
    -- Kiểm tra lỗi sai thì
    ELSIF (position('will' in norm_user_answer) > 0 AND position('would' in norm_correct_answer) > 0) OR
          (position('is' in norm_user_answer) > 0 AND position('was' in norm_correct_answer) > 0) OR
          (position('has' in norm_user_answer) > 0 AND position('had' in norm_correct_answer) > 0) OR
          (position('do' in norm_user_answer) > 0 AND position('did' in norm_correct_answer) > 0) OR
          (position('are' in norm_user_answer) > 0 AND position('were' in norm_correct_answer) > 0) THEN
      error_counts := jsonb_set(error_counts, '{tense}', to_jsonb((error_counts->>'tense')::INTEGER + 1));
      error_type := 'tense';
    
    -- Lỗi thiếu từ
    ELSIF array_length(string_to_array(norm_user_answer, ' '), 1) < array_length(string_to_array(norm_correct_answer, ' '), 1) - 1 THEN
      error_counts := jsonb_set(error_counts, '{missing}', to_jsonb((error_counts->>'missing')::INTEGER + 1));
      error_type := 'missing';
    
    -- Các lỗi khác (mặc định xếp vào lỗi sai nghĩa)
    ELSE
      error_counts := jsonb_set(error_counts, '{meaning}', to_jsonb((error_counts->>'meaning')::INTEGER + 1));
      error_type := 'meaning';
    END IF;
    
    -- Lưu loại lỗi và thêm vào danh sách đáp án sai
    error_types := jsonb_set(error_types, ARRAY[(i-1)::TEXT], to_jsonb(error_type));
    wrong_answers := wrong_answers || jsonb_build_object(
      'index', i-1,
      'userAnswer', user_answer,
      'correctAnswer', correct_answer,
      'type', error_type
    );
  END LOOP;
  
  -- Lưu hoặc cập nhật phân tích lỗi trong bảng error_analysis
  INSERT INTO error_analysis (
    student_id, 
    question_id, 
    error_types, 
    error_details
  )
  VALUES (
    p_student_id,
    p_question_id,
    error_counts,
    jsonb_build_object(
      'error_types', error_types,
      'wrong_answers', wrong_answers
    )
  )
  ON CONFLICT (student_id, question_id) 
  DO UPDATE SET
    error_types = EXCLUDED.error_types,
    error_details = EXCLUDED.error_details,
    created_at = NOW();
  
  RETURN jsonb_build_object(
    'error_counts', error_counts,
    'error_types', error_types,
    'wrong_answers', wrong_answers
  );
END;
$$;

-- 4. Tạo SQL view để tổng hợp phân tích lỗi của học sinh
CREATE OR REPLACE VIEW public.student_error_analysis_view AS
WITH error_counts_summary AS (
  SELECT 
    ea.student_id,
    SUM((ea.error_types->>'spelling')::int) AS spelling_count,
    SUM((ea.error_types->>'grammar')::int) AS grammar_count,
    SUM((ea.error_types->>'missing')::int) AS missing_count,
    SUM((ea.error_types->>'meaning')::int) AS meaning_count,
    SUM((ea.error_types->>'blank')::int) AS blank_count,
    SUM((ea.error_types->>'tense')::int) AS tense_count,
    COUNT(DISTINCT ea.question_id) as questions_count
  FROM 
    error_analysis ea
  GROUP BY 
    ea.student_id
)
SELECT 
  p.id AS student_id,
  p.full_name,
  COALESCE(ecs.questions_count, 0) as questions_count,
  jsonb_build_object(
    'spelling', COALESCE(ecs.spelling_count, 0),
    'grammar', COALESCE(ecs.grammar_count, 0),
    'missing', COALESCE(ecs.missing_count, 0),
    'meaning', COALESCE(ecs.meaning_count, 0),
    'blank', COALESCE(ecs.blank_count, 0),
    'tense', COALESCE(ecs.tense_count, 0)
  ) AS error_type_counts,
  (
    SELECT 
      jsonb_agg(jsonb_build_object(
        'question_id', ea.question_id,
        'error_counts', ea.error_types,
        'error_details', ea.error_details
      ))
    FROM 
      error_analysis ea
    WHERE 
      ea.student_id = p.id
    LIMIT 10
  ) AS question_errors,
  now() AS updated_at
FROM 
  profiles p
LEFT JOIN 
  error_counts_summary ecs ON p.id = ecs.student_id
WHERE 
  p.role = 'student';

-- 5. Tạo function tạo gợi ý cải thiện dựa trên phân tích lỗi
CREATE OR REPLACE FUNCTION public.generate_improvement_suggestions(
  p_student_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  error_data JSONB;
  strengths TEXT[] := '{}';
  weaknesses TEXT[] := '{}';
  suggested_exercises JSONB := '{"exercises": []}'::JSONB;
BEGIN
  -- Lấy tổng hợp lỗi của học sinh
  SELECT 
    jsonb_build_object(
      'spelling', COALESCE(SUM((ea.error_types->>'spelling')::int), 0),
      'grammar', COALESCE(SUM((ea.error_types->>'grammar')::int), 0),
      'missing', COALESCE(SUM((ea.error_types->>'missing')::int), 0),
      'meaning', COALESCE(SUM((ea.error_types->>'meaning')::int), 0),
      'blank', COALESCE(SUM((ea.error_types->>'blank')::int), 0),
      'tense', COALESCE(SUM((ea.error_types->>'tense')::int), 0)
    ) INTO error_data
  FROM 
    error_analysis ea
  WHERE 
    ea.student_id = p_student_id;
  
  -- Xác định điểm mạnh
  IF (error_data->>'spelling')::int <= 1 THEN
    strengths := array_append(strengths, 'Chính tả');
  END IF;
  
  IF (error_data->>'grammar')::int <= 1 THEN
    strengths := array_append(strengths, 'Ngữ pháp');
  END IF;
  
  IF (error_data->>'blank')::int <= 1 THEN
    strengths := array_append(strengths, 'Hoàn thành bài');
  END IF;
  
  -- Xác định điểm yếu (2 loại lỗi phổ biến nhất)
  WITH sorted_errors AS (
    SELECT key, value::int AS count
    FROM jsonb_each_text(error_data)
    WHERE value::int > 0
    ORDER BY value::int DESC
    LIMIT 2
  )
  SELECT 
    array_agg(
      CASE key
        WHEN 'spelling' THEN 'Chính tả'
        WHEN 'grammar' THEN 'Ngữ pháp'
        WHEN 'tense' THEN 'Thì của động từ'
        WHEN 'meaning' THEN 'Từ vựng'
        WHEN 'blank' THEN 'Hoàn thành bài'
        WHEN 'missing' THEN 'Thiếu từ'
        ELSE key
      END
    ) INTO weaknesses
  FROM sorted_errors;
  
  -- Tạo gợi ý bài tập
  IF 'Chính tả' = ANY(weaknesses) THEN
    suggested_exercises := jsonb_set(
      suggested_exercises, 
      '{exercises}', 
      (suggested_exercises->'exercises') || jsonb_build_object(
        'type', 'spelling',
        'title', 'Luyện chính tả',
        'description', 'Tập trung vào việc luyện đánh vần và chính tả các từ.'
      )
    );
  END IF;
  
  IF 'Ngữ pháp' = ANY(weaknesses) THEN
    suggested_exercises := jsonb_set(
      suggested_exercises, 
      '{exercises}', 
      (suggested_exercises->'exercises') || jsonb_build_object(
        'type', 'grammar',
        'title', 'Ôn ngữ pháp',
        'description', 'Ôn lại các quy tắc ngữ pháp cơ bản và cấu trúc câu.'
      )
    );
  END IF;
  
  IF 'Thì của động từ' = ANY(weaknesses) THEN
    suggested_exercises := jsonb_set(
      suggested_exercises, 
      '{exercises}', 
      (suggested_exercises->'exercises') || jsonb_build_object(
        'type', 'tense',
        'title', 'Luyện thì động từ',
        'description', 'Tập trung vào việc phân biệt và sử dụng đúng các thì.'
      )
    );
  END IF;
  
  IF 'Từ vựng' = ANY(weaknesses) THEN
    suggested_exercises := jsonb_set(
      suggested_exercises, 
      '{exercises}', 
      (suggested_exercises->'exercises') || jsonb_build_object(
        'type', 'vocabulary',
        'title', 'Mở rộng từ vựng',
        'description', 'Học thêm từ vựng mới và phân biệt các từ đồng nghĩa, trái nghĩa.'
      )
    );
  END IF;
  
  -- Lưu vào bảng improvement_suggestions
  INSERT INTO improvement_suggestions (
    student_id,
    strengths,
    weaknesses,
    suggested_exercises,
    created_at,
    updated_at
  )
  VALUES (
    p_student_id,
    strengths,
    weaknesses,
    suggested_exercises,
    NOW(),
    NOW()
  )
  ON CONFLICT (student_id)
  DO UPDATE SET
    strengths = EXCLUDED.strengths,
    weaknesses = EXCLUDED.weaknesses,
    suggested_exercises = EXCLUDED.suggested_exercises,
    updated_at = NOW();
  
  RETURN jsonb_build_object(
    'strengths', strengths,
    'weaknesses', weaknesses,
    'suggested_exercises', suggested_exercises
  );
END;
$$;

-- 6. Cấp quyền cho các function và view
GRANT EXECUTE ON FUNCTION public.wordoverlap(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_student_errors(UUID, UUID, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_improvement_suggestions(UUID) TO authenticated;
GRANT SELECT ON public.student_error_analysis_view TO authenticated; 