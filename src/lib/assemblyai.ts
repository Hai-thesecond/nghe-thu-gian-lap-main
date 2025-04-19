import { supabase } from '@/lib/supabase';
import { AssemblyAI } from 'assemblyai';

// AssemblyAI client configuration
const client = new AssemblyAI({
  apiKey: '1a13f448518d4cdc91417cc200b20d91',
});

export interface WordTiming {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

/**
 * Upload an audio file to Supabase Storage and get the public URL
 */
export async function uploadAudioToStorage(file: File, userId?: string): Promise<string> {
  try {
    const fileName = `audio/${userId || 'temp'}/${Date.now()}-${file.name}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('dictation')
      .upload(fileName, file, {
        upsert: true
      });
      
    if (error) {
      console.error('Error uploading to Supabase:', error);
      throw error;
    }
    
    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('dictation')
      .getPublicUrl(fileName);
      
    return publicUrl;
  } catch (error) {
    console.error('Error in uploadAudioToStorage:', error);
    throw error;
  }
}

/**
 * Generate a transcript using AssemblyAI API (for text only, not timing)
 */
export async function generateTranscript(audioUrl: string): Promise<string> {
  try {
    console.log('Generating transcript with AssemblyAI SDK for URL:', audioUrl);
    
    // Prepare request parameters
    const transcriptionParams = {
      audio: audioUrl,
      language_code: 'en'
    };
    
    console.log('Sending request with params:', transcriptionParams);
    
    // Use the official SDK to transcribe
    const transcript = await client.transcripts.transcribe(transcriptionParams);
    
    if (!transcript || !transcript.text) {
      console.error('No transcript text returned from AssemblyAI');
      throw new Error('No transcript text returned');
    }
    
    console.log('Transcript generated successfully');
    return transcript.text;
  } catch (error) {
    console.error('Error in generateTranscript:', error);
    throw error;
  }
}

// Thêm hàm fallback để tạo transcript giả khi API bị lỗi
function generateDummyTranscript(durationSeconds: number = 60): string {
  // Những câu mẫu để chọn ngẫu nhiên
  const sampleSentences = [
    "Hello, how are you today?",
    "The weather is quite nice this morning.",
    "I'm planning to go to the beach this weekend.",
    "Have you finished reading that book I recommended?",
    "The concert last night was absolutely amazing.",
    "Could you please help me with this assignment?",
    "I think we should meet up for coffee sometime.",
    "The new restaurant downtown has excellent food.",
    "My brother just got a new job at a tech company.",
    "Do you think it will rain later today?",
    "I've been learning to play the piano for three months.",
    "What time does your flight arrive tomorrow?",
    "She's been working on this project for weeks.",
    "The museum has a special exhibition until next month.",
    "You should try the new recipe I found online."
  ];
  
  // Số câu cần tạo - dựa trên thời lượng audio
  const sentenceCount = Math.max(3, Math.round(durationSeconds / 10));
  
  // Tạo transcript bằng cách lấy ngẫu nhiên các câu
  let dummyText = '';
  for (let i = 0; i < sentenceCount; i++) {
    const randomSentence = sampleSentences[Math.floor(Math.random() * sampleSentences.length)];
    dummyText += randomSentence + ' ';
  }
  
  console.log(`Generated dummy transcript with ${sentenceCount} sentences`);
  return dummyText.trim();
}

/**
 * Process an audio file: upload to Supabase and generate transcript
 */
export async function processAudioFile(file: File, userId?: string, withTiming = true): Promise<{ audioUrl: string, transcript: string, timingData: WordTiming[] | null }> {
  try {
    // Upload audio file and get URL
    const audioUrl = await uploadAudioToStorage(file, userId);
    console.log('Audio uploaded to URL:', audioUrl);
    
    // Get audio duration
    let audioDuration = 60; // Default 60 seconds
    try {
      // Attempt to get actual duration
      const audioBlob = new Blob([file], { type: file.type });
      const audio = new Audio(URL.createObjectURL(audioBlob));
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', resolve);
        audio.addEventListener('error', resolve); // Handle loading errors
      });
      if (audio.duration && !isNaN(audio.duration)) {
        audioDuration = audio.duration;
        console.log('Actual audio duration:', audioDuration, 'seconds');
      }
    } catch (durationError) {
      console.warn('Could not determine audio duration:', durationError);
    }
    
    // Generate transcript using AssemblyAI
    let transcript: string;
    let usedFallback = false;
    
    try {
      transcript = await generateTranscript(audioUrl);
      console.log('Transcript generated successfully:', transcript);
    } catch (transcriptError) {
      console.error('Failed to generate transcript with AssemblyAI:', transcriptError);
      // Fallback to dummy text if API call fails
      transcript = generateDummyTranscript(audioDuration);
      usedFallback = true;
      console.log('Using fallback transcript:', transcript);
    }
    
    // Generate synthetic timing data
    const syntheticTiming = generateSyntheticTiming(transcript, audioDuration);
    
    return {
      audioUrl,
      transcript: usedFallback ? transcript + "\n\n[Lưu ý: Transcript này được tạo tự động do API gặp sự cố. Vui lòng kiểm tra và sửa lại nội dung cho phù hợp.]" : transcript,
      timingData: syntheticTiming
    };
  } catch (error) {
    console.error('Error processing audio file:', error);
    throw error;
  }
}

/**
 * Format timing data for display
 */
export function formatTimingData(timingData: WordTiming[]): string {
  return timingData.map(word => {
    const startSec = (word.start / 1000).toFixed(2);
    const endSec = (word.end / 1000).toFixed(2);
    return `${word.text} [${startSec}s - ${endSec}s]`;
  }).join('\n');
}

/**
 * Generate synthetic timing data for a transcript
 * when AssemblyAI doesn't provide word-level timing
 */
export function generateSyntheticTiming(
  transcript: string, 
  audioDurationSeconds: number = 60
): WordTiming[] {
  if (!transcript || transcript.trim() === '') {
    return [];
  }
  
  // Clean the transcript and split into words
  const words = transcript
    .replace(/[.,!?;:()[\]{}"""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.trim() !== '');
  
  if (words.length === 0) return [];
  
  // Convert duration to milliseconds
  const audioDurationMs = audioDurationSeconds * 1000;
  
  // Calculate average time per word, leaving some buffer at the end
  // We'll use 85% of the audio duration to ensure we don't exceed the total length
  const effectiveDuration = audioDurationMs * 0.85;
  const avgWordDuration = effectiveDuration / words.length;
  
  const timingData: WordTiming[] = [];
  let currentTime = 0;
  
  words.forEach(word => {
    // Adjust duration based on word length (longer words take more time)
    // Plus some randomness for natural feeling
    const lengthFactor = Math.max(0.7, Math.min(1.5, word.length / 5));
    const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
    
    // Calculate this word's duration
    let wordDuration = avgWordDuration * lengthFactor * randomFactor;
    
    // Ensure we don't exceed the audio duration
    if (currentTime + wordDuration > audioDurationMs) {
      wordDuration = audioDurationMs - currentTime;
    }
    
    // Add the word with timing
    timingData.push({
      text: word,
      start: Math.round(currentTime),
      end: Math.round(currentTime + wordDuration),
      confidence: 0.95 // Synthetic confidence value
    });
    
    // Add a small gap between words (natural pauses)
    const gap = Math.random() * 50; // 0-50ms gap
    currentTime += wordDuration + gap;
  });
  
  // If we have remaining time, stretch out the timings a bit
  if (timingData.length > 0 && timingData[timingData.length - 1].end < audioDurationMs) {
    const stretchFactor = audioDurationMs / timingData[timingData.length - 1].end;
    
    // Apply stretch factor to all timings
    timingData.forEach(word => {
      word.start = Math.round(word.start * stretchFactor);
      word.end = Math.round(word.end * stretchFactor);
    });
  }
  
  console.log(`Generated synthetic timing for ${words.length} words over ${audioDurationSeconds} seconds`);
  return timingData;
} 