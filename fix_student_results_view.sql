-- Xóa view cũ nếu tồn tại
DROP VIEW IF EXISTS public.student_results_view;

-- Tạo lại view với tên cột chính xác
CREATE VIEW public.student_results_view AS
SELECT 
  sa.id,  
  sa.student_id,
  sa.question_id,
  sa.score,
  sa.adjusted_score,
  sa.correct_count,
  sa.incorrect_count,
  sa.is_completed,
  sa.completed_at,
  sa.created_at,
  sa.updated_at,
  sa.metadata,
  sa.attempt_count,
  sa.attempt_timestamp,
  q.title AS question_title,
  q.script AS question_script,
  q.audio_url,
  p.full_name AS student_name,
  p.avatar_url AS student_avatar
FROM 
  public.student_answers sa
JOIN 
  public.questions q ON sa.question_id = q.id
JOIN 
  public.profiles p ON sa.student_id = p.id; 