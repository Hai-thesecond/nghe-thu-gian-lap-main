interface TextualPronunciation {
  pronunciation: string;
}

interface AudioFile {
  link: string;
  label: string;
}

interface PronunciationEntry {
  entry: string;
  textual: TextualPronunciation[];
  audioFiles?: AudioFile[];
}

interface PronunciationSection {
  sectionID: string;
  entries: PronunciationEntry[];
}

interface Example {
  example: string;
}

interface Definition {
  definition: string;
  examples?: string[];
}

interface InflectionalForm {
  type: string;
  comment?: string;
  forms: string[];
}

interface WordItem {
  word: string;
  partOfSpeech: string;
  definitions: Definition[];
  inflectionalForms?: InflectionalForm[];
  pronunciationSectionID: string;
}

interface FrequencyInfo {
  partOfSpeech: string;
  frequencyBand: string;
}

interface WordFrequency {
  word: string;
  frequencies: FrequencyInfo[];
}

export interface XFDictionaryResponse {
  target: string;
  sentence: string;
  items: WordItem[];
  pronunciations: PronunciationSection[];
  wordFrequencies: WordFrequency[];
}

/**
 * Removes HTML tags from text and handles special cases properly
 */
function sanitizeHtmlContent(text: string): string {
  if (!text) return '';
  
  // Replace common HTML entities
  let sanitized = text
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  // Replace italic tags with emphasis
  sanitized = sanitized.replace(/<i>(.*?)<\/i>/g, '$1');
  
  // Replace bold tags with emphasis
  sanitized = sanitized.replace(/<b>(.*?)<\/b>/g, '$1');
  
  // Remove any remaining HTML tags but keep their content
  sanitized = sanitized.replace(/<\/?[^>]+(>|$)/g, '');
  
  // Clean up extra spaces
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  return sanitized.trim();
}

/**
 * Sanitizes an array of texts with HTML content
 */
function sanitizeArrayContent(items: string[] | undefined): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map(sanitizeHtmlContent).filter(Boolean);
}

/**
 * Fetches data from XF Dictionary API through RapidAPI
 * @param word The word to look up
 * @returns Promise with dictionary data
 */
export async function fetchXFDictionaryData(word: string): Promise<XFDictionaryResponse> {
  try {
    // Prepare request data
    const requestData = {
      selection: word,
      textAfterSelection: '',
      textBeforeSelection: ''
    };

    // Make fetch request to RapidAPI
    const response = await fetch('https://xf-english-dictionary1.p.rapidapi.com/v1/dictionary', {
      method: 'POST',
      headers: {
        'x-rapidapi-key': '3069f1f8e9mshbe08e6281e89ce8p1278f3jsncf63290a068a',
        'x-rapidapi-host': 'xf-english-dictionary1.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching XF Dictionary data:', error);
    throw error;
  }
}

// Helper function to get the first audio URL if available
export function getFirstAudioUrl(data: XFDictionaryResponse): string | null {
  for (const pronunciation of data.pronunciations) {
    for (const entry of pronunciation.entries) {
      if (entry.audioFiles && entry.audioFiles.length > 0) {
        return entry.audioFiles[0].link;
      }
    }
  }
  return null;
}

// Helper function to get all definitions with examples
export function getAllDefinitionsWithExamples(data: XFDictionaryResponse): Array<{
  partOfSpeech: string;
  definition: string;
  examples: string[];
}> {
  const result = [];
  
  for (const item of data.items) {
    for (const def of item.definitions) {
      result.push({
        partOfSpeech: item.partOfSpeech,
        definition: sanitizeHtmlContent(def.definition),
        examples: sanitizeArrayContent(def.examples)
      });
    }
  }
  
  return result;
}

// Helper function to get word frequency information
export function getWordFrequency(data: XFDictionaryResponse): string {
  if (data.wordFrequencies && data.wordFrequencies.length > 0) {
    const firstFreq = data.wordFrequencies[0].frequencies[0];
    return firstFreq ? firstFreq.frequencyBand : 'Unknown';
  }
  return 'Unknown';
} 