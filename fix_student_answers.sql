-- Script để sửa cấu trúc bảng student_answers và đảm bảo xử lý mảng đúng cách
-- Chạy script này trong Supabase SQL Editor

-- Bắt đầu transaction để đảm bảo toàn bộ thay đổi được thực hiện hoặc không có thay đổi nào được áp dụng
BEGIN;

-- 1. Kiểm tra xem trường answers đã tồn tại chưa
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'student_answers'
        AND column_name = 'answers'
    ) THEN
        -- Nếu trường đã tồn tại, đảm bảo nó có kiểu dữ liệu text[]
        ALTER TABLE public.student_answers
        ALTER COLUMN answers TYPE text[] USING 
        CASE 
            WHEN answers IS NULL THEN ARRAY[]::text[]
            WHEN jsonb_typeof(to_jsonb(answers)) = 'array' THEN answers::text[]
            ELSE ARRAY[answers::text]
        END;
    ELSE
        -- Nếu trường chưa tồn tại, tạo mới
        ALTER TABLE public.student_answers
        ADD COLUMN answers text[] DEFAULT ARRAY[]::text[];
    END IF;
END $$;

-- 2. Đảm bảo rằng trường answers không thể NULL và có giá trị mặc định
ALTER TABLE public.student_answers
ALTER COLUMN answers SET DEFAULT ARRAY[]::text[],
ALTER COLUMN answers SET NOT NULL;

-- 3. Cập nhật các giá trị NULL hiện có thành mảng rỗng
UPDATE public.student_answers 
SET answers = ARRAY[]::text[] 
WHERE answers IS NULL;

-- 4. Đảm bảo rằng trường answers_json tồn tại (để hỗ trợ cách tiếp cận thay thế)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'student_answers'
        AND column_name = 'answers_json'
    ) THEN
        ALTER TABLE public.student_answers
        ADD COLUMN answers_json jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 5. Tạo trigger để đồng bộ answers và answers_json
CREATE OR REPLACE FUNCTION sync_answers_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.answers IS NULL THEN
            NEW.answers := ARRAY[]::text[];
        END IF;
        
        IF NEW.answers_json IS NULL THEN
            NEW.answers_json := to_jsonb(NEW.answers);
        ELSIF NEW.answers_json IS NOT NULL AND NEW.answers IS NULL THEN
            NEW.answers := (SELECT array_agg(value::text) FROM jsonb_array_elements(NEW.answers_json));
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.answers IS DISTINCT FROM OLD.answers AND NEW.answers IS NOT NULL THEN
            NEW.answers_json := to_jsonb(NEW.answers);
        ELSIF NEW.answers_json IS DISTINCT FROM OLD.answers_json AND NEW.answers_json IS NOT NULL THEN
            NEW.answers := (SELECT array_agg(value::text) FROM jsonb_array_elements(NEW.answers_json));
        END IF;
        
        IF NEW.answers IS NULL THEN
            NEW.answers := ARRAY[]::text[];
        END IF;
        
        IF NEW.answers_json IS NULL THEN
            NEW.answers_json := '[]'::jsonb;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Xóa trigger nếu đã tồn tại
DROP TRIGGER IF EXISTS sync_answers_trigger ON public.student_answers;

-- Tạo trigger mới
CREATE TRIGGER sync_answers_trigger
BEFORE INSERT OR UPDATE ON public.student_answers
FOR EACH ROW
EXECUTE FUNCTION sync_answers_fields();

-- 6. Kiểm tra các ràng buộc khóa chính và khóa ngoại
DO $$
BEGIN
    -- Đảm bảo rằng bảng có khóa chính
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.student_answers'::regclass AND contype = 'p'
    ) THEN
        ALTER TABLE public.student_answers ADD PRIMARY KEY (id);
    END IF;
    
    -- Đảm bảo các khóa ngoại đến profiles và questions
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.student_answers'::regclass 
        AND conname = 'student_answers_student_id_fkey'
    ) THEN
        ALTER TABLE public.student_answers
        ADD CONSTRAINT student_answers_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.student_answers'::regclass 
        AND conname = 'student_answers_question_id_fkey'
    ) THEN
        ALTER TABLE public.student_answers
        ADD CONSTRAINT student_answers_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES public.questions(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 7. Tạo hàm RPC để kiểm tra thông tin bảng
CREATE OR REPLACE FUNCTION public.get_table_info(table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'columns', (
            SELECT jsonb_object_agg(column_name, jsonb_build_object(
                'data_type', data_type,
                'is_nullable', is_nullable,
                'column_default', column_default
            ))
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
        ),
        'constraints', (
            SELECT jsonb_agg(jsonb_build_object(
                'constraint_name', c.conname,
                'constraint_type', CASE
                    WHEN c.contype = 'p' THEN 'PRIMARY KEY'
                    WHEN c.contype = 'f' THEN 'FOREIGN KEY'
                    WHEN c.contype = 'u' THEN 'UNIQUE'
                    ELSE c.contype::text
                END
            ))
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public' AND t.relname = $1
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION public.get_table_info(text) TO anon, authenticated, service_role;

COMMIT; 