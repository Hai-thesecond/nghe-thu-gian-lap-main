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
import { ArrowLeft, Book, CheckCircle2, Check, ArrowRight, Loader2, Sparkles, Image as ImageIcon, Rotate3D, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import StudentLayout from '@/layouts/StudentLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VocabularyItem } from '@/components/vocabulary/FlashCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useVisibilityRefresh from '@/hooks/useVisibilityRefresh';
import { handleApiRequest } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/events';
import { setCache, getCache, createCacheKey, CACHE_DURATIONS } from '@/lib/storage';

// Add custom CSS for fullscreen mode
const fullscreenStyles = `
  .fullscreen-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
    overflow-x: hidden;
    overflow-y: hidden;
    width: 100%;
    padding: 0.5rem;
  }

  .fullscreen-container .content-wrapper .container {
    width: 100%;
    max-width: 100%;
    padding: 0 0.5rem;
  }

  .fullscreen-container .content-wrapper .card-content {
    overflow: visible;
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
  }
`;

// Add custom CSS for flippable card
const flippableCardStyles = `
  .flip-card-container {
    perspective: 1000px;
    width: 100%;
    height: auto;
    min-height: 450px;
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
    min-height: 450px;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    border-radius: 1rem;
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
    overflow: visible;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding-bottom: 4rem;
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
    height: 280px;
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
    max-width: 260px;
    height: 180px;
  }
  
  .image-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .vocabulary-main {
    font-size: 3rem;
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
      font-size: 2.5rem;
      text-align: center;
    }
    
    .image-container {
      max-width: 240px;
      height: 180px;
      margin-bottom: 1rem;
    }
    
    .additional-info-section {
      padding: 0.75rem;
    }
  }
`;

// Extend VocabularyItem với các trường mới
interface ExtendedVocabularyItem extends VocabularyItem {
  definition?: string;
  example?: string | string[];
  synonyms?: string[];
  antonyms?: string[];
}

const VocabularyFlashcards = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    vocabularyData: true,
    progressData: true
  });

  // Define fetch function for vocabulary data
  const fetchVocabularyData = useCallback(async () => {
    if (!questionId || !user) return null;
    
    try {
      setLoadingStates(prev => ({...prev, vocabularyData: true}));
      
      // Create cache keys
      const cacheKey = createCacheKey('vocabulary', questionId);
      
      // Check for cached data first - ALWAYS USE CACHE DATA IF AVAILABLE
      const cachedData = getCache(cacheKey);
      
      // Set a timeout to force reset loading state after 5 seconds
      const loadingTimeout = setTimeout(() => {
        console.log('Vocabulary data loading timeout reached - forcing loading state reset');
        setLoadingStates(prev => ({...prev, vocabularyData: false}));
      }, 5000);
      
      if (cachedData) {
        console.log('Using cached vocabulary data');
        clearTimeout(loadingTimeout); // Clear the timeout since we have data
        setLoadingStates(prev => ({...prev, vocabularyData: false}));
        
        // Still fetch progress data but don't block UI
        fetchProgressData().catch(err => console.error('Background progress data fetch error:', err));
        
        return cachedData;
      }
      
      // Fetch question data using handleApiRequest for automatic session refresh
      const { data: question, error: questionError } = await handleApiRequest(() => 
        supabase
          .from('questions')
          .select('title')
          .eq('id', questionId)
          .single()
      );
      
      clearTimeout(loadingTimeout); // Clear the timeout

      if (questionError) throw questionError;
      
      // Fetch vocabulary items using handleApiRequest
      const { data: vocabulary, error: vocabularyError } = await handleApiRequest(() => 
        supabase
          .from('vocabulary_items')
          .select(`
            *,
            vocabulary_images(image_url, tags)
          `)
          .eq('question_id', questionId)
          .order('created_at', { ascending: true })
      );
      
      if (vocabularyError) throw vocabularyError;
      
      // Fetch user progress
      await fetchProgressData();
      
      // Process vocabulary to use images from vocabulary_images if available
      const processedVocabulary = vocabulary?.map(item => {
        // Use image from vocabulary_images if available
        const preferredImage = 
          Array.isArray(item.vocabulary_images) && item.vocabulary_images.length > 0 
            ? item.vocabulary_images[0].image_url 
            : item.image_url;
            
        return {
          ...item,
          image_url: preferredImage
        };
      });
      
      const result = {
        question,
        vocabulary: processedVocabulary
      };
      
      // Cache the data using our storage utility
      setCache(cacheKey, result, { 
        expiration: CACHE_DURATIONS.LONG // Cache for 4 hours
      });
      
      setLoadingStates(prev => ({...prev, vocabularyData: false}));
      return result;
    } catch (error) {
      console.error('Error fetching vocabulary data:', error);
      toast.error('Không thể tải dữ liệu. Vui lòng thử lại sau.');
      setLoadingStates(prev => ({...prev, vocabularyData: false}));
      
      // Attempt to return cached data even in case of error
      const cacheKey = createCacheKey('vocabulary', questionId);
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        console.log('Using cached data after fetch error');
        return cachedData;
      }
      
      // Create a minimal empty result to prevent UI from breaking
      return {
        question: { title: 'Đang tải...' },
        vocabulary: []
      };
    }
  }, [questionId, user]);
  
  // Separate function to fetch progress data
  const fetchProgressData = async () => {
    if (!user || !questionId) return;
    
    try {
      setLoadingStates(prev => ({...prev, progressData: true}));
      
      // Safety timeout to ensure loading state is reset
      const loadingTimeout = setTimeout(() => {
        console.log('Progress data loading timeout reached - forcing loading state reset');
        setLoadingStates(prev => ({...prev, progressData: false}));
      }, 3000);
      
      // Create progress cache key
      const progressCacheKey = createCacheKey('vocabulary_progress', `${user.id}_${questionId}`);
      const cachedProgress = getCache<string[]>(progressCacheKey);
      
      if (cachedProgress) {
        console.log('Using cached progress data');
        clearTimeout(loadingTimeout);
        setCompletedIds(cachedProgress);
        setLoadingStates(prev => ({...prev, progressData: false}));
        return;
      }
      
      const { data: progress, error: progressError } = await handleApiRequest(() => 
        supabase
          .from('vocabulary_progress')
          .select('vocabulary_id, flashcard_completed')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
      );
      
      clearTimeout(loadingTimeout);
      
      if (!progressError && progress) {
        const completed = progress
          .filter(p => p.flashcard_completed)
          .map(p => p.vocabulary_id);
        
        setCompletedIds(completed);
        
        // Cache the progress data with a shorter expiration (more likely to change)
        setCache(progressCacheKey, completed, { 
          expiration: CACHE_DURATIONS.SHORT // Cache for 5 minutes
        });
      }
      
      setLoadingStates(prev => ({...prev, progressData: false}));
    } catch (error) {
      console.error('Error fetching progress data:', error);
      // Force reset loading state on error
      setLoadingStates(prev => ({...prev, progressData: false}));
      
      // Try to recover cached progress data in case of error
      const progressCacheKey = createCacheKey('vocabulary_progress', `${user.id}_${questionId}`);
      const cachedProgress = getCache<string[]>(progressCacheKey);
      if (cachedProgress) {
        console.log('Using cached progress data after fetch error');
        setCompletedIds(cachedProgress);
      }
    }
  };

  // Use React Query with optimized caching
  const { data: vocabularyData, isLoading, error, refetch } = useQuery({
    queryKey: ['vocabulary', questionId, user?.id],
    queryFn: fetchVocabularyData,
    enabled: !!questionId && !!user,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 60 * 60 * 1000, // Keep inactive data cached for 1 hour (formerly cacheTime)
    refetchOnWindowFocus: false, // Disable automatic refetch on window focus
    placeholderData: (oldData) => oldData, // Keep showing previous data while fetching new data
  });

  // Use visibility refresh hook with a null callback to disable automatic refreshes
  // We'll handle refreshes manually in the global event handler
  useVisibilityRefresh(
    null, // Disable automatic refreshes on visibility change
    60000, // 1 minute minimum time away
    [questionId, user],
    process.env.NODE_ENV === 'development' // Enable debug mode in development
  );

  // Listen for global data refresh events with debounce
  useEffect(() => {
    let isRefreshing = false;
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 60000; // 1 minute minimum between refreshes
    
    const handleDataRefresh = () => {
      const now = Date.now();
      
      // Check if data is already loading
      if (isLoading) {
        console.log('VocabularyFlashcards - Skipping global refresh (already loading)');
        return;
      }
      
      // Check if enough time has passed since last refresh
      if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        console.log('VocabularyFlashcards - Skipping global refresh (too soon)');
        return;
      }
      
      if (!isRefreshing) {
        console.log('VocabularyFlashcards - Global data refresh event received');
        isRefreshing = true;
        lastRefreshTime = now;
        
        // Use React Query's refetch which preserves previous data while loading
        refetch().finally(() => {
          isRefreshing = false;
        });
      }
    };
    
    window.addEventListener(EVENT_TYPES.DATA_REFRESH_NEEDED, handleDataRefresh);
    
    // Initialize lastRefreshTime from localStorage if available
    const storedTime = localStorage.getItem('vocabulary_last_refresh');
    if (storedTime) {
      lastRefreshTime = parseInt(storedTime, 10);
    }
    
    return () => {
      window.removeEventListener(EVENT_TYPES.DATA_REFRESH_NEEDED, handleDataRefresh);
      // Save last refresh time to localStorage
      localStorage.setItem('vocabulary_last_refresh', lastRefreshTime.toString());
    };
  }, [refetch, isLoading]);

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
      // Check for existing progress using handleApiRequest
      const { data: existingProgress } = await handleApiRequest(() => 
        supabase
          .from('vocabulary_progress')
          .select('id')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .eq('vocabulary_id', vocabId)
          .maybeSingle()
      );
      
      if (existingProgress) {
        // Update existing record using handleApiRequest
        await handleApiRequest(() => 
          supabase
            .from('vocabulary_progress')
            .update({
              flashcard_completed: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProgress.id)
        );
      } else {
        // Create new record using handleApiRequest
        await handleApiRequest(() => 
          supabase
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
            })
        );
      }
      
      // Update state
      setCompletedIds(prev => [...prev, vocabId]);
      
      // Move to next card
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

  // Lật thẻ
  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  // Thay đổi renderCardContent để sử dụng bố cục card lật
  const renderCardContent = () => {
    if (!currentVocabulary) return <div className="flex justify-center items-center h-full">Loading...</div>;
    
    const isCompleted = completedIds.includes(currentVocabulary.id);
    
    // Helper function to check if definition is same as any synonym
    const isDefinitionSameAsSynonyms = () => {
      if (!currentVocabulary.definition || !currentVocabulary.synonyms) return false;
      
      const definition = currentVocabulary.definition.toLowerCase().trim();
      let synonymsList: string[] = [];
      
      if (Array.isArray(currentVocabulary.synonyms)) {
        synonymsList = currentVocabulary.synonyms.map(s => s.toLowerCase().trim());
      } else if (typeof currentVocabulary.synonyms === 'string') {
        synonymsList = currentVocabulary.synonyms.split(',').map(s => s.toLowerCase().trim());
      }
      
      // Chỉ kiểm tra nếu definition chính xác trùng khớp với bất kỳ synonym nào
      return synonymsList.includes(definition);
    };
    
    // Helper function to get appropriate definition
    const getDefinition = () => {
      const word = currentVocabulary.word?.toLowerCase() || '';
      
      // Log để kiểm tra
      console.log("Definition check:", {
        word: currentVocabulary.word,
        definition: currentVocabulary.definition,
        synonyms: currentVocabulary.synonyms,
        isSameAsSynonyms: isDefinitionSameAsSynonyms()
      });
      
      // Special cases for specific words
      if (word === 'academic journals' || word === 'academic journal') {
        return "Publications containing scholarly research articles written by academics, researchers and experts in specific fields";
      }
      
      // If definition exists and is not the same as any synonym, use it
      if (currentVocabulary.definition && !isDefinitionSameAsSynonyms()) {
        return currentVocabulary.definition;
      }
      
      // Otherwise, generate an appropriate definition based on word type
      const partOfSpeech = currentVocabulary.part_of_speech?.toLowerCase() || '';
      
      if (partOfSpeech.includes('noun')) {
        return `A type of ${word} commonly used in academic and educational contexts`;
      } else if (partOfSpeech.includes('verb')) {
        return `The action of ${word} typically performed in educational or professional settings`;
      } else if (partOfSpeech.includes('adj')) {
        return `Having qualities or characteristics that are ${word}`;
      } else if (partOfSpeech.includes('adv')) {
        return `In a manner that is ${word}`;
      }
      
      // Default fallback
      return `A term referring to ${word} used in academic contexts`;
    };
    
    return (
      <div className="flip-card-container">
        <div className={`flip-card ${isFlipped ? 'flipped' : ''}`}>
          {/* Mặt trước: hiển thị văn bản bên trái, ảnh to bên phải */}
          <div className="flip-card-front">
            {/* Phần văn bản bên trái */}
            <div className="text-container">
              {/* Từ vựng lớn */}
              <div className="vocabulary-main">{currentVocabulary.word}</div>
              
              {/* Từ loại */}
              <div className="controls-row">
                <div className="part-of-speech">
                  {currentVocabulary.part_of_speech || '(không xác định)'}
                </div>
              </div>
              
              <div className="flip-hint text-blue-500 text-sm animate-pulse flex items-center">
                <RotateCcw className="h-4 w-4 mr-1" />
                Nhấn để xem nghĩa và thông tin thêm
              </div>
            </div>
            
            {/* Ảnh lớn bên phải */}
            <div className="image-container relative">
              {currentVocabulary.image_url ? (
                <img 
                  src={currentVocabulary.image_url} 
                    alt={currentVocabulary.word}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=No+Image';
                    }}
                  />
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
          
          {/* Mặt sau: hiển thị nghĩa và thông tin bổ sung */}
          <div className="flip-card-back">
            {/* Hình ảnh */}
            <div className="image-container back relative">
              {currentVocabulary.image_url ? (
                <img 
                  src={currentVocabulary.image_url} 
                    alt={currentVocabulary.word}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/300x200?text=No+Image';
                    }}
                  />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}
          </div>
          
            {/* Nghĩa tiếng Việt */}
            <div className="meaning-vi w-full text-center mb-2">
              {currentVocabulary.meaning_vi || "Chưa có nghĩa tiếng Việt"}
            </div>
            
            {/* Thông tin bổ sung */}
            <div className="additional-info-section">
              <div className="grid grid-cols-1 gap-2">
              {/* Definition */}
                <div className="mb-2">
                <div className="info-title flex items-center">
                  <Book className="h-4 w-4 mr-1 text-primary" />
                  Definition:
                </div>
                  <div className="text-gray-700 p-2 bg-white/60 rounded-md border border-blue-50 mt-1">
                      <p className="text-sm">
                      {getDefinition()}
                      </p>
                  </div>
              </div>
              
                {/* Example */}
                <div className="mb-2">
                <div className="info-title flex items-center">
                  <Sparkles className="h-4 w-4 mr-1 text-primary" />
                  Example:
                </div>
                  <p className="text-gray-700 italic p-2 bg-white/60 rounded-md border border-blue-50 mt-1 text-sm">
                    {Array.isArray(currentVocabulary.example) && currentVocabulary.example.length > 0
                      ? `"${currentVocabulary.example[0]}"`
                      : typeof currentVocabulary.example === 'string' && currentVocabulary.example 
                        ? `"${currentVocabulary.example}"`
                        : "No example available."
                    }
                  </p>
                </div>
              </div>
              
              {/* Synonyms and Antonyms in a 2-column layout */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {/* Synonyms */}
                <div>
                  <div className="info-title flex items-center">
                    <span className="mr-1 text-primary">≈</span>
                    Synonyms:
                  </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                    {currentVocabulary.synonyms && 
                     (Array.isArray(currentVocabulary.synonyms) ? 
                      currentVocabulary.synonyms.length > 0 : 
                      typeof currentVocabulary.synonyms === 'string' && currentVocabulary.synonyms.length > 0) ? 
                      (Array.isArray(currentVocabulary.synonyms) ? 
                        currentVocabulary.synonyms : 
                        (currentVocabulary.synonyms as string).split(',')
                      ).map((syn, idx) => (
                        <Badge key={idx} variant="outline" className="bg-white text-xs">
                          {syn.trim()}
                          </Badge>
                        )) : 
                      <span className="text-gray-500 text-xs">No synonyms available.</span>
                      }
                    </div>
                </div>
                
                {/* Antonyms */}
                <div>
                  <div className="info-title flex items-center">
                    <span className="mr-1 text-red-500">≠</span>
                    Antonyms:
                  </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                    {currentVocabulary.antonyms && 
                     (Array.isArray(currentVocabulary.antonyms) ? 
                      currentVocabulary.antonyms.length > 0 : 
                      typeof currentVocabulary.antonyms === 'string' && currentVocabulary.antonyms.length > 0) ? 
                      (Array.isArray(currentVocabulary.antonyms) ? 
                        currentVocabulary.antonyms : 
                        (currentVocabulary.antonyms as string).split(',')
                      ).map((ant, idx) => (
                        <Badge key={idx} variant="outline" className="bg-white/80 border-red-100 text-red-600 text-xs">
                          {ant.trim()}
                          </Badge>
                        )) : 
                      <span className="text-gray-500 text-xs">No antonyms available.</span>
                      }
                    </div>
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

  // Global safety net to reset any stuck loading states
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (loadingStates.vocabularyData || loadingStates.progressData) {
        console.log('SAFETY: Force resetting stuck loading states after timeout');
        setLoadingStates({
          vocabularyData: false,
          progressData: false
        });
      }
    }, 10000); // 10 seconds safety timeout
    
    return () => clearTimeout(safetyTimeout);
  }, [loadingStates]);
  
  // Render a simplified view when there's cached data but still loading
  if ((isLoading || loadingStates.vocabularyData) && vocabularyData) {
    return (
      <StudentLayout>
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Từ vựng: {vocabularyData.question?.title || 'Đang tải...'}</CardTitle>
                  <CardDescription>Đang tải dữ liệu cập nhật...</CardDescription>
                </div>
                <Button variant="outline" onClick={() => navigate(`/student/question/${questionId}`)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Quay lại
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                  <p>Đang cập nhật dữ liệu...</p>
                  <p className="text-sm text-muted-foreground mt-2">Hiển thị dữ liệu đã lưu trong bộ nhớ đệm</p>
                  <Button 
                    variant="link" 
                    className="mt-4"
                    onClick={() => {
                      setLoadingStates({
                        vocabularyData: false,
                        progressData: false
                      });
                    }}
                  >
                    Hiển thị ngay với dữ liệu đã lưu
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </StudentLayout>
    );
  }

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