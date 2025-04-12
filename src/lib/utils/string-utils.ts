/**
 * Utility functions for string manipulation and comparison
 */

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 * Used for detecting spelling errors
 * @param a First string to compare
 * @param b Second string to compare
 * @returns The edit distance between the two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,   // insertion
            matrix[i - 1][j] + 1    // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate word overlap/similarity between two strings
 * Used for detecting grammar errors
 * @param a First string to compare
 * @param b Second string to compare
 * @returns A similarity score between 0 and 1
 */
export function wordOverlap(a: string, b: string): number {
  const aWords = a.split(/\s+/).filter(Boolean);
  const bWords = b.split(/\s+/).filter(Boolean);
  
  if (aWords.length === 0 || bWords.length === 0) return 0;
  
  const commonWords = aWords.filter(word => bWords.includes(word)).length;
  return commonWords / Math.max(aWords.length, bWords.length);
}
