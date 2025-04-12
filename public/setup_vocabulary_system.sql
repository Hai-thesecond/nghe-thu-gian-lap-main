-- Bọc toàn bộ script trong transaction để đảm bảo tính nhất quán
BEGIN;

-- 1. Tạo bảng vocabulary_items nếu chưa tồn tại
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vocabulary_items') THEN
    CREATE TABLE public.vocabulary_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
      word TEXT NOT NULL,
      part_of_speech TEXT DEFAULT 'noun',
      meaning_vi TEXT NOT NULL,
      audio_start_time NUMERIC DEFAULT 0,
      audio_end_time NUMERIC DEFAULT 0,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
    );
    
    -- Thiết lập RLS
    ALTER TABLE public.vocabulary_items ENABLE ROW LEVEL SECURITY;
    
    -- Cấp quyền
    GRANT ALL ON public.vocabulary_items TO authenticated;
    GRANT ALL ON public.vocabulary_items TO service_role;
    
    RAISE NOTICE 'Đã tạo bảng vocabulary_items';
  ELSE
    RAISE NOTICE 'Bảng vocabulary_items đã tồn tại';
  END IF;
END $$;

-- 2. Xóa policies hiện có nếu cần cập nhật lại
DO $$
BEGIN
  -- Xóa policies cũ để tránh trùng lặp
  DROP POLICY IF EXISTS "Everyone can view vocabulary items" ON public.vocabulary_items;
  DROP POLICY IF EXISTS "Teachers can insert vocabulary items" ON public.vocabulary_items;
  DROP POLICY IF EXISTS "Teachers can update vocabulary items" ON public.vocabulary_items;
  DROP POLICY IF EXISTS "Teachers can delete vocabulary items" ON public.vocabulary_items;
  
  -- Tạo policies mới
  EXECUTE 'CREATE POLICY "Everyone can view vocabulary items" ON public.vocabulary_items FOR SELECT USING (true)';
  
  EXECUTE 'CREATE POLICY "Teachers can insert vocabulary items" ON public.vocabulary_items FOR INSERT
          WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = ''teacher'')';
  
  EXECUTE 'CREATE POLICY "Teachers can update vocabulary items" ON public.vocabulary_items FOR UPDATE
          USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = ''teacher'')';
  
  EXECUTE 'CREATE POLICY "Teachers can delete vocabulary items" ON public.vocabulary_items FOR DELETE
          USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = ''teacher'')';
          
  RAISE NOTICE 'Đã cập nhật policies cho vocabulary_items';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Lỗi khi cập nhật policies: %', SQLERRM;
END $$;

-- 3. Tạo bảng vocabulary_progress nếu chưa tồn tại
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vocabulary_progress') THEN
    CREATE TABLE public.vocabulary_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      vocabulary_id UUID REFERENCES public.vocabulary_items(id) ON DELETE CASCADE,
      question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
      attempts INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      last_practiced TIMESTAMP WITH TIME ZONE,
      mastery_level INTEGER DEFAULT 0,
      flashcard_completed BOOLEAN DEFAULT false,
      listening_practice_completed BOOLEAN DEFAULT false,
      post_practice_completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      UNIQUE(student_id, vocabulary_id)
    );
    
    -- Thiết lập RLS
    ALTER TABLE public.vocabulary_progress ENABLE ROW LEVEL SECURITY;
    
    -- Cấp quyền
    GRANT ALL ON public.vocabulary_progress TO authenticated;
    GRANT ALL ON public.vocabulary_progress TO service_role;
    
    RAISE NOTICE 'Đã tạo bảng vocabulary_progress';
  ELSE
    RAISE NOTICE 'Bảng vocabulary_progress đã tồn tại';
  END IF;
END $$;

