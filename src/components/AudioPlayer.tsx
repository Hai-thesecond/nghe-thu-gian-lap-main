import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Play, Pause, Info } from 'lucide-react';
import { toast } from 'sonner';
import { WordTiming } from '@/lib/azure-speech';

interface AudioPlayerProps {
  audioUrl: string | null;
  wordTimings: WordTiming[];
  words: string[];
  onWordHighlight?: (index: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  wordTimings,
  words,
  onWordHighlight
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [lastHighlightedWord, setLastHighlightedWord] = useState<{index: number, word: string}>({ index: -1, word: '' });
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerIdRef = useRef<NodeJS.Timeout>();
  
  // Reset current timing when URL changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, [audioUrl]);
  
  // Load audio
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      console.log('AudioPlayer: Setting audio URL', audioUrl);
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);
  
  // Log when wordTimings change
  useEffect(() => {
    console.log(`AudioPlayer: Received ${wordTimings.length} word timings`);
    if (wordTimings.length > 0) {
      console.log('AudioPlayer: First 3 timings:', wordTimings.slice(0, 3));
    }
  }, [wordTimings]);
  
  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      highlightCurrentWord(audio.currentTime);
    };
    
    const handleDurationChange = () => {
      console.log('AudioPlayer: Duration loaded:', audio.duration);
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      console.log('AudioPlayer: Playback ended');
      setIsPlaying(false);
      if (onWordHighlight) onWordHighlight(-1);
    };
    
    const handlePlay = () => {
      console.log('AudioPlayer: Playback started');
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      console.log('AudioPlayer: Playback paused');
      setIsPlaying(false);
    };
    
    const handleError = (e: Event) => {
      console.error('AudioPlayer: Error playing audio', e);
      toast.error('Không thể phát audio');
      setIsPlaying(false);
    };
    
    const handleCanPlay = () => {
      console.log('AudioPlayer: Audio can play, duration:', audio.duration);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onWordHighlight]);
  
  // Highlight current word based on time
  const highlightCurrentWord = (time: number) => {
    if (!wordTimings.length || !onWordHighlight) return;
    
    try {
      // Find the word that should be highlighted at current time
      let activeWordIndex = -1;
      let activeWord = '';
      
      // First try to find a word with direct timing match
      for (let i = 0; i < wordTimings.length; i++) {
        const timing = wordTimings[i];
        if (time >= timing.startTime && time <= timing.endTime) {
          activeWordIndex = i;
          activeWord = timing.word;
          break;
        }
      }
      
      // If no direct match, use fallback: find closest index
      if (activeWordIndex === -1) {
        for (let i = 0; i < wordTimings.length; i++) {
          if (time < wordTimings[i].startTime) {
            // We've gone too far, use previous index
            activeWordIndex = Math.max(0, i - 1);
            activeWord = wordTimings[activeWordIndex].word;
            break;
          }
        }
        
        // If still not found and we're at the end, use the last word
        if (activeWordIndex === -1 && wordTimings.length > 0) {
          activeWordIndex = wordTimings.length - 1;
          activeWord = wordTimings[activeWordIndex].word;
        }
      }
      
      // Match timing word to script words
      if (activeWordIndex >= 0) {
        // Log for debugging
        if (showDebug) {
          console.log(`Trying to match '${activeWord}' (index ${activeWordIndex}) at time ${time.toFixed(2)}s`);
        }
        
        const timingWord = wordTimings[activeWordIndex].word;
        
        // Calculate a position estimate based on the relative position in the timing array
        const estimatedPosition = Math.floor((activeWordIndex / wordTimings.length) * words.length);
        const searchWindowSize = Math.max(10, Math.floor(words.length * 0.2)); // 20% of total or at least 10 words
        
        // Define search window
        const startSearch = Math.max(0, estimatedPosition - searchWindowSize);
        const endSearch = Math.min(words.length, estimatedPosition + searchWindowSize);
        
        // Try to find matching word in script words
        let matchedWordIndex = -1;
        let bestMatchScore = 0;
        
        // Normalize for comparison
        const normalizedTimingWord = timingWord.toLowerCase().replace(/[.,!?;:()]/g, '');
        
        // Step 1: Try exact match first within the search window
        for (let i = startSearch; i < endSearch; i++) {
          const normalizedWord = words[i].toLowerCase().replace(/[.,!?;:()]/g, '');
          if (normalizedWord === normalizedTimingWord) {
            matchedWordIndex = i;
            break;
          }
        }
        
        // Step 2: If no exact match, try fuzzy matching within window
        if (matchedWordIndex === -1) {
          for (let i = startSearch; i < endSearch; i++) {
            const normalizedWord = words[i].toLowerCase().replace(/[.,!?;:()]/g, '');
            
            // Calculate string similarity
            const similarity = calculateStringSimilarity(normalizedWord, normalizedTimingWord);
            
            if (similarity > 0.7 && similarity > bestMatchScore) { // 70% similar
              bestMatchScore = similarity;
              matchedWordIndex = i;
            }
          }
        }
        
        // Step 3: If still no match, look for containing word
        if (matchedWordIndex === -1) {
          for (let i = startSearch; i < endSearch; i++) {
            const normalizedWord = words[i].toLowerCase().replace(/[.,!?;:()]/g, '');
            
            if (normalizedWord.includes(normalizedTimingWord) || 
                normalizedTimingWord.includes(normalizedWord)) {
              matchedWordIndex = i;
              break;
            }
          }
        }
        
        // Step 4: Fallback - use proportional position if no match found
        if (matchedWordIndex === -1) {
          matchedWordIndex = Math.floor((activeWordIndex / wordTimings.length) * words.length);
          // Ensure within bounds
          matchedWordIndex = Math.min(Math.max(0, matchedWordIndex), words.length - 1);
          
          if (showDebug) {
            console.log(`No match found, using proportional position: ${matchedWordIndex}`);
          }
        }
        
        // Check if we found a match
        if (matchedWordIndex >= 0) {
          // Save the last highlighted word for debug info
          setLastHighlightedWord({
            index: matchedWordIndex,
            word: words[matchedWordIndex]
          });
          
          // Highlight the word
          onWordHighlight(matchedWordIndex);
          
          if (showDebug) {
            console.log(`Highlighted: '${words[matchedWordIndex]}' (index ${matchedWordIndex})`);
          }
        }
      }
    } catch (error) {
      console.error('AudioPlayer: Error highlighting word:', error);
    }
  };
  
  // Calculate string similarity using Levenshtein distance
  const calculateStringSimilarity = (a: string, b: string): number => {
    if (a.length === 0) return b.length === 0 ? 1 : 0;
    if (b.length === 0) return 0;
    
    // Maximum distance is the length of the longer string
    const maxDistance = Math.max(a.length, b.length);
    
    // Levenshtein distance calculation
    const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    // Convert distance to similarity score (0-1)
    const distance = matrix[a.length][b.length];
    return 1 - (distance / maxDistance);
  };
  
  // Toggle play/pause
  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      if (!audioUrl) {
        toast.error('Không có file audio hoặc đang tải');
        return;
      }
      
      if (wordTimings.length === 0) {
        toast.warning('Không có timing data, highlight từng từ có thể không chính xác');
      }
      
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        toast.error('Không thể phát audio: ' + err.message);
      });
    }
  };
  
  // Toggle debug info
  const toggleDebug = () => {
    setShowDebug(!showDebug);
  };
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={togglePlayback}
          className={`flex items-center gap-2 ${isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
          size="sm"
          disabled={!audioUrl}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              Dừng
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Phát
            </>
          )}
        </Button>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          ></div>
        </div>
        
        <div className="text-sm text-gray-600">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDebug}
          title="Hiển thị debug info"
        >
          <Info className="w-4 h-4" />
        </Button>
      </div>
      
      {showDebug && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
          <div><strong>Audio URL:</strong> {audioUrl ? 'Loaded' : 'None'}</div>
          <div><strong>Duration:</strong> {duration.toFixed(2)}s</div>
          <div><strong>Word Timings:</strong> {wordTimings.length}</div>
          <div><strong>Script Words:</strong> {words.length}</div>
          <div>
            <strong>Last Word:</strong> {lastHighlightedWord.index >= 0 ? 
              `${lastHighlightedWord.index}: "${lastHighlightedWord.word}"` : 'None'}
          </div>
          {wordTimings.length > 0 && (
            <div>
              <strong>First timing:</strong> "{wordTimings[0].word}" ({wordTimings[0].startTime.toFixed(2)}s - {wordTimings[0].endTime.toFixed(2)}s)
            </div>
          )}
        </div>
      )}
      
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};

// Helper to format time
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' + secs : secs}`;
};

export default AudioPlayer; 