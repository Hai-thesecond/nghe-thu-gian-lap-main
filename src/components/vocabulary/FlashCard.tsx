import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Volume, Repeat, ArrowRight, Maximize } from 'lucide-react';

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
  }, [vocabulary]);

  const playAudio = () => {
    if (audioRef.current && playCount < 2) {
      const audio = audioRef.current;
      
      // Thiết lập thời gian bắt đầu và kết thúc nếu có
      if (vocabulary.audio_start_time !== undefined && vocabulary.audio_end_time !== undefined) {
        audio.currentTime = vocabulary.audio_start_time;
      }
      
      audio.play();
      setIsPlaying(true);
      setPlayCount(prev => prev + 1);
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
            
            <div className="mt-4 flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio();
                }}
                disabled={isPlaying || playCount >= 2}
                className="flex items-center space-x-1"
              >
                <Volume className="h-4 w-4 mr-1" />
                <span>Nghe ({playCount}/2)</span>
              </Button>
            </div>
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