-- 4. Xóa và tạo lại policies cho vocabulary_progress
DO $$
BEGIN
  -- Xóa policies cũ nếu có
  DROP POLICY IF EXISTS "Students can view their own vocabulary progress" ON public.vocabulary_progress;
  DROP POLICY IF EXISTS "Students can insert their own vocabulary progress" ON public.vocabulary_progress;
  DROP POLICY IF EXISTS "Students can update their own vocabulary progress" ON public.vocabulary_progress;
  
  -- Tạo policies mới
  EXECUTE 'CREATE POLICY "Students can view their own vocabulary progress" 
          ON public.vocabulary_progress FOR SELECT
          USING (student_id = auth.uid())';
  
  EXECUTE 'CREATE POLICY "Students can insert their own vocabulary progress" 
          ON public.vocabulary_progress FOR INSERT
          WITH CHECK (student_id = auth.uid())';
  
  EXECUTE 'CREATE POLICY "Students can update their own vocabulary progress" 
          ON public.vocabulary_progress FOR UPDATE
          USING (student_id = auth.uid())';
          
  RAISE NOTICE 'Đã cập nhật policies cho vocabulary_progress';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Lỗi khi cập nhật policies vocabulary_progress: %', SQLERRM;
END $$;

-- 5. Tạo hoặc cập nhật function get_vocabulary_for_practice
CREATE OR REPLACE FUNCTION public.get_vocabulary_for_practice(
  p_student_id UUID,
  p_question_id UUID,
  p_practice_type TEXT
)
RETURNS TABLE (
  id UUID,
  word TEXT,
  part_of_speech TEXT,
  meaning_vi TEXT,
  image_url TEXT,
  audio_start_time NUMERIC,
  audio_end_time NUMERIC,
  attempts INTEGER,
  correct_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.word,
    v.part_of_speech,
    v.meaning_vi,
    v.image_url,
    v.audio_start_time,
    v.audio_end_time,
    COALESCE(vp.attempts, 0) as attempts,
    COALESCE(vp.correct_count, 0) as correct_count
  FROM 
    public.vocabulary_items v
  LEFT JOIN 
    public.vocabulary_progress vp ON v.id = vp.vocabulary_id AND vp.student_id = p_student_id
  WHERE 
    v.question_id = p_question_id
  AND (
    CASE 
      WHEN p_practice_type = 'flashcard' THEN
        (vp.id IS NULL OR vp.flashcard_completed = FALSE)
      WHEN p_practice_type = 'practice' THEN
        (vp.id IS NULL OR vp.listening_practice_completed = FALSE)
      WHEN p_practice_type = 'post_practice' THEN
        (vp.id IS NULL OR (vp.post_practice_completed = FALSE AND vp.correct_count < vp.attempts))
      ELSE FALSE
    END
  )
  ORDER BY 
    COALESCE(vp.attempts, 0) ASC, 
    v.created_at ASC;
END;
$$;

-- 6. Tạo hoặc cập nhật function check_vocabulary_completion
CREATE OR REPLACE FUNCTION public.check_vocabulary_completion(
  p_student_id UUID,
  p_question_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_vocab INT;
  completed_flashcard INT;
  completed_practice INT;
  completed_post_practice INT;
  result JSONB;
BEGIN
  -- Đếm tổng số từ vựng của bài
  SELECT COUNT(*) INTO total_vocab
  FROM public.vocabulary_items
  WHERE question_id = p_question_id;
  
  -- Không có từ vựng nào, trả về hoàn thành
  IF total_vocab = 0 THEN
    RETURN jsonb_build_object(
      'is_completed', TRUE,
      'flashcard_completed', TRUE,
      'practice_completed', TRUE,
      'post_practice_completed', TRUE,
      'progress', 100,
      'total_vocabulary', 0,
      'completed_vocabulary', 0
    );
  END IF;
  
  -- Đếm số từ vựng đã học qua flashcard
  SELECT COUNT(*) INTO completed_flashcard
  FROM public.vocabulary_progress
  WHERE student_id = p_student_id
    AND question_id = p_question_id
    AND flashcard_completed = TRUE;
  
  -- Đếm số từ vựng đã luyện tập nghe
  SELECT COUNT(*) INTO completed_practice
  FROM public.vocabulary_progress
  WHERE student_id = p_student_id
    AND question_id = p_question_id
    AND listening_practice_completed = TRUE;
  
  -- Đếm số từ vựng đã ôn tập sau bài
  SELECT COUNT(*) INTO completed_post_practice
  FROM public.vocabulary_progress
  WHERE student_id = p_student_id
    AND question_id = p_question_id
    AND post_practice_completed = TRUE;
  
  -- Tính toán tỷ lệ phần trăm
  result := jsonb_build_object(
    'is_completed', (completed_practice = total_vocab),
    'flashcard_completed', (completed_flashcard = total_vocab),
    'practice_completed', (completed_practice = total_vocab),
    'post_practice_completed', (completed_post_practice = total_vocab),
    'progress', CASE 
      WHEN total_vocab = 0 THEN 100
      ELSE ROUND((completed_practice::NUMERIC / total_vocab::NUMERIC) * 100)
    END,
    'total_vocabulary', total_vocab,
    'completed_vocabulary', completed_practice
  );
  
  RETURN result;
END;
$$;

-- 7. Di chuyển dữ liệu từ bảng vocabulary cũ nếu cần
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vocabulary' AND table_schema = 'public') THEN
    INSERT INTO vocabulary_items (question_id, word, part_of_speech, meaning_vi, audio_start_time, audio_end_time, image_url, created_at, updated_at)
    SELECT 
      question_id, 
      word, 
      COALESCE(part_of_speech, 'noun') as part_of_speech, 
      meaning_vi, 
      COALESCE(audio_start_time, 0) as audio_start_time, 
      COALESCE(audio_end_time, 0) as audio_end_time, 
      image_url, 
      COALESCE(created_at, NOW()) as created_at, 
      COALESCE(updated_at, NOW()) as updated_at
    FROM vocabulary
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Đã di chuyển dữ liệu từ bảng vocabulary sang vocabulary_items';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Lỗi khi di chuyển dữ liệu: %', SQLERRM;
END $$;

-- 8. Tạo function utility để setup toàn bộ hệ thống vocabulary
CREATE OR REPLACE FUNCTION public.setup_vocabulary_system()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tables_created BOOLEAN := FALSE;
  policies_updated BOOLEAN := FALSE;
  functions_created BOOLEAN := FALSE;
  data_migrated BOOLEAN := FALSE;
BEGIN
  -- Gọi các block code bên trên từ đây nếu cần
  
  RETURN 'Thiết lập hệ thống vocabulary hoàn tất: ' || 
         'Bảng: ' || CASE WHEN tables_created THEN 'Đã tạo' ELSE 'Đã tồn tại' END || ', ' ||
         'Policies: ' || CASE WHEN policies_updated THEN 'Đã cập nhật' ELSE 'Không thay đổi' END || ', ' ||
         'Functions: ' || CASE WHEN functions_created THEN 'Đã tạo' ELSE 'Đã cập nhật' END || ', ' ||
         'Dữ liệu: ' || CASE WHEN data_migrated THEN 'Đã di chuyển' ELSE 'Không có thay đổi' END;
EXCEPTION
  WHEN others THEN
    RETURN 'Lỗi khi thiết lập hệ thống vocabulary: ' || SQLERRM;
END;
$$;

-- 9. Tạo function translate_with_huggingface
CREATE OR REPLACE FUNCTION public.translate_with_huggingface(
  text_to_translate TEXT,
  source_lang TEXT DEFAULT 'eng_Latn',
  target_lang TEXT DEFAULT 'vie_Latn'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_url TEXT := 'https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M';
  api_key TEXT := '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'; -- Thay bằng API key của bạn
  payload JSONB;
  response JSONB;
  translated_text TEXT;
BEGIN
  -- Tạo payload cho API request
  payload := jsonb_build_object(
    'inputs', text_to_translate,
    'parameters', jsonb_build_object(
      'source_lang', source_lang,
      'target_lang', target_lang
    )
  );

  -- Gọi API
  SELECT
    content::jsonb
  INTO
    response
  FROM
    http.post(
      url := api_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json'
      ),
      body := payload::text
    );

  -- Xử lý kết quả
  IF response IS NULL OR response->>'translation_text' IS NULL THEN
    RETURN 'Nghĩa tiếng Việt của "' || text_to_translate || '"';
  END IF;

  translated_text := response->>'translation_text';
  RETURN translated_text;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error translating text: %', SQLERRM;
    RETURN 'Nghĩa tiếng Việt của "' || text_to_translate || '"';
END;
$$;

-- Add http extension if not present
CREATE EXTENSION IF NOT EXISTS http;

COMMIT; 