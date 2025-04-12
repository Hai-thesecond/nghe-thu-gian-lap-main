import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Book, CheckCircle2, Check, Eye, Volume2, ArrowRight, Loader2, Pause, MoveRight, Sparkles, Maximize2, RefreshCw, Image as ImageIcon, Rotate3D, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import StudentLayout from '@/layouts/StudentLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import FlashCard, { VocabularyItem } from '@/components/vocabulary/FlashCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import Google Image Search service
import { 
  searchImagesForWord, 
  getBestImageForVocabulary,
  getEnhancedImageForVocabulary,
  saveImageForVocabulary, 
  GoogleImageResult 
} from '@/services/googleImageSearch';
import { getWordData, EnhancedVocabularyData } from '@/services/combinedDictionaryService';

// Add custom CSS for fullscreen mode
const fullscreenStyles = `
  .fullscreen-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    padding: 0;
    margin: 0;
    background-color: #f8fafc;
  }

  .fullscreen-container .progress-bar-wrapper {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    flex-shrink: 0;
  }
  
  .fullscreen-container .content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    padding: 0.5rem;
    max-height: calc(100vh - 80px);
  }

  .fullscreen-container .content-wrapper .container {
    width: 100%;
    max-width: 100%;
    padding: 0 0.5rem;
  }

  .fullscreen-container .content-wrapper .card-content {
    max-height: calc(100vh - 220px);
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 0.5rem;
  }
  
  /* Ensure text and content wrap properly */
  .flashcard-content {
    word-wrap: break-word;
    word-break: normal;
    overflow-wrap: break-word;
    white-space: normal;
    width: 100%;
    max-width: 100%;
  }
  
  .dialog-in-fullscreen {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
  }

  @media (min-width: 640px) {
    .fullscreen-container .content-wrapper {
      padding: 1rem;
    }
    
    .fullscreen-container .content-wrapper .container {
      padding: 0 1rem;
    }
  }

  @media (min-width: 768px) {
    .fullscreen-container .content-wrapper {
      padding: 1.5rem;
    }
    
    .fullscreen-container .content-wrapper .container {
      max-width: 90%;
    }
  }

  @media (min-width: 1024px) {
    .fullscreen-container .content-wrapper .container {
      max-width: 80%;
    }
    
    .fullscreen-container .content-wrapper .card-content {
      max-height: calc(100vh - 200px);
    }
  }
`;

// Add custom CSS for flippable card
const flippableCardStyles = `
  .flip-card-container {
    perspective: 1000px;
    width: 100%;
    height: 450px;
    margin: 0 auto;
  }
  
  .flip-card {
    position: relative;
    width: 100%;
    height: 100%;
    text-align: center;
    transition: transform 0.8s;
    transform-style: preserve-3d;
  }
  
  .flipped {
    transform: rotateY(180deg);
  }
  
  .flip-card-front, .flip-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    padding: 2rem;
  }
  
  .flip-card-front {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(240, 249, 255, 0.9));
    border: 1px solid rgba(59, 130, 246, 0.2);
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  
  .flip-card-back {
    background: linear-gradient(135deg, rgba(240, 249, 255, 0.95), rgba(219, 234, 254, 0.95));
    transform: rotateY(180deg);
    border: 1px solid rgba(59, 130, 246, 0.3);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  
  .flip-icon {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    padding: 0.5rem;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    z-index: 5;
    transition: transform 0.3s ease;
  }
  
  .flip-icon:hover {
    transform: scale(1.1);
  }
  
  .text-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    max-width: 50%;
  }
  
  .image-container {
    flex: 1;
    width: 100%;
    max-width: 340px;
    height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border-radius: 0.75rem;
    overflow: hidden;
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  
  .image-container.back {
    margin: 0 auto 1.5rem;
    max-width: 300px;
    height: 200px;
  }
  
  .image-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .vocabulary-main {
    font-size: 3.5rem;
    font-weight: 700;
    background: linear-gradient(to right, #3b82f6, #6366f1);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin: 0.5rem 0;
    line-height: 1.1;
    text-align: left;
  }
  
  .controls-row {
    display: flex;
    align-items: center;
    margin-top: 1rem;
    gap: 1rem;
  }
  
  .part-of-speech {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background-color: rgba(219, 234, 254, 0.8);
    color: #3b82f6;
    border-radius: 9999px;
    font-size: 0.75rem;
  }
  
  .audio-button {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .audio-button:hover {
    transform: scale(1.1);
  }
  
  .flip-hint {
    text-align: left;
    margin-top: 2rem;
  }
  
  .meaning-vi {
    font-size: 1.5rem;
    font-weight: 500;
    color: #1f2937;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.05);
  }
  
  .additional-info-section {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1rem;
    width: 100%;
    text-align: left;
  }
  
  .info-title {
    font-weight: 600;
    color: #3b82f6;
    margin-bottom: 0.25rem;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .flip-card-front {
      flex-direction: column;
      justify-content: center;
      padding: 1rem;
    }
    
    .text-container {
      max-width: 100%;
      align-items: center;
      text-align: center;
    }
    
    .vocabulary-main {
      font-size: 2.8rem;
      text-align: center;
    }
    
    .image-container {
      max-width: 280px;
      height: 200px;
      margin-bottom: 1rem;
    }
  }
`;

// Extend VocabularyItem với các trường mới
interface ExtendedVocabularyItem extends VocabularyItem {
  definition?: string;
  example?: string | string[]; // Update to allow both string and string array
  synonyms?: string[];
  antonyms?: string[];
  imageResults?: GoogleImageResult[];
  selectedImageUrl?: string;
  isLoadingDictionary?: boolean;
  partOfSpeech?: string;
}

