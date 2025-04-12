-- Thêm cột answers_text để lưu answers dưới dạng chuỗi JSON đơn giản
-- Chạy script này trong Supabase SQL Editor

DO $$
BEGIN
  -- Kiểm tra xem cột answers_text đã tồn tại chưa
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'student_answers'
    AND column_name = 'answers_text'
  ) THEN
    -- Nếu chưa tồn tại, thêm cột mới
    ALTER TABLE public.student_answers
    ADD COLUMN answers_text text;
    
    -- Cập nhật cột answers_text từ cột answers nếu có
    UPDATE public.student_answers
    SET answers_text = array_to_json(answers)::text
    WHERE answers IS NOT NULL;
  END IF;
  
  -- Tạo trigger để đồng bộ answers và answers_text
  CREATE OR REPLACE FUNCTION sync_answers_text()
  RETURNS TRIGGER AS $$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      -- Khi thêm mới một bản ghi
      IF NEW.answers IS NOT NULL AND NEW.answers_text IS NULL THEN
        NEW.answers_text := array_to_json(NEW.answers)::text;
      ELSIF NEW.answers IS NULL AND NEW.answers_text IS NOT NULL THEN
        BEGIN
          NEW.answers := array(SELECT jsonb_array_elements_text(NEW.answers_text::jsonb));
        EXCEPTION WHEN OTHERS THEN
          -- Nếu không phải JSON array, thử xử lý dưới dạng text
          NEW.answers := ARRAY[NEW.answers_text];
        END;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Khi cập nhật một bản ghi
      IF NEW.answers IS DISTINCT FROM OLD.answers AND NEW.answers IS NOT NULL THEN
        NEW.answers_text := array_to_json(NEW.answers)::text;
      ELSIF NEW.answers_text IS DISTINCT FROM OLD.answers_text AND NEW.answers_text IS NOT NULL THEN
        BEGIN
          NEW.answers := array(SELECT jsonb_array_elements_text(NEW.answers_text::jsonb));
        EXCEPTION WHEN OTHERS THEN
          -- Nếu không phải JSON array, thử xử lý dưới dạng text
          NEW.answers := ARRAY[NEW.answers_text];
        END;
      END IF;
    END IF;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  
  -- Xóa trigger nếu đã tồn tại
  DROP TRIGGER IF EXISTS sync_answers_text_trigger ON public.student_answers;
  
  -- Tạo trigger mới
  CREATE TRIGGER sync_answers_text_trigger
  BEFORE INSERT OR UPDATE ON public.student_answers
  FOR EACH ROW
  EXECUTE FUNCTION sync_answers_text();
  
  -- Tạo hàm RPC để cập nhật answers_text
  CREATE OR REPLACE FUNCTION public.update_student_answers_text(
    p_record_id uuid,
    p_answers_text text,
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
      answers_text = p_answers_text,
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
        'message', 'Successfully updated student answers_text',
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
  GRANT EXECUTE ON FUNCTION public.update_student_answers_text(uuid, text, timestamp with time zone, integer) TO anon, authenticated, service_role;

END
$$; 