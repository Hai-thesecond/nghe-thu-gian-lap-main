import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent,  
  CardHeader, 
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Headphones, AlertCircle, Check, ArrowRight, Clock, RotateCcw, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StudentLayout from '@/layouts/StudentLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import VocabularyPracticeItem from '@/components/vocabulary/VocabularyPracticeItem';
import { VocabularyItem } from '@/components/vocabulary/FlashCard';

interface VocabularyWithProgress extends VocabularyItem {
  listening_practice_completed?: boolean;
}

const COOLDOWN_TIME_MS = 2 * 60 * 1000; // 2 minutes in milliseconds

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
  .practice-content {
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

const VocabularyPractice = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [vocabularyList, setVocabularyList] = useState<VocabularyWithProgress[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [remainingCooldown, setRemainingCooldown] = useState(0);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [cooldownInterval, setCooldownInterval] = useState<NodeJS.Timeout | null>(null);
  const [allMeanings, setAllMeanings] = useState<string[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Anti-cheating related states
  const [cheatingAttempts, setCheatingAttempts] = useState(0);
  const [cheatingMessage, setCheatingMessage] = useState('');
  const [showAntiCheatingWarning, setShowAntiCheatingWarning] = useState(false);
  // Timer for redirection after cheating detection
  const [redirectTimer, setRedirectTimer] = useState(60);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Thêm state để theo dõi lịch sử gian lận của học sinh
  const [studentCheatingHistory, setStudentCheatingHistory] = useState({
    totalCheatingCount: 0,
    questionCheatingCount: 0,
    maxAllowedCheating: 7,
    isAccountLocked: false
  });

  // Loại bỏ state về fullscreen và notification
  const [loadingStates, setLoadingStates] = useState({
    vocabularyData: true,
    progressData: true,
    audioData: true
  });
  
  // State to track flashcard completion validation
  const [isCheckingPreviousStep, setIsCheckingPreviousStep] = useState(true);
  
  // Check if user has completed the flashcard step (step 2) before allowing access
  useEffect(() => {
    if (!user?.id || !questionId) return;
    
    const validateFlashcardCompletion = async () => {
      try {
        setIsCheckingPreviousStep(true);
        console.log('Bắt đầu kiểm tra tiến trình học flashcard...');
        
        // Check if flashcard step is completed by checking vocabulary_progress table
        const { data: vocabProgress, error: vocabError } = await supabase
          .from('vocabulary_progress')
          .select('vocabulary_id, flashcard_completed')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .eq('flashcard_completed', true);
          
        if (vocabError) {
          console.error('Error checking flashcard completion:', vocabError);
          setIsCheckingPreviousStep(false);
          toast.error('Không thể kiểm tra tiến trình học flashcard, vui lòng thử lại sau.', {
            duration: 3000
          });
          return;
        }
        
        // Count total vocabulary items for this question
        const { data: vocabularyItems, error: vocabularyError } = await supabase
          .from('vocabulary_items')
          .select('id')
          .eq('question_id', questionId);
          
        if (vocabularyError) {
          console.error('Error fetching vocabulary items:', vocabularyError);
          setIsCheckingPreviousStep(false);
          toast.error('Không thể tải danh sách từ vựng, vui lòng thử lại sau.', {
            duration: 3000
          });
          return;
        }
        
        const totalVocab = vocabularyItems?.length || 0;
        const completedFlashcards = vocabProgress?.length || 0;
        
        console.log(`Đã học flashcard: ${completedFlashcards}/${totalVocab} từ vựng`);
        
        // Ghi log cụ thể để dễ dàng debug
        if (vocabProgress && vocabProgress.length > 0) {
          console.log('Các từ vựng đã hoàn thành flashcard:', vocabProgress.map(p => p.vocabulary_id));
        }
        
        if (vocabularyItems && vocabularyItems.length > 0) {
          console.log('Tổng số từ vựng cần học:', vocabularyItems.map(v => v.id));
        }
        
        // If user hasn't completed flashcards or there are no completed flashcards, redirect back
        if (totalVocab > 0 && (completedFlashcards === 0 || completedFlashcards < totalVocab)) {
          console.log('Chưa hoàn thành bước flashcard, chuyển hướng về trang flashcard...');
          toast.warning('Bạn cần học đầy đủ từ vựng ở bước flashcard trước khi làm bài luyện tập', {
            duration: 5000
          });
          
          // Redirect back to flashcards after a short delay
          setTimeout(() => {
            navigate(`/student/vocabulary-flashcards/${questionId}`);
          }, 2000);
        } else {
          console.log('Đã hoàn thành bước flashcard, tiếp tục bước luyện tập...');
        }
        
        setIsCheckingPreviousStep(false);
      } catch (error) {
        console.error('Error validating flashcard completion:', error);
        setIsCheckingPreviousStep(false);
        toast.error('Đã xảy ra lỗi khi kiểm tra tiến trình học từ vựng', {
          duration: 3000
        });
      }
    };
    
    validateFlashcardCompletion();
  }, [user?.id, questionId, navigate]);

  // Kiểm tra lịch sử gian lận của học sinh khi component mount
  useEffect(() => {
    if (!user?.id || !questionId) return;
    
    const fetchCheatingHistory = async () => {
      try {
        // Lấy thông tin gian lận từ bảng profiles cho tổng số lần vi phạm
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('total_cheating_count, cheating_locked')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Lỗi khi kiểm tra trạng thái khóa tài khoản:', profileError);
          return;
        }
        
        // Đặt thông tin tổng số lần vi phạm từ profiles
        const globalCheatingCount = profileData.total_cheating_count || 0;
        const isAccountLocked = profileData.cheating_locked || false;
        
        // Đếm số bản ghi có cheating_attempts > 0
        const { count, error: countError } = await supabase
          .from('student_answers')
          .select('id', { count: 'exact' })
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .gt('cheating_attempts', 0);
        
        if (countError) {
          console.error('Lỗi khi đếm lịch sử gian lận:', countError);
          return;
        }
        
        let questionCheatingCount = count || 0;
        
        console.log('Lịch sử gian lận cho bài tập này:', {
          questionId,
          questionCheatingCount,
          globalCheatingCount,
          isAccountLocked
        });
        
        // Cập nhật state với cả số lần vi phạm toàn cục và số lần vi phạm của bài tập cụ thể
        setStudentCheatingHistory({
          totalCheatingCount: globalCheatingCount,
          questionCheatingCount: questionCheatingCount,
          maxAllowedCheating: 7,
          isAccountLocked: isAccountLocked
        });
        
        // Cập nhật số lần đã vi phạm trong state cheatingAttempts
        setCheatingAttempts(questionCheatingCount);
        
        // Nếu tài khoản đã bị khóa, hiển thị thông báo và chuyển về trang chủ
        if (isAccountLocked) {
          toast.error('Tài khoản của bạn đã bị khóa do vi phạm quy chế thi nhiều lần', {
            duration: 5000,
          });
          setTimeout(() => {
            navigate('/student/dashboard');
          }, 3000);
        }
        
      } catch (err) {
        console.error('Lỗi khi kiểm tra lịch sử gian lận:', err);
      }
    };
    
    fetchCheatingHistory();
  }, [user?.id, questionId, navigate]);

  // New function to handle mouse leave detection
  const handleMouseLeave = useCallback(() => {
    handleCheatingAttempt('Di chuyển chuột ra khỏi cửa sổ');
  }, []);

  // New function to handle visibility change (tab switching)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      handleCheatingAttempt('Chuyển sang tab khác');
      }
  }, []);

  // Function to reset interactions after returning to focus
  const resetInteractions = () => {
    // Re-focus relevant elements or reset UI state if needed
    const interactiveElement = document.querySelector('.practice-content input, .practice-content button') as HTMLElement;
    if (interactiveElement) {
      setTimeout(() => {
        interactiveElement.focus();
      }, 500);
    }
  };

  // Centralized function to handle cheating attempts
  const handleCheatingAttempt = (reason: string) => {
    // Cập nhật UI state ngay lập tức
    setCheatingMessage(`Cảnh báo: Hệ thống đã phát hiện hành vi gian lận (${reason}). 
      Bài thi sẽ bị hủy ngay lập tức theo quy định.`);
    
    // Record cheating attempt in database
    if (user?.id && questionId) {
      // Lấy dữ liệu mới nhất từ profile trước khi cập nhật
      supabase
        .from('profiles')
        .select('total_cheating_count')
        .eq('id', user.id)
        .single()
        .then(({ data: profileData, error: profileError }) => {
          if (profileError) {
            console.error('Lỗi khi lấy tổng số lần gian lận:', profileError);
            return;
          }
          
          // Tính toán giá trị mới nhất dựa trên dữ liệu từ database
          const currentTotalCheating = profileData?.total_cheating_count || 0;
          const newTotalCheating = currentTotalCheating + 1;
          
          console.log('Dữ liệu profile trước khi cập nhật:', {
            currentTotalCheating,
            newTotalCheating
          });
          
          // Lấy số lần thử hiện tại trước khi tạo một bản ghi mới
      supabase
        .from('student_answers')
            .select('attempt_count, cheating_attempts')
            .eq('student_id', user.id)
            .eq('question_id', questionId)
            .order('attempt_count', { ascending: false })
            .limit(1)
            .then(({ data, error }) => {
              if (error) {
                console.error('Lỗi khi lấy số lần thử hiện tại:', error);
                return;
              }
              
              // Tính toán attempt_count mới (lấy giá trị lớn nhất + 1)
              const currentMaxAttempt = data && data.length > 0 ? data[0].attempt_count : 0;
              const newAttemptCount = currentMaxAttempt + 1;
              
              // Tạo bản ghi mới cho mỗi lần vi phạm với attempt_count tăng dần
              supabase
                .from('student_answers')
                .insert({
                  student_id: user.id,
                  question_id: questionId,
                  attempt_count: newAttemptCount,
                  cheating_attempts: 1, // Luôn đặt là 1 vì đây là bản ghi mới cho 1 lần vi phạm
                  is_completed: true, // Đánh dấu đã hoàn thành (nhưng là do gian lận)
                  completed_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  metadata: {
                    terminated_reason: `Gian lận: ${reason}`,
                    terminated_at: new Date().toISOString()
                  }
                })
                .then(({ error: insertError }) => {
                  if (insertError) {
                    console.error('Error recording cheating attempt:', insertError);
                  } else {
                    console.log('Đã lưu bản ghi vi phạm mới vào cơ sở dữ liệu với attempt_count =', newAttemptCount);
                    
                    // Luôn cập nhật tổng số lần gian lận trong profiles bất kể từ phần nào
                    supabase
                      .from('profiles')
        .update({
                        total_cheating_count: newTotalCheating,
                        cheating_locked: newTotalCheating >= 7
                      })
                      .eq('id', user.id)
                      .then(({ error: updateError }) => {
                        if (updateError) {
                          console.error('Lỗi khi cập nhật tổng số lần gian lận trong profiles:', updateError);
                        } else {
                          console.log('Đã cập nhật tổng số lần gian lận trong profiles:', newTotalCheating);
                          
                          // Đọc lại dữ liệu mới nhất sau khi đã cập nhật
                          supabase
                            .from('profiles')
                            .select('total_cheating_count, cheating_locked')
                            .eq('id', user.id)
                            .single()
                            .then(({ data: updatedProfile, error: readError }) => {
                              if (readError) {
                                console.error('Lỗi khi đọc lại dữ liệu từ profiles:', readError);
                              } else {
                                console.log('Dữ liệu mới từ profiles sau khi cập nhật:', updatedProfile);
                                
                                // Cập nhật state với dữ liệu mới nhất từ database
                                setStudentCheatingHistory(prev => ({
                                  ...prev,
                                  totalCheatingCount: updatedProfile?.total_cheating_count || 0,
                                  isAccountLocked: updatedProfile?.cheating_locked || false
                                }));
                              }
                            });
                        }
                      });
                    
                    // Sau khi lưu xong bản ghi, lấy số lần vi phạm mới nhất từ cơ sở dữ liệu
                    supabase
                      .from('student_answers')
                      .select('id', { count: 'exact' })
                      .eq('student_id', user.id)
                      .eq('question_id', questionId)
                      .gt('cheating_attempts', 0)
                      .then(({ count, error: countError }) => {
                        if (countError) {
                          console.error('Lỗi khi đếm số lần vi phạm mới:', countError);
                          return;
                        }
                        
                        const questionCheatingCount = count || 0;
                        console.log('Tổng số lần vi phạm cho bài tập này:', questionCheatingCount);
                        
                        // Cập nhật state với số lần vi phạm mới nhất
                        setCheatingAttempts(questionCheatingCount);
                        
                        // Cập nhật state studentCheatingHistory với số lần vi phạm mới
                        setStudentCheatingHistory(prev => ({
                          ...prev,
                          questionCheatingCount: questionCheatingCount
                        }));
                        
                        // Hiển thị cảnh báo sau khi đã cập nhật đủ dữ liệu
                        setShowAntiCheatingWarning(true);
                        
                        // Kết thúc bài thi ngay lập tức
                        resetTest(reason);
                      });
                  }
                });
            });
        });
    } else {
      // Nếu không có user hoặc questionId, vẫn hiển thị cảnh báo
      setShowAntiCheatingWarning(true);
      resetTest(reason);
    }
  };

  // New function to reset the test after max cheating attempts
  const resetTest = (reason = '') => {
    // Clean up
    if (cooldownInterval) {
      clearInterval(cooldownInterval);
    }
    
    // Show error message
    toast.error(`Bài làm đã bị hủy do phát hiện hành vi gian lận: ${reason}`, {
      duration: 5000,
    });
    
    // Start the redirect timer
    setRedirectTimer(60); // 60 seconds countdown
    
    // Clear any existing timer
    if (redirectTimerRef.current) {
      clearInterval(redirectTimerRef.current);
    }
    
    // Setup the countdown timer
    redirectTimerRef.current = setInterval(() => {
      setRedirectTimer(prev => {
        if (prev <= 1) {
          // When timer reaches zero, navigate back
          if (redirectTimerRef.current) {
            clearInterval(redirectTimerRef.current);
            redirectTimerRef.current = null;
          }
      navigate(`/student/question/${questionId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Navigate back to the question page after a delay
    // This is now handled by the timer
  };

  // Setup anti-cheating event listeners
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    // Xử lý khi cửa sổ focus
    const handleWindowFocus = () => {
        resetInteractions();
    };
    
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [handleVisibilityChange, handleMouseLeave]);

  // Cleanup timers when component unmounts
  useEffect(() => {
    return () => {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
      }
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  // Fetch question anti-cheating settings
  useEffect(() => {
    if (questionId && user) {
      // Try to get question settings including anti-cheating settings
      supabase
        .from('questions')
        .select('max_cheating_attempts, enable_anti_cheating')
        .eq('id', questionId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            // Không cần set max_cheating_attempts vì chúng ta đã thay đổi cơ chế để hủy bài ngay lập tức
            // nên loại bỏ dòng code này
          }
        });
    }
  }, [questionId, user]);

  // Kiểm tra thời gian cooldown khi component mount
  useEffect(() => {
    if (!user || !questionId) return;
    
    const checkCooldown = async () => {
      try {
        // Lấy timestamp lần cuối thất bại từ localStorage
        const lastFailKey = `vocab_practice_fail_${user.id}_${questionId}`;
        const lastFailTime = localStorage.getItem(lastFailKey);
        
        if (lastFailTime) {
          const lastFailTimestamp = parseInt(lastFailTime, 10);
          const currentTime = new Date().getTime();
          const timeSinceFail = currentTime - lastFailTimestamp;
          
          if (timeSinceFail < COOLDOWN_TIME_MS) {
            // Vẫn trong thời gian cooldown
            const remaining = COOLDOWN_TIME_MS - timeSinceFail;
            setRemainingCooldown(remaining);
            setIsOnCooldown(true);
            startCooldownTimer(remaining);
          }
        }
      } catch (error) {
        console.error("Error checking cooldown:", error);
      }
    };
    
    checkCooldown();
    
    // Cleanup
    return () => {
      if (cooldownInterval) {
        clearInterval(cooldownInterval);
      }
    };
  }, [user, questionId]);

  // Fetch thông tin bài học và từ vựng
  const { data: vocabularyData, isLoading, error } = useQuery({
    queryKey: ['vocabulary-practice', questionId],
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
        
        // Danh sách các nghĩa tiếng Việt phụ để đảm bảo đủ lựa chọn
        const fallbackMeanings = [
          "phụ thuộc", "đồng ý", "từ chối", "kỳ lạ", "trung thực", "thành công", 
          "thất bại", "cẩn thận", "lười biếng", "thông minh", "ngốc nghếch", 
          "tò mò", "buồn chán", "hạnh phúc", "đau đớn", "tự tin", "thiếu tự tin",
          "cô đơn", "bận rộn", "thoải mái", "khó khăn", "sợ hãi", "dũng cảm",
          "tuyệt vời", "tệ hại", "nhanh chóng", "chậm chạp", "mới mẻ", "cũ kỹ",
          "sáng tạo", "thực tế", "cứng đầu", "linh hoạt", "tự nhiên", "nhân tạo",
          "tình cờ", "cố ý", "nghiêm túc", "nực cười", "thận trọng", "liều lĩnh",
          "bình thường", "khác thường", "sáng sủa", "tối tăm", "cao cả", "thấp hèn"
        ];
        
        // Khởi tạo allMeanings từ danh sách từ vựng
        if (vocabulary && vocabulary.length > 0) {
          // Tạo mảng chứa tất cả các nghĩa tiếng Việt
          const meanings = vocabulary.map(item => item.meaning_vi);
          
          // Kết hợp nghĩa từ bài học và danh sách phụ
          const allPossibleMeanings = [...meanings, ...fallbackMeanings];
          
          // Loại bỏ các giá trị trùng lặp
          const uniqueMeanings = [...new Set(allPossibleMeanings)];
          
          // Cập nhật state allMeanings
          setAllMeanings(uniqueMeanings);
        }
        
        // Fetch user progress
        if (user) {
          setLoadingStates(prev => ({...prev, progressData: true}));
          const { data: progress, error: progressError } = await supabase
            .from('vocabulary_progress')
            .select('vocabulary_id, listening_practice_completed')
            .eq('student_id', user.id)
            .eq('question_id', questionId);
            
          if (!progressError && progress) {
            const completed = progress
              .filter(p => p.listening_practice_completed)
              .map(p => p.vocabulary_id);
            
            setCompletedIds(completed);
            setVocabularyList(vocabulary || []);
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

  // Mutation để cập nhật tiến trình luyện tập
  const updateProgressMutation = useMutation({
    mutationFn: async ({ vocabId }: { vocabId: string }) => {
      if (!user || !questionId) throw new Error('User or question ID is missing');
      
      // Kiểm tra xem đã có bản ghi tiến trình chưa
      const { data: existingProgress } = await supabase
        .from('vocabulary_progress')
        .select('id, correct_count, attempts')
        .eq('student_id', user.id)
        .eq('question_id', questionId)
        .eq('vocabulary_id', vocabId)
        .maybeSingle();
      
      if (existingProgress) {
        // Cập nhật bản ghi hiện có
        return supabase
          .from('vocabulary_progress')
          .update({
            listening_practice_completed: true,
            correct_count: (existingProgress.correct_count || 0) + 1,
            attempts: (existingProgress.attempts || 0) + 1,
            last_practice_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
      } else {
        // Tạo bản ghi mới
        return supabase
          .from('vocabulary_progress')
          .insert({
            student_id: user.id,
            question_id: questionId,
            vocabulary_id: vocabId,
            flashcard_completed: false,
            listening_practice_completed: true,
            post_practice_completed: false,
            attempts: 1,
            correct_count: 1,
            last_practice_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    },
    onSuccess: () => {
      // Invalidate queries khi tiến trình thay đổi
      queryClient.invalidateQueries({ queryKey: ['vocabulary-practice', questionId] });
    }
  });

  // Kiểm tra tiến trình hoàn thành
  const { data: completionData, isLoading: isLoadingCompletion } = useQuery({
    queryKey: ['vocabulary-completion', questionId, completedIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('check_vocabulary_completion', {
          p_student_id: user?.id,
          p_question_id: questionId
        });
        
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!questionId
  });

  // Làm mới danh sách từ vựng đã hoàn thành
  const refreshCompletedVocab = async () => {
    if (!user || !questionId) return;
    
    try {
      const { data: progress, error: progressError } = await supabase
        .from('vocabulary_progress')
        .select('vocabulary_id, listening_practice_completed')
        .eq('student_id', user.id)
        .eq('question_id', questionId);
      
      if (progressError) {
        console.error('Lỗi khi làm mới danh sách từ vựng đã hoàn thành:', progressError);
        return;
      }
      
      if (progress) {
        // Cập nhật danh sách ID đã hoàn thành
        const completed = progress
          .filter(p => p.listening_practice_completed)
          .map(p => p.vocabulary_id);
        
        setCompletedIds(completed);
        console.log('Đã làm mới danh sách từ vựng đã hoàn thành:', completed);
      }
    } catch (error) {
      console.error('Lỗi khi làm mới danh sách từ vựng đã hoàn thành:', error);
    }
  };

  // Xử lý chuyển đến từ tiếp theo
  const handleNextWord = () => {
    if (currentIndex < vocabularyList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Đã học xong tất cả từ vựng
      toast.success('Chúc mừng! Bạn đã hoàn thành luyện tập từ vựng.', {
        duration: 3000,
      });
      
      // Kiểm tra lại danh sách từ vựng đã hoàn thành
      refreshCompletedVocab();
      
      // Hiển thị dialog xác nhận chuyển đến trang dictation
      setShowCompleteDialog(true);
    }
  };

  // Xử lý chuyển đến trang dictation
  const handleContinueToDictation = () => {
    setShowCompleteDialog(false);
    
    // Thông báo chuyển trang
    toast.info('Đang chuyển đến bài dictation...', {
      duration: 2000,
    });
    
    // Thêm log để xác minh hàm được gọi và tham số chính xác
    console.log('Đang chuyển hướng đến DictationExercise với questionId:', questionId);
    
    // Chuyển đến trang DictationExercise
    setTimeout(() => {
      navigate(`/student/dictation/${questionId}`);
    }, 1000);
  };

  // Xử lý khi làm đúng một từ vựng
  const handleCorrect = async (vocabId: string) => {
    if (!user || !questionId) return;
    
    try {
      // Kiểm tra xem đã có bản ghi tiến trình chưa
      const { data: existingProgress, error: progressError } = await supabase
        .from('vocabulary_progress')
        .select('id')
        .eq('student_id', user.id)
        .eq('question_id', questionId)
        .eq('vocabulary_id', vocabId)
        .maybeSingle();
      
      if (progressError) {
        console.error('Lỗi khi kiểm tra tiến trình:', progressError);
      }
      
      if (existingProgress) {
        // Cập nhật bản ghi hiện có
        const { error: updateError } = await supabase
          .from('vocabulary_progress')
          .update({
            listening_practice_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
          
        if (updateError) {
          console.error('Lỗi khi cập nhật tiến trình:', updateError);
          toast.error('Không thể cập nhật tiến trình. Vui lòng thử lại!');
          return;
        }
    } else {
        // Tạo bản ghi mới
        const { error: insertError } = await supabase
          .from('vocabulary_progress')
          .insert({
            student_id: user.id,
            question_id: questionId,
            vocabulary_id: vocabId,
            flashcard_completed: true,
            listening_practice_completed: true,
            post_practice_completed: false,
            attempts: 1,
            correct_count: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        if (insertError) {
          console.error('Lỗi khi tạo tiến trình mới:', insertError);
          toast.error('Không thể lưu tiến trình. Vui lòng thử lại!');
          return;
        }
      }
      
      // Cập nhật state
      setCompletedIds(prev => {
        if (prev.includes(vocabId)) {
          return prev; // Nếu đã có rồi thì giữ nguyên
        }
        return [...prev, vocabId]; // Nếu chưa có thì thêm vào
      });
      
      console.log(`Đã đánh dấu từ vựng ${vocabId} là hoàn thành`);
      
      // Reset lỗi nếu đã thất bại trước đó
      const lastFailKey = `vocab_practice_fail_${user.id}_${questionId}`;
      localStorage.removeItem(lastFailKey);
      
    } catch (error) {
      console.error('Lỗi khi cập nhật tiến trình học từ vựng:', error);
      toast.error('Không thể cập nhật tiến trình học từ vựng');
    }
  };

  // Xử lý khi làm sai một từ vựng
  const handleFail = async (vocabId: string) => {
    if (!user || !questionId) return;
    
    try {
      // Lưu thời gian thất bại
      const currentTime = new Date().getTime();
      const lastFailKey = `vocab_practice_fail_${user.id}_${questionId}`;
      localStorage.setItem(lastFailKey, currentTime.toString());
      
      // Lưu trạng thái reset để khi quay lại sẽ bắt đầu từ đầu
      localStorage.setItem(`vocab_practice_reset_${user.id}_${questionId}`, "true");
      
      // Hiển thị dialog thông báo thất bại
      setShowFailDialog(true);
      
    } catch (error) {
      console.error('Error handling vocabulary failure:', error);
    }
  };

  // Xử lý tiếp tục sau dialog
  const handleConfirmContinue = () => {
    setShowWarningDialog(false);
    navigate(`/student/vocabulary-practice/${questionId}`);
  };

  // Xử lý quay lại học flashcard sau khi thất bại
  const handleReturnToFlashcards = () => {
    setShowFailDialog(false);
    
    // Hiển thị thông báo
    toast.warning("Bạn sẽ phải làm lại từ đầu khi quay lại luyện tập", {
      duration: 3000
    });
    
    // Chuyển về trang flashcards
    navigate(`/student/vocabulary-flashcards/${questionId}`);
  };

  // Kiểm tra nếu cần reset khi component mount
  useEffect(() => {
    if (user && questionId) {
      // Kiểm tra xem có cần reset không
      const resetKey = `vocab_practice_reset_${user.id}_${questionId}`;
      const needsReset = localStorage.getItem(resetKey);
      
      if (needsReset === "true") {
        // Reset về từ đầu tiên
        setCurrentIndex(0);
        // Xóa flag reset
        localStorage.removeItem(resetKey);
        toast.info("Bạn cần làm lại từ đầu sau khi thất bại", { duration: 3000 });
      }
      
      refreshCompletedVocab();
    }
  }, [user, questionId]);

  // Tạo danh sách nghĩa sai cho mỗi từ vựng
  const getOtherMeanings = (currentWord: VocabularyItem) => {
    // Danh sách dự phòng để đảm bảo luôn có đủ lựa chọn
    const additionalMeanings = [
      "phụ thuộc", "đồng ý", "từ chối", "kỳ lạ", "trung thực", "thành công", 
      "thất bại", "cẩn thận", "lười biếng", "thông minh", "ngốc nghếch", 
      "tò mò", "buồn chán", "hạnh phúc", "đau đớn", "tự tin", "thiếu tự tin"
    ];
    
    // Lọc ra các nghĩa khác với nghĩa hiện tại
    let otherOptions = allMeanings.filter(m => m !== currentWord.meaning_vi);
    
    // Nếu không đủ lựa chọn từ allMeanings, bổ sung từ danh sách dự phòng
    if (otherOptions.length < 3) {
      const extraOptions = additionalMeanings.filter(m => m !== currentWord.meaning_vi && !otherOptions.includes(m));
      otherOptions = [...otherOptions, ...extraOptions];
    }
    
    // Xáo trộn và lấy tối đa 3 nghĩa
    return shuffleArray(otherOptions).slice(0, 3);
  };

  // Hàm xáo trộn mảng
  const shuffleArray = (array: string[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Tính phần trăm hoàn thành
  const calculateProgress = () => {
    if (!vocabularyList || vocabularyList.length === 0) return 0;
    return (completedIds.length / vocabularyList.length) * 100;
  };

  // Bắt đầu đếm ngược cooldown
  const startCooldownTimer = (duration: number) => {
    if (cooldownInterval) {
      clearInterval(cooldownInterval);
    }
    
    setRemainingCooldown(duration);
    const interval = setInterval(() => {
      setRemainingCooldown((prev) => {
        const newValue = prev - 1000;
        if (newValue <= 0) {
          clearInterval(interval);
          setIsOnCooldown(false);
          return 0;
        }
        return newValue;
      });
    }, 1000);
    
    setCooldownInterval(interval);
  };

  // Format thời gian cooldown
  const formatCooldownTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Lấy từ vựng hiện tại
  const currentVocabulary = vocabularyList[currentIndex];
  const isCurrentVocabularyCompleted = completedIds.includes(currentVocabulary?.id || '');

  // Add a function to reset the practice
  const handleResetPractice = async () => {
    if (!user?.id || !questionId) return;
    
    try {
      // Show confirmation dialog to user before resetting
      if (!window.confirm('Bạn có chắc chắn muốn làm lại từ đầu? Tiến độ hiện tại sẽ bị mất.')) {
        return;
      }
      
      // Clear the completed IDs from vocabulary_progress table
      const { error } = await supabase
        .from('vocabulary_progress')
        .update({
          listening_practice_completed: false,
          last_practice_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('student_id', user.id)
        .eq('question_id', questionId);
        
      if (error) {
        console.error('Lỗi khi reset tiến độ học từ vựng:', error);
        toast.error('Không thể reset bài tập. Vui lòng thử lại sau.');
        return;
      }
      
      // Reset local state
      setCompletedIds([]);
      setCurrentIndex(0);
      
      // Clear any localStorage flags
      const resetKey = `vocab_practice_reset_${user.id}_${questionId}`;
      const lastFailKey = `vocab_practice_fail_${user.id}_${questionId}`;
      localStorage.removeItem(resetKey);
      localStorage.removeItem(lastFailKey);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['vocabulary-practice', questionId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-completion', questionId] });
      
      // Show success message
      toast.success('Đã reset bài tập thành công. Bạn có thể bắt đầu lại từ đầu.');
    } catch (err) {
      console.error('Lỗi khi reset bài tập:', err);
      toast.error('Đã xảy ra lỗi khi reset bài tập.');
    }
  };

  // Hiển thị màn hình cooldown
  if (isOnCooldown) {
    return (
      <StudentLayout hideSidebar={true}>
        {/* Add style tag for fullscreen styles */}
        <style dangerouslySetInnerHTML={{ __html: fullscreenStyles }} />
        <div className="container mx-auto p-4 max-w-4xl">
          <Card className="backdrop-blur-md bg-white/80 border border-blue-50 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-blue-100/50">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-70"></div>
            <CardHeader className="relative z-10">
              <CardTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold">
                Thời gian chờ
              </CardTitle>
              <CardDescription className="text-gray-600">
                Bạn cần đợi thêm một chút trước khi tiếp tục bài luyện tập
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 flex flex-col items-center justify-center p-12">
              <div className="w-32 h-32 rounded-full bg-blue-50 border-4 border-blue-200 flex items-center justify-center mb-8 relative">
                <Clock className="h-16 w-16 text-blue-400" />
                <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-transparent border-t-blue-500 animate-spin" style={{ animationDuration: '4s' }}></div>
              </div>
              
              <h2 className="text-4xl font-bold text-primary mb-4">
                {formatCooldownTime(remainingCooldown)}
              </h2>
              
              <p className="text-gray-600 text-center max-w-md mb-8">
                Hãy quay lại học từ vựng trước khi thử lại bài luyện tập. Bạn có thể tiếp tục sau {formatCooldownTime(remainingCooldown)}.
              </p>
              
              <Button 
                onClick={() => navigate(`/student/vocabulary-flashcards/${questionId}`)}
                className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Quay lại học flashcards
              </Button>
            </CardContent>
          </Card>
        </div>
      </StudentLayout>
    );
  }

  // Add loading indicator
  if (Object.values(loadingStates).some(loading => loading) || isCheckingPreviousStep) {
    return (
      <StudentLayout hideSidebar={true}>
        <div className="fullscreen-container flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600">Đang tải dữ liệu...</p>
            <div className="space-y-2">
              {loadingStates.vocabularyData && <p className="text-sm text-gray-500">Đang tải danh sách từ vựng...</p>}
              {loadingStates.progressData && <p className="text-sm text-gray-500">Đang tải tiến trình học tập...</p>}
              {loadingStates.audioData && <p className="text-sm text-gray-500">Đang tải file audio...</p>}
              {isCheckingPreviousStep && <p className="text-sm text-gray-500">Đang kiểm tra tiến trình học tập...</p>}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout hideSidebar={true}>
      {/* Add style tag for fullscreen styles */}
      <style dangerouslySetInnerHTML={{ __html: fullscreenStyles }} />
      
      <div ref={containerRef} className="fullscreen-container">
        {/* Thanh tiến trình cải tiến */}
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
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                      <span className="font-semibold">1</span>
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

                {/* Bước 2: Flashcard */}
                <div className="flex-1 relative">
                  <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/student/vocabulary-flashcards/${questionId}`)}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                      <span className="font-semibold">2</span>
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Flashcard</h3>
                      <p className="text-xs text-gray-500">Đã hoàn thành</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                    <div className="h-full w-full bg-primary"></div>
                  </div>
                </div>

                {/* Bước 3: Luyện tập - đang hoạt động */}
                <div className="flex-1 relative">
                  <div className="flex items-center">
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">3</span>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Luyện tập</h3>
                      <p className="text-xs text-gray-500">Đang thực hiện</p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                    <div className="h-full w-1/2 bg-primary"></div>
                  </div>
                </div>

                {/* Bước 4: Dictation */}
                <div className="flex-1 relative">
                  <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => calculateProgress() === 100 ? navigate(`/student/question/${questionId}`) : toast.warning("Bạn cần hoàn thành luyện tập từ vựng trước")}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 shadow-md">
                      <span className="font-semibold">4</span>
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-gray-600">Dictation</h3>
                      <p className="text-xs text-gray-500">Tiếp theo</p>
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
                      Luyện tập từ vựng
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Nghe, gõ từ tiếng Anh và chọn nghĩa tiếng Việt tương ứng
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-xs text-gray-500 mb-1">Tiến độ học</div>
                    <Progress 
                      value={currentIndex + 1} 
                      max={vocabularyList.length || 1} 
                      className="w-32 h-2.5 bg-blue-100" 
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {currentIndex + 1}/{vocabularyList.length || 0}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 card-content practice-content space-y-6">
                <div className="flex items-center mb-6">
                  <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mr-2">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Quay lại
                  </Button>
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 flex-1">
                    {vocabularyData?.question?.title || 'Bài luyện tập'}
                  </h1>
                  <Button variant="outline" size="sm" onClick={handleResetPractice} className="ml-2">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Làm lại từ đầu
                  </Button>
                </div>
                
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-600">Tiến độ</span>
                        <span className="text-gray-700">
                      {completedIds.length}/{vocabularyList?.length || 0} từ vựng
                    </span>
                  </div>
                      <Progress 
                        value={calculateProgress()} 
                        className="h-2.5 bg-blue-100"
                      />
                </div>
                
                <div className="flex items-center justify-center mb-4">
                      <Badge className="bg-primary/90 text-sm py-1.5 px-3 shadow-sm">
                    <Headphones className="h-4 w-4 mr-1" />
                        <span>Luyện tập nghe và gõ từ</span>
                  </Badge>
                </div>
                
                {isLoading ? (
                      <div className="w-full max-w-md mx-auto h-80 flex items-center justify-center">
                        <div className="backdrop-blur-md bg-white/50 rounded-xl p-8 border border-white/40 shadow-xl">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
                          <p className="text-center mt-4 text-gray-600">Đang tải bài luyện tập...</p>
                        </div>
                      </div>
                ) : error ? (
                      <div className="w-full max-w-md mx-auto rounded-xl overflow-hidden backdrop-blur-md bg-white/50 border border-white/40 shadow-xl p-6">
                      <div className="text-center text-red-500">
                          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                        <p>Không thể tải bài luyện tập. Vui lòng thử lại sau.</p>
                          <Button onClick={() => window.location.reload()} className="mt-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md">
                          Thử lại
                        </Button>
                      </div>
                    </div>
                ) : vocabularyList?.length === 0 ? (
                      <div className="w-full max-w-md mx-auto rounded-xl overflow-hidden backdrop-blur-md bg-white/50 border border-white/40 shadow-xl">
                        <div className="bg-gradient-to-br from-green-50 to-blue-50 p-6 text-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                            <Check className="h-8 w-8 text-green-600" />
                          </div>
                          <CardTitle className="text-xl mb-2 text-primary">Bạn đã hoàn thành tất cả!</CardTitle>
                          <p className="mb-4 text-gray-600">Bạn đã hoàn thành luyện tập tất cả từ vựng.</p>
                          <Button 
                            onClick={() => navigate(`/student/question/${questionId}`)}
                            className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md hover:shadow-lg transition-all"
                          >
                          Bắt đầu bài kiểm tra
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                  ) : currentVocabulary ? (
                        <div className="rounded-xl overflow-hidden backdrop-blur-sm border border-white/40 bg-white/50 shadow-xl transition-all duration-300 hover:shadow-blue-100/50">
                <VocabularyPracticeItem
                  vocabulary={currentVocabulary}
                  audioUrl={audioUrl}
                  onNextWord={handleNextWord}
                  onCorrect={handleCorrect}
                        onFail={handleFail}
                  isLastItem={currentIndex === vocabularyList.length - 1}
                  otherMeanings={getOtherMeanings(currentVocabulary)}
                        alreadyCompleted={isCurrentVocabularyCompleted}
                />
                        </div>
                  ) : null}
                  
                {/* Thanh đánh dấu từ vựng */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {vocabularyList.map((vocab, idx) => (
                    <Badge 
                      key={vocab.id}
                      variant={idx === currentIndex ? "default" : completedIds.includes(vocab.id) ? "outline" : "secondary"} 
                      className={`cursor-pointer transition-all ${
                        idx === currentIndex 
                          ? 'bg-primary hover:bg-primary/90 shadow-md' 
                          : completedIds.includes(vocab.id)
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => setCurrentIndex(idx)}
                    >
                      {idx + 1}
                      {completedIds.includes(vocab.id) && <Check className="ml-1 h-3 w-3" />}
                    </Badge>
                  ))}
                </div>
                
                <div className="mt-6 text-center text-sm text-gray-500 px-4 py-3 bg-blue-50/50 rounded-lg backdrop-blur-sm border border-blue-100/50">
                  <p>Bạn cần hoàn thành tất cả từ vựng ở bước này (100%) để có thể chuyển sang bài dictation.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Dialog cảnh báo khi chưa hoàn thành */}
        <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
          <AlertDialogContent className="backdrop-blur-lg bg-white/90 border border-white/40 shadow-xl dialog-in-fullscreen">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-70 rounded-lg"></div>
            <AlertDialogHeader className="relative z-10">
              <AlertDialogTitle className="text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold">Chưa hoàn thành</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-gray-600">
                  <p>Bạn cần hoàn thành tất cả từ vựng trước khi làm bài dictation. 
                  Bạn sẽ được chuyển về trang học từ vựng để tiếp tục.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="relative z-10">
              <AlertDialogCancel className="border-blue-200 hover:border-blue-300 bg-white/60 hover:bg-white/80">Hủy</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-gradient-to-r from-primary to-indigo-600 shadow-md hover:shadow-xl transition-shadow"
                onClick={handleConfirmContinue}
              >
                Tiếp tục học
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog thông báo thất bại */}
        <AlertDialog open={showFailDialog} onOpenChange={setShowFailDialog}>
          <AlertDialogContent className="backdrop-blur-lg bg-white/90 border border-white/40 shadow-xl dialog-in-fullscreen">
            <div className="absolute inset-0 bg-gradient-to-br from-red-50/30 to-orange-50/30 opacity-70 rounded-lg"></div>
            <AlertDialogHeader className="relative z-10">
              <AlertDialogTitle className="text-xl text-red-600 font-bold">Bạn cần học lại từ vựng</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-gray-600">
                  <p>Bạn cần quay lại học flashcards để ghi nhớ các từ vựng tốt hơn.
                  Sau đó bạn có thể thử lại bài luyện tập sau ít nhất 2 phút, 
                  nhưng bạn sẽ phải bắt đầu lại từ từ vựng đầu tiên.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="relative z-10">
              <AlertDialogAction 
                className="bg-gradient-to-r from-red-500 to-orange-500 shadow-md hover:shadow-xl transition-shadow"
                onClick={handleReturnToFlashcards}
              >
                Quay lại học từ vựng
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog xác nhận khi hoàn thành */}
        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent className="backdrop-blur-lg bg-white/90 border border-white/40 shadow-xl dialog-in-fullscreen">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-70 rounded-lg"></div>
            <AlertDialogHeader className="relative z-10">
              <AlertDialogTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold text-center">Chúc mừng! Bạn đã hoàn thành!</AlertDialogTitle>
              <div className="flex justify-center my-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center mb-2 shadow-inner border border-green-200 relative">
                  <Check className="h-12 w-12 text-green-600" />
                  <div className="absolute -inset-1 bg-green-500/10 rounded-full blur-sm animate-pulse"></div>
                </div>
              </div>
              <AlertDialogDescription asChild>
                <div className="text-center text-gray-700">
                  <p>Bạn đã hoàn thành phần luyện tập từ vựng. Bây giờ bạn đã sẵn sàng cho bài kiểm tra dictation.</p>
                  <div className="mt-2 p-2 bg-blue-50/70 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-700">Bạn sẽ nghe bài đọc và điền từ còn thiếu vào chỗ trống.</p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="relative z-10 flex-col sm:flex-row-reverse gap-2 mt-4">
              <AlertDialogAction 
                className="bg-gradient-to-r from-primary to-indigo-600 shadow-md hover:shadow-xl transition-shadow w-full sm:w-auto"
                onClick={handleContinueToDictation}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Bắt đầu làm bài dictation
              </AlertDialogAction>
              <AlertDialogCancel className="border-blue-200 hover:border-blue-300 bg-white/60 hover:bg-white/80 w-full sm:w-auto">
                Quay lại
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Warning Dialog for anti-cheating */}
        <div className="dialog-overlay" style={{display: showAntiCheatingWarning ? 'flex' : 'none'}}>
          <Dialog 
            open={showAntiCheatingWarning} 
            onOpenChange={(open) => {
              // Don't allow closing via ESC when timer is still active
              if (!open && redirectTimer > 0) {
                setShowAntiCheatingWarning(true);
                return;
              }
              setShowAntiCheatingWarning(open);
            }}
          >
            <DialogContent 
              className="backdrop-blur-lg bg-white/90 border-2 border-red-500 shadow-2xl warning-shake anti-cheating-dialog" 
              tabIndex={-1}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-50/60 to-orange-50/60 opacity-90 rounded-lg"></div>
              <DialogHeader className="relative z-10">
                <div className="flex items-center justify-center mb-2">
                  <AlertCircle className="h-12 w-12 text-red-500 mr-2" />
                  <DialogTitle className="text-2xl text-red-600 font-bold">VI PHẠM QUY CHẾ THI!</DialogTitle>
                  </div>
                <DialogDescription className="text-gray-800 text-center text-base">
                  {cheatingMessage || 'Hệ thống đã phát hiện hành vi gian lận. Bài thi đã bị hủy theo quy định.'}
                  <div className="mt-4 p-4 bg-red-100 rounded-lg border border-red-200 font-medium text-red-800 text-lg">
                    Bài thi của bạn đã bị hủy và thông báo cho giáo viên
                </div>
                  
                  <div className="mt-6 flex flex-col items-center">
                    <div className="text-base font-medium">Lịch sử vi phạm toàn hệ thống</div>
                    <div className="flex items-center justify-center mt-2 space-x-1">
                      {[...Array(studentCheatingHistory.maxAllowedCheating)].map((_, index) => (
                        <div 
                          key={index}
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            index < studentCheatingHistory.totalCheatingCount 
                              ? 'bg-red-500 text-white' 
                              : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {index + 1}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-sm">
                      {studentCheatingHistory.totalCheatingCount}/{studentCheatingHistory.maxAllowedCheating} lần vi phạm
                      {studentCheatingHistory.totalCheatingCount >= 5 && (
                        <div className="text-red-600 font-bold mt-1 animate-pulse">
                          Cảnh báo: Chỉ còn {studentCheatingHistory.maxAllowedCheating - studentCheatingHistory.totalCheatingCount} lần vi phạm trước khi tài khoản bị khóa!
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                    <p className="text-blue-800">
                      Bạn sẽ tự động quay về trang chủ sau <span className="font-bold">{redirectTimer}</span> giây
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="relative z-10 flex justify-center mt-4">
                <Button 
                onClick={() => {
                  setShowAntiCheatingWarning(false);
                    // Hủy đếm ngược nếu người dùng nhấn nút
                    if (redirectTimerRef.current) {
                      clearInterval(redirectTimerRef.current);
                      redirectTimerRef.current = null;
                    }
                    navigate(`/student/question/${questionId}`);
                  }}
                  className="bg-gradient-to-r from-red-500 to-orange-500 shadow-md hover:shadow-xl transition-shadow px-8 py-3 text-lg font-medium"
                >
                  Quay lại trang chủ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </StudentLayout>
  );
};

export default VocabularyPractice; 