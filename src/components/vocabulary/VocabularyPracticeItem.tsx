import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volume2, Check, X, ArrowRight, Type, BookOpen } from "lucide-react";
import { VocabularyItem } from './FlashCard';

interface VocabularyPracticeItemProps {
  vocabulary: VocabularyItem;
  audioUrl?: string;
  onNextWord: () => void;
  onCorrect: (vocabId: string) => void;
  onFail: (vocabId: string) => void;
  isLastItem: boolean;
  otherMeanings: string[];
  alreadyCompleted?: boolean;
}

const VocabularyPracticeItem: React.FC<VocabularyPracticeItemProps> = ({
  vocabulary,
  audioUrl,
  onNextWord,
  onCorrect,
  onFail,
  isLastItem,
  otherMeanings,
  alreadyCompleted = false
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'typing' | 'meaning' | 'result'>(alreadyCompleted ? 'result' : 'typing');
  const [typingCorrect, setTypingCorrect] = useState(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);

  // Chuẩn bị các lựa chọn nghĩa
  useEffect(() => {
    if (!vocabulary) return;

    // Tạo mảng các lựa chọn bao gồm nghĩa đúng và các nghĩa nhiễu
    const allChoices = [vocabulary.meaning_vi, ...otherMeanings.slice(0, 3)];
    
    // Xáo trộn mảng lựa chọn
    const shuffled = [...allChoices].sort(() => 0.5 - Math.random());
    
    setChoices(shuffled);
    setShowResult(alreadyCompleted);
    setIsCorrect(alreadyCompleted);
    setSelectedChoice(alreadyCompleted ? vocabulary.meaning_vi : null);
    setInputValue(alreadyCompleted ? vocabulary.word : "");
    setStep(alreadyCompleted ? 'result' : 'typing');
    setTypingCorrect(alreadyCompleted);
    setHasPlayedAudio(false);
    
    // Tự động phát âm khi hiển thị từ mới - chỉ khi chưa hoàn thành từ này
    if (!alreadyCompleted) {
      setTimeout(() => {
        playAudio();
      }, 500);
    }
    
    // Focus vào input khi component mount
    if (inputRef.current && !alreadyCompleted) {
      inputRef.current.focus();
    }
  }, [vocabulary, otherMeanings, alreadyCompleted]);

  // Phát âm thanh từ vựng
  const playAudio = () => {
    if (isPlaying) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }
    
    if ('speechSynthesis' in window) {
      try {
        setIsPlaying(true);
        setHasPlayedAudio(true);
        
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

  // Xử lý kiểm tra đáp án gõ từ
  const handleCheckTyping = () => {
    const userWordTrimmed = inputValue.trim().toLowerCase();
    const correctWordTrimmed = vocabulary.word.trim().toLowerCase();
    
    const isWordCorrect = userWordTrimmed === correctWordTrimmed;
    
    if (isWordCorrect) {
      setTypingCorrect(true);
      setStep('meaning');
    } else {
      // Nếu gõ sai từ, đánh dấu là thất bại
      setShowResult(true);
      setIsCorrect(false);
      setStep('result');
      
      // Báo lỗi cho component cha
      onFail(vocabulary.id);
    }
  };

  // Xử lý kiểm tra đáp án chọn nghĩa
  const handleCheckMeaning = () => {
    if (selectedChoice) {
      const correct = selectedChoice === vocabulary.meaning_vi;
      setIsCorrect(correct);
      setShowResult(true);
      setStep('result');
      
      if (correct) {
        // Cả hai bước đều đúng
        onCorrect(vocabulary.id);
      } else {
        // Chọn nghĩa sai
        onFail(vocabulary.id);
      }
    }
  };

  // Hàm xác định thông báo lỗi dựa trên bước hiện tại
  const getErrorMessage = () => {
    if (step === 'typing' || (!typingCorrect && step === 'result')) {
      return `Không chính xác! Từ bạn nên gõ là "${vocabulary.word}"`;
    } else {
      return `Không chính xác! Nghĩa của từ "${vocabulary.word}" là "${vocabulary.meaning_vi}"`;
    }
  };

  // Xử lý submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 'typing') {
      handleCheckTyping();
    } else if (step === 'meaning') {
      handleCheckMeaning();
    } else if (step === 'result') {
      // Nếu kết quả hiện tại là đúng, chuyển tới từ mới
      if (isCorrect) {
        onNextWord();
      } else {
        // Nếu sai, đã được xử lý bởi onFail
      }
    }
  };

  // Xử lý chọn đáp án
  const handleChoiceSelect = (choice: string) => {
    if (step === 'meaning') {
      setSelectedChoice(choice);
    }
  };

  return (
    <div className="flex flex-col p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 backdrop-blur-sm"></div>
      
      {/* Phần hiển thị từ và nút phát âm */}
      <div className="relative z-10 flex justify-center mb-8">
        <div className="flex flex-col items-center backdrop-blur-sm bg-white/50 rounded-xl p-6 border border-white/40 shadow-lg">
          <p className="text-gray-500 text-sm mb-2">
            {step === 'typing' 
              ? "Nghe và gõ từ tiếng Anh:" 
              : step === 'meaning' 
                ? "Chọn nghĩa tiếng Việt của từ:" 
                : "Kết quả:"}
          </p>
          
          <div className="mb-4 flex items-center">
            {/* Hiển thị từ chỉ khi đã thực hiện kiểm tra hoặc đang ở bước chọn nghĩa */}
            {(showResult || step === 'meaning') && (
              <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 mr-4">
                {vocabulary.word}
              </div>
            )}
            
            {/* Nút phát âm */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full opacity-70 blur-sm group-hover:opacity-100 transition duration-300"></div>
              <Button
                size="icon"
                className="relative rounded-full w-16 h-16 bg-white hover:bg-blue-50 border-none shadow-md transform hover:scale-110 transition-all duration-300"
                onClick={playAudio}
              >
                <Volume2 className={`h-8 w-8 text-primary ${isPlaying ? 'animate-pulse' : ''}`} />
              </Button>
            </div>
          </div>
          
          <p className="text-gray-600 text-sm">
            {step === 'typing' 
              ? hasPlayedAudio ? "Nhấn vào biểu tượng để nghe lại" : "Nhấn vào biểu tượng để nghe từ"
              : step === 'meaning' 
                ? "Đã gõ đúng từ! Tiếp tục chọn nghĩa." 
                : isCorrect 
                  ? "Chính xác! Tiếp tục từ tiếp theo." 
                  : "Không chính xác! Bạn cần quay lại học lại."}
          </p>
        </div>
      </div>
      
      {/* Phần nhập liệu và chọn nghĩa */}
      <div className="relative z-10">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Phần gõ từ - hiển thị khi ở bước typing */}
          {step === 'typing' && (
            <div className="mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="backdrop-blur-sm bg-white/60 border border-white/40 rounded-lg p-1 shadow-inner">
                    <Input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Gõ từ bạn nghe được..."
                      className="border-none bg-transparent text-center text-xl h-12 font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md hover:shadow-lg transition-all text-white px-8 py-2 rounded-lg"
                  disabled={!inputValue.trim() || !hasPlayedAudio}
                >
                  <Type className="mr-2 h-4 w-4" />
                  Kiểm tra từ
                </Button>
              </div>
            </div>
          )}

          {/* Phần chọn nghĩa - hiển thị khi ở bước meaning */}
          {step === 'meaning' && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {choices.map((choice, index) => (
                  <div 
                    key={index}
                    onClick={() => handleChoiceSelect(choice)}
                    className={`
                      p-4 rounded-lg cursor-pointer transition-all duration-300 
                      backdrop-blur-sm border shadow-md
                      ${selectedChoice === choice
                        ? 'bg-blue-50/80 border-blue-200 shadow-blue-100/50' 
                        : 'bg-white/50 border-white/40 hover:bg-blue-50/50 hover:border-blue-200'}
                    `}
                  >
                    <div className="flex items-center">
                      <div 
                        className={`w-6 h-6 mr-3 rounded-full flex items-center justify-center border 
                          ${selectedChoice === choice
                            ? 'bg-blue-100 border-blue-300 text-blue-600' 
                            : 'bg-white border-gray-300 text-gray-400'}`}
                      >
                      </div>
                      <span className="font-medium text-gray-700">
                        {choice}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="submit"
                className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md hover:shadow-lg transition-all text-white px-8 py-2 rounded-lg w-full"
                disabled={!selectedChoice}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Kiểm tra nghĩa
              </Button>
            </div>
          )}
          
          {/* Phần kết quả - hiển thị khi ở bước result */}
          {step === 'result' && (
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-full p-4 mb-4 rounded-lg backdrop-blur-sm ${isCorrect ? 'bg-green-50/80 border border-green-200' : 'bg-red-50/80 border border-red-200'}`}>
                {isCorrect ? (
                  <div className="flex items-center text-green-600">
                    <Check className="h-5 w-5 mr-2" />
                    <span className="font-medium">Chính xác! Từ "{vocabulary.word}" có nghĩa là "{vocabulary.meaning_vi}"</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <X className="h-5 w-5 mr-2" />
                    <span className="font-medium">
                      {getErrorMessage()}
                    </span>
                  </div>
                )}
              </div>
              
              <Button
                type="submit"
                className={`${isCorrect 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                } shadow-md hover:shadow-lg transition-all text-white px-8 py-2 rounded-lg w-full md:w-auto min-w-[200px]`}
              >
                {isCorrect ? (
                  <>
                    {isLastItem ? 'Hoàn thành' : 'Tiếp tục'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Quay lại học từ
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default VocabularyPracticeItem; 