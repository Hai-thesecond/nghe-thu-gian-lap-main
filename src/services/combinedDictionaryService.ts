// Combined Dictionary Service
// Thứ tự ưu tiên:
// 1. XF Dictionary API (nguồn chính cho định nghĩa và ví dụ)
// 2. Datamuse API (chỉ để lấy từ đồng nghĩa và trái nghĩa)

import { fetchXFDictionaryData, getAllDefinitionsWithExamples, getFirstAudioUrl } from './xfDictionaryService';
// import { fetchSynonyms } from './datamuseService';

// Tạm thời tự xử lý fetchSynonyms và fetchAntonyms để tránh lỗi
const fetchSynonyms = async (word: string, maxResults: number = 5): Promise<string[]> => {
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=${maxResults}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch synonyms: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    console.error('Error fetching synonyms:', error);
    return [];
  }
}

const fetchAntonyms = async (word: string, maxResults: number = 5): Promise<string[]> => {
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=${maxResults}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch antonyms: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((item: any) => item.word);
  } catch (error) {
    console.error('Error fetching antonyms:', error);
    return [];
  }
}

// Types cho Free Dictionary API
export interface Phonetic {
  text: string;
  audio?: string;
}

export interface Definition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface DictionaryEntry {
  word: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
}

// Types cho Datamuse
interface DatamuseWord {
  word: string;
  score: number;
  tags?: string[];
}

// Kết quả cuối cùng
export interface EnhancedVocabularyData {
  word: string;
  definitions: string[];
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  audioUrl?: string;
  partOfSpeech?: string;
  frequency?: string;
}

/**
 * Trích xuất audio URL từ dữ liệu phát âm
 */
function extractAudioUrl(phonetics: Phonetic[]): string | undefined {
  if (!phonetics || phonetics.length === 0) return undefined;
  
  // Tìm audio URL đầu tiên có phát âm
  for (const phonetic of phonetics) {
    if (phonetic.audio && phonetic.audio.trim() !== '') {
      return phonetic.audio;
    }
  }
  
  return undefined;
}

/**
 * Hàm chính để lấy dữ liệu từ vựng từ nhiều nguồn
 */
export async function fetchEnhancedDictionaryData(word: string): Promise<EnhancedVocabularyData> {
  try {
    // Initialize result object
    const result: EnhancedVocabularyData = {
      word,
      definitions: [],
      examples: [],
      synonyms: [],
      antonyms: [],
      partOfSpeech: '',
      frequency: ''
    };

    // Try XF Dictionary API first for definitions, examples, etc.
    try {
      console.log(`Fetching XF Dictionary data for word: ${word}`);
      const xfData = await fetchXFDictionaryData(word);
      
      // Get all definitions with examples
      const definitionsWithExamples = getAllDefinitionsWithExamples(xfData);
      
      // Extract unique definitions and examples
      result.definitions = [...new Set(definitionsWithExamples.map(d => d.definition))];
      
      // Get only the first example
      const examples = [...new Set(definitionsWithExamples.flatMap(d => d.examples))];
      result.examples = examples.length > 0 ? [examples[0].trim()] : [];
      
      // Get audio URL if available
      const audioUrl = getFirstAudioUrl(xfData);
      if (audioUrl) {
        result.audioUrl = audioUrl;
      }
      
      // Get part of speech from first item
      if (xfData.items && xfData.items.length > 0) {
        result.partOfSpeech = xfData.items[0].partOfSpeech;
      }
      
      // Get frequency band if available
      if (xfData.wordFrequencies && 
          xfData.wordFrequencies.length > 0 && 
          xfData.wordFrequencies[0].frequencies && 
          xfData.wordFrequencies[0].frequencies.length > 0) {
        result.frequency = xfData.wordFrequencies[0].frequencies[0].frequencyBand;
      }
      
      console.log('Successfully fetched XF Dictionary data');
    } catch (error) {
      console.error('Error fetching XF Dictionary data:', error);
      // Fall back to empty values if XF Dictionary fails
      result.definitions = [`No definition found for "${word}".`];
      result.examples = [`Example with "${word}" not available.`];
    }
    
    // Always fetch synonyms and antonyms from Datamuse (secondary source)
    try {
      console.log('Fetching synonyms from Datamuse');
      const synonyms = await fetchSynonyms(word);
      if (synonyms && synonyms.length > 0) {
        result.synonyms = synonyms;
      } else {
        result.synonyms = ['(no synonyms available)'];
      }
    } catch (error) {
      console.error('Error fetching synonyms:', error);
      result.synonyms = ['(no synonyms available)'];
    }
    
    try {
      console.log('Fetching antonyms from Datamuse');
      const antonyms = await fetchAntonyms(word);
      if (antonyms && antonyms.length > 0) {
        result.antonyms = antonyms;
      } else {
        result.antonyms = ['(no antonyms available)'];
      }
    } catch (error) {
      console.error('Error fetching antonyms:', error);
      result.antonyms = ['(no antonyms available)'];
    }
    
    return result;
  } catch (error) {
    console.error('Error in fetchEnhancedDictionaryData:', error);
    
    // Return minimal result to avoid crashing the application
    return {
      word,
      definitions: [`Failed to fetch definition for "${word}".`],
      examples: [`Example with "${word}" not available.`],
      synonyms: ['(no synonyms available)'],
      antonyms: ['(no antonyms available)'],
      partOfSpeech: '',
      frequency: ''
    };
  }
}

/**
 * Kiểm tra xem một từ có phải tiếng Anh không
 */
export function isEnglishWord(word: string): boolean {
  // Biểu thức chính quy kiểm tra chỉ chứa ký tự a-z hoặc A-Z (có thể có dấu gạch ngang)
  return /^[a-zA-Z\-]+$/.test(word);
}

/**
 * Hàm chính được gọi từ component để lấy dữ liệu từ vựng
 */
export async function getWordData(word: string, vietnamese_meaning?: string): Promise<EnhancedVocabularyData> {
  // Nếu từ tiếng Anh, lấy dữ liệu từ API
  if (isEnglishWord(word)) {
    return await fetchEnhancedDictionaryData(word);
  }
  
  // Nếu không phải từ tiếng Anh, trả về dữ liệu cơ bản
  return {
    word,
    definitions: vietnamese_meaning ? [vietnamese_meaning] : [],
    examples: [],
    synonyms: [],
    antonyms: [],
    partOfSpeech: ''
  };
} 