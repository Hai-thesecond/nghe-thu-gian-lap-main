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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase, getBucketName, verifyAuthentication } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Play, Volume2, AlertCircle, PauseCircle, Clock, Info, CheckCircle2, Maximize2, BookText, AlertTriangle, ArrowLeft, Trophy, Star, Heart, Lightbulb, ListTodo, Check, XCircle, Pencil, Headphones, Send, Book, PlayCircle, UserIcon } from 'lucide-react';
import StudentLayout from '@/layouts/StudentLayout';
import { submitStudentAnswers, submitAnswersText, markAssignmentAsCompleted, debugRLS } from '@/lib/api';
import { SUPABASE_URL, API_KEY } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

interface Question {
  id: string;
  title: string;
  script: string;
  audio_url: string;
  difficulty: string;
  time_limit: number;
  blanks_count: number;
  created_by: string;
  profiles?: {
    full_name: string;
  };
  good_students_blanks_percentage?: number;
  average_students_blanks_percentage?: number;
  poor_students_blanks_percentage?: number;
  max_cheating_attempts?: number;
}

const QuestionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isStarted, setIsStarted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [blanksPositions, setBlanksPositions] = useState<number[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [cheatingAttempts, setCheatingAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const submissionRecordIdRef = useRef<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [scoreInfo, setScoreInfo] = useState<{
    totalScore: number;
    correctAnswers: number;
    incorrectAnswers: number;
    errors: Array<{index: number, userAnswer: string, correctAnswer: string}>;
    maxScore?: number;
    userAnswers?: string[];
  }>({
    totalScore: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    errors: []
  });
  const [isVocabRequired, setIsVocabRequired] = useState(false);
  const [vocabCompletionStatus, setVocabCompletionStatus] = useState<any>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [studentCategory, setStudentCategory] = useState({ category: 'average', categoryDisplay: 'Trung bình' });
  // Update để lưu số từ cần điền thực tế
  const [actualBlanksCount, setActualBlanksCount] = useState(0);
  // Thêm state để theo dõi bước học hiện tại
  const [currentStep, setCurrentStep] = useState<'category' | 'flashcard' | 'practice' | 'dictation' | 'complete'>('category');
  const [cheatingMessage, setCheatingMessage] = useState('');
  const [maxCheatingAttempts, setMaxCheatingAttempts] = useState(7);
  // Khai báo biến theo dõi trạng thái hoàn thành (thêm ở phần đầu file, gần các state khác)
  const [answerData, setAnswerData] = useState(null);
  const [completedAnswers, setCompletedAnswers] = useState([]);
  // Biến cho thống kê
  const [startTime, setStartTime] = useState<number | null>(null);
  const [audioPlayCount, setAudioPlayCount] = useState(0);
  // Add new state to track if user has completed test at least once
  const [hasCompletedTestOnce, setHasCompletedTestOnce] = useState(false);
  // Thêm state để lưu trữ lịch sử vi phạm
  const [studentCheatingHistory, setStudentCheatingHistory] = useState({
    totalCheatingCount: 0,
    questionCheatingCount: 0,
    maxAllowedCheating: 7,
    isAccountLocked: false
  });

  // Cập nhật API key mới
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2lncXR2b3dmdHpyaXF2eml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mjk2NTAsImV4cCI6MjA1ODAwNTY1MH0.wOUqO1V261MA_NGTnmf_1TkwYB-yhgtRCd0rtqxpbyM';

  // Thêm hàm handleStartDictation để xử lý click vào bước 4
  const handleStartDictation = () => {
    navigate(`/student/dictation/${id}`);
  };

  // Hàm lấy URL audio dựa vào cấu trúc bucket thực tế
  const getAudioUrl = async (path: string): Promise<string> => {
    try {
      if (!path) {
        console.error('Audio path is empty');
        setErrorMessage('Đường dẫn file audio không hợp lệ');
        return '';
      }

      console.log('Original audio path:', path);

      // Nếu đã là URL đầy đủ, trả về luôn
      if (path.startsWith('http://') || path.startsWith('https://')) {
        console.log('Using direct URL:', path);
        setAudioUrl(path);
        return path;
      }

      // Dùng API key trực tiếp để lấy URL
      const directFetchUrl = async (bucket: string, filePath: string) => {
        try {
          console.log(`Trying direct fetch for ${bucket}/${filePath}`);
          const url = `https://tscigqtvowftzriqvzit.supabase.co/storage/v1/object/public/${bucket}/${filePath}`;
          
          // Kiểm tra URL có khả dụng không
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            console.log('URL accessible:', url);
            return url;
          } else {
            console.log('URL not accessible:', url, response.status);
            return null;
          }
        } catch (e) {
          console.error('Error checking URL:', e);
          return null;
        }
      };

      // Xác định đường dẫn file
      let filepath = path;
      
      // Kiểm tra xem path có phải là ID file mp3 không
      const isIdPattern = /^\d+(-Ex\d+)?$/.test(path);
      if (isIdPattern) {
        filepath = `${path}.mp3`;
      }
      
      // Xóa tiền tố không cần thiết
      if (filepath.startsWith('dictation/')) {
        filepath = filepath.slice('dictation/'.length);
      }
      
      // Thử nhiều bucket khác nhau
      const possibleBuckets = ['dictation', 'audio', 'public'];
      
      // Thử với tất cả bucket và đường dẫn khác nhau
      for (const bucket of possibleBuckets) {
        // Thử với đường dẫn gốc
        let url = await directFetchUrl(bucket, filepath);
        if (url) {
          setAudioUrl(url);
          return url;
        }
        
        // Thử với đường dẫn trong thư mục audio
        url = await directFetchUrl(bucket, `audio/${filepath}`);
        if (url) {
          setAudioUrl(url);
          return url;
        }
        
        // Thử với định dạng mặc định
        url = await directFetchUrl(bucket, `${filepath}.mp3`);
        if (url) {
          setAudioUrl(url);
          return url;
        }
      }
      
      // Nếu không tìm thấy, tạo URL mặc định
      const fallbackUrl = `https://tscigqtvowftzriqvzit.supabase.co/storage/v1/object/public/dictation/${filepath}`;
      console.log('Using fallback URL:', fallbackUrl);
      setAudioUrl(fallbackUrl);
      return fallbackUrl;
    } catch (error) {
      console.error('Error getting audio URL:', error);
      setErrorMessage('Không thể tải file audio. Vui lòng liên hệ hỗ trợ.');
      return '';
    }
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    try {
      if (audioPlaying) {
        audio.pause();
        setAudioPlaying(false);
      } else {
        // Reset audio if it's at the end
        if (audio.currentTime >= audio.duration) {
          audio.currentTime = 0;
        }
        
        setError(null); // Clear any previous errors
        
        try {
          await audio.play();
          setAudioPlaying(true);
        } catch (error) {
          console.error('Error playing audio:', error);
          setError('Không thể phát audio. Vui lòng thử lại.');
          setAudioPlaying(false);
        }
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
      setError('Không thể điều khiển audio. Vui lòng thử lại.');
      setAudioPlaying(false);
    }
  };
  
  const { data: question, isLoading: questionLoading } = useQuery({
    queryKey: ['question', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          profiles:created_by (
            full_name
          )
        `)
        .eq('id', id)
        .single();
        
      if (error) {
        console.error('Error fetching question:', error);
        setError('Không thể tải bài tập. Vui lòng thử lại sau.');
        return null;
      }

      if (!data.audio_url) {
        setError('Bài tập này chưa có file âm thanh.');
        return null;
      }

      if (!data.script) {
        setError('Bài tập này chưa có nội dung.');
        return null;
      }

      // Get audio URL
      const url = data.audio_url;
      console.log('Audio URL:', url); // Debug log
      setAudioUrl(url);
      return data as Question;
    },
  });

  // Function to start audio playback
  const startAudio = () => {
    try {
      if (audioRef.current && audioUrl) {
        const audio = audioRef.current;
        
        // Make sure the audio element is properly set up
        if (!audio.src || audio.src !== audioUrl) {
          audio.src = audioUrl;
          audio.load();
        }
        
        audio.play()
          .then(() => {
            setIsAudioPlaying(true);
            setAudioPlaying(true);
            console.log('Audio playing started successfully');
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            setErrorMessage(`Không thể phát audio: ${error.message}`);
          });
      } else {
        console.error('Audio element or URL not available');
        setErrorMessage('Không thể phát audio: Audio chưa sẵn sàng');
      }
    } catch (error: any) {
      console.error('Error in startAudio:', error);
      setErrorMessage(`Không thể phát audio: ${error.message}`);
    }
  };

  // Cleanup the useEffect for audio setup
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;
      
      console.log('Setting up audio with URL:', audioUrl);
      
      // Reset audio
      audio.pause();
      audio.currentTime = 0;
      
      // Set source and load
      audio.src = audioUrl;
      audio.preload = 'auto';
      audio.load();
      
      // Add detailed event listeners
      const handleLoadStart = () => {
        console.log('Audio load started for:', audioUrl);
        setIsAudioLoading(true);
        setErrorMessage('');
      };
      
      const handleCanPlay = () => {
        console.log('Audio can play now:', audioUrl);
        setIsAudioLoading(false);
      };
      
      const handleError = () => {
        const error = audio.error;
        let errorMsg = 'Unknown error';
        
        if (error) {
          switch (error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMsg = 'Playback aborted';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorMsg = 'Network error';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorMsg = 'Decoding error - file may be corrupted';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMsg = 'Format not supported';
              break;
          }
        }
        
        console.error(`Audio error (${errorMsg}):`, error);
        setIsAudioLoading(false);
        setErrorMessage(`Không thể phát audio: ${errorMsg}`);
      };
      
      const handlePlay = () => {
        console.log('Audio play event fired for:', audioUrl);
        setAudioPlaying(true);
      };
      
      const handlePause = () => {
        console.log('Audio pause event');
        setAudioPlaying(false);
      };
      
      const handleEnded = () => {
        console.log('Audio playback ended');
        setAudioPlaying(false);
        setIsAudioPlaying(false);
      };
      
      // Add event listeners
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        // Cleanup
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioUrl]);

  // Function to handle fullscreen changes
  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
    if (!document.fullscreenElement && isStarted) {
      handleCheatingAttempt('Thoát khỏi chế độ toàn màn hình');
    }
  }, [isStarted]);

  // New function to handle mouse leave detection
  const handleMouseLeave = useCallback(() => {
    if (isStarted) {
      handleCheatingAttempt('Di chuyển chuột ra khỏi cửa sổ');
    }
  }, [isStarted]);

  // Handle visibility change (tab switching)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden' && isStarted) {
      handleCheatingAttempt('Chuyển sang tab khác');
    }
  }, [isStarted]);

  // Centralized function to handle cheating attempts
  const handleCheatingAttempt = (reason: string) => {
    // Cập nhật UI state ngay lập tức
    setCheatingMessage(`Cảnh báo: Hệ thống đã phát hiện hành vi gian lận (${reason}). 
      Bài thi sẽ bị hủy ngay lập tức theo quy định.`);
    setShowWarning(true);
    
    // Record cheating attempt in database
    if (user?.id && id) {
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
            .eq('question_id', id)
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
                  question_id: id,
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
                      .eq('question_id', id)
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
                        
                        // Kết thúc bài thi ngay lập tức
                        resetTest(reason);
                      });
                  }
                });
            });
        });
    } else {
      // Nếu không có user hoặc id, vẫn kết thúc bài thi
      resetTest(reason);
    }
  };

  // New function to reset the test after max cheating attempts
  const resetTest = (reason = '') => {
    // Clean up
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Show error message
    toast.error(`Bài làm đã bị hủy do phát hiện hành vi gian lận: ${reason}`, {
      duration: 5000,
    });
    
    // Reset state to the beginning
    setIsStarted(false);
    
    // Navigate back to the dashboard after a delay
    setTimeout(() => {
      navigate('/student/dashboard');
    }, 3000);
  };

  // Enable fullscreen mode
  const enableFullscreen = async () => {
    try {
      if (containerRef.current) {
        await containerRef.current.requestFullscreen();
      }
    } catch (err) {
      console.error('Error enabling fullscreen:', err);
      toast.error('Không thể bật chế độ toàn màn hình', {
        description: 'Vui lòng cho phép quyền toàn màn hình để làm bài'
      });
    }
  };
  
  // Setup anti-cheating event listeners
  useEffect(() => {
    if (isStarted) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
    
    return undefined;
  }, [isStarted, handleFullscreenChange, handleVisibilityChange, handleMouseLeave]);

  // Fetch question anti-cheating settings
  useEffect(() => {
    if (question) {
      // Always set max cheating attempts to 7 regardless of database value
      setMaxCheatingAttempts(7);
      
      // Other question settings can still be applied here
    }
  }, [question]);

  // Function to list available buckets
  const getBuckets = async () => {
    try {
      console.log('Getting buckets from supabase.ts helper...');
      // Sử dụng hàm từ supabase.ts để lấy danh sách bucket
      const bucketNames = await getBucketName();
      console.log('Available buckets from supabase.ts:', bucketNames);
      return bucketNames;
    } catch (error) {
      console.error('Error in getBuckets:', error);
      // Fallback to hardcoded values
      return ['dictation', 'audio'];
    }
  };

  // Lấy trạng thái hoàn thành từ vựng
  const { data: vocabularyStatus, isLoading: isLoadingVocabStatus } = useQuery({
    queryKey: ['vocabulary-status', id, user?.id, isStarted],
    queryFn: async () => {
      if (!id || !user) return null;
      
      try {
        // Kiểm tra xem câu hỏi có yêu cầu học từ vựng không
        const { data: question, error: questionError } = await supabase
          .from('questions')
          .select('require_vocabulary_practice')
          .eq('id', id)
          .single();
        
        if (questionError) throw questionError;
        
        // Cập nhật trạng thái yêu cầu học từ vựng
        setIsVocabRequired(!!question?.require_vocabulary_practice);
        
        if (!question?.require_vocabulary_practice) {
          return { required: false, completion: null };
        }
        
        // Kiểm tra tiến trình học từ vựng
        const { data: completion, error: completionError } = await supabase
          .rpc('check_vocabulary_completion', {
            p_student_id: user.id,
            p_question_id: id
          });
        
        if (completionError) throw completionError;
        
        setVocabCompletionStatus(completion);
        return { required: true, completion };
      } catch (error) {
        console.error('Error checking vocabulary status:', error);
        // Mặc định không yêu cầu nếu có lỗi
        return { required: false, completion: null };
      }
    },
    enabled: !!id && !!user
  });

  // Fetch student category
  const { data: studentCategoryData } = useQuery({
    queryKey: ['student-category', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('student_categories')
        .select('category')
        .eq('student_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching student category:', error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id
  });

  // Update student category when data is available
  useEffect(() => {
    if (studentCategoryData) {
      const category = studentCategoryData.category || 'average';
      
      // Tạo categoryDisplay dựa trên category
      const getCategoryDisplay = (cat) => {
        switch (cat) {
          case 'good': return 'Tốt';
          case 'average': return 'Trung bình';
          case 'poor': return 'Yếu';
          default: return 'Trung bình';
        }
      };
      
      setStudentCategory({
        category: category,
        categoryDisplay: getCategoryDisplay(category)
      });
    }
  }, [studentCategoryData]);

  const getEncouragementMessage = (category) => {
    switch (category) {
      case 'good':
        return 'Bạn đang làm rất tốt! Tiếp tục phát huy và chinh phục những thử thách mới nhé. Chúng tôi tin bạn có thể đạt điểm tuyệt đối!';
      case 'average':
        return 'Bạn đang có tiến bộ tốt! Hãy cố gắng thêm một chút nữa, bạn đang rất gần với mức xuất sắc rồi đấy!';
      case 'poor':
        return 'Đừng lo lắng! Mỗi bài tập là cơ hội để tiến bộ. Hãy kiên nhẫn và cố gắng, kết quả sẽ cải thiện dần và chúng tôi luôn ở đây để hỗ trợ bạn!';
      default:
        return 'Hãy cố gắng hết sức trong bài tập này nhé! Mỗi bước tiến đều đáng quý.';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'good':
        return <div className="h-20 w-20 rounded-full bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center mb-6 shadow-lg shadow-green-200/50 border border-green-200/50 group relative">
          <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping duration-700 opacity-0 group-hover:opacity-100"></div>
          <div className="absolute -inset-2 bg-green-500/5 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
          <Trophy className="h-10 w-10 text-green-600 transform group-hover:scale-110 transition-transform duration-300" />
        </div>;
      case 'average':
        return <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center mb-6 shadow-lg shadow-amber-200/50 border border-amber-200/50 group relative">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping duration-700 opacity-0 group-hover:opacity-100"></div>
          <div className="absolute -inset-2 bg-amber-500/5 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
          <Star className="h-10 w-10 text-amber-600 transform group-hover:scale-110 transition-transform duration-300" />
        </div>;
      case 'poor':
        return <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-6 shadow-lg shadow-blue-200/50 border border-blue-200/50 group relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping duration-700 opacity-0 group-hover:opacity-100"></div>
          <div className="absolute -inset-2 bg-blue-500/5 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
          <Heart className="h-10 w-10 text-blue-600 transform group-hover:scale-110 transition-transform duration-300" />
        </div>;
      default:
        return <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-6 shadow-lg shadow-blue-200/50 border border-blue-200/50 group relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping duration-700 opacity-0 group-hover:opacity-100"></div>
          <div className="absolute -inset-2 bg-blue-500/5 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
          <Lightbulb className="h-10 w-10 text-blue-600 transform group-hover:scale-110 transition-transform duration-300" />
        </div>;
    }
  };

  // Cập nhật hàm continueAfterCategoryDialog
  const continueAfterCategoryDialog = async () => {
    console.log('Tiếp tục sau khi đóng dialog đánh giá');
    try {
      setIsLoading(true);
      setShowCategoryDialog(false);
      
      // Cần một khoảng delay ngắn để ensure UI hoàn thành animation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Kiểm tra đã hoàn thành học từ vựng chưa nếu bài yêu cầu
      if (isVocabRequired && vocabularyStatus?.completion) {
        const completion = vocabularyStatus.completion;
        
        // Nếu chưa hoàn thành phần flashcard, chuyển đến bước flashcard
        if (!completion.flashcard_completed) {
          setCurrentStep('flashcard');
          setIsLoading(false);
          await redirectToPage(`/student/vocabulary-flashcards/${id}`);
          return;
        }
        // Nếu chưa hoàn thành phần practice, chuyển đến bước practice
        else if (!completion.practice_completed) {
          setCurrentStep('practice');
          setIsLoading(false);
          await redirectToPage(`/student/vocabulary-practice/${id}`);
          return;
        }
      }
      
      // Nếu đã hoàn thành các bước trước hoặc không yêu cầu, chuyển đến trang dictation
      setCurrentStep('dictation');
        setIsLoading(false);
      
      // Chuyển đến trang dictation thay vì hiển thị UI dictation tại đây
      await redirectToPage(`/student/dictation/${id}`);
      
    } catch (error) {
      console.error('Lỗi khi tiếp tục sau category dialog:', error);
      setErrorMessage(`Đã xảy ra lỗi: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
          setIsLoading(false);
    }
  };

  // Cập nhật hàm startTest
  const startTest = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      console.log('Bắt đầu quy trình làm bài...', { user: user?.id, question: id });
      
      // Kiểm tra người dùng đã đăng nhập chưa
      if (!user?.id) {
        setErrorMessage("Bạn cần đăng nhập để làm bài. Vui lòng đăng nhập lại.");
        setIsLoading(false);
        return;
      }

      // Hiển thị dialog thông báo mức độ đánh giá của học viên
      setCurrentStep('category');
      setShowCategoryDialog(true);
      setIsLoading(false);
      // Các bước tiếp theo sẽ thực hiện trong continueAfterCategoryDialog
    } catch (error) {
      console.error('Lỗi khi bắt đầu bài thi:', error);
      setErrorMessage(`Đã xảy ra lỗi khi bắt đầu: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
      setIsLoading(false);
    }
  };

  // Hàm để redirect đến các trang khác nhau
  const redirectToPage = async (path: string) => {
    // Đảm bảo màn hình vẫn là toàn màn hình khi redirect
    try {
      if (!document.fullscreenElement) {
        await enableFullscreen();
      }
    } catch (error) {
      console.error('Không thể bật chế độ toàn màn hình trước khi chuyển trang:', error);
    }
    
    // Chờ một chút để đảm bảo fullscreen được thiết lập
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Chuyển hướng đến trang mới
    navigate(path);
  };
  
  useEffect(() => {
    if (remainingTime > 0 && isStarted) {
      timerRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            // Time's up, submit automatically
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingTime, isStarted]);
  
  useEffect(() => {
    if (isStarted) {
      // Set up event listeners for anti-cheating
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          setCheatingAttempts(prev => prev + 1);
          setShowWarning(true);
          
          // Record cheating attempt
          supabase
            .from('student_answers')
            .update({
              cheating_attempts: cheatingAttempts + 1
            })
            .eq('student_id', user?.id)
            .eq('question_id', id)
            .then(({ error }) => {
              if (error) console.error('Error recording cheating attempt:', error);
            });
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isStarted, cheatingAttempts]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setAudioPlaying(false);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = value[0];
    audio.currentTime = (newTime / 100) * audio.duration;
    setCurrentTime((newTime / 100) * audio.duration);
  };
  
  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  // Cập nhật hàm createStudentAnswer để tạo bản ghi mới mỗi lần làm
  const createStudentAnswer = async () => {
    if (!user || !id) {
      console.error("Missing user or question id");
      return null;
    }
    
      const attemptTime = new Date().toISOString();
      
    try {
      // Tạo bản ghi mới trong student_answers
      const { data, error } = await supabase
        .from('student_answers')
        .insert({
          student_id: user.id,
          question_id: id,
          started_at: attemptTime,
          is_completed: false,
          attempt_timestamp: attemptTime // Thêm trường mới để phân biệt các lần làm
        })
        .select();
      
      if (error) {
        console.error('Error creating student answer record:', error);
        toast.error("Lỗi khi tạo bản ghi bài làm");
        return null;
      }
      
      if (data && data.length > 0) {
        console.log('Created student answer record:', data[0]);
        return data[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Exception creating student answer record:', error);
      toast.error("Lỗi không xác định khi tạo bản ghi bài làm");
      return null;
    }
  };

  // Thêm hàm so sánh đáp án cải tiến vào trong file DictationExercise.tsx
  const compareAnswer = (userAnswer, correctAnswer) => {
    // Đảm bảo cả hai không là null/undefined
    userAnswer = userAnswer || '';
    correctAnswer = correctAnswer || '';
    
    // Chuẩn hóa đáp án
    const normalizedUser = userAnswer.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    const normalizedCorrect = correctAnswer.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    
    // Ghi log chi tiết để debug
    console.log(`So sánh đáp án: "${userAnswer}" vs "${correctAnswer}"`, {
      normalizedUser,
      normalizedCorrect,
      isEmpty: normalizedUser === '',
      isCorrect: normalizedUser === normalizedCorrect
    });
    
    // Nếu học sinh không điền gì, luôn tính là sai
    if (normalizedUser === '') {
      return {
        isCorrect: false,
        message: 'Không có câu trả lời'
      };
    }
    
    return {
      isCorrect: normalizedUser === normalizedCorrect,
      message: normalizedUser === normalizedCorrect ? 'Đúng' : 'Sai'
    };
  };

  // Cập nhật hàm calculateScore
  const calculateScore = (studentAnswers, correctPositions) => {
    if (!question) return { totalScore: 0, correctAnswers: 0, incorrectAnswers: 0, errors: [] };
    
    const script = question.script.split(/\s+/);
    let correctCount = 0;
    const errors = [];
    
    // Lưu lại kết quả chi tiết để debug
    const detailedResults = [];
    
    correctPositions.forEach((position, index) => {
      const studentAnswer = studentAnswers[index] || '';
      const correctAnswer = script[position] || '';
      
      // Sử dụng hàm so sánh đáp án cải tiến
      const result = compareAnswer(studentAnswer, correctAnswer);
      
      // Lưu kết quả chi tiết
      detailedResults.push({
        index,
        position,
        studentAnswer,
        correctAnswer,
        normalizedStudent: studentAnswer.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ''),
        normalizedCorrect: correctAnswer.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ''),
        isCorrect: result.isCorrect,
        message: result.message
      });
      
      if (result.isCorrect) {
        correctCount++;
      } else {
        errors.push({
          index,
          userAnswer: studentAnswer,
          correctAnswer: correctAnswer,
          position // Thêm vị trí để dễ debug
        });
      }
    });
    
    // Log toàn bộ kết quả chi tiết
    console.log('Chi tiết kết quả tính điểm:', detailedResults);
    
    const totalQuestions = correctPositions.length;
    const incorrectCount = totalQuestions - correctCount;
    
    // Đảm bảo không chia cho 0
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    
    // Log tổng kết
    console.log('Kết quả tính điểm:', {
      totalScore: score,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      totalQuestions,
      errors: errors.length
    });
    
    return {
      totalScore: score,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      errors,
      detailedResults // Thêm chi tiết để có thể lưu vào metadata
    };
  };

  const handleSubmit = async () => {
    console.log('Bắt đầu nộp bài...');
    
    try {
      if (!user?.id) {
        console.error('User not authenticated');
        toast.error('Bạn chưa đăng nhập');
        return;
      }
      
      if (!id) {
        console.error('Missing question ID');
        toast.error('Thiếu ID câu hỏi');
        return;
      }
    
      // Dừng audio nếu đang phát
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Dừng timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      const safeAnswers = answers.map(answer => answer || ''); // Đảm bảo không có giá trị null
      console.log('Mảng đáp án của học sinh:', safeAnswers);
      
      // Chuẩn bị danh sách đáp án đúng từ blanksPositions
      const script = question.script.split(/\s+/);
      const correctAnswers = blanksPositions.map(position => script[position] || '');
      
      // Tính điểm với thuật toán cải tiến
      const scoreResults = calculateScore(safeAnswers, blanksPositions);
      setScoreInfo(scoreResults);
      
      // Ghi log chi tiết để debug
      console.log('Chi tiết kết quả tính điểm:');
      blanksPositions.forEach((position, index) => {
        console.log(`Câu ${index + 1}: Vị trí ${position + 1}`, {
          từ_gốc: script[position],
          đáp_án_học_sinh: safeAnswers[index] || '(Trống)',
          đáp_án_đúng: correctAnswers[index],
          kết_quả: scoreResults.detailedResults?.[index]?.isCorrect ? 'Đúng' : 'Sai'
        });
      });
      
      // Kiểm tra xem có record đã tạo chưa
      let recordId = submissionRecordIdRef.current;
      
      // Tạo mới nếu chưa có
      if (!recordId) {
        recordId = await createStudentAnswer();
        if (!recordId) {
          console.log('Không thể tạo record, hiển thị kết quả local');
          handleSubmitSuccess();
          return;
        }
      }
      
      // Tạo metadata
      const metadata = {
        timeTaken: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
        audioPlayCount: audioPlayCount,
        blanksPositions: blanksPositions,
        timestamp: Date.now(),
        detailedResults: scoreResults.detailedResults // Lưu chi tiết kết quả
      };
      
      // Lưu trữ cải tiến
      try {
        console.log('Lưu kết quả vào Supabase với ID:', recordId);
        
        const { data, error } = await supabase
          .from('student_answers')
          .update({
            answers: safeAnswers, // Mảng gốc
            answers_text: JSON.stringify(safeAnswers), // String phụ trợ
            completed_at: new Date().toISOString(),
            is_completed: true,
            cheating_attempts: cheatingAttempts,
            score: scoreResults.totalScore,
            correct_answers_text: JSON.stringify(correctAnswers),
            metadata: JSON.stringify(metadata),
            // Các trường mới
            correct_count: scoreResults.correctAnswers,
            incorrect_count: scoreResults.incorrectAnswers,
            error_details: scoreResults.errors
          })
          .eq('id', recordId)
          .select();
          
        if (error) {
          console.error('Lỗi lưu dữ liệu:', error);
          toast.error('Lỗi khi lưu kết quả');
        } else {
          console.log('Lưu kết quả thành công:', data);
          handleSubmitSuccess();
        }
      } catch (e) {
        console.error('Lỗi exception khi lưu:', e);
        toast.error('Lỗi không xác định khi lưu kết quả');
      }
      
    } catch (error) {
      console.error('Error submitting answers:', error);
      toast.error('Đã xảy ra lỗi khi nộp bài');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitSuccess = () => {
    toast.success('Nộp bài thành công!', {
      description: 'Bài làm của bạn đã được lưu.'
    });
    
    // Thoát fullscreen nếu đang ở chế độ fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('Lỗi khi thoát chế độ toàn màn hình:', err);
      });
    }
    
    // Hiển thị kết quả bài làm ngay lập tức
    setShowResults(true);
  };
  
  const renderScript = () => {
    if (!question) return null;
    
    const words = question.script.split(/\s+/);
    
    // Xác định loại chỗ trống dựa vào trình độ học sinh
    let inputClass = "w-24"; // Mặc định cho từ đơn
    let placeholder = "...";
    
    if (studentCategory.category === 'good') {
      inputClass = "w-56"; // Mở rộng cho câu
      placeholder = "Nhập câu...";
    } else if (studentCategory.category === 'average') {
      inputClass = "w-40"; // Mở rộng cho cụm từ
      placeholder = "Nhập cụm từ...";
    }

    return (
      <div className="space-y-4">
        <p className="text-lg text-gray-800 leading-relaxed break-words">
          {words.map((word, index) => {
            if (blanksPositions.includes(index)) {
              const blankIndex = blanksPositions.indexOf(index);
              return (
                <span key={index} className="inline-block mx-1">
                  <Input
                    className={`inline-block bg-blue-50 border-blue-200 focus:border-blue-500 ${inputClass}`}
                    placeholder={placeholder}
                    value={answers[blankIndex] || ''}
                    onChange={(e) => handleAnswerChange(blankIndex, e.target.value)}
                  />
                </span>
              );
            }
            return <span key={index} className="mx-1 break-all">{word}</span>;
          })}
        </p>
      </div>
    );
  };
  
  // Make sure audio is loaded when question data is fetched
  useEffect(() => {
    if (question?.audio_url && !audioUrl) {
      console.log('Loading audio from question data:', question.audio_url);
      getAudioUrl(question.audio_url).then(url => {
        console.log('Audio URL set to:', url);
      }).catch(error => {
        console.error('Failed to load audio URL:', error);
      });
    }
  }, [question]);

  // Cập nhật số lượng chỗ trống thực tế
  useEffect(() => {
    if (blanksPositions.length > 0) {
      console.log(`Cập nhật số lượng từ cần điền thực tế: ${blanksPositions.length}`);
      setActualBlanksCount(blanksPositions.length);
    }
  }, [blanksPositions]);

  // Thêm vào useEffect
  useEffect(() => {
    if (user?.id) {
      debugRLS('student_answers', user.id);
    }
  }, [user]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Thêm useEffect để load dữ liệu hoàn thành từ student_answers
  useEffect(() => {
    if (!id || !user?.id) {
      return;
    }
    
    const fetchCompletedAnswers = async () => {
      try {
        console.log('Fetching completion status for question:', id, 'and user:', user.id);
        
        // Fetch answer data - bỏ điều kiện is_completed=true
        const { data: answerData, error: answerError } = await supabase
          .from('student_answers')
          .select('*')
          .eq('student_id', user.id)
          .eq('question_id', id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (answerError) {
          console.error('Error fetching answer data:', answerError);
          return;
        }
        
        // Lọc các bản ghi đã hoàn thành
        const completedRecords = answerData?.filter(record => 
          record.is_completed || record.completed_at
        ) || [];
        
        console.log('Found records:', answerData?.length || 0, 'Completed:', completedRecords.length);
        
        if (completedRecords.length > 0) {
          setAnswerData(completedRecords[0]);
          setCompletedAnswers(completedRecords);
          
          // Set state to indicate that user has completed test at least once
          setHasCompletedTestOnce(true);
        } else {
          setHasCompletedTestOnce(false);
        }
      } catch (error) {
        console.error('Error in fetchCompletedAnswers:', error);
      }
    };
    
    fetchCompletedAnswers();
  }, [id, user?.id]);
  
  // Thêm useEffect để lấy lịch sử vi phạm từ profiles
  useEffect(() => {
    const fetchCheatingHistory = async () => {
      if (!user) return;
      
      try {
        console.log('Đang lấy dữ liệu vi phạm cho user:', user.id, 'và bài tập:', id);
        
        // Lấy thông tin tổng số vi phạm và tình trạng khóa từ profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('total_cheating_count, cheating_locked')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Lỗi khi lấy thông tin vi phạm từ profiles:', profileError);
          return;
        }
        
        console.log('Dữ liệu vi phạm từ profiles:', profileData);
        
        // Đếm tổng số lần vi phạm cho bài này
        const { count: questionCheatingCount, error: countError } = await supabase
          .from('student_answers')
          .select('id', { count: 'exact' })
          .eq('student_id', user.id)
          .eq('question_id', id)
          .gt('cheating_attempts', 0);
        
        if (countError) {
          console.error('Lỗi khi đếm số lần vi phạm cho bài này:', countError);
          return;
        }
        
        console.log('Số lần vi phạm cho bài này:', questionCheatingCount);
        
        // Cập nhật state
        setStudentCheatingHistory({
          totalCheatingCount: profileData?.total_cheating_count || 0,
          questionCheatingCount: questionCheatingCount || 0,
          maxAllowedCheating: 7, // Giá trị mặc định là 7
          isAccountLocked: profileData?.cheating_locked || false
        });
        
        console.log('Đã cập nhật state studentCheatingHistory:', {
          totalCheatingCount: profileData?.total_cheating_count || 0,
          questionCheatingCount: questionCheatingCount || 0,
          maxAllowedCheating: 7,
          isAccountLocked: profileData?.cheating_locked || false
        });
        
        // Cập nhật state cheatingAttempts để các phần khác có thể sử dụng
        setCheatingAttempts(questionCheatingCount || 0);
        
        // Kiểm tra nếu tài khoản bị khóa thì hiển thị thông báo và chuyển về dashboard
        if (profileData?.cheating_locked) {
          toast.error('Tài khoản của bạn đã bị khóa do vi phạm quy chế. Vui lòng liên hệ giáo viên để được hỗ trợ.', {
            duration: 5000
          });
          
          // Chuyển về dashboard sau 3 giây
          setTimeout(() => {
            navigate('/student/dashboard');
          }, 3000);
        }
      } catch (error) {
        console.error('Lỗi khi lấy thông tin vi phạm:', error);
      }
    };
    
    if (user && id) {
      console.log('Gọi fetchCheatingHistory() với user:', user.id, 'và bài tập:', id);
      fetchCheatingHistory();
    }
  }, [user, id, navigate]);
  
  if (questionLoading) {
    return (
      <StudentLayout hideSidebar={true}>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </StudentLayout>
    );
  }

  if (error || !question) {
    return (
      <StudentLayout hideSidebar={true}>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Có lỗi xảy ra</h2>
          <p className="text-gray-600">{error || 'Không thể tải bài tập'}</p>
          <Button 
            variant="outline"
            onClick={() => navigate('/student/dashboard')}
            className="mt-4"
          >
            Quay lại trang chủ
          </Button>
        </div>
      </StudentLayout>
    );
  }

  if (!isStarted) {
    return (
      <StudentLayout hideSidebar={true}>
        {/* Thanh tiến trình cho bốn bước học */}
        <div className="sticky top-0 z-50 relative bg-gradient-to-r from-blue-50/90 to-indigo-50/90 py-4 border-b border-blue-100 backdrop-blur-md">
          <div className="absolute inset-0 bg-blue-500/5 backdrop-blur-sm"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-center max-w-4xl mx-auto">
              <div className="flex items-center space-x-1 md:space-x-6 w-full justify-between">
                {/* Bước 1: Đánh giá */}
                <div className="flex-1 relative">
                  <div className="flex items-center">
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">1</span>
                      {studentCategory && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                      )}
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Đánh giá</h3>
                      <p className="text-xs text-gray-500">
                        {studentCategory ? "Đã hoàn thành" : "Chưa hoàn thành"}
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                    <div className={`h-full ${studentCategory ? "w-full" : "w-0"} bg-primary transition-all duration-300`}></div>
                  </div>
                </div>

                {/* Bước 2: Flashcard */}
                <div className="flex-1 relative">
                  <div 
                    className={`flex items-center ${hasCompletedTestOnce && completedAnswers?.length > 0 && vocabCompletionStatus?.flashcard_completed ? "cursor-pointer hover:opacity-80 transition-opacity" : "opacity-50 cursor-not-allowed"}`}
                    onClick={() => {
                      // Only allow navigation if the student has completed the test at least once and completed the step
                      if (hasCompletedTestOnce && completedAnswers?.length > 0 && vocabCompletionStatus?.flashcard_completed) {
                          navigate(`/student/vocabulary-flashcards/${id}`);
                      } else if (!hasCompletedTestOnce) {
                        toast.warning("Vui lòng hoàn thành bài kiểm tra ít nhất một lần!", {
                          description: "Bạn cần hoàn thành bài kiểm tra trước khi sử dụng các bước học tập"
                        });
                      } else {
                        toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                          description: "Bạn cần hoàn thành bước đánh giá trước khi chuyển đến phần này"
                        });
                      }
                    }}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">2</span>
                      {vocabCompletionStatus?.flashcard_completed && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                      )}
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Flashcard</h3>
                      <p className="text-xs text-gray-500">
                        {vocabCompletionStatus?.flashcard_completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                    <div className={`h-full ${vocabCompletionStatus?.flashcard_completed ? "w-full" : "w-0"} bg-primary transition-all duration-300`}></div>
                  </div>
                </div>

                {/* Bước 3: Luyện tập */}
                <div className="flex-1 relative">
                  <div 
                    className={`flex items-center ${hasCompletedTestOnce && completedAnswers?.length > 0 && vocabCompletionStatus?.practice_completed && vocabCompletionStatus?.flashcard_completed ? "cursor-pointer hover:opacity-80 transition-opacity" : "opacity-50 cursor-not-allowed"}`}
                    onClick={() => {
                      // Only allow navigation if the student has completed the test at least once and previous steps
                      if (hasCompletedTestOnce && completedAnswers?.length > 0 && vocabCompletionStatus?.practice_completed && vocabCompletionStatus?.flashcard_completed) {
                          navigate(`/student/vocabulary-practice/${id}`);
                      } else if (!hasCompletedTestOnce) {
                        toast.warning("Vui lòng hoàn thành bài kiểm tra ít nhất một lần!", {
                          description: "Bạn cần hoàn thành bài kiểm tra trước khi sử dụng các bước học tập"
                        });
                      } else {
                        toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                          description: "Bạn cần hoàn thành bước luyện tập trước khi chuyển đến phần này"
                        });
                      }
                    }}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">3</span>
                      {vocabCompletionStatus?.practice_completed && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                      )}
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Luyện tập</h3>
                      <p className="text-xs text-gray-500">
                        {vocabCompletionStatus?.practice_completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                    <div className={`h-full ${vocabCompletionStatus?.practice_completed ? "w-full" : "w-0"} bg-primary transition-all duration-300`}></div>
                  </div>
                </div>

                {/* Bước 4: Dictation */}
                <div className="flex-1 relative">
                  <div 
                    className={`flex items-center ${hasCompletedTestOnce && completedAnswers?.length > 0 && vocabCompletionStatus?.practice_completed && vocabCompletionStatus?.flashcard_completed ? "cursor-pointer hover:opacity-80 transition-opacity" : "opacity-50 cursor-not-allowed"}`}
                    onClick={() => {
                      // Only allow navigation if the student has completed the test at least once and previous steps
                      if (hasCompletedTestOnce && completedAnswers?.length > 0 && vocabCompletionStatus?.practice_completed && vocabCompletionStatus?.flashcard_completed) {
                        handleStartDictation();
                      } else if (!hasCompletedTestOnce) {
                        toast.warning("Vui lòng hoàn thành bài kiểm tra ít nhất một lần!", {
                          description: "Bạn cần hoàn thành bài kiểm tra trước khi sử dụng các bước học tập"
                        });
                      } else {
                        toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                          description: "Bạn cần hoàn thành bước luyện tập trước khi chuyển đến phần này"
                        });
                      }
                    }}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">4</span>
                      {/* Only show checkmark if there are fully completed dictation answers (with proper score) */}
                      {completedAnswers?.length > 0 && completedAnswers.some(answer => 
                        answer.is_completed === true && 
                        answer.score !== null && 
                        answer.completed_at !== null
                      ) && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                      )}
                    </div>
                    <div className="flex-1 ml-3">
                      <h3 className="font-medium text-primary">Dictation</h3>
                      <p className="text-xs text-gray-500">
                        {completedAnswers?.length > 0 && completedAnswers.some(answer => 
                          answer.is_completed === true && 
                          answer.score !== null && 
                          answer.completed_at !== null
                        ) ? "Đã hoàn thành" : "Chưa hoàn thành"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pt-6 pb-20 max-w-4xl">
          {/* Phần còn lại giữ nguyên */}
          <Card className="overflow-hidden backdrop-blur-md bg-white/80 border border-blue-50 shadow-xl relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-50"></div>
            <CardHeader className="relative z-10 text-center">
              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">
                {question.title}
              </CardTitle>
              <CardDescription className="text-gray-600">
                Luyện tập nghe và điền từ để nâng cao kỹ năng nghe tiếng Anh
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 relative z-10">
              {/* Thông tin bài tập với card hiệu ứng nổi */}
              <div className="space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-md hover:shadow-lg transition-all duration-300 text-center">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-700">
                  <Info className="h-5 w-5 text-blue-500" />
                  Thông tin bài tập
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/60 p-4 rounded-lg border border-blue-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center transform hover:-translate-y-1 hover:scale-[1.02]">
                    <Book className="h-8 w-8 text-indigo-500 mb-2 transform transition-transform group-hover:scale-110" />
                    <p className="text-sm text-gray-500">Giáo viên</p>
                    <p className="font-medium">{question?.profiles?.full_name}</p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-lg border border-blue-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center transform hover:-translate-y-1 hover:scale-[1.02]">
                    <Clock className="h-8 w-8 text-amber-500 mb-2 transform transition-transform group-hover:scale-110" />
                    <p className="text-sm text-gray-500">Thời gian làm bài</p>
                    <p className="font-medium">{question?.time_limit || 10} phút</p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-lg border border-blue-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center transform hover:-translate-y-1 hover:scale-[1.02]">
                    <UserIcon className="h-8 w-8 text-green-500 mb-2 transform transition-transform group-hover:scale-110" />
                    <p className="text-sm text-gray-500">Trình độ của bạn</p>
                    <p className="font-medium">{studentCategory.categoryDisplay}</p>
                  </div>
                </div>
              </div>
              
              {/* Hiển thị số lần vi phạm */}
              <div className="bg-white/80 p-4 rounded-xl border border-amber-100 shadow-sm max-w-md mx-auto animate-in slide-in-from-bottom duration-1000 delay-300 hover:shadow-md transition-all duration-300 mb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="rounded-full flex-shrink-0 h-10 w-10 bg-amber-100 flex items-center justify-center animate-pulse">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="text-amber-800 font-medium text-base">Cảnh báo vi phạm: {studentCheatingHistory.totalCheatingCount}/{studentCheatingHistory.maxAllowedCheating}</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                  <div 
                    className={`h-2.5 rounded-full ${
                      studentCheatingHistory.totalCheatingCount === 0 ? 'bg-green-500' : 
                      studentCheatingHistory.totalCheatingCount < studentCheatingHistory.maxAllowedCheating / 2 ? 'bg-amber-500' : 
                      'bg-red-500'
                    } transition-all duration-500 ease-in-out`}
                    style={{ width: `${(studentCheatingHistory.totalCheatingCount / studentCheatingHistory.maxAllowedCheating) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>An toàn</span>
                  <span>Cảnh báo</span>
                  <span>Nguy hiểm</span>
                </div>
                <p className="text-center text-sm text-gray-700 mt-3 font-medium">
                  {studentCheatingHistory.totalCheatingCount === 0 ? (
                    <span className="text-green-600">Bạn chưa vi phạm quy định nào</span>
                  ) : (
                    <span>Bạn còn <span className="text-amber-700 font-bold">{studentCheatingHistory.maxAllowedCheating - studentCheatingHistory.totalCheatingCount}</span> lần cảnh báo trước khi bài thi kết thúc</span>
                  )}
                </p>
              </div>
              
              {/* Các bước làm bài với hiệu ứng */}
              <div className="space-y-6 animate-in slide-in-from-bottom duration-1000 delay-300 text-center">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-indigo-700 justify-center">
                  <ListTodo className="h-6 w-6 text-primary" />
                  Quy trình làm bài 4 bước
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bước 1: Đánh giá */}
                  <div className="relative group cursor-pointer">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
                    <div className="relative bg-white p-5 rounded-xl flex items-start gap-4 border border-blue-100 transition-all duration-300 hover:shadow-lg h-full group-hover:-translate-y-1 transform">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg shadow-sm group-hover:scale-110 transition-transform duration-300">
                      1
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-700 flex items-center gap-2 mb-1">
                          <Trophy className="h-5 w-5 text-blue-600" />
                          Đánh giá trình độ
                        </h4>
                        <p className="text-gray-600 mb-2">Hệ thống đánh giá trình độ và phân loại học sinh thành: Tốt, Trung bình, Yếu</p>
                        <div className="rounded-lg bg-blue-50 p-2 text-sm text-blue-700 my-2">
                          <span className="font-medium">Lợi ích:</span> Nội dung bài tập sẽ được điều chỉnh theo trình độ của bạn
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bước 2: Flashcard */}
                  <div className="relative group cursor-pointer">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
                    <div className="relative bg-white p-5 rounded-xl flex items-start gap-4 border border-blue-100 transition-all duration-300 hover:shadow-lg h-full group-hover:-translate-y-1 transform">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg shadow-sm group-hover:scale-110 transition-transform duration-300">
                      2
                    </div>
                    <div>
                        <h4 className="font-semibold text-indigo-700 flex items-center gap-2 mb-1">
                          <BookText className="h-5 w-5 text-indigo-600" />
                          Học từ vựng qua flashcard
                        </h4>
                        <p className="text-gray-600 mb-2">Làm quen với từ vựng xuất hiện trong bài và cách phát âm</p>
                        <div className="rounded-lg bg-indigo-50 p-2 text-sm text-indigo-700 my-2">
                          <span className="font-medium">Tính năng:</span> Lật thẻ học 2 mặt, nghe phát âm, xem hình ảnh minh họa
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bước 3: Luyện tập từ vựng */}
                  <div className="relative group cursor-pointer">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
                    <div className="relative bg-white p-5 rounded-xl flex items-start gap-4 border border-blue-100 transition-all duration-300 hover:shadow-lg h-full group-hover:-translate-y-1 transform">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg shadow-sm group-hover:scale-110 transition-transform duration-300">
                      3
                    </div>
                    <div>
                        <h4 className="font-semibold text-green-700 flex items-center gap-2 mb-1">
                          <Pencil className="h-5 w-5 text-green-600" />
                          Luyện tập từ vựng
                        </h4>
                        <p className="text-gray-600 mb-2">Nghe và điền từ vựng đã học, chọn nghĩa chính xác của từ</p>
                        <div className="rounded-lg bg-green-50 p-2 text-sm text-green-700 my-2">
                          <span className="font-medium">Phương pháp:</span> Các bài tập tương tác giúp ghi nhớ cách dùng từ
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bước 4: Dictation */}
                  <div className="relative group cursor-pointer">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
                    <div className="relative bg-white p-5 rounded-xl flex items-start gap-4 border border-blue-100 transition-all duration-300 hover:shadow-lg h-full group-hover:-translate-y-1 transform">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-lg shadow-sm group-hover:scale-110 transition-transform duration-300">
                      4
                    </div>
                    <div>
                        <h4 className="font-semibold text-amber-700 flex items-center gap-2 mb-1">
                          <Headphones className="h-5 w-5 text-amber-600" />
                          Dictation - Chính bài
                        </h4>
                        <p className="text-gray-600 mb-2">Nghe đoạn âm thanh và điền các từ còn thiếu vào đoạn văn</p>
                        <div className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700 my-2">
                          <span className="font-medium">Điều chỉnh:</span> Độ khó tùy theo trình độ (điền từ đơn/cụm từ/câu)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Lưu ý quan trọng với hiệu ứng nhấp nháy */}
              <div className="relative rounded-xl overflow-hidden group animate-in slide-in-from-bottom duration-1000 delay-500">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-red-500 animate-pulse rounded-xl blur opacity-50"></div>
                <div className="relative space-y-4 bg-white/95 p-6 rounded-xl border border-amber-100 backdrop-blur">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-700">
                    <AlertCircle className="h-6 w-6 text-amber-500" />
                  Lưu ý quan trọng
                </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Thời gian */}
                    <div className="bg-white/80 p-4 rounded-lg border border-amber-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group/card transform hover:-translate-y-1 hover:scale-[1.02]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="rounded-full flex-shrink-0 h-10 w-10 bg-amber-100 flex items-center justify-center group-hover/card:scale-110 transition-transform duration-300">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 font-medium text-base">Quản lý thời gian</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 pl-12">Bài tập có giới hạn thời gian, hãy quản lý thời gian hợp lý</p>
              </div>
              
                    {/* Toàn màn hình */}
                    <div className="bg-white/80 p-4 rounded-lg border border-amber-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group/card transform hover:-translate-y-1 hover:scale-[1.02]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="rounded-full flex-shrink-0 h-10 w-10 bg-amber-100 flex items-center justify-center group-hover/card:scale-110 transition-transform duration-300">
                          <Maximize2 className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 font-medium text-base">Chế độ toàn màn hình</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 pl-12">Bắt buộc làm bài ở chế độ toàn màn hình để tập trung tốt nhất</p>
                    </div>
                    
                    {/* Không chuyển tab */}
                    <div className="bg-white/80 p-4 rounded-lg border border-red-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group/card transform hover:-translate-y-1 hover:scale-[1.02]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="rounded-full flex-shrink-0 h-10 w-10 bg-red-100 flex items-center justify-center group-hover/card:scale-110 transition-transform duration-300">
                          <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 font-medium text-base">Không chuyển tab</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 pl-12">Không được chuyển sang tab khác hoặc rời khỏi trang khi đang làm bài</p>
                    </div>
                    
                    {/* Tự động nộp */}
                    <div className="bg-white/80 p-4 rounded-lg border border-green-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group/card transform hover:-translate-y-1 hover:scale-[1.02]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="rounded-full flex-shrink-0 h-10 w-10 bg-green-100 flex items-center justify-center group-hover/card:scale-110 transition-transform duration-300">
                          <Send className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 font-medium text-base">Tự động nộp bài</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 pl-12">Bài làm sẽ tự động nộp khi hết thời gian</p>
                    </div>
                    
                    {/* Nghe audio */}
                    <div className="bg-white/80 p-4 rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group/card transform hover:-translate-y-1 hover:scale-[1.02]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="rounded-full flex-shrink-0 h-10 w-10 bg-blue-100 flex items-center justify-center group-hover/card:scale-110 transition-transform duration-300">
                          <Volume2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 font-medium text-base">Nghe lại audio</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 pl-12">Có thể nghe lại audio nhiều lần trong thời gian làm bài</p>
                    </div>
                    
                    {/* Hoàn thành 4 bước */}
                    <div className="bg-white/80 p-4 rounded-lg border border-purple-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group/card transform hover:-translate-y-1 hover:scale-[1.02]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="rounded-full flex-shrink-0 h-10 w-10 bg-purple-100 flex items-center justify-center group-hover/card:scale-110 transition-transform duration-300">
                          <Star className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 font-medium text-base">Hoàn thành 4 bước</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 pl-12">Nên hoàn thành đầy đủ 4 bước để đạt kết quả tốt nhất</p>
                    </div>
                  </div>
                </div>
              </div>
        
              {/* Error message if any */}
              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Lỗi:</span> {errorMessage}
                  </div>
                </div>
              )}

              {/* Nút bắt đầu với animation */}
              <div className="flex justify-center pt-8 animate-in slide-in-from-bottom duration-1000 delay-700">
                <Button
                  size="lg"
                  onClick={startTest}
                  className="w-full max-w-sm relative overflow-hidden group bg-white border-2 border-primary/70 text-primary font-medium hover:text-white hover:border-transparent transition-all duration-300 before:absolute before:inset-0 before:border-2 before:border-primary/30 before:rounded-md before:scale-[1.01] before:opacity-0 before:animate-pulse"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Đang tải...
                    </span>
                  ) : (
                    <>
                      <span className="relative z-10 flex items-center gap-2 justify-center">
                        <PlayCircle className="h-5 w-5" />
                        Bắt đầu làm bài
                      </span>
                      <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 w-full scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out"></span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dialog thông báo mức độ đánh giá của học viên */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 transition-all duration-300 animate-in fade-in-50 zoom-in-95 slide-in-from-top-5 overflow-hidden">
            <div className="absolute inset-0 z-0 overflow-hidden">
              <div className="absolute top-[-10%] right-[-5%] w-32 h-32 bg-primary/10 rounded-full blur-3xl opacity-70"></div>
              <div className="absolute bottom-[-10%] left-[-5%] w-32 h-32 bg-blue-500/10 rounded-full blur-3xl opacity-70"></div>
            </div>
            
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent drop-shadow-sm">
                Mức độ đánh giá hiện tại
              </DialogTitle>
              <DialogDescription className="text-center mt-2">
                Dựa trên kết quả học tập trước đây, bạn đang được đánh giá ở mức:
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col items-center justify-center py-6 px-4 relative z-10">
              <div className="transform transition-all duration-500 hover:scale-105 animate-in slide-in-from-top-10 fade-in-50 duration-500">
                {getCategoryIcon(studentCategory.category)}
              </div>
              
              <div className={`text-3xl font-bold mb-4 transform transition-all duration-300 animate-in fade-in-30 duration-500 ${
                studentCategory.category === 'good' ? 'text-green-600 bg-green-50/80' : 
                studentCategory.category === 'average' ? 'text-amber-600 bg-amber-50/80' : 
                'text-blue-600 bg-blue-50/80'
              } px-8 py-2 rounded-full shadow-lg backdrop-blur-sm border border-white/50`}>
                {studentCategory.categoryDisplay}
              </div>
              
              <div className={`text-center text-gray-700 max-w-md p-6 rounded-xl backdrop-blur-sm shadow-lg border border-white/30 transition-all duration-500 animate-in fade-in-50 duration-700 ${
                studentCategory.category === 'good' ? 'bg-green-50/40' : 
                studentCategory.category === 'average' ? 'bg-amber-50/40' : 
                'bg-blue-50/40'
              }`}>
                <p className="italic relative">
                  <span className="absolute -top-3 -left-3 text-4xl text-primary/20">"</span>
                  <span className="relative z-10">{getEncouragementMessage(studentCategory.category)}</span>
                  <span className="absolute -bottom-3 -right-2 text-4xl text-primary/20">"</span>
                </p>
              </div>
            </div>
            
            <DialogFooter className="flex-col sm:flex-row sm:justify-center gap-2 pt-4 pb-2 relative z-10">
              <Button 
                onClick={continueAfterCategoryDialog}
                className={`transform transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 hover:-translate-y-1 ${
                  studentCategory.category === 'good' ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border border-green-400/30' : 
                  studentCategory.category === 'average' ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 border border-amber-400/30' : 
                  'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-400/30'
                }`}
                size="lg"
              >
                <span className="relative inline-flex items-center">
                  <span className="animate-ping absolute right-0 h-2 w-2 rounded-full bg-white opacity-75"></span>
                  <span className="relative">Tiếp tục làm bài</span>
                </span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StudentLayout>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-white overflow-hidden">
      {/* Thanh tiến trình cải tiến */}
      <div className="sticky top-0 z-50 relative bg-gradient-to-r from-blue-50/90 to-indigo-50/90 py-4 border-b border-blue-100 backdrop-blur-md">
        <div className="absolute inset-0 bg-blue-500/5 backdrop-blur-sm"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-center max-w-4xl mx-auto">
            <div className="flex items-center space-x-1 md:space-x-6 w-full justify-between">
              {/* Bước 1: Đánh giá */}
              <div className="flex-1 relative">
                <div 
                  className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    if (isStarted) {
                      const confirmExit = window.confirm("Bạn có chắc muốn rời khỏi bài làm? Tiến trình sẽ không được lưu.");
                      if (confirmExit && (vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0)) {
                        navigate(`/student/vocabulary-flashcards/${id}`);
                      } else if (!vocabCompletionStatus?.flashcard_completed && completedAnswers?.length === 0) {
                        toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                          description: "Bạn cần hoàn thành bước trước khi chuyển đến phần này"
                        });
                      }
                    } else if (vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0) {
                      navigate(`/student/vocabulary-flashcards/${id}`);
                    } else {
                      toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                        description: "Bạn cần hoàn thành bước trước khi chuyển đến phần này"
                      });
                    }
                  }}
                >
                  <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                    <span className="font-semibold">1</span>
                    {vocabCompletionStatus?.flashcard_completed && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    )}
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

              {/* Bước 2: Flashcard */}
              <div className="flex-1 relative">
                <div 
                  className={`flex items-center ${vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0 ? "cursor-pointer hover:opacity-80 transition-opacity" : "opacity-50 cursor-not-allowed"}`}
                  onClick={() => {
                    if (isStarted) {
                      const confirmExit = window.confirm("Bạn có chắc muốn rời khỏi bài làm? Tiến trình sẽ không được lưu.");
                      if (confirmExit && (vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0)) {
                        navigate(`/student/vocabulary-flashcards/${id}`);
                      } else if (!vocabCompletionStatus?.flashcard_completed && completedAnswers?.length === 0) {
                        toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                          description: "Bạn cần hoàn thành bước trước khi chuyển đến phần này"
                        });
                      }
                    } else if (vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0) {
                      navigate(`/student/vocabulary-flashcards/${id}`);
                    } else {
                      toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                        description: "Bạn cần hoàn thành bước trước khi chuyển đến phần này"
                      });
                    }
                  }}
                >
                  <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                    <span className="font-semibold">2</span>
                    {vocabCompletionStatus?.flashcard_completed && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    )}
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

              {/* Bước 3: Luyện tập */}
              <div className="flex-1 relative">
                <div 
                  className={`flex items-center ${(vocabCompletionStatus?.practice_completed || completedAnswers?.length > 0) && (vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0) ? "cursor-pointer hover:opacity-80 transition-opacity" : "opacity-50 cursor-not-allowed"}`}
                  onClick={() => {
                    if (isStarted) {
                      const confirmExit = window.confirm("Bạn có chắc muốn rời khỏi bài làm? Tiến trình sẽ không được lưu.");
                      if (confirmExit && (vocabCompletionStatus?.practice_completed || completedAnswers?.length > 0) && 
                          (vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0)) {
                        navigate(`/student/vocabulary-practice/${id}`);
                      } else if (!(vocabCompletionStatus?.practice_completed || completedAnswers?.length > 0) || 
                                !(vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0)) {
                        toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                          description: "Bạn cần hoàn thành bước trước khi chuyển đến phần này"
                        });
                      }
                    } else if ((vocabCompletionStatus?.practice_completed || completedAnswers?.length > 0) && 
                              (vocabCompletionStatus?.flashcard_completed || completedAnswers?.length > 0)) {
                      navigate(`/student/vocabulary-practice/${id}`);
                    } else {
                      toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                        description: "Bạn cần hoàn thành bước trước khi chuyển đến phần này"
                      });
                    }
                  }}
                >
                  <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                    <span className="font-semibold">3</span>
                    {vocabCompletionStatus?.practice_completed && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    )}
                  </div>
                  <div className="flex-1 ml-3">
                    <h3 className="font-medium text-primary">Luyện tập</h3>
                    <p className="text-xs text-gray-500">Đã hoàn thành</p>
                  </div>
                </div>
                <div className="absolute left-5 top-5 h-0.5 w-full bg-gray-200">
                  <div className="h-full w-full bg-primary"></div>
                </div>
              </div>

              {/* Bước 4: Dictation - đang hoạt động */}
              <div className="flex-1 relative">
                <div 
                  className={`flex items-center ${hasCompletedTestOnce && completedAnswers?.length > 0 && vocabCompletionStatus?.practice_completed && vocabCompletionStatus?.flashcard_completed ? "cursor-pointer hover:opacity-80 transition-opacity" : "opacity-50 cursor-not-allowed"}`}
                  onClick={() => {
                    if (isStarted) {
                      // Already in dictation, no need to navigate again
                    } else if ((answerData || completedAnswers?.length > 0) && 
                              (vocabCompletionStatus?.practice_completed || completedAnswers?.length > 0)) {
                      handleStartDictation();
                    } else {
                      toast.warning("Vui lòng hoàn thành các bước trước đó!", {
                        description: "Bạn cần hoàn thành bước trước khi chuyển đến phần này"
                      });
                    }
                  }}
                >
                  <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                    <span className="font-semibold">4</span>
                    {(answerData || completedAnswers?.length > 0) && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    )}
                  </div>
                  <div className="flex-1 ml-3">
                    <h3 className="font-medium text-primary">Dictation</h3>
                    <p className="text-xs text-gray-500">Đang thực hiện</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nội dung hiện tại của component */}
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="backdrop-blur-md bg-white/90 border border-blue-50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-50"></div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="truncate">
                <CardTitle className="truncate">{question.title}</CardTitle>
                <CardDescription className="truncate">
                  Giáo viên: {question.profiles?.full_name}
                </CardDescription>
                <div className="mt-2">
                  <Badge variant="secondary">
                    Thời gian: {question.time_limit} phút
                  </Badge>
                </div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="text-2xl font-bold text-primary">
                  {formatTime(remainingTime)}
                  </div>
                <div className="text-sm text-gray-500">
                  Thời gian còn lại
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Audio Player */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <audio
                ref={audioRef}
                controls
                style={{ width: '100%', marginBottom: '10px' }}
                aria-label="Audio player"
              />
              
              {error && (
                <div className="mt-2 text-sm text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              {errorMessage && (
                <div className="mt-2 text-sm text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage}
                </div>
              )}
              
              <div className="text-xs text-gray-500 mt-2">
                Current audio URL: {audioUrl || 'Not set'}
              </div>
            </div>
            
            {/* Script with blanks */}
            <div className="overflow-auto max-h-[50vh] p-2">
              {renderScript()}
            </div>

            {/* Submit button */}
            <div className="flex justify-end">
              <Button 
                onClick={handleSubmit}
                disabled={!isStarted || isLoading}
                className="focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang nộp bài...
                  </span>
                ) : (
                  'Nộp bài'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      
        {/* Warning Dialog */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
              Cảnh báo gian lận
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-amber-800 font-medium text-base">Cảnh báo vi phạm: {studentCheatingHistory.totalCheatingCount}/{studentCheatingHistory.maxAllowedCheating}</p>
              </div>
                
                <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full"
                    style={{ 
                      width: `${Math.min(100, (studentCheatingHistory.totalCheatingCount / studentCheatingHistory.maxAllowedCheating) * 100)}%`
                    }}
              ></div>
            </div>
                
                <p className="text-gray-700 mt-2">{cheatingMessage}</p>
                
                <div className="p-4 bg-amber-50 rounded-md border border-amber-100">
                  <p className="text-sm text-amber-800">
                    {studentCheatingHistory.totalCheatingCount >= studentCheatingHistory.maxAllowedCheating
                      ? "Tài khoản của bạn sẽ bị khóa do vượt quá số lần vi phạm cho phép."
                      : `Bạn còn ${studentCheatingHistory.maxAllowedCheating - studentCheatingHistory.totalCheatingCount} lần cảnh báo trước khi bài thi kết thúc`}
              </p>
            </div>
          </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Đã hiểu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      
      {/* Modal hiển thị kết quả */}
      {showResults && (
        <Dialog 
          open={showResults} 
          onOpenChange={setShowResults}
        >
          <DialogContent className="min-w-[70vw] max-w-[90vw] lg:max-w-[70vw] max-h-[90vh] overflow-y-auto bg-white p-0">
            <DialogHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 sticky top-0 z-10">
              <DialogTitle className="text-2xl font-bold text-gray-900">Kết quả bài làm</DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                {question?.title}
            </DialogDescription>
          </DialogHeader>
          
            <div className="p-6 space-y-6 max-h-[calc(90vh-8rem)] overflow-y-auto flex flex-col md:flex-row md:space-x-6">
              {/* Kết quả bài làm */}
              <div className="w-full md:w-2/3 space-y-6">
            {/* Hiển thị điểm số */}
                <Card className="shadow-md border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-gray-800">Điểm số</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center">
                      <div className="text-4xl font-bold text-primary mb-2">
                {scoreInfo.totalScore}%
              </div>
              <p className="text-sm text-gray-500">
                {scoreInfo.correctAnswers} đúng / {scoreInfo.correctAnswers + scoreInfo.incorrectAnswers} câu
              </p>
            </div>
                  </CardContent>
                </Card>
                  
                {/* Hiển thị script */}
                <Card className="shadow-md border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-gray-800">Nội dung bài nghe</CardTitle>
                    <CardDescription>
                      Bài nghe có {blanksPositions.length} chỗ trống cần điền
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-gray-800 space-y-2">
                      <p className="text-base leading-relaxed">
                        {question?.script}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                  
                {/* Hiển thị câu trả lời chi tiết */}
                <Card className="shadow-md border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-gray-800">Chi tiết câu trả lời</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Bảng so sánh câu trả lời */}
            {scoreInfo.errors.length > 0 && (
                <div className="border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          STT
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Đáp án của bạn
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Đáp án đúng
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {scoreInfo.errors.map((error, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-red-500">
                            {error.userAnswer || '(Trống)'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-green-500">
                            {error.correctAnswer}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            )}
                  </CardContent>
                </Card>
          </div>
          
              {/* Phân tích thống kê */}
              <div className="w-full md:w-1/3 space-y-6">
                {/* Hiển thị thông tin vi phạm */}
                <Card className="shadow-md border-gray-200">
                  <CardHeader className="pb-2 border-b">
                    <CardTitle className="text-lg text-gray-800 flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
                      Cảnh báo vi phạm
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-700 font-medium">Tổng số vi phạm:</span>
                      <Badge variant="outline" className={studentCheatingHistory.totalCheatingCount > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}>
                        {studentCheatingHistory.totalCheatingCount}/{studentCheatingHistory.maxAllowedCheating}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-700 font-medium">Vi phạm cho bài này:</span>
                      <Badge variant="outline" className={studentCheatingHistory.questionCheatingCount > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}>
                        {studentCheatingHistory.questionCheatingCount}
                      </Badge>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-md">
                      <p className="text-sm text-blue-700">
                        {studentCheatingHistory.totalCheatingCount === 0 
                          ? "Bạn chưa vi phạm quy định nào" 
                          : `Đã vi phạm ${studentCheatingHistory.totalCheatingCount} lần. Tài khoản sẽ bị khóa nếu vi phạm ${studentCheatingHistory.maxAllowedCheating} lần.`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Thông tin thời gian */}
                <Card className="shadow-md border-gray-200">
                  <CardHeader className="pb-2 border-b">
                    <CardTitle className="text-lg text-gray-800 flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-blue-500" />
                      Thống kê thời gian
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Thời gian làm bài:</span>
                        <span className="text-sm text-gray-900">{formatTime((question?.time_limit || 0) * 60 - remainingTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Thời gian cho phép:</span>
                        <span className="text-sm text-gray-900">{formatTime((question?.time_limit || 0) * 60)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Nút điều hướng */}
                <div className="space-y-3 mt-4">
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => navigate('/student/progress')}
                  >
              Xem kết quả gần đây
            </Button>
                  <Button 
                    className="w-full" 
                    onClick={() => navigate('/student/dashboard')}
                  >
              Quay lại trang chủ
            </Button>
                </div>
              </div>
            </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
};

export default QuestionDetail;


