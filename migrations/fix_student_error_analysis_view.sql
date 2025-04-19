-- Sửa lỗi PostgreSQL 42P16: cannot change name of view column
-- 1. Xóa view hiện tại
DROP VIEW IF EXISTS public.student_error_analysis_view;

-- 2. Tạo lại view với định nghĩa đúng
CREATE VIEW public.student_error_analysis_view AS
WITH error_counts_summary AS (
  SELECT 
    ea.student_id,
    SUM((ea.error_types->>'spelling')::int) AS spelling_count,
    SUM((ea.error_types->>'grammar')::int) AS grammar_count,
    SUM((ea.error_types->>'missing')::int) AS missing_count,
    SUM((ea.error_types->>'meaning')::int) AS meaning_count,
    SUM((ea.error_types->>'blank')::int) AS blank_count,
    SUM((ea.error_types->>'tense')::int) AS tense_count,
    COUNT(DISTINCT ea.question_id) as questions_count
  FROM 
    error_analysis ea
  GROUP BY 
    ea.student_id
)
SELECT 
  p.id AS student_id,
  p.full_name,
  COALESCE(ecs.questions_count, 0) as questions_count,
  jsonb_build_object(
    'spelling', COALESCE(ecs.spelling_count, 0),
    'grammar', COALESCE(ecs.grammar_count, 0),
    'missing', COALESCE(ecs.missing_count, 0),
    'meaning', COALESCE(ecs.meaning_count, 0),
    'blank', COALESCE(ecs.blank_count, 0),
    'tense', COALESCE(ecs.tense_count, 0)
  ) AS error_type_counts,
  (
    SELECT 
      jsonb_agg(jsonb_build_object(
        'question_id', ea.question_id,
        'error_counts', ea.error_types,
        'error_details', ea.error_details
      ))
    FROM 
      error_analysis ea
    WHERE 
      ea.student_id = p.id
    LIMIT 10
  ) AS question_errors,
  now() AS updated_at
FROM 
  profiles p
LEFT JOIN 
  error_counts_summary ecs ON p.id = ecs.student_id
WHERE 
  p.role = 'student';

-- 3. Cấp quyền cho view sau khi tạo lại
GRANT SELECT ON public.student_error_analysis_view TO authenticated; 