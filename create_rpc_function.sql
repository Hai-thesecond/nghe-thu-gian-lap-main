-- Tạo hàm RPC để cập nhật bảng student_answers
-- Chạy script này trong Supabase SQL Editor

-- Tạo hàm RPC để cập nhật bảng student_answers
CREATE OR REPLACE FUNCTION public.update_student_answers(
  p_record_id uuid, 
  p_answers text[], 
  p_completed_at timestamp with time zone, 
  p_cheating_attempts integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  success boolean;
  result jsonb;
BEGIN
  -- Cập nhật bảng student_answers
  UPDATE public.student_answers
  SET 
    answers = p_answers,
    completed_at = p_completed_at,
    cheating_attempts = p_cheating_attempts,
    updated_at = now()
  WHERE id = p_record_id;
  
  -- Kiểm tra xem có bản ghi nào bị ảnh hưởng không
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- Tạo kết quả
  IF success THEN
    result := jsonb_build_object(
      'success', true,
      'message', 'Successfully updated student answers',
      'record_id', p_record_id
    );
  ELSE
    result := jsonb_build_object(
      'success', false,
      'message', 'No records updated',
      'record_id', p_record_id
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION public.update_student_answers(uuid, text[], timestamp with time zone, integer) TO anon, authenticated, service_role;

-- Cập nhật hoặc tạo hàm khác nếu cột answers_json tồn tại
CREATE OR REPLACE FUNCTION public.update_student_answers_json(
  p_record_id uuid, 
  p_answers_json jsonb, 
  p_completed_at timestamp with time zone, 
  p_cheating_attempts integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  success boolean;
  result jsonb;
  column_exists boolean;
BEGIN
  -- Kiểm tra xem cột answers_json có tồn tại không
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'student_answers'
    AND column_name = 'answers_json'
  ) INTO column_exists;
  
  IF column_exists THEN
    -- Cập nhật bảng student_answers với answers_json
    UPDATE public.student_answers
    SET 
      answers_json = p_answers_json,
      completed_at = p_completed_at,
      cheating_attempts = p_cheating_attempts,
      updated_at = now()
    WHERE id = p_record_id;
  ELSE
    -- Chuyển đổi answers_json thành mảng text và cập nhật answers
    UPDATE public.student_answers
    SET 
      answers = (SELECT array_agg(value::text) FROM jsonb_array_elements(p_answers_json)),
      completed_at = p_completed_at,
      cheating_attempts = p_cheating_attempts,
      updated_at = now()
    WHERE id = p_record_id;
  END IF;
  
  -- Kiểm tra xem có bản ghi nào bị ảnh hưởng không
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- Tạo kết quả
  IF success THEN
    result := jsonb_build_object(
      'success', true,
      'message', 'Successfully updated student answers',
      'record_id', p_record_id
    );
  ELSE
    result := jsonb_build_object(
      'success', false,
      'message', 'No records updated',
      'record_id', p_record_id
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION public.update_student_answers_json(uuid, jsonb, timestamp with time zone, integer) TO anon, authenticated, service_role; 