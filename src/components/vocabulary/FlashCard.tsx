import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Volume, Volume2, Repeat, ArrowRight, Maximize } from 'lucide-react';

export interface VocabularyItem {
  id: string;
  word: string;
  part_of_speech: string;
  meaning_vi: string;
  image_url: string | null;
  audio_start_time: number;
  audio_end_time: number;
  attempts?: number;
  correct_count?: number;
}

interface FlashCardProps {
  vocabulary: VocabularyItem;
  audioUrl: string;
  onNext: () => void;
  onComplete: (vocabId: string) => void;
  isLastCard: boolean;
}

const FlashCard: React.FC<FlashCardProps> = ({
  vocabulary,
  audioUrl,
  onNext,
  onComplete,
  isLastCard,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Khi component mount, tạo audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', () => {
          setIsPlaying(false);
        });
      }
    };
  }, []);

  // Xử lý khi từ vựng thay đổi
  useEffect(() => {
    setIsFlipped(false);
    setPlayCount(0);
    
    // Tự động phát âm khi component mount
    setTimeout(() => {
      playAudio();
    }, 500);
  }, [vocabulary]);

  // Phát âm thanh từ vựng
  const playAudio = () => {
    if (isPlaying) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }
    
    if (playCount >= 2) return;
    
    // Thử sử dụng file audio nếu có
    if (audioRef.current && audioUrl) {
      try {
        const audio = audioRef.current;
        
        // Thiết lập thời gian bắt đầu và kết thúc nếu có
        if (vocabulary.audio_start_time !== undefined && vocabulary.audio_end_time !== undefined) {
          audio.currentTime = vocabulary.audio_start_time;
        }
        
        // Phát audio
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          setIsPlaying(true);
          
          playPromise
            .then(() => {
              // Audio phát thành công
              setPlayCount(prev => prev + 1);
            })
            .catch(error => {
              console.error("Không thể phát audio file:", error);
              // Fallback sang Web Speech API
              useSpeechSynthesis();
            });
        }
      } catch (error) {
        console.error("Lỗi khi phát audio:", error);
        // Fallback sang Web Speech API
        useSpeechSynthesis();
      }
    } else {
      // Không có audio file, sử dụng Web Speech API
      useSpeechSynthesis();
    }
  };
  
  // Hàm sử dụng Web Speech API
  const useSpeechSynthesis = () => {
    if ('speechSynthesis' in window) {
      try {
        setIsPlaying(true);
        
        // Tạo utterance mới
        const utterance = new SpeechSynthesisUtterance(vocabulary.word);
        
        // Tìm giọng tiếng Anh UK
        const voices = speechSynthesis.getVoices();
        const ukVoice = voices.find(voice => 
          voice.name.includes('UK English Female') || 
          voice.name.includes('British') || 
          (voice.lang === 'en-GB' && voice.name.includes('Female'))
        );
        
        // Nếu tìm thấy giọng UK, sử dụng giọng đó
        if (ukVoice) {
          utterance.voice = ukVoice;
        } else {
          // Fallback sang giọng tiếng Anh khác
          utterance.lang = 'en-US';
        }
        
        // Tùy chỉnh rate và pitch
        utterance.rate = 0.85; // Tốc độ nói (0.1 đến 10)
        utterance.pitch = 1; // Cao độ (0 đến 2)
        
        // Các sự kiện xử lý
        utterance.onend = () => {
          setIsPlaying(false);
          setPlayCount(prev => prev + 1);
        };
        
        utterance.onerror = () => {
          setIsPlaying(false);
        };
        
        // Phát âm
        speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Lỗi khi phát âm:', error);
        setIsPlaying(false);
      }
    }
  };

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextClick = () => {
    if (isLastCard) {
      onComplete(vocabulary.id);
    } else {
      onNext();
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <div 
        ref={cardRef}
        className={`relative w-full h-80 cursor-pointer transition-transform duration-500 ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        style={{ perspective: '1000px' }}
      >
        <div 
          className={`absolute inset-0 rounded-2xl ${
            isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } transition-opacity duration-500 bg-white shadow-lg`}
          onClick={handleCardClick}
        >
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <h2 className="text-3xl font-bold mb-3">{vocabulary.word}</h2>
            {vocabulary.part_of_speech && (
              <Badge variant="outline" className="mb-4">
                {vocabulary.part_of_speech}
              </Badge>
            )}
            
            {vocabulary.image_url && (
              <div className="w-40 h-40 mb-4 overflow-hidden rounded-lg">
                <img 
                  src={vocabulary.image_url} 
                  alt={vocabulary.word} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="mt-4 flex space-x-2 justify-center">
              {/* Nút phát âm thanh được cải thiện */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full opacity-70 blur-sm group-hover:opacity-100 transition duration-300"></div>
                <Button
                  size="icon"
                  className="relative rounded-full w-14 h-14 bg-white hover:bg-blue-50 border-none shadow-md transform hover:scale-110 transition-all duration-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    playAudio();
                  }}
                  disabled={playCount >= 2}
                >
                  <Volume2 className={`h-7 w-7 text-primary ${isPlaying ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mt-3">
              {playCount > 0 ? "Nhấn vào biểu tượng để nghe lại" : "Nhấn vào biểu tượng để nghe từ"} ({playCount}/2)
            </p>
          </div>
        </div>
        
        <div 
          className={`absolute inset-0 rounded-2xl ${
            isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } transition-opacity duration-500 bg-blue-50 shadow-lg`}
          onClick={handleCardClick}
        >
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <h3 className="text-2xl font-semibold mb-4">Nghĩa tiếng Việt:</h3>
            <p className="text-xl mb-6">{vocabulary.meaning_vi}</p>
            
            <div className="mt-4 flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                }}
                className="flex items-center space-x-1"
              >
                <Repeat className="h-4 w-4 mr-1" />
                <span>Lật lại</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <audio 
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        style={{ display: 'none' }}
      />
      
      <div className="mt-6 flex justify-between w-full">
        <Button 
          onClick={handleNextClick}
          className="flex items-center space-x-1"
        >
          {isLastCard ? (
            <>
              <span>Hoàn thành</span>
              <Maximize className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              <span>Tiếp tục</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
      
      <div className="mt-2 text-sm text-gray-500">
        <p>Nhấn vào thẻ để lật xem nghĩa tiếng Việt</p>
      </div>
    </div>
  );
};

export default FlashCard; 