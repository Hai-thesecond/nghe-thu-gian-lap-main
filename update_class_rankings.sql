-- Function to update class rankings
CREATE OR REPLACE FUNCTION update_class_rankings()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh/recalculate rankings for the affected question and class
  WITH ranked_scores AS (
    SELECT
      sa.student_id,
      sa.question_id,
      sc.class_id,
      sa.score,
      sa.adjusted_score,
      ROW_NUMBER() OVER (
        PARTITION BY sc.class_id, sa.question_id 
        ORDER BY sa.adjusted_score DESC, sa.score DESC, sa.completed_at ASC
      ) AS calculated_rank
    FROM
      student_answers sa
    JOIN
      student_classes sc ON sa.student_id = sc.student_id
    WHERE
      sa.is_completed = true
      AND sa.score IS NOT NULL
      AND sa.adjusted_score IS NOT NULL
      AND sa.question_id = COALESCE(NEW.question_id, OLD.question_id)
      AND sc.class_id = (
        SELECT class_id FROM student_classes 
        WHERE student_id = COALESCE(NEW.student_id, OLD.student_id) 
        LIMIT 1
      )
  )
  
  -- Delete existing rankings
  DELETE FROM class_rankings 
  WHERE 
    question_id = COALESCE(NEW.question_id, OLD.question_id)
    AND class_id = (
      SELECT class_id FROM student_classes 
      WHERE student_id = COALESCE(NEW.student_id, OLD.student_id) 
      LIMIT 1
    );
  
  -- Insert new rankings
  INSERT INTO class_rankings (
    student_id, 
    question_id, 
    class_id, 
    score, 
    adjusted_score, 
    rank, 
    created_at, 
    updated_at
  )
  SELECT
    student_id,
    question_id,
    class_id,
    score,
    adjusted_score,
    calculated_rank,
    NOW(),
    NOW()
  FROM ranked_scores;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_class_rankings ON student_answers;

-- Create trigger to automatically update rankings when student_answers is modified
CREATE TRIGGER trigger_update_class_rankings
AFTER INSERT OR UPDATE OF score, adjusted_score
ON student_answers
FOR EACH ROW
WHEN (NEW.is_completed = true AND NEW.score IS NOT NULL)
EXECUTE FUNCTION update_class_rankings();

-- Function to manually update all rankings for all classes and questions
CREATE OR REPLACE FUNCTION refresh_all_class_rankings()
RETURNS void AS $$
BEGIN
  -- Clear existing rankings
  DELETE FROM class_rankings;
  
  -- Recalculate all rankings
  -- Sử dụng CTE để chọn điểm cao nhất cho mỗi (student_id, question_id, class_id)
  WITH best_student_answers AS (
    SELECT DISTINCT ON (sa.student_id, sa.question_id, sc.class_id)
      sa.student_id,
      sa.question_id,
      sc.class_id,
      sa.score,
      sa.adjusted_score,
      sa.completed_at
    FROM
      student_answers sa
    JOIN
      student_classes sc ON sa.student_id = sc.student_id
    WHERE
      sa.is_completed = true
      AND sa.score IS NOT NULL
      AND sa.adjusted_score IS NOT NULL
    ORDER BY
      sa.student_id, sa.question_id, sc.class_id, 
      sa.adjusted_score DESC, sa.score DESC, sa.completed_at ASC
  ),
  ranked_scores AS (
    SELECT
      bsa.student_id,
      bsa.question_id,
      bsa.class_id,
      bsa.score,
      bsa.adjusted_score,
      ROW_NUMBER() OVER (
        PARTITION BY bsa.class_id, bsa.question_id 
        ORDER BY bsa.adjusted_score DESC, bsa.score DESC, bsa.completed_at ASC
      ) AS calculated_rank
    FROM
      best_student_answers bsa
  )
  
  INSERT INTO class_rankings (
    student_id, 
    question_id, 
    class_id, 
    score, 
    adjusted_score, 
    rank, 
    created_at, 
    updated_at
  )
  SELECT
    student_id,
    question_id,
    class_id,
    score,
    adjusted_score,
    calculated_rank,
    NOW(),
    NOW()
  FROM ranked_scores;
END;
$$ LANGUAGE plpgsql;

-- Run the function to refresh all rankings immediately
SELECT refresh_all_class_rankings(); 