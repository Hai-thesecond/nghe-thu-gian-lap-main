-- Script đơn giản để khắc phục vấn đề với cột answers
-- Chạy script này trong Supabase SQL Editor

DO $$
BEGIN
  -- Kiểm tra nếu bảng chưa tồn tại, tạo mới
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_answers') THEN
    CREATE TABLE public.student_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
      answers text[] DEFAULT ARRAY[]::text[] NOT NULL,
      attempt_count integer DEFAULT 1,
      cheating_attempts integer DEFAULT 0,
      started_at timestamp with time zone,
      completed_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );
  ELSE
    -- Kiểm tra cột answers và đảm bảo nó có kiểu dữ liệu text[]
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_answers' AND column_name = 'answers') THEN
      -- Kiểm tra kiểu dữ liệu của cột
      IF NOT (SELECT data_type FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'student_answers' AND column_name = 'answers') = 'ARRAY' THEN
        -- Cập nhật kiểu dữ liệu từ kiểu hiện tại sang text[]
        ALTER TABLE public.student_answers ALTER COLUMN answers TYPE text[] USING 
          CASE 
            WHEN answers IS NULL THEN ARRAY[]::text[]
            WHEN answers::text LIKE '[%]' THEN
              -- Cố gắng chuyển đổi từ chuỗi JSON sang mảng
              (SELECT array_agg(value::text) FROM jsonb_array_elements(answers::jsonb))
            ELSE ARRAY[answers::text]
          END;
      END IF;
      
      -- Đảm bảo cột không được NULL và có giá trị mặc định
      ALTER TABLE public.student_answers ALTER COLUMN answers SET DEFAULT ARRAY[]::text[];
      ALTER TABLE public.student_answers ALTER COLUMN answers SET NOT NULL;
      
      -- Cập nhật các giá trị NULL
      UPDATE public.student_answers SET answers = ARRAY[]::text[] WHERE answers IS NULL;
    ELSE
      -- Nếu cột không tồn tại, thêm vào
      ALTER TABLE public.student_answers ADD COLUMN answers text[] DEFAULT ARRAY[]::text[] NOT NULL;
    END IF;
  END IF;
  
  -- Tạo hàm RPC đơn giản để cập nhật bài làm học sinh
  CREATE OR REPLACE FUNCTION public.update_student_record(
    record_id uuid,
    answer_values text[],
    complete_time timestamptz,
    cheating_count int
  ) RETURNS boolean AS $$
  DECLARE
    success boolean;
  BEGIN
    UPDATE public.student_answers SET
      answers = answer_values,
      completed_at = complete_time,
      cheating_attempts = cheating_count,
      updated_at = now()
    WHERE id = record_id;
    
    GET DIAGNOSTICS success = ROW_COUNT;
    RETURN success > 0;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  
  -- Cấp quyền cho hàm
  GRANT EXECUTE ON FUNCTION public.update_student_record(uuid, text[], timestamptz, int) TO authenticated, anon;
END
$$; 