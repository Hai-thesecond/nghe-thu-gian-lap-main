-- 1. Kiểm tra function calculate_student_score
SELECT public.calculate_student_score(
  ARRAY['apple', 'orange', 'banana', ''],
  ARRAY['apple', 'orange', 'grape', 'pear']
);

-- 2. Kiểm tra function calculate_adjusted_score
SELECT public.calculate_adjusted_score(75, 'good');
SELECT public.calculate_adjusted_score(75, 'average');
SELECT public.calculate_adjusted_score(75, 'poor');

-- 3. Kiểm tra function get_blank_percentage
SELECT public.get_blank_percentage('good');
SELECT public.get_blank_percentage('average');
SELECT public.get_blank_percentage('poor');

-- 4. Kiểm tra function analyze_and_score_student_answer
-- Chú ý: Cần thay thế các giá trị UUID với ID thực của người dùng và câu hỏi
/* 
SELECT public.analyze_and_score_student_answer(
  '12345678-1234-1234-1234-123456789012'::UUID, -- student_id
  '87654321-4321-4321-4321-210987654321'::UUID, -- question_id
  ARRAY['apple', 'orange', 'banana', ''],
  ARRAY['apple', 'orange', 'grape', 'pear'],
  'average'
);
*/ 