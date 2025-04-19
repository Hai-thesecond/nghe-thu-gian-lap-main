-- Step 1: Clean up existing functions first
DROP FUNCTION IF EXISTS levenshtein(text, text);
DROP FUNCTION IF EXISTS levenshteinDistance(text, text);

-- Step 2: Create new function with a completely different name
CREATE OR REPLACE FUNCTION dictation_text_similarity(str1 text, str2 text) 
RETURNS integer AS $$
DECLARE
  matrix integer[][];
  len1 integer := length(str1);
  len2 integer := length(str2);
  i integer;
  j integer;
BEGIN
  -- Handle empty strings
  IF str1 IS NULL OR str2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF len1 = 0 THEN
    RETURN len2;
  END IF;
  
  IF len2 = 0 THEN
    RETURN len1;
  END IF;
  
  -- Initialize matrix
  matrix := array_fill(0, ARRAY[len2 + 1, len1 + 1]);
  
  -- Fill first row and column
  FOR i IN 0..len2 LOOP
    matrix[i+1][1] := i;
  END LOOP;
  
  FOR j IN 0..len1 LOOP
    matrix[1][j+1] := j;
  END LOOP;
  
  -- Fill the rest of the matrix
  FOR i IN 1..len2 LOOP
    FOR j IN 1..len1 LOOP
      IF substring(str2 FROM i FOR 1) = substring(str1 FROM j FOR 1) THEN
        matrix[i+1][j+1] := matrix[i][j];
      ELSE
        matrix[i+1][j+1] := LEAST(
          matrix[i][j] + 1,     -- substitution
          matrix[i+1][j] + 1,   -- insertion
          matrix[i][j+1] + 1    -- deletion
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN matrix[len2+1][len1+1];
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Test the function
SELECT dictation_text_similarity('hello', 'hallo') as test_result_1; -- Should return 1
SELECT dictation_text_similarity('hello', 'world') as test_result_2; -- Should return 4 