-- Thêm trường antonyms vào bảng vocabulary_items
ALTER TABLE public.vocabulary_items 
ADD COLUMN IF NOT EXISTS antonyms TEXT;

-- Cập nhật quyền truy cập cho role authenticated
GRANT ALL ON public.vocabulary_items TO authenticated;
GRANT ALL ON public.vocabulary_items TO service_role; 