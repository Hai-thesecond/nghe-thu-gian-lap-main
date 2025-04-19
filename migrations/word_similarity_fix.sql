-- Make sure required extensions are installed
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Create a unique function with a very specific name to avoid conflicts
DROP FUNCTION IF EXISTS dictation_word_similarity(text, text);
CREATE OR REPLACE FUNCTION dictation_word_similarity(word1 text, word2 text) 
RETURNS integer AS $$
DECLARE
  dist_matrix integer[][];
  i integer;
  j integer;
  len1 integer;
  len2 integer;
BEGIN
  -- Handle empty strings
  IF word1 IS NULL OR word2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  len1 := length(word1);
  len2 := length(word2);
  
  IF len1 = 0 THEN
    RETURN len2;
  END IF;
  
  IF len2 = 0 THEN
    RETURN len1;
  END IF;
  
  -- Initialize matrix
  dist_matrix := array_fill(0, ARRAY[len2 + 1, len1 + 1]);
  
  -- Fill first row and column
  FOR i IN 0..len2 LOOP
    dist_matrix[i+1][1] := i;
  END LOOP;
  
  FOR j IN 0..len1 LOOP
    dist_matrix[1][j+1] := j;
  END LOOP;
  
  -- Fill the rest of the matrix
  FOR i IN 1..len2 LOOP
    FOR j IN 1..len1 LOOP
      IF substring(word2 FROM i FOR 1) = substring(word1 FROM j FOR 1) THEN
        dist_matrix[i+1][j+1] := dist_matrix[i][j];
      ELSE
        dist_matrix[i+1][j+1] := LEAST(
          dist_matrix[i][j] + 1,     -- substitution
          dist_matrix[i+1][j] + 1,   -- insertion
          dist_matrix[i][j+1] + 1    -- deletion
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN dist_matrix[len2+1][len1+1];
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Test the function
SELECT dictation_word_similarity('hello', 'hallo') as test_result; -- Should return 1
SELECT dictation_word_similarity('hello', 'world') as test_result; -- Should return 4 