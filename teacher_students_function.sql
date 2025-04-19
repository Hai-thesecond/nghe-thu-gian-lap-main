-- Tạo hàm để lấy thông tin học sinh và điểm trung bình của họ
CREATE OR REPLACE FUNCTION get_teacher_students(p_class_ids uuid[], p_teacher_id uuid)
RETURNS TABLE (
  student_id uuid,
  email text, 
  full_name text,
  class_id uuid,
  class_name text,
  class_code text,
  avg_score numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH student_classes AS (
    -- Lấy thông tin học sinh trong lớp
    SELECT 
      sc.student_id,
      sc.class_id,
      c.name as class_name,
      c.class_code
    FROM 
      student_classes sc
    JOIN 
      classes c ON sc.class_id = c.id
    WHERE 
      sc.class_id = ANY(p_class_ids)
      AND sc.is_active = true
      AND c.teacher_id = p_teacher_id
  ),
  student_scores AS (
    -- Lấy điểm trung bình của mỗi học sinh từ các bài làm gần nhất (tối đa 5 bài)
    SELECT 
      sa.student_id,
      AVG(sa.score) as avg_score
    FROM (
      SELECT 
        student_id, 
        score, 
        created_at,
        ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at DESC) as rn
      FROM 
        student_answers
      WHERE 
        student_id IN (SELECT student_id FROM student_classes)
    ) sa
    WHERE sa.rn <= 5
    GROUP BY sa.student_id
  )
  -- Kết hợp thông tin học sinh, lớp học và điểm
  SELECT 
    p.id as student_id,
    p.email,
    p.full_name,
    sc.class_id,
    sc.class_name,
    sc.class_code,
    COALESCE(ss.avg_score, 0) as avg_score
  FROM 
    profiles p
  JOIN 
    student_classes sc ON p.id = sc.student_id
  LEFT JOIN 
    student_scores ss ON p.id = ss.student_id
  WHERE 
    p.role = 'student';
END;
$$ LANGUAGE plpgsql;

-- Gán quyền cho authenticated users để gọi hàm này
GRANT EXECUTE ON FUNCTION get_teacher_students TO authenticated; 