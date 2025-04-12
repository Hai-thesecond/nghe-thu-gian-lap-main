-- RPC function để lấy từ vựng của một bài học
CREATE OR REPLACE FUNCTION public.get_vocabulary_for_question(
  p_question_id UUID
)
RETURNS SETOF public.vocabulary_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.vocabulary_items
  WHERE question_id = p_question_id
  ORDER BY created_at ASC;
END;
$$;

-- RPC function để lấy từ vựng cần luyện tập
CREATE OR REPLACE FUNCTION public.get_vocabulary_for_practice(
  p_student_id UUID,
  p_question_id UUID,
  p_practice_type TEXT  -- 'flashcard', 'practice', 'post_practice'
)
RETURNS SETOF public.vocabulary_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  completed_column TEXT;
BEGIN
  -- Xác định cột trạng thái hoàn thành dựa trên loại luyện tập
  IF p_practice_type = 'flashcard' THEN
    completed_column := 'flashcard_completed';
  ELSIF p_practice_type = 'practice' THEN
    completed_column := 'listening_practice_completed';
  ELSIF p_practice_type = 'post_practice' THEN
    completed_column := 'post_practice_completed';
  ELSE
    RAISE EXCEPTION 'Invalid practice type: %', p_practice_type;
  END IF;

  -- Chạy truy vấn động để lấy từ vựng chưa hoàn thành
  RETURN QUERY EXECUTE format('
    SELECT v.* FROM public.vocabulary_items v
    LEFT JOIN public.vocabulary_progress p ON 
      v.id = p.vocabulary_id AND 
      p.student_id = %L
    WHERE v.question_id = %L
    AND (p.id IS NULL OR p.%I IS NOT TRUE)
    ORDER BY v.created_at ASC
  ', p_student_id, p_question_id, completed_column);
END;
$$;

-- RPC function để cập nhật tiến độ luyện tập từ vựng
CREATE OR REPLACE FUNCTION public.update_vocabulary_progress(
  p_student_id UUID,
  p_vocabulary_id UUID,
  p_practice_type TEXT,
  p_is_correct BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  progress_exists BOOLEAN;
  question_id_val UUID;
  completed_column TEXT;
BEGIN
  -- Lấy question_id từ vocabulary_item
  SELECT question_id INTO question_id_val
  FROM public.vocabulary_items
  WHERE id = p_vocabulary_id;
  
  IF question_id_val IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Xác định cột trạng thái hoàn thành
  IF p_practice_type = 'flashcard' THEN
    completed_column := 'flashcard_completed';
  ELSIF p_practice_type = 'practice' THEN
    completed_column := 'listening_practice_completed';
  ELSIF p_practice_type = 'post_practice' THEN
    completed_column := 'post_practice_completed';
  ELSE
    RAISE EXCEPTION 'Invalid practice type: %', p_practice_type;
  END IF;
  
  -- Kiểm tra xem đã có bản ghi tiến độ chưa
  SELECT EXISTS(
    SELECT 1 FROM public.vocabulary_progress
    WHERE student_id = p_student_id AND vocabulary_id = p_vocabulary_id
  ) INTO progress_exists;
  
  IF progress_exists THEN
    -- Cập nhật bản ghi đã tồn tại
    EXECUTE format('
      UPDATE public.vocabulary_progress
      SET 
        %I = TRUE,
        attempts = CASE WHEN $1 IS NOT NULL THEN attempts + 1 ELSE attempts END,
        correct_count = CASE WHEN $1 IS TRUE THEN correct_count + 1 ELSE correct_count END,
        last_practiced = NOW(),
        updated_at = NOW()
      WHERE student_id = $2 AND vocabulary_id = $3
    ', completed_column)
    USING p_is_correct, p_student_id, p_vocabulary_id;
  ELSE
    -- Tạo bản ghi mới
    EXECUTE format('
      INSERT INTO public.vocabulary_progress (
        student_id, vocabulary_id, question_id, %I,
        attempts, correct_count, last_practiced
      )
      VALUES (
        $1, $2, $3, TRUE,
        CASE WHEN $4 IS NOT NULL THEN 1 ELSE 0 END,
        CASE WHEN $4 IS TRUE THEN 1 ELSE 0 END,
        NOW()
      )
    ', completed_column)
    USING p_student_id, p_vocabulary_id, question_id_val, p_is_correct;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Thêm function để phân tích từ vựng từ script
CREATE OR REPLACE FUNCTION public.extract_vocabulary_from_script(
  p_script TEXT,
  p_word_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  word TEXT,
  frequency INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH words AS (
    -- Tách từ và loại bỏ dấu câu
    SELECT regexp_split_to_table(
      lower(regexp_replace(p_script, '[.,;!?:()[\]{}"""'']+', ' ', 'g')),
      '\s+'
    ) AS word
  ),
  filtered_words AS (
    -- Lọc từ có độ dài > 4 và chỉ chứa chữ cái
    SELECT word FROM words
    WHERE length(word) > 4
    AND word ~ '^[a-z]+$'
  ),
  word_counts AS (
    -- Đếm tần suất xuất hiện
    SELECT word, count(*) AS frequency
    FROM filtered_words
    GROUP BY word
    ORDER BY frequency DESC, word
  )
  -- Lấy số lượng từ cần thiết
  SELECT word, frequency FROM word_counts
  ORDER BY frequency DESC, word
  LIMIT p_word_count;
END;
$$; 