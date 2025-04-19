-- Cập nhật bảng student_answers để hỗ trợ nhiều lần làm bài
-- Đảm bảo có trường attempt_timestamp
ALTER TABLE public.student_answers
ADD COLUMN IF NOT EXISTS attempt_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Đảm bảo có các index cần thiết
CREATE INDEX IF NOT EXISTS idx_student_answers_attempts 
ON public.student_answers (student_id, question_id, attempt_count);

CREATE INDEX IF NOT EXISTS idx_student_answers_timestamps
ON public.student_answers (student_id, question_id, attempt_timestamp DESC);

-- Tạo RPC function mới cho việc lưu điểm với nhiều lần làm bài
CREATE OR REPLACE FUNCTION public.save_new_student_attempt(
  p_student_id UUID,
  p_question_id UUID,
  p_score INTEGER,
  p_correct_count INTEGER,
  p_incorrect_count INTEGER,
  p_answers TEXT[],
  p_answers_text TEXT,
  p_correct_answers_text TEXT,
  p_metadata JSONB,
  p_error_details JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_count INTEGER;
  v_new_record_id UUID;
BEGIN
  -- Kiểm tra tham số đầu vào
  IF p_student_id IS NULL OR p_question_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'student_id và question_id không được null'
    );
  END IF;
  
  -- Tìm số lần làm bài hiện tại
  SELECT COALESCE(MAX(attempt_count), 0) + 1 INTO v_attempt_count
  FROM student_answers
  WHERE student_id = p_student_id AND question_id = p_question_id;
  
  -- Thêm bản ghi mới
  INSERT INTO student_answers (
    student_id, 
    question_id, 
    attempt_count, 
    score, 
    correct_count,
    incorrect_count,
    answers,
    answers_text,
    correct_answers_text,
    is_completed, 
    completed_at, 
    metadata,
    error_details,
    attempt_timestamp
  ) VALUES (
    p_student_id, 
    p_question_id, 
    v_attempt_count, 
    p_score, 
    p_correct_count,
    p_incorrect_count,
    p_answers,
    p_answers_text,
    p_correct_answers_text,
    TRUE, 
    NOW(), 
    p_metadata,
    p_error_details,
    NOW()
  ) RETURNING id INTO v_new_record_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'record_id', v_new_record_id,
    'attempt_count', v_attempt_count
  );
END; 
$$;

-- Cập nhật simple_update_score để hỗ trợ attempt_count
CREATE OR REPLACE FUNCTION public.simple_update_score(
  p_record_id uuid,
  p_score integer,
  p_correct_count integer,
  p_incorrect_count integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_result JSONB;
BEGIN
  -- Kiểm tra tham số đầu vào
  IF p_record_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Record ID không được null'
    );
  END IF;
  
  -- Tính toán số liệu nếu thiếu
  p_score := COALESCE(p_score, 0);
  p_correct_count := COALESCE(p_correct_count, 0);
  p_incorrect_count := COALESCE(p_incorrect_count, 0);
  
  -- Lấy student_id từ bản ghi
  SELECT student_id INTO v_student_id FROM student_answers WHERE id = p_record_id;
  
  -- Kiểm tra bản ghi tồn tại
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Không tìm thấy bản ghi'
    );
  END IF;
  
  -- Cập nhật bản ghi
  UPDATE student_answers
  SET 
    score = p_score,
    correct_count = p_correct_count,
    incorrect_count = p_incorrect_count,
    is_completed = TRUE,
    completed_at = COALESCE(completed_at, NOW()),
    updated_at = NOW()
  WHERE id = p_record_id
  RETURNING id INTO v_student_id;
  
  -- Kiểm tra kết quả
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cập nhật thất bại'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cập nhật thành công',
    'record_id', p_record_id
  );
END;
$$;

-- Thêm function để lấy lịch sử làm bài theo học sinh và câu hỏi
CREATE OR REPLACE FUNCTION public.get_student_attempt_history(
  p_student_id UUID,
  p_question_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sa.id,
      'score', sa.score,
      'attempt_count', sa.attempt_count,
      'completed_at', sa.completed_at,
      'correct_count', sa.correct_count,
      'incorrect_count', sa.incorrect_count,
      'attempt_timestamp', sa.attempt_timestamp
    )
  ) INTO v_result
  FROM student_answers sa
  WHERE 
    sa.student_id = p_student_id AND 
    sa.question_id = p_question_id AND
    sa.is_completed = TRUE
  ORDER BY sa.attempt_count DESC;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$; 