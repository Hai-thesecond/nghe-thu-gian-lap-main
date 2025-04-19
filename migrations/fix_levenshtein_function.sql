-- Make sure required extensions are installed
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- No need to drop the built-in levenshtein function
-- We'll just use the existing one or our custom implementation

-- Create our custom levenshtein function with a different name
CREATE OR REPLACE FUNCTION custom_levenshtein(a text, b text) 
RETURNS integer AS $$
DECLARE
  matrix integer[][];
  i integer;
  j integer;
BEGIN
  -- Handle empty strings
  IF a IS NULL OR b IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF length(a) = 0 THEN
    RETURN length(b);
  END IF;
  
  IF length(b) = 0 THEN
    RETURN length(a);
  END IF;
  
  -- Initialize matrix
  matrix := array_fill(0, ARRAY[length(b) + 1, length(a) + 1]);
  
  -- Fill first row and column
  FOR i IN 0..length(b) LOOP
    matrix[i+1][1] := i;
  END LOOP;
  
  FOR j IN 0..length(a) LOOP
    matrix[1][j+1] := j;
  END LOOP;
  
  -- Fill the rest of the matrix
  FOR i IN 1..length(b) LOOP
    FOR j IN 1..length(a) LOOP
      IF substring(b FROM i FOR 1) = substring(a FROM j FOR 1) THEN
        matrix[i+1][j+1] := matrix[i][j];
      ELSE
        matrix[i+1][j+1] := LEAST(
          matrix[i][j] + 1,    -- substitution
          matrix[i+1][j] + 1,  -- insertion
          matrix[i][j+1] + 1   -- deletion
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN matrix[length(b)+1][length(a)+1];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test the function
SELECT custom_levenshtein('hello', 'hallo') as test_result; -- Should return 1
SELECT custom_levenshtein('hello', 'world') as test_result; -- Should return 4 