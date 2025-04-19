-- 1. Function tính điểm dựa trên đáp án của học sinh và đáp án đúng
CREATE OR REPLACE FUNCTION public.calculate_student_score(
  p_student_answers TEXT[],
  p_correct_answers TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  i INTEGER;
  student_answer TEXT;
  correct_answer TEXT;
  norm_student_answer TEXT;
  norm_correct_answer TEXT;
  is_correct BOOLEAN;
  correct_count INTEGER := 0;
  total_positions INTEGER;
  total_score INTEGER;
  errors JSONB := '[]'::JSONB;
  detailed_results JSONB := '[]'::JSONB;
BEGIN
  -- Kiểm tra đầu vào
  IF p_student_answers IS NULL OR p_correct_answers IS NULL THEN
    RETURN jsonb_build_object(
      'totalScore', 0,
      'correctAnswers', 0,
      'incorrectAnswers', 0,
      'errors', errors,
      'detailedResults', detailed_results
    );
  END IF;
  
  -- Duyệt qua từng cặp đáp án
  FOR i IN 1..LEAST(array_length(p_student_answers, 1), array_length(p_correct_answers, 1)) LOOP
    student_answer := COALESCE(p_student_answers[i], '');
    correct_answer := COALESCE(p_correct_answers[i], '');
    
    -- Chuẩn hóa đáp án để so sánh
    norm_student_answer := LOWER(TRIM(REGEXP_REPLACE(student_answer, '[.,\/#!$%\^&\*;:{}=\-_`~()?]', '', 'g')));
    norm_correct_answer := LOWER(TRIM(REGEXP_REPLACE(correct_answer, '[.,\/#!$%\^&\*;:{}=\-_`~()?]', '', 'g')));
    
    -- QUAN TRỌNG: Nếu học sinh không điền gì, luôn tính là sai
    is_correct := norm_student_answer != '' AND norm_student_answer = norm_correct_answer;
    
    -- Thêm kết quả vào detailed_results
    detailed_results := detailed_results || jsonb_build_object(
      'index', i-1,
      'position', i-1,
      'studentAnswer', student_answer,
      'correctAnswer', correct_answer,
      'normalized', jsonb_build_object(
        'student', norm_student_answer,
        'correct', norm_correct_answer
      ),
      'isCorrect', is_correct,
      'isSentence', FALSE
    );
    
    IF is_correct THEN
      correct_count := correct_count + 1;
    ELSE
      errors := errors || jsonb_build_object(
        'index', i-1,
        'userAnswer', student_answer,
        'correctAnswer', correct_answer,
        'position', i-1
      );
    END IF;
  END LOOP;
  
  -- Tính điểm tổng thể
  total_positions := LEAST(array_length(p_student_answers, 1), array_length(p_correct_answers, 1));
  
  IF total_positions > 0 THEN
    total_score := ROUND((correct_count::float / total_positions) * 100);
  ELSE
    total_score := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'totalScore', total_score,
    'correctAnswers', correct_count,
    'incorrectAnswers', total_positions - correct_count,
    'errors', errors,
    'detailedResults', detailed_results
  );
END;
$$;

-- 2. Function điều chỉnh điểm số theo trình độ học sinh
CREATE OR REPLACE FUNCTION public.calculate_adjusted_score(
  p_score INTEGER,
  p_student_category TEXT
) RETURNS FLOAT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  category TEXT;
  multiplier FLOAT;
  adjusted_score FLOAT;
BEGIN
  -- Map 'weak' to 'poor' for multiplier lookup
  category := CASE WHEN p_student_category = 'weak' THEN 'poor' ELSE p_student_category END;
  
  -- Định nghĩa hệ số nhân cho từng loại - thang điểm 10
  multiplier := CASE category
    WHEN 'good' THEN 10.0    -- Học sinh giỏi: 10 là điểm tối đa
    WHEN 'average' THEN 8.0  -- Học sinh trung bình: 8 là điểm tối đa
    WHEN 'poor' THEN 7.0     -- Học sinh yếu: 7 là điểm tối đa
    ELSE 8.0                 -- Mặc định: 8
  END;
  
  -- Tính điểm đã điều chỉnh thang điểm 10 và làm tròn lên 1 chữ số thập phân
  adjusted_score := CEIL((p_score::float / 100) * multiplier * 10) / 10;
  
  RETURN adjusted_score;
END;
$$;

-- 3. Function xác định tỷ lệ điền chỗ trống theo trình độ học sinh
CREATE OR REPLACE FUNCTION public.get_blank_percentage(
  p_student_level TEXT
) RETURNS FLOAT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE p_student_level
    WHEN 'good' THEN 0.5     -- 50% for good students
    WHEN 'average' THEN 0.4  -- 40% for average students
    WHEN 'poor' THEN 0.3     -- 30% for poor students
    ELSE 0.4                 -- Default to 40%
  END;
END;
$$;

-- 4. Function tổng hợp: vừa phân tích lỗi, vừa tính điểm (giảm số lượng API call)
CREATE OR REPLACE FUNCTION public.analyze_and_score_student_answer(
  p_student_id UUID,
  p_question_id UUID,
  p_student_answers TEXT[],
  p_correct_answers TEXT[],
  p_student_category TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  score_result JSONB;
  error_analysis JSONB;
  adjusted_score FLOAT;
BEGIN
  -- 1. Tính điểm
  score_result := calculate_student_score(p_student_answers, p_correct_answers);
  
  -- 2. Phân tích lỗi
  error_analysis := analyze_student_errors(p_student_id, p_question_id, p_student_answers, p_correct_answers);
  
  -- 3. Tính điểm điều chỉnh
  adjusted_score := calculate_adjusted_score(
    (score_result->>'totalScore')::INTEGER,
    p_student_category
  );
  
  -- 4. Tạo gợi ý cải thiện
  PERFORM generate_improvement_suggestions(p_student_id);
  
  -- 5. Trả về kết quả tổng hợp
  RETURN jsonb_build_object(
    'score_result', score_result,
    'error_analysis', error_analysis,
    'adjusted_score', adjusted_score,
    'blank_percentage', get_blank_percentage(p_student_category)
  );
END;
$$;

-- 5. Cấp quyền cho các function
GRANT EXECUTE ON FUNCTION public.calculate_student_score(TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_adjusted_score(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_blank_percentage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_and_score_student_answer(UUID, UUID, TEXT[], TEXT[], TEXT) TO authenticated; 