const VocabularyFlashcards = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [showMeaning, setShowMeaning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Thêm state cho fullscreen
  const [hasFullscreenPermission, setHasFullscreenPermission] = useState(true); // Default to true to avoid prompt
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  
  // Thay thế anti-cheating state bằng state theo dõi thời gian học
  const [studyTime, setStudyTime] = useState(0); // seconds
  const studyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [loadingStates, setLoadingStates] = useState({
    vocabularyData: true,
    progressData: true,
    audioData: true
  });

  const [vocabularyWithImages, setVocabularyWithImages] = useState<Record<string, ExtendedVocabularyItem>>({});
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Bắt đầu đếm thời gian khi component được mount
  useEffect(() => {
    // Bắt đầu đếm thời gian
    startTimeRef.current = Date.now();
    
    // Cập nhật thời gian học mỗi giây
    studyTimerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setStudyTime(elapsedSeconds);
        
        // Lưu thời gian học vào localStorage
        try {
          localStorage.setItem(`vocab_study_time_${questionId}`, elapsedSeconds.toString());
    } catch (err) {
          console.error('Không thể lưu thời gian học:', err);
        }
      }
    }, 1000);
    
    // Thử tải thời gian học đã lưu trước đó
    try {
      const savedTime = localStorage.getItem(`vocab_study_time_${questionId}`);
      if (savedTime) {
        setStudyTime(parseInt(savedTime, 10));
      }
    } catch (err) {
      console.error('Không thể đọc thời gian học đã lưu:', err);
    }
    
    // Cleanup
    return () => {
      if (studyTimerRef.current) {
        clearInterval(studyTimerRef.current);
      }
      
      // Lưu thời gian học cuối cùng khi rời khỏi trang
      if (startTimeRef.current && questionId) {
        const finalTime = Math.floor((Date.now() - startTimeRef.current) / 1000) + studyTime;
        try {
          localStorage.setItem(`vocab_study_time_${questionId}`, finalTime.toString());
          
          // Lưu thời gian học vào database nếu đã đăng nhập
          if (user?.id) {
            // Thay vì cố gắng tạo một bản ghi mới, trước tiên kiểm tra xem có bất kỳ bản ghi nào cho người dùng và câu hỏi này chưa
            supabase
              .from('vocabulary_progress')
              .select('id, vocabulary_id')
              .eq('student_id', user.id)
              .eq('question_id', questionId)
              .limit(1)
              .then(({ data, error }) => {
                if (error) {
                  console.error('Lỗi khi kiểm tra tiến trình từ vựng:', error);
                  return;
                }
                
                // Nếu tìm thấy ít nhất một bản ghi, cập nhật nó
                if (data && data.length > 0) {
                  supabase
                    .from('vocabulary_progress')
                    .update({
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', data[0].id)
                    .then(({ error: updateError }) => {
                      if (updateError) {
                        console.error('Lỗi khi cập nhật thời gian học:', updateError);
                      }
                    });
                } else {
                  // Không có bản ghi nào, ghi log thông báo
                  console.log('Không tìm thấy bản ghi để cập nhật thời gian học');
                }
              });
          }
        } catch (err) {
          console.error('Không thể lưu thời gian học cuối cùng:', err);
        }
      }
    };
  }, [questionId, user?.id]);
  
  // Format thời gian học
  const formatStudyTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  // Kiểm tra xem Web Speech API có được hỗ trợ không
  useEffect(() => {
    if ('speechSynthesis' in window) {
      console.log('Web Speech API được hỗ trợ');
      setIsSpeechSupported(true);
      
      // Preload voices
      speechSynthesis.onvoiceschanged = () => {
        const voices = speechSynthesis.getVoices();
        console.log('Các giọng nói khả dụng:', voices.map(v => v.name));
      };
      
      // Cần gọi một lần để kích hoạt onvoiceschanged
      speechSynthesis.getVoices();
    } else {
      console.error('Web Speech API không được hỗ trợ trên trình duyệt này');
      setIsSpeechSupported(false);
    }
    
    // Cleanup khi unmount
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Update useQuery with loading states
  const { data: vocabularyData, isLoading, error } = useQuery({
    queryKey: ['vocabulary', questionId],
    queryFn: async () => {
      try {
        setLoadingStates(prev => ({...prev, vocabularyData: true}));
        
        // Fetch question data
        const { data: question, error: questionError } = await supabase
          .from('questions')
          .select('title, audio_url')
          .eq('id', questionId)
          .single();
        
        if (questionError) throw questionError;
        
        // Set audio URL if available
        if (question?.audio_url) {
          setLoadingStates(prev => ({...prev, audioData: true}));
          setAudioUrl(question.audio_url);
          setLoadingStates(prev => ({...prev, audioData: false}));
        }
        
        // Fetch vocabulary items
        const { data: vocabulary, error: vocabularyError } = await supabase
          .from('vocabulary_items')
          .select('*')
          .eq('question_id', questionId)
          .order('created_at', { ascending: true });
          
        if (vocabularyError) throw vocabularyError;
        
        // Fetch user progress
        if (user) {
          setLoadingStates(prev => ({...prev, progressData: true}));
          const { data: progress, error: progressError } = await supabase
            .from('vocabulary_progress')
            .select('vocabulary_id, flashcard_completed')
            .eq('student_id', user.id)
            .eq('question_id', questionId);
            
          if (!progressError && progress) {
            const completed = progress
              .filter(p => p.flashcard_completed)
              .map(p => p.vocabulary_id);
            
            setCompletedIds(completed);
          }
          setLoadingStates(prev => ({...prev, progressData: false}));
        }
        
        setLoadingStates(prev => ({...prev, vocabularyData: false}));
        return {
          question,
          vocabulary: vocabulary || []
        };
      } catch (error) {
        console.error('Error fetching vocabulary data:', error);
        toast.error('Không thể tải dữ liệu. Vui lòng thử lại sau.');
        throw error;
      }
    },
    enabled: !!questionId && !!user,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Kiểm tra xem đã hoàn thành tất cả từ vựng chưa
  useEffect(() => {
    if (vocabularyData?.vocabulary && vocabularyData.vocabulary.length > 0 && completedIds.length > 0) {
      const isAllCompleted = vocabularyData.vocabulary.every(
        vocab => completedIds.includes(vocab.id)
      );
      setAllCompleted(isAllCompleted);
    }
  }, [vocabularyData, completedIds]);

  // Xử lý khi xem xong thẻ từ vựng
  const handleCompleteCard = async (vocabId: string) => {
    if (!user || !questionId) return;
    
    try {
      // Kiểm tra xem đã có bản ghi tiến trình chưa
      const { data: existingProgress } = await supabase
        .from('vocabulary_progress')
        .select('id')
        .eq('student_id', user.id)
        .eq('question_id', questionId)
        .eq('vocabulary_id', vocabId)
        .maybeSingle();
      
      if (existingProgress) {
        // Cập nhật bản ghi hiện có
        await supabase
          .from('vocabulary_progress')
          .update({
            flashcard_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
      } else {
        // Tạo bản ghi mới
        await supabase
          .from('vocabulary_progress')
          .insert({
            student_id: user.id,
            question_id: questionId,
            vocabulary_id: vocabId,
            flashcard_completed: true,
            listening_practice_completed: false,
            post_practice_completed: false,
            attempts: 0,
            correct_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
      
      // Cập nhật state
      setCompletedIds(prev => [...prev, vocabId]);
      
      // Chuyển đến từ tiếp theo
      handleNextCard();
    } catch (error) {
      console.error('Error updating vocabulary progress:', error);
      toast.error('Không thể cập nhật tiến trình học từ vựng');
    }
  };

  // Xử lý chuyển đến thẻ tiếp theo
  const handleNextCard = () => {
    if (vocabularyData?.vocabulary && currentIndex < vocabularyData.vocabulary.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Đã học xong tất cả thẻ từ vựng, hiện hộp thoại xác nhận
      setShowCompleteDialog(true);
    }
  };

  // Xử lý khi hoàn thành tất cả flashcards
  const handleFinishFlashcards = async () => {
    if (!user || !questionId) {
      toast.error("Không thể chuyển trang: Thông tin người dùng không hợp lệ");
      return;
    }
    
    try {
      // Đánh dấu tất cả từ vựng là đã hoàn thành
      if (vocabularyData?.vocabulary && vocabularyData.vocabulary.length > 0) {
        // Hiển thị thông báo đang xử lý
        toast.loading("Đang lưu tiến trình...", { id: "saving-progress" });
        
        // Tạo danh sách các từ vựng cần cập nhật (những từ chưa được đánh dấu hoàn thành)
        const vocabsToUpdate = vocabularyData.vocabulary
          .filter(vocab => !completedIds.includes(vocab.id))
          .map(vocab => vocab.id);
          
        console.log(`Đánh dấu hoàn thành ${vocabsToUpdate.length} từ vựng còn lại...`);
        
        // Cập nhật từng từ vựng
        for (const vocabId of vocabsToUpdate) {
          // Kiểm tra xem đã có bản ghi tiến trình chưa
          const { data: existingProgress } = await supabase
            .from('vocabulary_progress')
            .select('id')
            .eq('student_id', user.id)
            .eq('question_id', questionId)
            .eq('vocabulary_id', vocabId)
            .maybeSingle();
          
          if (existingProgress) {
            // Cập nhật bản ghi hiện có
            await supabase
              .from('vocabulary_progress')
              .update({
                flashcard_completed: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingProgress.id);
          } else {
            // Tạo bản ghi mới
            await supabase
              .from('vocabulary_progress')
              .insert({
                student_id: user.id,
                question_id: questionId,
                vocabulary_id: vocabId,
                flashcard_completed: true,
                listening_practice_completed: false,
                post_practice_completed: false,
                attempts: 0,
                correct_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
          }
          
          // Cập nhật state
          setCompletedIds(prev => {
            if (prev.includes(vocabId)) return prev;
            return [...prev, vocabId];
          });
        }
        
        // Kết thúc thông báo đang xử lý
        toast.success("Đã lưu tiến trình học tập!", { id: "saving-progress" });
      }
      
      // Hiển thị thông báo trước khi chuyển trang
      toast.success('Hoàn thành học từ vựng, bắt đầu luyện tập!', {
        duration: 2000,
      });
      
      // Đảm bảo chuyển trang sau khi đã cập nhật dữ liệu
      setTimeout(() => {
        try {
          // Chuyển đến trang luyện tập từ vựng
          navigate(`/student/vocabulary-practice/${questionId}`);
          console.log("Đã chuyển hướng đến:", `/student/vocabulary-practice/${questionId}`);
        } catch (error) {
          console.error("Lỗi khi chuyển trang:", error);
          toast.error("Có lỗi xảy ra khi chuyển trang. Vui lòng thử lại.");
        }
      }, 1000);
    } catch (error) {
      console.error("Lỗi khi lưu tiến trình học tập:", error);
      toast.error("Có lỗi xảy ra khi lưu tiến trình. Vui lòng thử lại.");
    }
  };

  // Xử lý quay lại trang trước
  const handleGoBack = () => {
    navigate(-1);
  };

  // Tính phần trăm hoàn thành
  const calculateCompletionPercentage = () => {
    if (!vocabularyData?.vocabulary || vocabularyData.vocabulary.length === 0) return 0;
    return (completedIds.length / vocabularyData.vocabulary.length) * 100;
  };

  // Lấy từ vựng hiện tại
  const currentVocabulary = vocabularyData?.vocabulary?.[currentIndex];

  const toggleMeaning = () => {
    setShowMeaning(!showMeaning);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < vocabularyData?.vocabulary.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Triển khai hàm phát âm thanh sử dụng Web Speech API
  const playAudio = (word: string) => {
    console.log('Bắt đầu hàm playAudio với từ:', word);
    
    if (!currentVocabulary) {
      toast.error("Không thể phát âm thanh: Không tìm thấy từ vựng");
      return;
    }

    // Nếu đang phát, dừng lại
    if (isPlaying) {
      console.log('Đang phát âm thanh, dừng lại');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        console.log('Đã hủy phát âm');
      }
      setIsPlaying(false);
      return;
    }

    // Kiểm tra Web Speech API có hỗ trợ không
    if ('speechSynthesis' in window) {
      try {
        console.log('Chuẩn bị phát âm với Web Speech API');
        setIsPlaying(true);
        
        // Tạo utterance mới
        const utterance = new SpeechSynthesisUtterance(word);
        
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
          console.log('Sử dụng giọng:', ukVoice.name);
        } else {
          // Fallback sang giọng tiếng Anh khác
          utterance.lang = 'en-US';
          console.log('Không tìm thấy giọng UK, sử dụng en-US');
        }
        
        // Tùy chỉnh rate và pitch
        utterance.rate = 0.85; // Tốc độ nói (0.1 đến 10)
        utterance.pitch = 1; // Cao độ (0 đến 2)
        
        // Các sự kiện xử lý
        utterance.onstart = () => {
          console.log("Bắt đầu phát âm từ:", word);
        };
        
        utterance.onend = () => {
          console.log("Đã phát xong từ:", word);
          setIsPlaying(false);
        };
        
        utterance.onerror = (event) => {
          console.error("Lỗi khi phát âm thanh:", event);
          toast.error("Không thể phát âm thanh");
          setIsPlaying(false);
        };
        
        // Phát âm
        console.log('Gọi speak với từ:', word);
        speechSynthesis.speak(utterance);
        console.log("Đã gọi hàm speak");
        
      } catch (error) {
        console.error('Lỗi khi phát âm:', error);
        toast.error("Đã xảy ra lỗi khi phát âm");
        setIsPlaying(false);
      }
    } else {
      console.error('Web Speech API không được hỗ trợ');
      toast.warning("Trình duyệt của bạn không hỗ trợ tính năng phát âm");
    }
  };

  // Làm sạch audio khi unmount component
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Hủy tất cả các phát âm đang diễn ra
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Thay đổi hàm để sử dụng getEnhancedImageForVocabulary
  const fetchImageForWord = useCallback(async (word: string, vocabId: string, partOfSpeech?: string, meaning?: string) => {
    if (!word || vocabularyWithImages[vocabId]?.imageResults) return;
    
    try {
      setIsLoadingImage(true);
      
      // Sử dụng hàm nâng cao để lấy ảnh phù hợp hơn, truyền thêm thông tin part_of_speech và meaning
      const bestImage = await getEnhancedImageForVocabulary(word, vocabId, partOfSpeech, meaning);
      
      if (bestImage) {
        setVocabularyWithImages(prev => ({
          ...prev,
          [vocabId]: {
            ...(prev[vocabId] || {}),
            imageResults: [bestImage], 
            selectedImageUrl: bestImage.link
          } as ExtendedVocabularyItem
        }));
      }
    } catch (error) {
      console.error('Error fetching image for word:', word, error);
    } finally {
      setIsLoadingImage(false);
    }
  }, [vocabularyWithImages]);

  // Lưu ảnh đã chọn vào cơ sở dữ liệu
  const saveSelectedImage = useCallback(async (vocabId: string, imageUrl: string, title: string = '') => {
    if (!vocabId || !imageUrl) return;
    
    try {
      const result = await saveImageForVocabulary(vocabId, imageUrl, title);
      if (result) {
        console.log('Đã lưu ảnh thành công:', result);
        toast.success('Đã lưu ảnh cho từ vựng');
      }
    } catch (error) {
      console.error('Error saving selected image:', error);
    }
  }, []);

  // Thêm hàm refreshImage để làm mới hình ảnh và làm rõ chức năng
  const refreshImage = useCallback(async (word: string, vocabId: string) => {
    try {
      setIsLoadingImage(true);
      toast.info('Đang tìm hình ảnh mới...', { duration: 2000 });
      
      // Trước tiên, xóa cache trình duyệt của các ảnh hiện tại
      if (vocabularyWithImages[vocabId]?.selectedImageUrl) {
        const oldImageUrl = vocabularyWithImages[vocabId]?.selectedImageUrl;
        const oldImages = document.querySelectorAll(`img[src^="${oldImageUrl?.split('?')[0]}"]`);
        console.log(`Clearing ${oldImages.length} cached images for ${word}`);
        
        // Xóa src trước khi đặt lại để buộc trình duyệt không sử dụng cache
        oldImages.forEach(img => {
          (img as HTMLImageElement).src = '';
        });
        
        // Thêm CSS để phá vỡ cache hoàn toàn
        const style = document.createElement('style');
        style.textContent = `
          img[alt="${word}"] {
            background-image: none !important;
            background: transparent !important;
          }
        `;
        document.head.appendChild(style);
        setTimeout(() => {
          document.head.removeChild(style);
        }, 2000);
      }
      
      // Xóa cache ảnh cũ trong database
      try {
        await supabase
          .from('vocabulary_images')
          .delete()
          .eq('vocabulary_id', vocabId);
          
        console.log(`Đã xóa ảnh cũ cho vocabulary_id: ${vocabId}`);
      } catch (err) {
        console.error('Error deleting old image from database:', err);
      }
      
      // Tạm xóa hình ảnh hiện tại trong state để tránh hiển thị ảnh cũ
      setVocabularyWithImages(prev => {
        if (!prev[vocabId]) return prev;
        
        const updatedItem = {
          ...prev[vocabId],
          selectedImageUrl: ''
        };
        
        return {
          ...prev,
          [vocabId]: updatedItem
        };
      });
      
      // Buộc trình duyệt làm mới DOM trước khi gọi API
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Tìm hình ảnh mới với từ khóa được cải tiến, bỏ qua cache và buộc tìm ảnh mới
      const bestImage = await getEnhancedImageForVocabulary(
        word, 
        vocabId, 
        currentVocabulary?.part_of_speech, 
        currentVocabulary?.meaning_vi,
        true, // skipCache = true để bỏ qua ảnh đã lưu trong cache
        true  // forceNewImage = true để tìm ảnh khác với ảnh hiện tại
      );
      
      // Hiển thị ảnh mới nếu tìm được
      if (bestImage) {
        // Force reload bằng cách thêm tham số ngẫu nhiên duy nhất
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const imageUrl = bestImage.link;
        
        // Đảm bảo URL không có tham số cache cũ trước khi thêm mới
        const cleanImageUrl = imageUrl.split('?')[0];
        
        // Tạo URL mới với tham số cache-busting cực mạnh (timestamp + random)
        const imageUrlWithTimestamp = `${cleanImageUrl}?forceRefresh=${timestamp}-${randomId}`;
        console.log(`New image URL with enhanced cache-busting: ${imageUrlWithTimestamp}`);
        
        // Cập nhật state với ảnh mới
        setVocabularyWithImages(prev => {
          if (!prev[vocabId]) return prev;
          
          const updatedItem = {
            ...prev[vocabId],
            imageResults: [bestImage],
            selectedImageUrl: imageUrlWithTimestamp
          };
          
          return {
            ...prev,
            [vocabId]: updatedItem
          };
        });
        
        // Đợi React cập nhật DOM với URL mới
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Tìm tất cả các phần tử img mới và cập nhật src
        try {
          const images = document.querySelectorAll(`img[alt="${word}"]`);
          console.log(`Found ${images.length} images for word "${word}" to update`);
          
          // Xóa src của tất cả ảnh trước khi cập nhật
          images.forEach(img => {
            (img as HTMLImageElement).src = '';
          });
          
          // Đợi một chút để đảm bảo browser đã xóa cache
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Cập nhật từng ảnh với URL duy nhất
          images.forEach((img, index) => {
            const imgElement = img as HTMLImageElement;
            const uniqueImgUrl = `${cleanImageUrl}?forceRefresh=${timestamp}-${randomId}-${index}`;
            console.log(`Setting new src for image ${index}: ${uniqueImgUrl}`);
            imgElement.src = uniqueImgUrl;
            
            // Thêm sự kiện để log khi ảnh được tải
            imgElement.onload = () => {
              console.log(`Image ${index} loaded successfully`);
            };
            
            imgElement.onerror = (e) => {
              console.error(`Image ${index} failed to load:`, e);
            };
          });
          
          // Tạo một thẻ img mới để preload hình ảnh
          const preloadImage = document.createElement('img');
          preloadImage.style.position = 'absolute';
          preloadImage.style.opacity = '0';
          preloadImage.style.pointerEvents = 'none';
          preloadImage.style.width = '1px';
          preloadImage.style.height = '1px';
          preloadImage.onload = () => {
            console.log('Preload image loaded successfully');
            document.body.removeChild(preloadImage);
          };
          preloadImage.onerror = (e) => {
            console.error('Preload image failed to load:', e);
            if (preloadImage.parentNode) {
              document.body.removeChild(preloadImage);
            }
          };
          
          // Sử dụng một URL khác hoàn toàn để preload
          preloadImage.src = `${cleanImageUrl}?preload=${timestamp}-${Math.random().toString(36).substring(2, 8)}`;
          document.body.appendChild(preloadImage);
        } catch (err) {
          console.error('Error updating image elements:', err);
        }
        
        // Hiển thị thông báo thành công
        toast.success('Đã tìm được hình ảnh mới!', {
          description: 'Hình ảnh đã được cập nhật thành công.'
        });
      } else {
        toast.error('Không tìm được hình ảnh phù hợp', {
          description: 'Vui lòng thử lại sau.'
        });
      }
    } catch (error) {
      console.error('Error refreshing image:', error);
      toast.error('Lỗi khi làm mới hình ảnh');
    } finally {
      setIsLoadingImage(false);
    }
  }, [currentVocabulary?.meaning_vi, currentVocabulary?.part_of_speech, vocabularyWithImages]);

  // Fetch định nghĩa và thông tin từ điển cho từ vựng hiện tại
  const fetchDictionaryInfo = useCallback(async (word: string, vocabId: string) => {
    if (!word || 
        vocabularyWithImages[vocabId]?.definition ||
        vocabularyWithImages[vocabId]?.isLoadingDictionary) return;
      
    try {
      // Đánh dấu đang tải thông tin từ điển
      setVocabularyWithImages(prev => ({
        ...prev,
        [vocabId]: {
          ...(prev[vocabId] || {}),
          isLoadingDictionary: true
        } as ExtendedVocabularyItem
      }));

      // Sử dụng chỉ XF Dictionary + Datamuse APIs
      console.log(`Fetching dictionary info for: ${word}`);
      const enhancedData = await getWordData(word, currentVocabulary?.meaning_vi);
      
      // Cập nhật state với dữ liệu từ XF Dictionary
      setVocabularyWithImages(prev => {
        const updatedItem = {
          ...(prev[vocabId] || {}),
          definition: enhancedData.definitions.length > 0 ? enhancedData.definitions[0] : "",
          example: enhancedData.examples,
          synonyms: enhancedData.synonyms,
          antonyms: enhancedData.antonyms,
          partOfSpeech: enhancedData.partOfSpeech || prev[vocabId]?.partOfSpeech || currentVocabulary?.part_of_speech,
          isLoadingDictionary: false
        };
      
        return {
          ...prev,
          [vocabId]: updatedItem as ExtendedVocabularyItem
        };
      });
      
      // Nếu có audio URL, phát âm
      if (enhancedData.audioUrl && audioRef.current) {
        audioRef.current.src = enhancedData.audioUrl;
      }
    } catch (error) {
      console.error('Error fetching dictionary info for word:', word, error);
      // Đánh dấu không đang tải nữa nếu có lỗi
      setVocabularyWithImages(prev => ({
        ...prev,
        [vocabId]: {
          ...(prev[vocabId] || {}),
          isLoadingDictionary: false
        } as ExtendedVocabularyItem
      }));
    }
  }, [vocabularyWithImages, currentVocabulary]);

  // Fetch hình ảnh và thông tin từ điển khi từ vựng thay đổi
  useEffect(() => {
    if (currentVocabulary) {
      console.log("Current vocabulary:", currentVocabulary);
      fetchImageForWord(
        currentVocabulary.word, 
        currentVocabulary.id, 
        currentVocabulary.part_of_speech, 
        currentVocabulary.meaning_vi
      );
      fetchDictionaryInfo(currentVocabulary.word, currentVocabulary.id);
    }
  }, [currentVocabulary, fetchImageForWord, fetchDictionaryInfo, vocabularyWithImages]);

  // Lật thẻ
  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  // Thay đổi renderCardContent để sử dụng bố cục card lật
  const renderCardContent = () => {
    if (!currentVocabulary) return <div className="flex justify-center items-center h-full">Loading...</div>;
    
    const isCompleted = completedIds.includes(currentVocabulary.id);
    const currentVocabWithImage = vocabularyWithImages[currentVocabulary.id];
    const imageUrl = currentVocabWithImage?.selectedImageUrl || currentVocabulary.image_url;
    const isLoadingDict = currentVocabWithImage?.isLoadingDictionary;
    
    return (
      <div className="flip-card-container">
        <div className={`flip-card ${isFlipped ? 'flipped' : ''}`}>
          {/* Mặt trước: hiển thị văn bản bên trái, ảnh to bên phải */}
          <div className="flip-card-front">
            {/* Phần văn bản bên trái */}
            <div className="text-container">
              {/* Từ vựng lớn */}
              <div className="vocabulary-main">{currentVocabulary.word}</div>
              
              {/* Từ loại và nút phát âm cùng dòng */}
              <div className="controls-row">
                <div className="part-of-speech">
                  {currentVocabulary.part_of_speech || currentVocabWithImage?.partOfSpeech || '(không xác định)'}
            </div>
            
                <div className="audio-button" onClick={() => playAudio(currentVocabulary.word)}>
                  {isPlaying ? (
                    <Pause className="h-6 w-6 text-primary" />
                  ) : (
                    <Volume2 className="h-6 w-6 text-primary" />
                  )}
                </div>
              </div>
              
              <div className="flip-hint text-blue-500 text-sm animate-pulse flex items-center">
                <RotateCcw className="h-4 w-4 mr-1" />
                Nhấn để xem nghĩa và thông tin thêm
              </div>
            </div>
            
            {/* Ảnh lớn bên phải */}
            <div className="image-container relative">
              {isLoadingImage ? (
                <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                </div>
              ) : imageUrl ? (
                <>
                  <img 
                    src={imageUrl} 
                    alt={currentVocabulary.word}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=No+Image';
                    }}
                  />
                  {/* Nút làm mới hình ảnh */}
              <Button
                size="icon"
                    variant="secondary" 
                    className="absolute bottom-2 right-2 h-8 w-8 bg-white/80 hover:bg-white rounded-full shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshImage(currentVocabulary.word, currentVocabulary.id);
                    }}
                    title="Tìm hình ảnh mới"
                  >
                    <RefreshCw className="h-4 w-4 text-primary" />
                  </Button>
                </>
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                </div>
              )}
            </div>
            
            <div className="flip-icon" onClick={handleFlipCard}>
              <Rotate3D className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          
          {/* Mặt sau: giữ nguyên bố cục hiện tại */}
          <div className="flip-card-back">
            {/* Hình ảnh */}
            <div className="image-container back relative">
              {isLoadingImage ? (
                <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                </div>
              ) : imageUrl ? (
                <>
                  <img 
                    src={imageUrl} 
                    alt={currentVocabulary.word}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/300x200?text=No+Image';
                    }}
                  />
                  {/* Nút làm mới hình ảnh - hiển thị rõ ràng, không ẩn sau hover */}
            <Button 
                    size="icon" 
                    variant="secondary" 
                    className="absolute bottom-2 right-2 h-8 w-8 bg-white/80 hover:bg-white rounded-full shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshImage(currentVocabulary.word, currentVocabulary.id);
                    }}
                    title="Tìm hình ảnh mới"
                  >
                    <RefreshCw className="h-4 w-4 text-primary" />
            </Button>
                </>
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}
          </div>
          
            {/* Nghĩa tiếng Việt - Fixed position */}
            <div className="meaning-vi w-full text-center mb-4">{currentVocabulary.meaning_vi || "Chưa có nghĩa tiếng Việt"}</div>
            
            {/* Thông tin bổ sung */}
            <div className="additional-info-section">
              {/* Definition */}
              <div className="mb-3">
                <div className="info-title flex items-center">
                  <Book className="h-4 w-4 mr-1 text-primary" />
                  Definition:
                </div>
                {isLoadingDict ? (
                  <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4"></div>
                ) : (
                  <div className="text-gray-700 p-2 bg-white/60 rounded-md border border-blue-50 mt-1">
                    {Array.isArray(currentVocabWithImage?.definition) ? (
                      // Display multiple definitions if available
                      currentVocabWithImage.definition.map((def, index) => (
                        <p key={index} className="mb-1 text-sm">
                          <span className="font-medium text-blue-600">{index + 1}.</span> {def}
                        </p>
                      ))
                    ) : (
                      // Display a single definition
                      <p className="text-sm">
                        {currentVocabWithImage?.definition || "No definition available yet."}
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Example - Show only one example */}
              <div className="mb-3">
                <div className="info-title flex items-center">
                  <Sparkles className="h-4 w-4 mr-1 text-primary" />
                  Example:
                </div>
                {isLoadingDict ? (
                  <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4"></div>
                ) : (
                  <p className="text-gray-700 italic p-2 bg-white/60 rounded-md border border-blue-50 mt-1">
                    {Array.isArray(currentVocabWithImage?.example) && currentVocabWithImage?.example.length > 0
                      ? `"${currentVocabWithImage.example[0]}"`
                      : typeof currentVocabWithImage?.example === 'string' && currentVocabWithImage.example 
                        ? `"${currentVocabWithImage.example}"`
                        : "No example available yet."
                    }
                  </p>
                )}
              </div>
              
              {/* Synonyms and Antonyms in a 2-column layout */}
              <div className="grid grid-cols-2 gap-3">
                {/* Synonyms */}
                <div>
                  <div className="info-title flex items-center">
                    <span className="mr-1 text-primary">≈</span>
                    Synonyms:
                  </div>
                  {isLoadingDict ? (
                    <div className="flex space-x-1">
                      <div className="h-5 bg-gray-200 animate-pulse rounded w-16"></div>
                      <div className="h-5 bg-gray-200 animate-pulse rounded w-14"></div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {currentVocabWithImage?.synonyms && currentVocabWithImage.synonyms.length > 0 ? 
                        currentVocabWithImage.synonyms.map((syn, idx) => (
                          <Badge key={idx} variant="outline" className="bg-white">
                            {syn}
                          </Badge>
                        )) : 
                        <span className="text-gray-500">No synonyms available yet.</span>
                      }
                    </div>
                  )}
                </div>
                
                {/* Antonyms */}
                <div>
                  <div className="info-title flex items-center">
                    <span className="mr-1 text-red-500">≠</span>
                    Antonyms:
                  </div>
                  {isLoadingDict ? (
                    <div className="flex space-x-1">
                      <div className="h-5 bg-gray-200 animate-pulse rounded w-16"></div>
                      <div className="h-5 bg-gray-200 animate-pulse rounded w-14"></div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {currentVocabWithImage?.antonyms && currentVocabWithImage.antonyms.length > 0 ? 
                        currentVocabWithImage.antonyms.map((ant, idx) => (
                          <Badge key={idx} variant="outline" className="bg-white/80 border-red-100 text-red-600">
                            {ant}
                          </Badge>
                        )) : 
                        <span className="text-gray-500">No antonyms available yet.</span>
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Nút hoàn thành */}
            <Button 
              className="w-full mt-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md hover:shadow-lg transition-all" 
              onClick={() => handleCompleteCard(currentVocabulary.id)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isCompleted ? "Đã hoàn thành" : "Đánh dấu đã học"}
            </Button>
            
            <div className="flip-icon" onClick={handleFlipCard}>
              <Rotate3D className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Thay đổi hàm renderControlButtons để phù hợp với card lật
  const renderControlButtons = () => {
    const isLastCard = currentIndex === (vocabularyData?.vocabulary?.length || 0) - 1;
    
    return (
      <div className="flex justify-center mt-8 gap-4">
        <Button
          variant="outline"
          className="border-blue-200 hover:border-blue-400 shadow-sm hover:shadow bg-white/70 hover:bg-white/90 transition-all"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Trước
        </Button>
        
        <Button 
          variant="outline"
          className="border-blue-200 hover:border-blue-400 shadow-sm hover:shadow bg-white/70 hover:bg-white/90 transition-all"
          onClick={handleFlipCard}
        >
          <Rotate3D className="mr-2 h-4 w-4" />
          Lật thẻ
        </Button>
        
        <Button 
          variant={isLastCard ? "default" : "outline"}
          className={`shadow-md hover:shadow-lg transition-all ${isLastCard 
            ? 'bg-gradient-to-r from-primary to-indigo-600 text-white' 
            : 'border-blue-200 hover:border-blue-400 bg-white/70 hover:bg-white/90'}`}
          onClick={isLastCard ? () => setShowCompleteDialog(true) : handleNext}
        >
          {isLastCard ? (
            <>
              Hoàn thành
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Tiếp
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    );
  };

  // Add fullscreen prompt component
  const FullscreenPrompt = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Yêu cầu chế độ toàn màn hình</h3>
        <p className="text-gray-600 mb-4">
          Để học từ vựng, bạn cần cho phép chế độ toàn màn hình.
          Nhấn nút bên dưới để bắt đầu.
        </p>
        <div className="flex flex-col space-y-3">
        <Button 
          onClick={enableFullscreen}
          className="w-full bg-primary hover:bg-primary/90"
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          Bật chế độ toàn màn hình
        </Button>
          
          <Button 
            variant="outline"
            onClick={() => {
              setHasFullscreenPermission(true);
              setShowFullscreenPrompt(false);
              toast.warning('Đã bỏ qua chế độ toàn màn hình', {
                description: 'Bạn có thể tiếp tục học mà không cần chế độ toàn màn hình.',
              });
            }}
            className="w-full text-gray-500"
          >
            Bỏ qua (không khuyến khích)
        </Button>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Nếu gặp vấn đề, vui lòng kiểm tra cài đặt trình duyệt và cho phép toàn màn hình.
        </p>
      </div>
    </div>
  );

  // Thêm function enableFullscreen để xử lý fullscreen
  const enableFullscreen = () => {
    try {
      if (containerRef.current && containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setHasFullscreenPermission(true);
        setShowFullscreenPrompt(false);
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
        setHasFullscreenPermission(true);
        setShowFullscreenPrompt(false);
      } else {
        // Fallback if fullscreen is not supported
        setHasFullscreenPermission(true);
        setShowFullscreenPrompt(false);
        toast.warning('Trình duyệt của bạn không hỗ trợ chế độ toàn màn hình');
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      setHasFullscreenPermission(true); // Still allow to continue
      setShowFullscreenPrompt(false);
      toast.warning('Không thể kích hoạt chế độ toàn màn hình, bạn vẫn có thể tiếp tục học');
    }
  };

  // Thêm useEffect để lưu ảnh đã chọn khi hoàn thành từ vựng
  useEffect(() => {
    // Khi người dùng đánh dấu đã học xong một từ, lưu ảnh đã chọn
    const currentVocab = currentVocabulary;
    const currentImage = vocabularyWithImages[currentVocab?.id || '']?.selectedImageUrl;
    
    if (currentVocab && currentImage && completedIds.includes(currentVocab.id)) {
      const imageTitle = vocabularyWithImages[currentVocab.id]?.imageResults?.[0]?.title || '';
      saveSelectedImage(currentVocab.id, currentImage, imageTitle);
    }
  }, [completedIds, vocabularyWithImages, currentVocabulary, saveSelectedImage]);

  // Add loading indicator
  if (Object.values(loadingStates).some(loading => loading)) {
    return (
      <StudentLayout hideSidebar={true}>
        <div className="fullscreen-container flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600">Đang tải dữ liệu...</p>
            <div className="space-y-2">
              {loadingStates.vocabularyData && <p className="text-sm text-gray-500">Đang tải danh sách từ vựng...</p>}
              {loadingStates.progressData && <p className="text-sm text-gray-500">Đang tải tiến trình học tập...</p>}
              {loadingStates.audioData && <p className="text-sm text-gray-500">Đang tải file audio...</p>}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout hideSidebar={true}>
      {/* Add style tag for fullscreen and flippable card styles */}
      <style dangerouslySetInnerHTML={{ __html: fullscreenStyles + flippableCardStyles }} />
      
      <div ref={containerRef} className="fullscreen-container">
        <div className="progress-bar-wrapper relative bg-gradient-to-r from-blue-50/90 to-indigo-50/90 py-4 border-b border-blue-100 backdrop-blur-md">
          <div className="absolute inset-0 bg-blue-500/5 backdrop-blur-sm"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-center max-w-4xl mx-auto">
              <div className="flex items-center space-x-1 md:space-x-3 w-full">
                {/* Bước 1: Đánh giá */}
                <div className="flex-1 relative">
                  <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/student/question/${questionId}`)}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">1</span>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Đánh giá</h3>
                      <p className="text-xs text-gray-500">Đã hoàn thành</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                    <div className="h-full w-full bg-primary"></div>
                  </div>
                </div>

                {/* Bước 2: Flashcard - đang hoạt động */}
                <div className="flex-1 relative">
                  <div className="flex items-center">
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">2</span>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Flashcard</h3>
                      <p className="text-xs text-gray-500">Đang thực hiện</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                    <div className="h-full w-1/2 bg-primary"></div>
                  </div>
                </div>

                {/* Bước 3: Luyện tập */}
                <div className="flex-1 relative">
                  <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => allCompleted ? navigate(`/student/vocabulary-practice/${questionId}`) : toast.warning("Bạn cần hoàn thành học từ vựng trước")}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 shadow-md">
                      <span className="font-semibold">3</span>
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-gray-600">Luyện tập</h3>
                      <p className="text-xs text-gray-500">Tiếp theo</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200"></div>
                </div>

                {/* Bước 4: Dictation */}
                <div className="flex-1 relative">
                  <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => allCompleted ? navigate(`/student/question/${questionId}`) : toast.warning("Bạn cần hoàn thành tất cả các bước trước")}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 shadow-md">
                      <span className="font-semibold">4</span>
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-gray-600">Dictation</h3>
                      <p className="text-xs text-gray-500">Kiểm tra</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="content-wrapper">
          <div className="container mx-auto px-2 sm:px-4 py-4 max-w-full sm:max-w-4xl">
            <Card className="backdrop-blur-md bg-white/80 border border-blue-50 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-blue-100/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-70"></div>
              <CardHeader className="relative z-10">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold">
                      Flashcards Từ Vựng
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Học từ vựng trước khi làm bài dictation
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-xs text-gray-500 mb-1">Tiến độ học</div>
                    <Progress 
                      value={calculateCompletionPercentage()} 
                      className="w-32 h-2.5 bg-blue-100" 
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 card-content flashcard-content space-y-6">
                {/* Flashcard hiện tại với hiệu ứng glassmorphism nâng cao */}
                {currentVocabulary ? (
                  <div className="rounded-xl overflow-hidden flex flex-col items-center p-6 my-8 relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 backdrop-blur-sm border border-white/40 rounded-xl shadow-xl group-hover:shadow-blue-200/20 transition-all duration-500"></div>
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
                    
                    <div className="relative w-full z-10">
                      {renderCardContent()}
                      
                      {/* Các nút điều khiển */}
                      {renderControlButtons()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-10">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                    <p>Đang tải từ vựng...</p>
                  </div>
                )}
                
                {/* Thanh tiến trình */}
                <div className="mt-6 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-600">{currentIndex + 1}/{vocabularyData?.vocabulary?.length || 0}</span>
                    <span className="text-xs text-gray-500">({Math.round((currentIndex + 1) / (vocabularyData?.vocabulary?.length || 1) * 100)}% hoàn thành)</span>
                  </div>
                  <Progress 
                    value={currentIndex + 1} 
                    max={vocabularyData?.vocabulary?.length || 1} 
                    className="w-full h-2 bg-blue-100"
                  />
                </div>
              </CardContent>
              
              {/* Hiển thị danh sách từ đã học */}
              <CardFooter className="relative z-10 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 bg-opacity-50 border-t border-blue-100 backdrop-blur-sm">
                <div className="w-full">
                  <h3 className="text-sm font-medium text-gray-600 mb-3">Các từ đã học:</h3>
                  <div className="flex flex-wrap gap-2">
                    {vocabularyData?.vocabulary?.map((item, idx) => (
                      <Badge 
                        key={idx} 
                        variant={idx <= currentIndex ? "default" : "outline"}
                        className={`cursor-pointer transition-all ${
                          idx <= currentIndex 
                            ? 'bg-primary hover:bg-primary/90' 
                            : 'text-gray-400 border-gray-200'
                        } ${idx === currentIndex ? 'ring ring-blue-200 shadow-sm' : ''}`}
                        onClick={() => {
                          setCurrentIndex(idx);
                          setShowMeaning(idx < currentIndex);
                        }}
                      >
                        {item.word}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Nút chuyển trang nổi bật khi hoàn thành tất cả từ vựng */}
        {allCompleted && (
          <div className="fixed bottom-10 right-10 z-50 transition-all duration-500 animate-bounce-slow">
            <div className="relative">
              {/* Hiệu ứng phát sáng */}
              <div className="absolute -inset-2 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-full opacity-75 blur-md animate-pulse"></div>
              
              <Button
                size="lg"
                onClick={handleFinishFlashcards}
                className="relative bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-bold py-3 px-6 rounded-full shadow-xl transition-all duration-300 hover:shadow-indigo-400/50 group"
              >
                <span className="text-yellow-300 mr-2">✨</span>
                <span className="mr-1">Luyện tập nghe và gõ từ</span>
                <span className="ml-1 group-hover:translate-x-1 transition-transform inline-block">→</span>
              </Button>

              {/* Badge thông báo */}
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                Sẵn sàng!
              </span>
            </div>
          </div>
        )}

        {/* Dialog xác nhận hoàn thành */}
        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent className="sm:max-w-md backdrop-blur-lg bg-white/90">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-70 rounded-lg"></div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold text-center">Chúc mừng! Bạn đã hoàn thành!</DialogTitle>
              <div className="flex justify-center my-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center mb-2 shadow-inner border border-green-200 relative">
                  <Check className="h-12 w-12 text-green-600" />
                  <div className="absolute -inset-1 bg-green-500/10 rounded-full blur-sm animate-pulse"></div>
                </div>
              </div>
              <DialogDescription asChild>
                <div className="text-center">
                  <div className="text-gray-700">
                    <p>Bạn đã hoàn thành việc học tất cả từ vựng. Bước tiếp theo là luyện tập nghe và gõ từ.</p>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">
                      Thời gian học: <span className="font-medium">{formatStudyTime(studyTime)}</span>
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      Tổng cộng: <span className="font-medium">{vocabularyData?.vocabulary?.length || 0}</span> từ vựng
                    </p>
                    <p className="text-xs text-green-600">
                      Hoàn thành bước 2/4: Flashcard từ vựng
                    </p>
                  </div>
                  <div className="mt-4 p-2 bg-blue-50/70 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-700">Bạn sẽ nghe bài đọc và điền từ còn thiếu vào chỗ trống.</p>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="relative z-10">
              <Button variant="outline" onClick={() => setShowCompleteDialog(false)} className="border-blue-200">
                Học lại
              </Button>
              <Button className="bg-gradient-to-r from-primary to-indigo-600 shadow-md hover:shadow-xl transition-shadow" onClick={handleFinishFlashcards}>
                Tiếp tục luyện tập
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StudentLayout>
  );
};

// Thêm vào cuối file để hỗ trợ animation
const style = document.createElement('style');
style.textContent = `
  @keyframes bounce-slow {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }
  .animate-bounce-slow {
    animation: bounce-slow 3s ease-in-out infinite;
  }
`;
document.head.appendChild(style);

export default VocabularyFlashcards; 