import React, { useState, useEffect, useRef, useCallback, FocusEvent } from 'react';
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
import { Play, Volume2, AlertCircle, PauseCircle, Clock, Info, CheckCircle2, Maximize2, BookText, AlertTriangle, ArrowLeft, Trophy, Star, Heart, Lightbulb, ListTodo, Check } from 'lucide-react';
import StudentLayout from '@/layouts/StudentLayout';
import { submitStudentAnswers, submitAnswersText, markAssignmentAsCompleted, debugRLS, SUPABASE_URL, API_KEY } from '@/lib/api';
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
import { createPortal } from 'react-dom';
import { levenshteinDistance, wordOverlap } from '@/lib/utils/string-utils';

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
  enable_anti_cheating?: boolean;
  good_students_difficulty?: string;
  average_students_difficulty?: string;
  poor_students_difficulty?: string;
}

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
    position: relative;
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
    position: relative;
    z-index: 10;
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
  
  /* Add text wrapping styles */
  .script-container {
    word-wrap: break-word;
    word-break: normal;
    overflow-wrap: break-word;
    white-space: normal;
    hyphens: auto;
    width: 100%;
    max-width: 100%;
    word-spacing: 0.25em;
    letter-spacing: 0.01em;
  }
  
  .script-container span {
    display: inline-block;
    vertical-align: middle;
    margin: 0.125rem 0.25rem;
  }
  
  .script-container .input-wrapper {
    display: inline-flex;
    margin: 0.125rem 0.25rem;
    vertical-align: middle;
    flex-wrap: wrap;
    position: relative;
    z-index: 5;
  }

  /* Cải thiện hiển thị input */
  .dictation-input {
    z-index: 5;
    position: relative;
  }

  /* Cải thiện hiển thị nút */
  .interactive-button {
    position: relative;
    z-index: 5;
  }

  /* Đảm bảo dialog hiển thị đúng */
  .dialog-content {
    position: relative;
    z-index: 100;
  }

  /* Fix focus issues */
  .focus-visible:focus {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
    z-index: 10;
  }

  /* Fix specifically for Firefox */
  @-moz-document url-prefix() {
    .script-container input {
      z-index: 5;
    }
  }

  /* Fix specifically for mobile browsers */
  @media (hover: none) {
    .script-container input {
      z-index: 5;
      font-size: 16px; /* Prevent zoom on focus */
    }
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

  /* Đảm bảo dialog cảnh báo luôn hiển thị phía trên */
  .alert-dialog-content {
    position: relative;
    z-index: 200 !important; /* Cao hơn các phần tử khác */
    max-width: 500px;
    width: 100%;
  }

  /* Làm nổi bật nền dialog cảnh báo */
  .alert-dialog-overlay {
    background-color: rgba(0, 0, 0, 0.8) !important;
    backdrop-filter: blur(8px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Hiệu ứng rung cảnh báo */
  .warning-shake {
    animation: warning-shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
  }
  
  @keyframes warning-shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
  }

  /* Thêm hiệu ứng warning-shake cho dialog cảnh báo */
  @keyframes warning-shake {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    2% { transform: translate(-50%, -50%) rotate(1deg); }
    4% { transform: translate(-50%, -50%) rotate(0deg); }
    6% { transform: translate(-50%, -50%) rotate(-1deg); }
    8% { transform: translate(-50%, -50%) rotate(0deg); }
    10% { transform: translate(-50%, -50%) rotate(1deg); }
    12% { transform: translate(-50%, -50%) rotate(0deg); }
    14% { transform: translate(-50%, -50%) rotate(-1deg); }
    16% { transform: translate(-50%, -50%) rotate(0deg); }
    18% { transform: translate(-50%, -50%) rotate(1deg); }
    20% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(0deg); }
  }

  .warning-shake {
    animation: warning-shake 1s ease;
    animation-iteration-count: 2;
  }

  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999999 !important;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .anti-cheating-dialog {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 999999 !important;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.3) !important;
    border: 3px solid #EF4444 !important;
    animation: warning-entrance 0.5s ease-in-out !important;
    margin: 0 !important;
  }

  @keyframes warning-entrance {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
`;

// Cập nhật interface StudentCheatingHistory
interface StudentCheatingHistory {
  totalCheatingCount: number;
  questionCheatingCount: number; // Thêm trường này
  maxAllowedCheating: number;
  isAccountLocked: boolean;
}

const DictationExercise = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isStarted, setIsStarted] = useState(true); // Luôn bắt đầu ở trạng thái đã bắt đầu
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [blanksPositions, setBlanksPositions] = useState<number[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [cheatingAttempts, setCheatingAttempts] = useState(0);
  const [cheatingMessage, setCheatingMessage] = useState('');
  const [maxCheatingAttempts, setMaxCheatingAttempts] = useState(1); // Giảm xuống 1 lần duy nhất
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
    errors: Array<{index: number, userAnswer: string, correctAnswer: string, position?: number}>;
    detailedResults: Array<{index: number, position: number, studentAnswer: string, correctAnswer: string, normalized: {student: string, correct: string}, isCorrect: boolean}>;
  }>({
    totalScore: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    errors: [],
    detailedResults: []
  });
  const [studentCategory, setStudentCategory] = useState({ category: 'average', categoryDisplay: 'Trung bình' });
  // Thêm biến state mới để xác định chế độ hiển thị (word hoặc sentence)
  const [displayMode, setDisplayMode] = useState<'word' | 'sentence'>('word');

  // Add new loading states
  const [loadingStates, setLoadingStates] = useState({
    questionData: true,
    audioData: true,
    scriptData: true,
    userProgress: true
  });

  // Add data validation state
  const [dataValidation, setDataValidation] = useState({
    isValid: true,
    errorMessage: ''
  });

  // Add new state for fullscreen permission
  const [hasFullscreenPermission, setHasFullscreenPermission] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);

  // Add time-related states
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Add time tracking
  const [startTime, setStartTime] = useState<number | null>(null);
  const [audioPlayCount, setAudioPlayCount] = useState(0);

  // Thêm state để lưu số lần học sinh đã bị phát hiện gian lận
  const [studentCheatingHistory, setStudentCheatingHistory] = useState<StudentCheatingHistory>({
    totalCheatingCount: 0,
    questionCheatingCount: 0, // Thêm giá trị khởi tạo
    maxAllowedCheating: 7,
    isAccountLocked: false
  });

  // Thêm useEffect để tải thông tin học sinh sớm hơn - DI CHUYỂN ĐẾN ĐÂY
  useEffect(() => {
    const getStudentCategory = async () => {
      if (!user?.id) return;
      
      try {
        console.log('Đang tải thông tin phân loại học sinh...');
        
        // Kiểm tra từ database
        const { data, error } = await supabase
          .from('student_categories')
          .select('category')
          .eq('student_id', user.id)
          .order('last_updated', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('Lỗi khi tải thông tin phân loại học sinh:', error);
          return;
        }
        
        // Nếu có dữ liệu, cập nhật category
        if (data && data.length > 0) {
          let category = data[0]?.category || 'average';
          
          // Chuyển đổi poor -> weak nếu cần
          if (category === 'poor') {
            category = 'weak';
          }
          
          // Chuyển đổi hiển thị
          const categoryDisplay = 
            category === 'good' ? 'Giỏi (điền 50% cả câu)' : 
            category === 'weak' ? 'Yếu (điền 30% từ)' : 'Trung bình (điền 40% cụm từ)';
          
          console.log(`Đã tải thông tin học sinh: ${category} (${categoryDisplay})`);
          
          // Cập nhật state
          setStudentCategory({
            category,
            categoryDisplay
          });
          
          // Hiển thị thông báo cho người dùng biết cấp độ học sinh
          toast.info(`Bạn đang làm bài với cấp độ: ${categoryDisplay}`, {
            id: 'student-level-info',
            duration: 5000
          });
          
          // Cập nhật chế độ hiển thị dựa trên cấp độ học sinh
          if (category === 'good') {
            setDisplayMode('sentence');
            console.log('Đã đặt chế độ hiển thị: sentence cho học sinh giỏi');
          } else {
            setDisplayMode('word');
            console.log('Đã đặt chế độ hiển thị: word cho học sinh trung bình/yếu');
          }
          
        } else {
          console.log('Không tìm thấy thông tin phân loại, sử dụng mặc định: trung bình');
          setStudentCategory({
            category: 'average',
            categoryDisplay: 'Trung bình (điền 50% cụm từ)'
          });
          setDisplayMode('word');
        }
      } catch (e) {
        console.error('Exception khi tải thông tin phân loại học sinh:', e);
      }
    };
    
    getStudentCategory();
  }, [user?.id]);

  // Query để lấy thông tin bài thi
  const { data, isLoading: isLoadingQuestion, error: questionError } = useQuery({
    queryKey: ['question', questionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*, profiles(full_name)')
        .eq('id', questionId)
        .single();
      
      if (error) throw error;
      return data as Question;
    },
    enabled: !!questionId && !!user
  });

  const question = data;

  // Add constants for time calculation
  const MAX_AUDIO_PLAYS = 3; // Số lần được nghe lại tối đa
  const EXTRA_TIME_PERCENTAGE = 0.2; // 20% thời gian thêm

  // Format time display (mm:ss)
  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Calculate time limit based on audio duration
  const calculateTimeLimit = useCallback((duration: number) => {
    // Công thức: (Số lần nghe * thời lượng audio) + (20% * thời lượng audio)
    const timeInSeconds = (MAX_AUDIO_PLAYS * duration) + (duration * EXTRA_TIME_PERCENTAGE);
    return Math.ceil(timeInSeconds);
  }, []);

  // Update audio duration and time limit when audio is loaded
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      const duration = audio.duration;
      setAudioDuration(duration);
      
      // If time_limit is not set in database, calculate it
      if (!question?.time_limit) {
        const calculatedTimeLimit = calculateTimeLimit(duration);
        console.log('Calculated time limit:', calculatedTimeLimit);
        setTimeLimit(calculatedTimeLimit);
        setRemainingTime(calculatedTimeLimit);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [question, calculateTimeLimit]);

  // Initialize timer when time limit is set
  useEffect(() => {
    // If time_limit is set in database, use it
    if (question?.time_limit) {
      const timeInSeconds = question.time_limit * 60;
      setTimeLimit(timeInSeconds);
      setRemainingTime(timeInSeconds);
    }

    // Start countdown timer if we have a time limit
    if (timeLimit) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // console.log(`Starting timer with ${timeLimit} seconds`);
      
      timerRef.current = setInterval(() => {
        setRemainingTime((prevTime) => {
          if (prevTime <= 1) {
            // Time's up - submit answers
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            handleSubmit();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [question, timeLimit]);

  // Update UI to display time
  const renderTimer = () => {
    if (!timeLimit) return null;

    const timeString = formatTime(remainingTime);
    const percentageRemaining = (remainingTime / timeLimit) * 100;
    const isLowTime = remainingTime < 60; // Less than 1 minute

    return (
      <div className="text-right whitespace-nowrap">
        <div className={`text-2xl font-bold transition-colors duration-300 ${
          isLowTime ? 'text-red-500 animate-pulse' : 'text-primary'
        }`}>
          {timeString}
        </div>
        <div className="text-sm text-gray-500">
          Thời gian còn lại
        </div>
        {isLowTime && (
          <div className="text-xs text-red-500 mt-1">
            Sắp hết giờ!
          </div>
        )}
      </div>
    );
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

  // Update togglePlayPause to count audio plays
  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    try {
      if (audio.paused) {
        await audio.play();
        setAudioPlaying(true);
      } else {
        audio.pause();
        setAudioPlaying(false);
      }
    } catch (err) {
      setError('Không thể phát audio. Vui lòng thử lại sau.');
    }
  };

  // Start timer when audio first plays
  useEffect(() => {
    if (isAudioPlaying && startTime === null) {
      setStartTime(Date.now());
    }
  }, [isAudioPlaying, startTime]);

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

  // Cleanup the useEffect for audio setup
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;
      
      console.log('DEBUG: Setting up audio with URL:', audioUrl);
      
      // Reset audio
      audio.pause();
      audio.currentTime = 0;
      
      // Set source and load
      audio.src = audioUrl;
      audio.preload = 'auto';
      audio.load();
      
      // Add detailed event listeners
      const handleLoadStart = () => {
        console.log('DEBUG: Audio load started for:', audioUrl);
        setIsAudioLoading(true);
        setErrorMessage('');
      };
      
      const handleCanPlay = () => {
        console.log('DEBUG: Audio can play now, duration:', audio.duration, 'readyState:', audio.readyState);
        setIsAudioLoading(false);
        // Force update duration here too
        setDuration(audio.duration);
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
        
        console.error(`DEBUG: Audio error (${errorMsg}):`, error);
        setIsAudioLoading(false);
        setErrorMessage(`Không thể phát audio: ${errorMsg}`);
      };
      
      const handlePlay = () => {
        console.log('DEBUG: Audio play event fired, currentTime:', audio.currentTime, 'duration:', audio.duration);
        setAudioPlaying(true);
      };
      
      const handlePause = () => {
        console.log('DEBUG: Audio pause event, currentTime:', audio.currentTime);
        setAudioPlaying(false);
      };
      
      const handleEnded = () => {
        console.log('DEBUG: Audio playback ended');
        setAudioPlaying(false);
        setIsAudioPlaying(false);
      };
      
      // Add additional event for loaded metadata
      const handleLoadedMetadata = () => {
        console.log('DEBUG: Audio loadedmetadata event, duration:', audio.duration);
        setDuration(audio.duration);
      };
      
      // Add event listeners
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        // Cleanup
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [audioUrl]);

  // Handle audio time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    // Update more frequently for smoother progress bar
    let updateTimeInterval: NodeJS.Timeout | null = null;
    
    const startUpdateInterval = () => {
      if (updateTimeInterval) clearInterval(updateTimeInterval);
      updateTimeInterval = setInterval(() => {
        if (audio && !audio.paused) {
          setCurrentTime(audio.currentTime);
          if (audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
          }
        }
      }, 50); // Update every 50ms for smoother progress
    };
    
    const stopUpdateInterval = () => {
      if (updateTimeInterval) {
        clearInterval(updateTimeInterval);
        updateTimeInterval = null;
      }
    };

    // Listen for play/pause events to start/stop interval
    const handlePlay = () => {
      setAudioPlaying(true);
      startUpdateInterval();
    };
    
    const handlePause = () => {
      setAudioPlaying(false);
      stopUpdateInterval();
    };
    
    // Handle audio loaded metadata
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    
    // Start interval if audio is already playing
    if (!audio.paused) {
      startUpdateInterval();
    }
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      stopUpdateInterval();
    };
  }, [audioRef.current]);

  // Function to handle fullscreen changes
  const handleFullscreenChange = useCallback(() => {
    const isInFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isInFullscreen);
    
    if (!isInFullscreen) {
      // Khi thoát khỏi chế độ toàn màn hình, hiển thị cả prompt lẫn warning
      setShowFullscreenPrompt(true);
      
      // Vẫn ghi nhận là gian lận nếu đã bắt đầu làm bài
      if (hasFullscreenPermission && isStarted) {
      handleCheatingAttempt('Thoát khỏi chế độ toàn màn hình');
    }
    }
  }, [hasFullscreenPermission, isStarted]);

  // New function to handle mouse leave detection
  const handleMouseLeave = useCallback(() => {
    if (isStarted) {
      handleCheatingAttempt('Di chuyển chuột ra khỏi cửa sổ');
    }
  }, [isStarted]);

  // Cập nhật hàm handleVisibilityChange để kết thúc bài thi ngay lập tức
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden' && isStarted) {
      // Ghi nhận hành vi gian lận và kết thúc ngay khi rời khỏi tab
      handleCheatingAttempt('Chuyển sang tab khác');
    } else if (document.visibilityState === 'visible') {
      // Khi quay lại tab
      if (!document.fullscreenElement) {
        // Hiển thị fullscreen prompt
        setShowFullscreenPrompt(true);
        
        // Nếu đã bắt đầu làm bài, ghi nhận hành vi gian lận và kết thúc bài thi
        if (isStarted && hasFullscreenPermission) {
          // Hiển thị thông báo cảnh báo rõ ràng trước khi kết thúc
          setShowWarning(true);
          setCheatingMessage(`Cảnh báo: Hệ thống đã phát hiện hành vi gian lận (Rời khỏi bài làm). 
          Bài thi sẽ bị hủy ngay lập tức theo quy định.`);
          
          // Ghi nhận hành vi gian lận này nếu chưa được ghi nhận khi rời khỏi
          handleCheatingAttempt('Rời khỏi bài làm và quay lại');
        }
      } else {
        // Đã ở chế độ toàn màn hình, reset tương tác
        resetInteractions();
      }
    }
  }, [isStarted, hasFullscreenPermission]);

  // Function to reset interactions after returning to fullscreen
  const resetInteractions = () => {
    // Re-focus relevant elements
    const interactiveElement = document.querySelector('.dictation-input') as HTMLElement;
    if (interactiveElement) {
      setTimeout(() => {
        interactiveElement.focus();
      }, 500);
    }
  };

  // Thêm useEffect để lấy thông tin gian lận của học sinh
  useEffect(() => {
    const fetchCheatingHistory = async () => {
      if (!user?.id || !questionId) return;
      
      try {
        // Lấy thông tin gian lận từ bảng profiles cho tổng số lần vi phạm
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('cheating_locked, total_cheating_count')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Lỗi khi kiểm tra trạng thái khóa tài khoản:', profileError);
          return;
        }
        
        // Đặt thông tin tổng số lần vi phạm từ profiles
        const globalCheatingCount = profileData.total_cheating_count || 0;
        const isAccountLocked = profileData.cheating_locked || false;
        
        // Lấy thông tin số lần gian lận cho bài tập cụ thể từ bảng student_answers
        const { data: cheatingData, error: cheatingError } = await supabase
          .from('student_answers')
          .select('cheating_attempts')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .is('is_completed', true)
          .order('created_at', { ascending: false });
        
        if (cheatingError) {
          console.error('Lỗi khi lấy lịch sử gian lận cho bài tập cụ thể:', cheatingError);
          return;
        }
        
        // Tính tổng số lần gian lận cho bài tập này
        let questionCheatingCount = 0;
        if (cheatingData && cheatingData.length > 0) {
          questionCheatingCount = cheatingData.reduce((sum, record) => 
            sum + (record.cheating_attempts || 0), 0);
        }
        
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
  }, [user?.id, questionId]);

  // Cập nhật hàm handleCheatingAttempt để cập nhật dữ liệu gian lận
  const handleCheatingAttempt = (reason: string) => {
    const updatedAttempts = cheatingAttempts + 1;
    setCheatingAttempts(updatedAttempts);
    setCheatingMessage(`Cảnh báo: Hệ thống đã phát hiện hành vi gian lận (${reason}). 
      Bài thi sẽ bị hủy ngay lập tức theo quy định.`);
    setShowWarning(true);
    
    // Record cheating attempt in database
    if (user?.id && questionId) {
      // Lấy dữ liệu mới nhất từ profile trước khi cập nhật
      supabase
        .from('profiles')
        .select('total_cheating_count, cheating_locked')
        .eq('id', user.id)
        .single()
        .then(({ data: profileData, error: profileError }) => {
          if (profileError) {
            console.error('Lỗi khi lấy tổng số lần gian lận:', profileError);
            return;
          }
          
          // Lấy giá trị mới nhất từ database
          const currentTotalCheating = profileData?.total_cheating_count || 0;
          const newTotalCheating = currentTotalCheating + 1;
          
          console.log('Profile data trước khi cập nhật:', {
            currentTotalCheating,
            newTotalCheating
          });

          // Trước tiên kiểm tra bản ghi hiện tại và lấy attempt_count chính xác
      supabase
        .from('student_answers')
            .select('id, attempt_count')
            .eq('student_id', user.id)
            .eq('question_id', questionId)
            .order('attempt_count', { ascending: false })
            .limit(1)
            .then(({ data: existingData, error: existingError }) => {
              if (existingError) {
                console.error('Lỗi khi lấy thông tin bản ghi hiện tại:', existingError);
                return;
              }
              
              // Sử dụng ID hiện tại nếu có, nếu không thì tạo bản ghi mới
              if (existingData && existingData.length > 0) {
                const recordId = existingData[0].id;
                console.log('Tìm thấy bản ghi hiện tại:', recordId);
                
                // Cập nhật bản ghi hiện tại
                supabase
                  .from('student_answers')
                  .update({
                    cheating_attempts: updatedAttempts,
                    is_completed: true, // Đánh dấu đã hoàn thành (do gian lận)
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    metadata: {
                      terminated_reason: `Gian lận: ${reason}`,
                      terminated_at: new Date().toISOString(),
                      total_cheating_history: newTotalCheating,
                      question_cheating_history: updatedAttempts
                    }
                  })
                  .eq('id', recordId)
                  .then(({ error: updateError }) => {
                    if (updateError) {
                      console.error('Lỗi khi cập nhật bản ghi vi phạm:', updateError);
                    } else {
                      console.log('Đã cập nhật bản ghi vi phạm với ID:', recordId);
                    }
                  });
              } else {
                // Không tìm thấy bản ghi hiện tại, tạo mới với attempt_count = 1
                console.log('Không tìm thấy bản ghi hiện tại, tạo mới');
                supabase
                  .from('student_answers')
                  .insert({
              student_id: user.id,
              question_id: questionId,
              cheating_attempts: updatedAttempts,
                    is_completed: true,
              completed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
                    attempt_count: 1, // Bắt đầu với 1 nếu không có bản ghi nào
                    attempt_timestamp: new Date().toISOString(),
              metadata: {
                terminated_reason: `Gian lận: ${reason}`,
                terminated_at: new Date().toISOString(),
                total_cheating_history: newTotalCheating,
                question_cheating_history: updatedAttempts
              }
            })
                  .then(({ error: insertError }) => {
                    if (insertError) {
                      console.error('Lỗi khi tạo bản ghi vi phạm mới:', insertError);
              } else {
                      console.log('Đã tạo bản ghi vi phạm mới');
                    }
                  });
              }
            });
            
          // Luôn cập nhật tổng số lần gian lận trong profiles bất kể từ phần nào
          supabase
            .from('profiles')
            .update({
              total_cheating_count: newTotalCheating,
              cheating_locked: newTotalCheating >= studentCheatingHistory.maxAllowedCheating
            })
            .eq('id', user.id)
            .then(({ error: updateError }) => {
              if (updateError) {
                console.error('Lỗi khi cập nhật tổng số lần gian lận trong profiles:', updateError);
              } else {
                console.log('Đã cập nhật tổng số lần gian lận trong profiles:', newTotalCheating);
                
                // Đọc lại dữ liệu sau khi đã cập nhật
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
                      
                      // Cập nhật state với dữ liệu mới nhất
                      setStudentCheatingHistory(prev => ({
                        ...prev,
                        totalCheatingCount: updatedProfile?.total_cheating_count || 0,
                        isAccountLocked: updatedProfile?.cheating_locked || false
                      }));
                    }
                  });
              }
            });
            
          // Cập nhật state trước khi đọc lại từ database
          setStudentCheatingHistory({
            ...studentCheatingHistory,
            totalCheatingCount: newTotalCheating,
            questionCheatingCount: updatedAttempts,
            isAccountLocked: newTotalCheating >= studentCheatingHistory.maxAllowedCheating
          });
        });
    }
    
    // Kết thúc bài thi ngay lập tức không phụ thuộc vào số lần
    resetTest(reason);
  };

  // Cập nhật hàm resetTest để chỉ rõ lý do kết thúc
  const resetTest = (reason = '') => {
    // Clean up
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Exit fullscreen immediately to ensure dialog is visible
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.error("Error exiting fullscreen:", err);
        });
      }
    } catch (err) {
      console.error("Error checking fullscreen:", err);
    }
    
    // Show error message
    toast.error(`Bài làm đã bị hủy do phát hiện hành vi gian lận: ${reason}`, {
      duration: 5000,
    });
    
    // Reset state to the beginning
    setIsStarted(false);
    
    // Show anti-cheating warning dialog
    setShowAntiCheatingWarning(true);
  };

  // Cập nhật AlertDialog để hiển thị thông báo nghiêm khắc hơn
  {showWarning && (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent 
        className="backdrop-blur-lg bg-white/90 border-2 border-red-500 shadow-2xl dialog-content alert-dialog-content warning-shake" 
        tabIndex={-1}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-50/60 to-orange-50/60 opacity-90 rounded-lg"></div>
        <AlertDialogHeader className="relative z-10">
          <div className="flex items-center justify-center mb-2">
            <AlertTriangle className="h-12 w-12 text-red-500 mr-2" />
            <AlertDialogTitle className="text-2xl text-red-600 font-bold">VI PHẠM QUY CHẾ THI!</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-gray-800 text-center text-base">
            {cheatingMessage || 'Hệ thống đã phát hiện hành vi gian lận. Bài thi đã bị hủy theo quy định.'}
            <div className="mt-4 p-4 bg-red-100 rounded-lg border border-red-200 font-medium text-red-800 text-lg">
              Bài thi của bạn đã bị hủy và thông báo cho giáo viên
            </div>
            
            {/* Hiển thị thêm thông tin vi phạm cho bài tập hiện tại */}
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="font-medium text-yellow-800">Bài tập này: {studentCheatingHistory.questionCheatingCount}/{3} lần vi phạm</p>
              <div className="mt-1 flex justify-center gap-1.5">
                {[...Array(3)].map((_, index) => (
                  <div 
                    key={`question-${index}`}
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      index < studentCheatingHistory.questionCheatingCount 
                        ? 'bg-yellow-500 text-white' 
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                ))}
              </div>
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="relative z-10 flex justify-center mt-4">
          <AlertDialogAction 
            onClick={() => {
              setShowWarning(false);
              navigate(`/student/question/${questionId}`);
            }}
            className="bg-gradient-to-r from-red-500 to-orange-500 shadow-md hover:shadow-xl transition-shadow px-8 py-3 text-lg font-medium"
          >
            Quay lại trang chủ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )}

  // Cập nhật hàm enableFullscreen để giải quyết vấn đề permissions
  const enableFullscreen = async () => {
    try {
      // Chỉ thực hiện khi có containerRef và không ở chế độ toàn màn hình
      if (!document.fullscreenElement && containerRef.current) {
        // Sử dụng try-catch để bắt lỗi permissions
        try {
        await containerRef.current.requestFullscreen();
          console.log('Đã bật chế độ toàn màn hình');
        } catch (err) {
          console.error('Lỗi khi bật chế độ toàn màn hình:', err);
          // Hiện thông báo lỗi dễ hiểu hơn
          toast.error('Không thể bật chế độ toàn màn hình', {
            description: 'Trình duyệt không cho phép bật tự động. Vui lòng nhấn F11 hoặc sử dụng nút toàn màn hình của trình duyệt.'
          });
        }
        
        // Cập nhật state bất kể có lỗi hay không
        setIsFullscreen(!!document.fullscreenElement);
        setHasFullscreenPermission(true);
        setShowFullscreenPrompt(false);
      } else {
        // Đã ở chế độ toàn màn hình, chỉ cập nhật state
        setIsFullscreen(true);
        setHasFullscreenPermission(true);
        setShowFullscreenPrompt(false);
      }
    } catch (err) {
      console.error('Error in enableFullscreen:', err);
      // Vẫn cho phép tương tác nếu không thể bật toàn màn hình
      setHasFullscreenPermission(true);
      setShowFullscreenPrompt(false);
      toast.error('Không thể bật chế độ toàn màn hình', {
        description: 'Vui lòng cho phép quyền toàn màn hình để có trải nghiệm tốt nhất'
      });
    }
  };
  
  // Setup anti-cheating event listeners
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    // Cập nhật window focus handler
    const handleWindowFocus = () => {
      // Kiểm tra trạng thái fullscreen khi cửa sổ được focus lại
      if (!document.fullscreenElement) {
        setShowFullscreenPrompt(true);
        
        // Nếu đã bắt đầu làm bài, ghi nhận hành vi gian lận
        if (isStarted && hasFullscreenPermission) {
          handleCheatingAttempt('Thoát khỏi chế độ toàn màn hình khi focus lại cửa sổ');
        }
      }
    };
    
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [handleFullscreenChange, handleVisibilityChange, handleMouseLeave, isStarted, hasFullscreenPermission]);

  // Fetch question anti-cheating settings
  useEffect(() => {
    if (question) {
      // Set max cheating attempts from question settings if available
      if (question.max_cheating_attempts) {
        setMaxCheatingAttempts(question.max_cheating_attempts);
      }
      
      // Check if we should enable additional anti-cheating features
      // This is included for future expansion
      const enableAntiCheating = question.enable_anti_cheating !== false;
      if (!enableAntiCheating) {
        // If anti-cheating is disabled, remove event listeners
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    }
  }, [question, handleMouseLeave]);

  // Handle slider changes for audio seeking
  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = value[0];
    audio.currentTime = (newTime / 100) * audio.duration;
    setCurrentTime((newTime / 100) * audio.duration);
  };
  
  // Handle answer input changes
  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  // Thêm hàm tiện ích để lưu và đọc thời gian còn lại từ localStorage
  const saveRemainingTimeToLocal = (questionId: string, timeRemaining: number, endTime: number) => {
    if (!questionId) return;
    try {
      localStorage.setItem(`dictation_time_${questionId}`, JSON.stringify({
        remainingTime: timeRemaining,
        endTimestamp: endTime,
        updatedAt: Date.now()
      }));
    } catch (err) {
      console.error('Lỗi khi lưu thời gian:', err);
    }
  };

  const getRemainingTimeFromLocal = (questionId: string): number | null => {
    if (!questionId) return null;
    try {
      const savedData = localStorage.getItem(`dictation_time_${questionId}`);
      if (!savedData) return null;
      
      const data = JSON.parse(savedData);
      const now = Date.now();
      
      // Nếu đã quá thời gian kết thúc, trả về 0
      if (now >= data.endTimestamp) {
        return 0;
      }
      
      // Tính toán thời gian còn lại
      return Math.max(0, Math.floor((data.endTimestamp - now) / 1000));
    } catch (err) {
      console.error('Lỗi khi đọc thời gian:', err);
      return null;
    }
  };
  
  // Hàm tải tiến trình bài làm từ database
  const loadExistingProgress = async () => {
    if (!user?.id || !questionId) return;
    
    try {
      // Use direct fetch with proper headers instead of supabase client
      const apiUrl = `${SUPABASE_URL}/rest/v1/student_answers?student_id=eq.${user.id}&question_id=eq.${questionId}&is_completed=eq.false&order=attempt_count.desc&limit=1`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status !== 404) {
          console.error('Lỗi khi tải bản ghi tiến trình:', response.status, await response.text());
        }
        return;
      }
      
      const records = await response.json();
      if (!records || records.length === 0 || !records[0].metadata) {
        return;
      }
      
      const data = records[0];
      
      // Kiểm tra nếu có thông tin thời gian
      if (data.metadata.startTime && data.metadata.timeLimit) {
        const startTime = new Date(data.metadata.startTime).getTime();
        const timeLimit = data.metadata.timeLimit; // seconds
        const now = Date.now();
        
        // Tính toán thời gian đã trôi qua (seconds)
        const elapsedTime = Math.floor((now - startTime) / 1000);
        
        // Tính toán thời gian còn lại
        const remaining = Math.max(0, timeLimit - elapsedTime);
        const endTimestamp = now + (remaining * 1000);
        
        // console.log(`Tiếp tục bài làm từ DB: Đã trôi qua ${elapsedTime}s, còn lại ${remaining}s`);
        
        // Cập nhật thời gian còn lại
        setRemainingTime(remaining);
        
        // Lưu vào localStorage để lần sau load nhanh hơn
        saveRemainingTimeToLocal(questionId, remaining, endTimestamp);
        
        // Set the record ID for submission
        if (data.id) {
          submissionRecordIdRef.current = data.id;
        }
        
        // Nếu thời gian đã hết nhưng bản ghi chưa completed, đánh dấu là đã hoàn thành
        if (remaining <= 0 && !data.is_completed) {
          console.log('Hết thời gian (từ DB), chuẩn bị nộp bài...');
          
          if (submissionRecordIdRef.current) {
            submitAnswersText(submissionRecordIdRef.current, JSON.stringify(answers))
              .then(() => navigate(`/student/dictation-result/${questionId}`))
              .catch(err => console.error('Lỗi khi nộp bài:', err));
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải tiến trình bài làm:', err);
    }
  };

  // Add a debounce ref to prevent too frequent API calls
  const debounceSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cập nhật useEffect để sử dụng cả localStorage và database
  useEffect(() => {
    // Kiểm tra localStorage trước (phản hồi nhanh)
    const localTimeRemaining = getRemainingTimeFromLocal(questionId || '');
    if (localTimeRemaining !== null) {
      console.log(`Thời gian còn lại từ localStorage: ${localTimeRemaining}s`);
      setRemainingTime(localTimeRemaining);
      
      // Nếu hết thời gian, tự động nộp bài
      if (localTimeRemaining <= 0) {
        console.log('Hết thời gian (từ localStorage), chuẩn bị nộp bài...');
        const submitTimeout = setTimeout(() => {
          if (user?.id && questionId) {
            submitAnswersText(submissionRecordIdRef.current || '', JSON.stringify(answers))
              .then(() => navigate(`/student/dictation-result/${questionId}`))
              .catch(err => console.error('Lỗi khi nộp bài:', err));
          }
        }, 1000);
        
        return () => clearTimeout(submitTimeout);
      }
    }
    
    // Prevent unnecessary API calls when answers change frequently
    // Only load from database on initial mount or when questionId/user changes
    const shouldReloadFromDB = !debounceSaveTimerRef.current;
    
    if (shouldReloadFromDB) {
      // Clear any existing debounce timer
      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
        debounceSaveTimerRef.current = null;
      }
      
      // Only load from database occasionally, not on every keystroke
      loadExistingProgress();
    } else {
      // Set a debounce timer to save answers to database, but don't need to reload progress
      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
      }
      
      debounceSaveTimerRef.current = setTimeout(() => {
        // Just clear the flag when timer completes
        debounceSaveTimerRef.current = null;
      }, 2000); // 2 second debounce
    }
    
    return () => {
      // Clean up the debounce timer on unmount
      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
        debounceSaveTimerRef.current = null;
      }
    };
  }, [user?.id, questionId, answers, navigate]);

  // Cập nhật lại đồng hồ đếm ngược để lưu thời gian định kỳ
  useEffect(() => {
    // Start countdown timer if we have a time limit
    if (remainingTime > 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // console.log(`Starting timer with ${remainingTime} seconds remaining`);
      
      timerRef.current = setInterval(() => {
        setRemainingTime((prevTime) => {
          const newTime = prevTime - 1;
          
          // Lưu thời gian còn lại vào localStorage mỗi 15 giây
          if (newTime % 15 === 0 && questionId) {
            const endTimestamp = Date.now() + (newTime * 1000);
            saveRemainingTimeToLocal(questionId, newTime, endTimestamp);
          }
          
          if (newTime <= 0) {
            // Time's up - submit answers
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            handleSubmit();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [remainingTime, questionId]);

  // Hàm tạo bản ghi student_answer khi bắt đầu làm bài
  const createStudentAnswer = async () => {
    if (!user || !questionId) {
      console.error("Missing user or questionId");
      return null;
    }
    
    try {
      console.log("Kiểm tra và tạo bản ghi student_answer mới...");
      
      // Kiểm tra bản ghi hiện tại
      const { data: existingAnswers, error: checkError } = await supabase
        .from('student_answers')
        .select('id, attempt_count, is_completed, cheating_attempts, metadata, started_at')
        .eq('student_id', user.id)
        .eq('question_id', questionId)
        .order('attempt_count', { ascending: false })
        .limit(1);
      
      if (checkError) {
        console.error("Error checking existing records:", checkError);
        toast.error("Lỗi khi kiểm tra bài làm đã tồn tại");
        return null;
      }
      
      // Tính toán attempt_count mới
      const currentAttemptCount = existingAnswers && existingAnswers.length > 0 
        ? (existingAnswers[0].attempt_count || 0) + 1 
        : 1;
      
      // Kiểm tra xem bản ghi cũ đã hoàn thành hoặc có gian lận không
      const shouldCreateNewRecord = !existingAnswers || 
                                   existingAnswers.length === 0 || 
                                   existingAnswers[0].is_completed === true || 
                                   (existingAnswers[0].cheating_attempts || 0) > 0;
      
      // Tính thời gian bắt đầu và dự kiến kết thúc
      const now = new Date();
      const startTime = now.toISOString();
      const nowTimestamp = now.getTime();
      
      // Tính toán thời gian kết thúc dự kiến (dựa trên time_limit của câu hỏi hoặc mặc định)
      const questionTimeLimit = question?.time_limit ? question.time_limit * 60 : 600; // seconds
      const estimatedEndTime = new Date(nowTimestamp + questionTimeLimit * 1000).toISOString();
      const endTimestamp = nowTimestamp + (questionTimeLimit * 1000);
      
      // Lưu thời gian vào localStorage
      saveRemainingTimeToLocal(questionId, questionTimeLimit, endTimestamp);
      
      const timerMetadata = {
        startTime: startTime,
        estimatedEndTime: estimatedEndTime,
        timeLimit: questionTimeLimit
      };
      
      if (shouldCreateNewRecord) {
        console.log(`Tạo bản ghi mới với attempt_count = ${currentAttemptCount}`);
        
        // Tạo bản ghi mới
      const { data, error } = await supabase
        .from('student_answers')
        .insert({
          student_id: user.id,
          question_id: questionId,
            started_at: startTime,
            is_completed: false,
            cheating_attempts: 0,
            attempt_count: currentAttemptCount,
            attempt_timestamp: startTime,
            metadata: timerMetadata
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Error creating student answer record:', error);
        toast.error("Lỗi khi tạo bản ghi bài làm");
        return null;
      }
      
      console.log("Created new record:", data.id);
      submissionRecordIdRef.current = data.id;
      return data.id;
      } else {
        // Cập nhật metadata với thông tin thời gian cho bản ghi cũ nếu chưa có
        if (!existingAnswers[0].metadata || !existingAnswers[0].metadata.startTime) {
          await supabase
            .from('student_answers')
            .update({
              metadata: timerMetadata
            })
            .eq('id', existingAnswers[0].id);
        }
        
        // Dùng lại bản ghi cũ nếu nó chưa hoàn thành và không có gian lận
        console.log("Using existing incomplete record:", existingAnswers[0].id);
        submissionRecordIdRef.current = existingAnswers[0].id;
        return existingAnswers[0].id;
      }
    } catch (error) {
      console.error('Exception creating student answer record:', error);
      toast.error("Lỗi không xác định khi tạo bản ghi bài làm");
      return null;
    }
  };

  // Calculate score based on student answers
  const calculateScore = () => {
    if (!question) return { totalScore: 0, correctAnswers: 0, incorrectAnswers: 0, errors: [], detailedResults: [] };
    
    const script = question.script.split(/\s+/);
    let correctCount = 0;
    const errors: Array<{index: number, userAnswer: string, correctAnswer: string, position?: number}> = [];
    
    // Lưu lại kết quả chi tiết để debug
    const detailedResults = [];
    
    // Hàm chuẩn hóa đáp án - loại bỏ dấu câu và khoảng trắng thừa
    const normalizeAnswer = (text: string): string => {
      return text.toString().toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '') // loại bỏ dấu câu
        .replace(/\s+/g, ' ')  // chuẩn hóa khoảng trắng
        .trim();              // loại bỏ khoảng trắng đầu/cuối
    };
    
    if (displayMode === 'sentence') {
      // Xử lý đánh giá kết quả cho chế độ câu/cụm từ
      // Đánh giá từng từ riêng biệt trong các câu đã chọn
      blanksPositions.forEach((position, index) => {
      // Đảm bảo dữ liệu hợp lệ và loại bỏ dấu câu, khoảng trắng thừa
        const studentAnswer = normalizeAnswer(answers[index] || '');
        const correctAnswer = normalizeAnswer(script[position] || '');
      
      // QUAN TRỌNG: Nếu học sinh không điền gì, luôn tính là sai
      const isCorrect = studentAnswer !== '' && studentAnswer === correctAnswer;
      
        // Log chi tiết để debug
        console.log(`Comparing word answer ${index} at position ${position}:`, {
        studentAnswer,
        correctAnswer,
        isCorrect,
          originalStudentAnswer: answers[index] || '',
        originalCorrectAnswer: script[position] || ''
      });
      
      detailedResults.push({
        index,
        position,
          studentAnswer: answers[index] || '',
        correctAnswer: script[position] || '',
        normalized: {
          student: studentAnswer,
          correct: correctAnswer
        },
          isCorrect,
          isSentence: false
      });
      
      if (isCorrect) {
        correctCount++;
      } else {
        errors.push({
          index,
            userAnswer: answers[index] || '',
          correctAnswer: script[position] || '',
            position
        });
      }
    });
    } else {
      // Xử lý đánh giá kết quả cho chế độ từ đơn lẻ (mặc định)
      blanksPositions.forEach((position, index) => {
      // Đảm bảo dữ liệu hợp lệ và loại bỏ dấu câu, khoảng trắng thừa
        const studentAnswer = normalizeAnswer(answers[index] || '');
        const correctAnswer = normalizeAnswer(script[position] || '');
      
      // QUAN TRỌNG: Nếu học sinh không điền gì, luôn tính là sai
      const isCorrect = studentAnswer !== '' && studentAnswer === correctAnswer;
      
      // Log chi tiết từng câu trả lời để debug
      console.log(`Comparing answer ${index}:`, {
        studentAnswer,
        correctAnswer,
        isCorrect,
          originalStudentAnswer: answers[index] || '',
        originalCorrectAnswer: script[position] || ''
      });
      
      detailedResults.push({
        index,
        position,
          studentAnswer: answers[index] || '',
        correctAnswer: script[position] || '',
        normalized: {
          student: studentAnswer,
          correct: correctAnswer
        },
          isCorrect,
          isSentence: false
      });
      
      if (isCorrect) {
        correctCount++;
      } else {
        errors.push({
          index,
            userAnswer: answers[index] || '',
          correctAnswer: script[position] || '',
            position
        });
      }
    });
    }
    
    // Tính điểm tổng thể
    const totalPositions = blanksPositions.length;
    const totalScore = totalPositions > 0 ? Math.round((correctCount / totalPositions) * 100) : 0;
    
    console.log(`Score calculation complete: ${correctCount}/${totalPositions} = ${totalScore}%`);
    
    return {
      totalScore,
      correctAnswers: correctCount,
      incorrectAnswers: totalPositions - correctCount,
      errors,
      detailedResults
    };
  };

  // Xử lý thành công sau khi nộp bài
  const handleSubmitSuccess = () => {
    console.log('Đã nộp bài thành công!');
    toast.success('Đã nộp bài thành công!');
    
    // Calculate final time taken in seconds
    const finalTimeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    console.log(`Final timeTaken: ${finalTimeTaken} seconds, audioPlayCount: ${audioPlayCount}`);
    
    // Đảm bảo scoreInfo đã được cập nhật đúng
    const finalScoreInfo = {
      ...scoreInfo,
      timeTaken: finalTimeTaken,
      audioPlayCount,
      completedAt: new Date().toISOString()
    };
    
    // Log thông tin cuối cùng gửi đến trang kết quả
    console.log('Final score info being sent to result page:', finalScoreInfo);
    
    // Không cần truyền dữ liệu phức tạp qua state nữa, vì đã lưu vào database
    // Chuyển sang trang kết quả và để trang đó đọc dữ liệu từ database
    navigate(`/student/dictation-result/${questionId}`);
  };

  // Hàm xử lý nộp bài
  const handleSubmit = async () => {
    console.log('Tải lên thành cho bài thi...');
    
    try {
      if (!user?.id) {
        console.error('User not authenticated');
        toast.error('Bạn chưa đăng nhập');
        return;
      }
      
      if (!questionId) {
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
      console.log('Safe answers array:', safeAnswers);
      
      // Chuẩn bị danh sách đáp án đúng từ blanksPositions
      const script = question.script.split(/\s+/);
      const correctAnswers = blanksPositions.map(position => script[position] || '');
      
      // Kiểm tra và log từng đáp án
      console.log('Detailed answers comparison:');
      blanksPositions.forEach((position, index) => {
        const userAnswer = safeAnswers[index] || '';
        const correctAnswer = script[position] || '';
        console.log(`Answer ${index + 1}: Position ${position + 1}`, {
          word: script[position],
          userAnswer,
          correctAnswer,
          isCorrect: (userAnswer.trim() !== '') && (userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase())
        });
      });
      
      // Tính điểm trước khi gửi
      const scoreResults = calculateScore();
      setScoreInfo(scoreResults);
      
      // Tính thời gian làm bài cuối cùng
      const finalTimeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
      
      // Đảm bảo thời gian làm bài ít nhất là 30 giây và số lần nghe ít nhất là 1
      const effectiveTimeTaken = finalTimeTaken > 0 ? finalTimeTaken : 30;
      const effectiveAudioPlayCount = audioPlayCount > 0 ? audioPlayCount : 1;
      
      console.log(`Saving timeTaken: ${effectiveTimeTaken} seconds (original: ${finalTimeTaken}), audioPlayCount: ${effectiveAudioPlayCount} (original: ${audioPlayCount})`);
      
      // Lấy kết quả phân tích lỗi từ hàm có sẵn 
      const errorAnalysis = analyzeErrors(safeAnswers, correctAnswers);
      
      // QUAN TRỌNG: Chuyển đổi danh sách câu trả lời và đáp án đúng thành 2 chuỗi JSON để lưu vào cột answers_text và correct_answers_text
      const answers_text = JSON.stringify(safeAnswers);
      const correct_answers_text = JSON.stringify(correctAnswers);
      
      // Tạo metadata với dữ liệu rõ ràng và thêm thông tin phân tích lỗi
      const totalQuestionsCount = blanksPositions.length;
      
      // Log thông tin tính điểm trước khi lưu vào database
      console.log('Score calculation before saving:', {
        totalQuestions: totalQuestionsCount,
        correctAnswers: scoreResults.correctAnswers,
        incorrectAnswers: scoreResults.incorrectAnswers,
        scoreFormula: `(${scoreResults.correctAnswers} / ${totalQuestionsCount}) * 100 = ${(scoreResults.correctAnswers / totalQuestionsCount) * 100}%`,
        roundedScore: scoreResults.totalScore,
        adjustedScore: calculateAdjustedScore(scoreResults.totalScore)
      });
      
      const metadata = {
        blanksPositions: blanksPositions,
        timestamp: Date.now(),
        timeTaken: effectiveTimeTaken,
        audioPlayCount: effectiveAudioPlayCount,
        errors: errorAnalysis.errorCounts,
        adjusted_score: calculateAdjustedScore(scoreResults.totalScore),
        score_calculation: {
          total_questions: totalQuestionsCount,
          correct_count: scoreResults.correctAnswers,
          incorrect_count: scoreResults.incorrectAnswers,
          raw_percentage: totalQuestionsCount > 0 ? (scoreResults.correctAnswers / totalQuestionsCount) * 100 : 0,
          final_score: scoreResults.totalScore,
          calculation_method: "auto_trigger",
          formula: "Math.round((correctCount / totalQuestions) * 100)",
          student_level: studentCategory.category, 
          multiplier: studentCategory.category === "good" ? 10 : studentCategory.category === "average" ? 8 : 7
        }
      };
      
      // Tạo object error_details chứa thông tin chi tiết các lỗi
      const errorDetails = scoreResults.errors.map(error => ({
        index: error.index,
        userAnswer: error.userAnswer,
        correctAnswer: error.correctAnswer,
        position: blanksPositions[error.index],
        errorType: error.userAnswer ? errorAnalysis.errorTypes[error.index] || 'unknown' : 'blank'
      }));
      
      // Log metadata và error details để debug
      console.log('Submission metadata:', metadata);
      console.log('Error details:', errorDetails);
      console.log('Scores being saved to database:', {
        score: scoreResults.totalScore,
        correct_count: scoreResults.correctAnswers,
        incorrect_count: scoreResults.incorrectAnswers,
        time_taken: finalTimeTaken,
        audio_play_count: audioPlayCount
      });
      
      // Bắt đầu lưu dữ liệu
      let submissionSuccess = false;
      
      // Lưu phân tích lỗi vào bảng error_analysis
      try {
        const { error: errorAnalysisError } = await supabase
          .from('error_analysis')
          .insert({
            student_id: user.id,
            question_id: questionId, 
            assignment_id: null, // có thể thêm nếu có
            error_types: errorAnalysis.errorCounts,
            error_details: errorDetails
          });
          
        if (errorAnalysisError) {
          console.error('Lỗi khi lưu phân tích lỗi:', errorAnalysisError);
        } else {
          console.log('Đã lưu phân tích lỗi thành công');
        }
      } catch (errorAnalysisEx) {
        console.error('Exception khi lưu phân tích lỗi:', errorAnalysisEx);
        // Tiếp tục xử lý dù gặp lỗi
      }
      
      // PHƯƠNG PHÁP MỚI: Sử dụng Direct API requests thay vì RPC functions
      console.log('Sử dụng Direct API requests để lưu kết quả...');
      
      try {
        // 1. Tạo một bản ghi mới thay vì cập nhật bản ghi hiện tại
        let attemptCount = 1;
        
        // Kiểm tra attempt_count lớn nhất hiện tại
        const { data: currentAttempts, error: attemptsError } = await supabase
          .from('student_answers')
          .select('attempt_count')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .order('attempt_count', { ascending: false })
          .limit(1);
          
        if (!attemptsError && currentAttempts && currentAttempts.length > 0) {
          attemptCount = (currentAttempts[0].attempt_count || 0) + 1;
        }
        
        console.log(`Bản ghi mới sẽ có attempt_count = ${attemptCount}`);
        
        // Tạo bản ghi mới trực tiếp (không qua RPC)
        const updatedMetadata = {
          ...metadata,
          wrong_answers: errorAnalysis.wrongAnswers, // Store wrong_answers inside metadata since it doesn't exist as a column
          score_calculation_details: {
            formula: "Math.round((correctCount / totalQuestions) * 100)",
            correctCount: scoreResults.correctAnswers,
            totalQuestions: blanksPositions.length,
            calculation: `Math.round((${scoreResults.correctAnswers} / ${blanksPositions.length}) * 100) = ${scoreResults.totalScore}`
          }
        };
        
        const { data: newRecord, error: insertError } = await supabase
          .from('student_answers')
          .insert({
            student_id: user.id,
            question_id: questionId,
            answers: safeAnswers,
            answers_text: answers_text, // QUAN TRỌNG: Lưu dạng JSON string
            correct_answers_text: correct_answers_text, // QUAN TRỌNG: Lưu dạng JSON string
            error_details: errorDetails,
            metadata: updatedMetadata,
            score: scoreResults.totalScore,
            adjusted_score: calculateAdjustedScore(scoreResults.totalScore),
            correct_count: scoreResults.correctAnswers,
            incorrect_count: scoreResults.incorrectAnswers,
            cheating_attempts: cheatingAttempts,
            is_completed: true,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            attempt_count: attemptCount,
            attempt_timestamp: new Date().toISOString()
          })
          .select('id');
        
        if (insertError) {
          console.error('Lỗi khi tạo bản ghi mới:', insertError);
          
          // Nếu thất bại và có bản ghi hiện tại, thử cập nhật
          if (submissionRecordIdRef.current) {
            console.log('Thử cập nhật bản ghi hiện tại:', submissionRecordIdRef.current);
            
            // Sử dụng PATCH request trực tiếp thay vì RPC
            const updateUrl = `${SUPABASE_URL}/rest/v1/student_answers?id=eq.${submissionRecordIdRef.current}`;
            
            const response = await fetch(updateUrl, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Prefer': 'return=representation',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                answers: safeAnswers,
                answers_text: answers_text, // QUAN TRỌNG: Lưu dạng JSON string
                correct_answers_text: correct_answers_text, // QUAN TRỌNG: Lưu dạng JSON string
                error_details: errorDetails,
                metadata: updatedMetadata,
                score: scoreResults.totalScore,
                adjusted_score: calculateAdjustedScore(scoreResults.totalScore),
                correct_count: scoreResults.correctAnswers,
                incorrect_count: scoreResults.incorrectAnswers,
                is_completed: true,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            });
            
            if (response.ok) {
              submissionSuccess = true;
              console.log('Cập nhật bản ghi thành công');
            } else {
              console.error('Lỗi khi cập nhật bản ghi:', await response.text());
            }
          }
        } else if (newRecord && newRecord.length > 0) {
          const newRecordId = newRecord[0].id;
          submissionRecordIdRef.current = newRecordId;
          submissionSuccess = true;
          console.log('Tạo bản ghi mới thành công:', newRecordId);
          
          // Lưu thông tin thời gian và số lần nghe vào bảng student_attempt_stats
          try {
            const { error: statsError } = await supabase
              .from('student_attempt_stats')
              .insert({
                student_answer_id: newRecordId,
                time_taken: effectiveTimeTaken,
                audio_play_count: effectiveAudioPlayCount
              });
              
            if (statsError) {
              console.error('Lỗi khi lưu thống kê vào student_attempt_stats:', statsError);
              
              // Thử lưu trực tiếp qua REST API
              const statsUrl = `${SUPABASE_URL}/rest/v1/student_attempt_stats`;
              
              const statsResponse = await fetch(statsUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': API_KEY,
                  'Authorization': `Bearer ${API_KEY}`,
                  'Prefer': 'return=minimal',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  student_answer_id: newRecordId,
                  time_taken: effectiveTimeTaken,
                  audio_play_count: effectiveAudioPlayCount
                })
              });
              
              if (!statsResponse.ok) {
                console.error('Lỗi khi lưu thống kê qua REST API:', await statsResponse.text());
              } else {
                console.log('Đã lưu thống kê vào student_attempt_stats thành công qua REST API');
              }
            } else {
              console.log('Đã lưu thống kê vào student_attempt_stats thành công');
            }
          } catch (statsError) {
            console.error('Exception khi lưu thống kê:', statsError);
          }
          
          // Lưu gợi ý cải thiện
          try {
            await saveLearningSuggestions(user.id, errorAnalysis);
          } catch (suggestionError) {
            console.error('Lỗi khi lưu gợi ý cải thiện:', suggestionError);
          }
        }
      } catch (directException) {
        console.error('Exception khi gọi phương pháp trực tiếp:', directException);
        
        // PHƯƠNG PHÁP DỰ PHÒNG - cố gắng cập nhật bản ghi nếu có
        try {
          if (!submissionRecordIdRef.current) {
            // Tạo một record mới nếu chưa có
            const recordId = await createStudentAnswer();
            if (recordId) {
              submissionRecordIdRef.current = recordId;
            }
          }
          
          if (submissionRecordIdRef.current) {
            console.log('Thử phương pháp dự phòng - cập nhật bản ghi hiện tại...');
            
            // Cập nhật trực tiếp bằng supabase client nhưng đảm bảo lưu answers_text và correct_answers_text
            const { error: updateError } = await supabase
              .from('student_answers')
              .update({
                answers: safeAnswers,
                answers_text: answers_text,
                correct_answers_text: correct_answers_text,
                score: scoreResults.totalScore,
                adjusted_score: calculateAdjustedScore(scoreResults.totalScore),
                correct_count: scoreResults.correctAnswers,
                incorrect_count: scoreResults.incorrectAnswers,
                metadata: metadata,
                is_completed: true,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', submissionRecordIdRef.current);
            
            if (!updateError) {
              submissionSuccess = true;
              console.log('Đã cập nhật bản ghi thành công với phương pháp dự phòng');
            } else {
              console.error('Lỗi khi cập nhật bản ghi:', updateError);
            }
          }
        } catch (backupError) {
          console.error('Exception trong phương pháp dự phòng:', backupError);
        }
      }
      
      // Hiển thị thông báo dựa trên kết quả
      if (submissionSuccess) {
        toast.success('Nộp bài thành công!');
        console.log('Đã nộp bài thành công, chuyển hướng đến trang kết quả');
      } else {
        toast.warning('Đã gặp một số sự cố khi lưu bài làm, nhưng bạn vẫn có thể xem kết quả');
        console.warn('Đã gặp vấn đề khi lưu bài làm, nhưng vẫn chuyển hướng đến trang kết quả');
      }
      
      // QUAN TRỌNG: Luôn chuyển hướng đến trang kết quả, bất kể thành công hay thất bại
      console.log('Đang chuyển hướng đến trang kết quả:', `/student/dictation-result/${questionId}`);
      navigate(`/student/dictation-result/${questionId}`);
      
    } catch (error) {
      console.error('Error submitting dictation exercise:', error);
      toast.error('Lỗi khi nộp bài');
      
      // Vẫn cố gắng chuyển đến trang kết quả dù có lỗi
      console.log('Đang chuyển hướng đến trang kết quả sau khi gặp lỗi:', `/student/dictation-result/${questionId}`);
      navigate(`/student/dictation-result/${questionId}`);
    }
  };

  // Hàm phân tích các loại lỗi
  const analyzeErrors = (studentAnswers: string[], correctAnswers: string[]) => {
    // Khởi tạo đếm lỗi
    const errorCounts: Record<string, number> = {
      'spelling': 0,     // Lỗi chính tả
      'grammar': 0,      // Lỗi ngữ pháp
      'missing': 0,      // Thiếu từ
      'meaning': 0,      // Sai nghĩa
      'blank': 0,        // Không điền
      'tense': 0         // Sai thì
    };
    
    // Lưu loại lỗi cho từng câu trả lời
    const errorTypes: Record<number, string> = {};
    
    // Lưu danh sách đáp án sai đã phân loại
    const wrongAnswers: Array<{index: number, userAnswer: string, correctAnswer: string, type: string}> = [];
    
    // Kiểm tra từng câu trả lời
    studentAnswers.forEach((userAnswer, index) => {
      const correctAnswer = correctAnswers[index] || '';
      
      // Chuẩn hóa để so sánh
      const normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');
      const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');
      
      // Nếu đáp án đúng, bỏ qua
      if (normalizedUserAnswer === normalizedCorrectAnswer) {
        return;
      }
      
      // Nếu học sinh không điền gì
      if (!normalizedUserAnswer) {
        errorCounts.blank++;
        errorTypes[index] = 'blank';
        wrongAnswers.push({
          index,
          userAnswer: '',
          correctAnswer,
          type: 'blank'
        });
        return;
      }
      
      // Kiểm tra lỗi chính tả (sai 1-2 ký tự)
      if (levenshteinDistance(normalizedUserAnswer, normalizedCorrectAnswer) <= 2) {
        errorCounts.spelling++;
        errorTypes[index] = 'spelling';
        wrongAnswers.push({
          index,
          userAnswer,
          correctAnswer,
          type: 'spelling'
        });
      }
      // Kiểm tra lỗi ngữ pháp
      else if (
        wordOverlap(normalizedUserAnswer, normalizedCorrectAnswer) > 0.7 || 
        (normalizedUserAnswer.includes(normalizedCorrectAnswer) || normalizedCorrectAnswer.includes(normalizedUserAnswer))
      ) {
        errorCounts.grammar++;
        errorTypes[index] = 'grammar';
        wrongAnswers.push({
          index,
          userAnswer,
          correctAnswer,
          type: 'grammar'
        });
      }
      // Kiểm tra lỗi sai thì
      else if (
        (normalizedUserAnswer.includes('will') && normalizedCorrectAnswer.includes('would')) ||
        (normalizedUserAnswer.includes('is') && normalizedCorrectAnswer.includes('was')) ||
        (normalizedUserAnswer.includes('has') && normalizedCorrectAnswer.includes('had')) ||
        (normalizedUserAnswer.includes('do') && normalizedCorrectAnswer.includes('did')) ||
        (normalizedUserAnswer.includes('are') && normalizedCorrectAnswer.includes('were'))
      ) {
        errorCounts.tense++;
        errorTypes[index] = 'tense';
        wrongAnswers.push({
          index,
          userAnswer,
          correctAnswer,
          type: 'tense'
        });
      }
      // Lỗi thiếu từ
      else if (normalizedUserAnswer.split(' ').length < normalizedCorrectAnswer.split(' ').length - 1) {
        errorCounts.missing++;
        errorTypes[index] = 'missing';
        wrongAnswers.push({
          index,
          userAnswer,
          correctAnswer,
          type: 'missing'
        });
      }
      // Các lỗi khác (mặc định xếp vào lỗi sai nghĩa)
      else {
        errorCounts.meaning++;
        errorTypes[index] = 'meaning';
        wrongAnswers.push({
          index,
          userAnswer,
          correctAnswer,
          type: 'meaning'
        });
      }
    });
    
    return {
      errorCounts,
      errorTypes,
      wrongAnswers
    };
  };

  // Lưu gợi ý học tập dựa trên lỗi
  const saveLearningSuggestions = async (studentId: string, errorAnalysis: any) => {
    // Xác định điểm mạnh và điểm yếu
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Xác định loại lỗi phổ biến nhất
    const errorEntries = Object.entries(errorAnalysis.errorCounts) as [string, number][];
    const sortedErrors = errorEntries.sort((a, b) => b[1] - a[1]);
    
    // Nếu có ít lỗi chính tả, đó là điểm mạnh
    if (errorAnalysis.errorCounts.spelling <= 1) {
      strengths.push('Chính tả');
    }
    
    // Nếu ít lỗi ngữ pháp, đó là điểm mạnh
    if (errorAnalysis.errorCounts.grammar <= 1) {
      strengths.push('Ngữ pháp');
    }
    
    // Nếu ít từ bỏ trống, đó là điểm mạnh
    if (errorAnalysis.errorCounts.blank <= 1) {
      strengths.push('Hoàn thành bài');
    }
    
    // Thêm điểm yếu dựa trên 2 loại lỗi phổ biến nhất
    for (let i = 0; i < Math.min(2, sortedErrors.length); i++) {
      if (sortedErrors[i][1] > 0) {
        const errorType = sortedErrors[i][0];
        switch (errorType) {
          case 'spelling':
            weaknesses.push('Chính tả');
            break;
          case 'grammar':
            weaknesses.push('Ngữ pháp');
            break;
          case 'tense':
            weaknesses.push('Thì của động từ');
            break;
          case 'meaning':
            weaknesses.push('Từ vựng');
            break;
          case 'blank':
            weaknesses.push('Hoàn thành bài');
            break;
          case 'missing':
            weaknesses.push('Thiếu từ');
            break;
        }
      }
    }
    
    // Tạo các gợi ý bài tập
    const suggestedExercises = {
      exercises: [] as any[]
    };
    
    // Thêm bài tập cho từng điểm yếu
    weaknesses.forEach(weakness => {
      switch (weakness) {
        case 'Chính tả':
          suggestedExercises.exercises.push({
            type: 'spelling',
            title: 'Luyện chính tả',
            description: 'Tập trung vào việc luyện đánh vần và chính tả các từ.'
          });
          break;
        case 'Ngữ pháp':
          suggestedExercises.exercises.push({
            type: 'grammar',
            title: 'Ôn ngữ pháp',
            description: 'Ôn lại các quy tắc ngữ pháp cơ bản và cấu trúc câu.'
          });
          break;
        case 'Thì của động từ':
          suggestedExercises.exercises.push({
            type: 'tense',
            title: 'Luyện thì động từ',
            description: 'Tập trung vào việc phân biệt và sử dụng đúng các thì.'
          });
          break;
        case 'Từ vựng':
          suggestedExercises.exercises.push({
            type: 'vocabulary',
            title: 'Mở rộng từ vựng',
            description: 'Học thêm từ vựng mới và phân biệt các từ đồng nghĩa, trái nghĩa.'
          });
          break;
      }
    });
    
    // Lưu gợi ý vào bảng improvement_suggestions
    try {
      // Kiểm tra xem đã có gợi ý cho học sinh này chưa
      const { data: existingSuggestions } = await supabase
        .from('improvement_suggestions')
        .select('id')
        .eq('student_id', studentId)
        .limit(1);
      
      if (existingSuggestions && existingSuggestions.length > 0) {
        // Cập nhật gợi ý hiện có
        const { error } = await supabase
          .from('improvement_suggestions')
          .update({
            strengths,
            weaknesses,
            suggested_exercises: suggestedExercises,
            updated_at: new Date().toISOString()
          })
          .eq('student_id', studentId);
          
        if (error) {
          console.error('Lỗi khi cập nhật gợi ý cải thiện:', error);
        } else {
          console.log('Đã cập nhật gợi ý cải thiện thành công');
        }
      } else {
        // Tạo gợi ý mới
        const { error } = await supabase
          .from('improvement_suggestions')
          .insert({
            student_id: studentId,
            strengths,
            weaknesses,
            suggested_exercises: suggestedExercises,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        if (error) {
          console.error('Lỗi khi tạo gợi ý cải thiện:', error);
        } else {
          console.log('Đã tạo gợi ý cải thiện thành công');
        }
      }
    } catch (error) {
      console.error('Exception khi lưu gợi ý cải thiện:', error);
    }
    
    return { strengths, weaknesses, suggestedExercises };
  };

  // Function để render script với blanks
  const renderScript = () => {
    if (!question?.script || blanksPositions.length === 0) {
      return (
        <div className="flex items-center justify-center h-40">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p className="text-gray-500 animate-pulse">Đang tải dữ liệu...</p>
          </div>
        </div>
      );
    }
    
    // Format script to ensure proper spacing
    const formattedScript = question.script
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim();               // Remove trailing spaces
    
    // Split by whitespace and prepare for rendering with proper spacing
    const words = formattedScript.split(/\s+/);
    const elements: JSX.Element[] = [];
    
    if (displayMode === 'sentence') {
      // Chế độ hiển thị cho học sinh giỏi: Hiển thị từng câu
      
      // Xác định các câu trong văn bản (kết thúc bằng dấu chấm, dấu chấm hỏi, dấu chấm than)
      const sentences: {start: number, end: number, hasBlanks: boolean}[] = [];
      let currentSentenceStart = 0;
      
      // Tìm điểm bắt đầu và kết thúc của mỗi câu
      for (let i = 0; i < words.length; i++) {
        if (words[i].endsWith('.') || words[i].endsWith('?') || words[i].endsWith('!')) {
          sentences.push({ 
            start: currentSentenceStart, 
            end: i,
            hasBlanks: false // Sẽ cập nhật sau
          });
          currentSentenceStart = i + 1;
        }
      }
      
      // Thêm câu cuối cùng nếu không kết thúc bằng dấu câu
      if (currentSentenceStart < words.length) {
        sentences.push({ 
          start: currentSentenceStart, 
          end: words.length - 1,
          hasBlanks: false
        });
      }
      
      // Đánh dấu các câu có chứa từ cần điền
      for (let i = 0; i < sentences.length; i++) {
        sentences[i].hasBlanks = blanksPositions.some(pos => 
          pos >= sentences[i].start && pos <= sentences[i].end
        );
      }
      
      // Render từng câu
      sentences.forEach((sentence, sentenceIndex) => {
        if (sentence.hasBlanks) {
          // Câu này có chỗ trống cần điền
          const sentenceWords = words.slice(sentence.start, sentence.end + 1);
          
          // Tìm vị trí từng từ trong câu này trong mảng blanksPositions
          const blanksInThisSentence = blanksPositions.filter(pos => 
            pos >= sentence.start && pos <= sentence.end
          );
          
          // Render từng từ trong câu
          sentenceWords.forEach((word, wordIndex) => {
            const globalWordIndex = sentence.start + wordIndex;
            const isBlank = blanksInThisSentence.includes(globalWordIndex);
            
            if (isBlank) {
              // Tìm vị trí của từ này trong mảng answers
              const positionIndex = blanksPositions.indexOf(globalWordIndex);
              
              // Hiển thị ô input cho từng từ
              elements.push(
                <span key={`word-${globalWordIndex}`} className="mx-1 inline-flex items-center">
                  <Input
                    type="text"
                    className="w-20 md:w-28 h-8 px-2 py-1 border border-primary/40 bg-white/70 backdrop-blur-sm rounded focus:border-primary focus:ring-1 focus:ring-primary/30 focus:bg-white/90 focus:outline-none shadow-sm hover:shadow transition-all duration-300 dictation-input focus-visible"
                    value={answers[positionIndex] || ''}
                    onChange={(e) => {
                      const newAnswers = [...answers];
                      newAnswers[positionIndex] = e.target.value;
                      setAnswers(newAnswers);
                    }}
                    placeholder="..."
                    aria-label={`Điền từ thứ ${wordIndex + 1} trong câu ${sentenceIndex + 1}`}
                    data-word-index={globalWordIndex}
                    tabIndex={0}
                  />
                </span>
              );
            } else {
              // Từ thông thường với khoảng cách rõ ràng
              elements.push(
                <span key={`word-${globalWordIndex}`} className="mx-1 text-gray-800">
                  {word}
                </span>
              );
            }
            
            // Add a visible space after each word (except the last one)
            if (wordIndex < sentenceWords.length - 1) {
              elements.push(<span key={`space-${globalWordIndex}`} className="mx-0.5">{' '}</span>);
            }
          });
        } else {
          // Keep the existing code for displaying normal sentences
          const sentenceText = words.slice(sentence.start, sentence.end + 1).join(' ');
          elements.push(
            <span key={`normal-sentence-${sentenceIndex}`} className="mx-2 text-gray-800">
              {sentenceText}
            </span>
          );
        }
      });
    } else {
      // Chế độ hiển thị mặc định (word): mỗi từ là một ô nhập riêng biệt
    words.forEach((word, index) => {
      const positionIndex = blanksPositions.indexOf(index);
      
      if (positionIndex > -1) {
        // Đây là từ cần điền
        elements.push(
          <span key={index} className="mx-1 inline-flex items-center input-wrapper">
            <Input
              type="text"
              className="w-20 md:w-28 h-8 px-2 py-1 border border-primary/40 bg-white/70 backdrop-blur-sm rounded focus:border-primary focus:ring-1 focus:ring-primary/30 focus:bg-white/90 focus:outline-none shadow-sm hover:shadow transition-all duration-300 dictation-input focus-visible"
              value={answers[positionIndex] || ''}
              onChange={(e) => {
                const newAnswers = [...answers];
                newAnswers[positionIndex] = e.target.value;
                setAnswers(newAnswers);
              }}
              onBlur={() => {
                // Ghi log an toàn hơn, không hiển thị đáp án
                console.log(`Học sinh vừa nhập đáp án cho từ thứ ${index} (vị trí ${positionIndex}): ${answers[positionIndex] || 'chưa điền'}`);
              }}
              placeholder="..."
              aria-label={`Điền từ thứ ${positionIndex + 1}, vị trí ${index + 1} trong văn bản`}
              data-word-index={index} // Thay đổi từ data-correct-answer sang data-word-index
              tabIndex={0} // Đảm bảo có thể focus
            />
          </span>
        );
      } else {
        // Từ thông thường với khoảng cách rõ ràng
        elements.push(
          <span key={index} className="mx-1 text-gray-800">
            {word}
          </span>
        );
      }
      
      // Add a visible space after each word (except the last one)
      if (index < words.length - 1) {
        elements.push(<span key={`space-${index}`} className="mx-0.5">{' '}</span>);
      }
    });
    }
    
    return (
      <div className="text-lg leading-relaxed bg-gradient-to-r from-blue-50/30 to-indigo-50/30 p-6 rounded-lg script-container">
        {elements}
      </div>
    );
  };

  // Tạo bản ghi student_answer khi component mount
  useEffect(() => {
    if (user && questionId && !submissionRecordIdRef.current) {
      createStudentAnswer();
    }
  }, [user, questionId]);

  // Tạo blanksPositions khi component mount và question đã có dữ liệu
  useEffect(() => {
    if (question && question.script) {
      // Format script to ensure proper spacing
      const formattedScript = question.script
        .replace(/\s+/g, ' ')  // Normalize spaces
        .trim();               // Remove trailing spaces
      
      // Chuẩn bị các từ cần điền
      console.log('Chuẩn bị các từ cần điền...');
      const words = formattedScript.split(/\s+/);
      const totalWords = words.length;
      console.log(`Tổng số từ trong bài: ${totalWords}`);

      // Xác định mức độ học sinh (mặc định là 'average')
      let studentLevel = 'average';
      if (studentCategory && studentCategory.category) {
        studentLevel = studentCategory.category;
      }
      console.log(`Học sinh thuộc nhóm: ${studentLevel}`);

      // Hiển thị thông tin cấu hình từ database
      console.log('Cấu hình hiện tại trong question:', {
        good_percentage: question.good_students_blanks_percentage,
        average_percentage: question.average_students_blanks_percentage,
        poor_percentage: question.poor_students_blanks_percentage,
        good_difficulty: question.good_students_difficulty,
        average_difficulty: question.average_students_difficulty,
        poor_difficulty: question.poor_students_difficulty
      });

      // Xác định tỷ lệ chỗ trống dựa vào loại học sinh
      let blanksPercentage = 50; // Mặc định là 50% cho học sinh trung bình
      
      // BUG FIX: Kiểm tra số 0 cũng được coi là giá trị hợp lệ
      if (studentLevel === 'good' && question.good_students_blanks_percentage !== undefined && question.good_students_blanks_percentage !== null) {
        blanksPercentage = question.good_students_blanks_percentage;
        // Fix: Nếu không có hoặc giá trị 0, áp dụng mặc định là 50% cho học sinh giỏi
        if (blanksPercentage === 0) blanksPercentage = 50;
        console.log(`Áp dụng tỷ lệ chỗ trống cho học sinh giỏi: ${blanksPercentage}%`);
      } else if (studentLevel === 'average' && question.average_students_blanks_percentage !== undefined && question.average_students_blanks_percentage !== null) {
        blanksPercentage = question.average_students_blanks_percentage;
        // Fix: Nếu không có hoặc giá trị 0, áp dụng mặc định là 40% cho học sinh trung bình
        if (blanksPercentage === 0) blanksPercentage = 40;
        console.log(`Áp dụng tỷ lệ chỗ trống cho học sinh trung bình: ${blanksPercentage}%`);
      } else if (studentLevel === 'poor' && question.poor_students_blanks_percentage !== undefined && question.poor_students_blanks_percentage !== null) {
        blanksPercentage = question.poor_students_blanks_percentage;
        // Fix: Nếu không có hoặc giá trị 0, áp dụng mặc định là 30% cho học sinh yếu
        if (blanksPercentage === 0) blanksPercentage = 30;
        console.log(`Áp dụng tỷ lệ chỗ trống cho học sinh yếu: ${blanksPercentage}%`);
      } else {
        // Fix: Áp dụng giá trị mặc định dựa trên cấp độ học sinh
        if (studentLevel === 'good') {
          blanksPercentage = getFillPercentage('good') * 100; // 50% cho học sinh giỏi
          console.log(`Không tìm thấy cấu hình, áp dụng tỷ lệ mặc định cho học sinh giỏi: ${blanksPercentage}%`);
        } else if (studentLevel === 'poor') {
          blanksPercentage = getFillPercentage('poor') * 100; // 30% cho học sinh yếu
          console.log(`Không tìm thấy cấu hình, áp dụng tỷ lệ mặc định cho học sinh yếu: ${blanksPercentage}%`);
        } else {
          blanksPercentage = getFillPercentage('average') * 100; // 40% cho học sinh trung bình
          console.log(`Không tìm thấy cấu hình, áp dụng tỷ lệ mặc định cho học sinh trung bình: ${blanksPercentage}%`);
        }
      }

      // Xác định độ khó dựa vào loại học sinh
      let difficulty = 'phrase'; // Mặc định là 'phrase' cho học sinh trung bình
      
      // BUG FIX: Kiểm tra giá trị rỗng cũng coi là không hợp lệ
      if (studentLevel === 'good' && question.good_students_difficulty && question.good_students_difficulty.trim() !== '') {
        difficulty = question.good_students_difficulty;
        console.log(`Áp dụng độ khó cho học sinh giỏi: ${difficulty}`);
      } else if (studentLevel === 'average' && question.average_students_difficulty && question.average_students_difficulty.trim() !== '') {
        difficulty = question.average_students_difficulty;
        console.log(`Áp dụng độ khó cho học sinh trung bình: ${difficulty}`);
      } else if (studentLevel === 'poor' && question.poor_students_difficulty && question.poor_students_difficulty.trim() !== '') {
        difficulty = question.poor_students_difficulty;
        console.log(`Áp dụng độ khó cho học sinh yếu: ${difficulty}`);
      } else {
        // Fix: Áp dụng giá trị mặc định dựa trên cấp độ học sinh
        if (studentLevel === 'good') {
          difficulty = 'sentence'; // Mặc định cho học sinh giỏi
          console.log(`Không tìm thấy cấu hình, áp dụng độ khó mặc định cho học sinh giỏi: ${difficulty}`);
        } else if (studentLevel === 'poor') {
          difficulty = 'word'; // Mặc định cho học sinh yếu
          console.log(`Không tìm thấy cấu hình, áp dụng độ khó mặc định cho học sinh yếu: ${difficulty}`);
        } else {
          console.log(`Không tìm thấy cấu hình, áp dụng độ khó mặc định cho học sinh trung bình: ${difficulty}`);
        }
      }

      // Xử lý đặc biệt cho học sinh giỏi - tính dựa trên số câu
      if (studentLevel === 'good' && difficulty === 'sentence') {
        // Tìm vị trí kết thúc các câu (dấu chấm, dấu hỏi, dấu chấm than)
        const sentenceEndPositions: number[] = [];
        
        // Tìm vị trí kết thúc của các câu
        for (let i = 0; i < words.length; i++) {
          if (words[i].endsWith('.') || words[i].endsWith('?') || words[i].endsWith('!')) {
            sentenceEndPositions.push(i);
          }
        }
        
        // Thêm vị trí cuối cùng nếu không kết thúc bằng dấu câu
        if (sentenceEndPositions.length === 0 || sentenceEndPositions[sentenceEndPositions.length - 1] < words.length - 1) {
          sentenceEndPositions.push(words.length - 1);
        }
        
        // Tính tổng số câu và số câu cần điền
        const totalSentences = sentenceEndPositions.length;
        // Thay đổi từ Math.ceil sang Math.floor để đảm bảo không vượt quá 50%
        let sentencesToFill = Math.floor(totalSentences * (blanksPercentage / 100));
        
        // Đảm bảo có ít nhất 1 câu và tối đa là tổng số câu
        sentencesToFill = Math.max(1, Math.min(sentencesToFill, totalSentences));
        
        console.log(`Tổng số câu: ${totalSentences}, Số câu cần điền: ${sentencesToFill} (${blanksPercentage}%)`);
        
        // Xây dựng danh sách các câu (start -> end)
        const sentences: { start: number, end: number }[] = [];
        let start = 0;
        
        for (const end of sentenceEndPositions) {
          sentences.push({ start, end });
          start = end + 1;
        }
        
        // Kiểm tra attempt_count từ createStudentAnswer
        // Dùng IIFE (Immediately Invoked Function Expression) để có thể sử dụng async/await
        (async () => {
          try {
            // Kiểm tra xem đây có phải lần làm bài đầu tiên không
            const { data: attemptInfo, error } = await supabase
              .from('student_answers')
              .select('attempt_count')
              .eq('student_id', user?.id)
              .eq('question_id', questionId)
              .order('attempt_count', { ascending: false })
              .limit(1);
            
            if (error) {
              console.error('Error checking attempt count:', error);
            }
            
            const isFirstAttempt = !attemptInfo || attemptInfo.length === 0 || attemptInfo[0].attempt_count <= 1;
            console.log(`Đây ${isFirstAttempt ? 'là' : 'không phải'} lần làm đầu tiên. Lần làm: ${attemptInfo?.[0]?.attempt_count || 1}`);
            
            let selectedSentenceIndices: number[] = [];
            
            if (isFirstAttempt) {
              // Lần đầu: chọn câu theo kiểu xen kẽ NGHIÊM NGẶT (một câu sẵn, một câu điền)
              console.log('Áp dụng thuật toán xen kẽ nghiêm ngặt cho lần làm đầu tiên');
              
              // Luôn chọn câu lẻ (index-based: 1, 3, 5, 7, ...) => (thứ tự thực tế: 2, 4, 6, 8, ...)
              // Bắt đầu từ câu thứ 2 (index 1), câu đầu tiên (index 0) luôn hiển thị
              for (let i = 1; i < totalSentences; i += 2) {
                selectedSentenceIndices.push(i);
                // Giới hạn số câu cần điền đúng theo tỷ lệ đã tính
                if (selectedSentenceIndices.length >= sentencesToFill) break;
              }
              
              console.log('Các câu được chọn để điền (mẫu xen kẽ nghiêm ngặt):', selectedSentenceIndices);
            } else {
              // Lần làm từ thứ 2 trở đi: chọn câu NGẪU NHIÊN (nhưng không chọn câu đầu tiên)
              console.log('Áp dụng thuật toán ngẫu nhiên cho lần làm từ thứ 2 trở đi');
              
              // Tạo mảng các chỉ số câu từ 1 đến (totalSentences - 1), bỏ câu đầu tiên (index 0)
              const eligibleSentences = Array.from({ length: totalSentences - 1 }, (_, i) => i + 1);
              
              // Xáo trộn mảng để tạo thứ tự ngẫu nhiên
              for (let i = eligibleSentences.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [eligibleSentences[i], eligibleSentences[j]] = [eligibleSentences[j], eligibleSentences[i]];
              }
              
              // Lấy số lượng câu cần thiết từ mảng đã xáo trộn
              selectedSentenceIndices = eligibleSentences.slice(0, sentencesToFill);
              
              console.log('Các câu được chọn để điền (ngẫu nhiên):', selectedSentenceIndices);
            }
            
            // Sắp xếp các vị trí câu theo thứ tự tăng dần
            selectedSentenceIndices.sort((a, b) => a - b);
            
            // Tạo mảng vị trí từ cần điền từ các câu đã chọn
            let positions: number[] = [];
            for (const sentenceIndex of selectedSentenceIndices) {
              const { start, end } = sentences[sentenceIndex];
              // Thêm tất cả các vị trí từ trong câu đã chọn
              for (let i = start; i <= end; i++) {
                positions.push(i);
              }
            }
            
            console.log('Vị trí các từ cần điền:', positions);
            console.log('Tổng số chỗ trống:', positions.length);
            
            // Cập nhật state
            setBlanksPositions(positions);
            setAnswers(new Array(positions.length).fill(''));
            
          } catch (error) {
            console.error('Error in sentence selection:', error);
            
            // Nếu có lỗi, áp dụng mẫu xen kẽ mặc định
            const selectedSentenceIndices: number[] = [];
            
            // Luôn chọn câu lẻ (index-based: 1, 3, 5, 7, ...)
            for (let i = 1; i < totalSentences; i += 2) {
              selectedSentenceIndices.push(i);
              if (selectedSentenceIndices.length >= sentencesToFill) break;
            }
            
            console.log('Áp dụng mẫu xen kẽ mặc định do lỗi:', selectedSentenceIndices);
            
            // Sắp xếp và tạo mảng positions như trước
            selectedSentenceIndices.sort((a, b) => a - b);
            
            let positions: number[] = [];
            for (const sentenceIndex of selectedSentenceIndices) {
              const { start, end } = sentences[sentenceIndex];
              for (let i = start; i <= end; i++) {
                positions.push(i);
              }
            }
            
            setBlanksPositions(positions);
            setAnswers(new Array(positions.length).fill(''));
          }
        })();
        
        return; // Kết thúc sớm, không thực hiện phần code bên dưới
      }

      // Tạo danh sách từ hợp lệ dựa trên độ khó (cho học sinh TB và YẾU)
      const getEligibleWords = () => {
        if (difficulty === 'sentence') {
          // Chế độ khó nhất: Thay đổi để tạo nhóm câu và cụm từ thay vì từ đơn lẻ
          const wordPositions = [];
          
          // Xử lý theo câu để tìm vị trí bắt đầu mỗi câu
          const sentenceStarts = [0]; // Luôn bắt đầu với từ đầu tiên
          
          // Tìm các câu trong văn bản
          for (let i = 0; i < words.length - 1; i++) {
            if (words[i].endsWith('.') || words[i].endsWith('!') || words[i].endsWith('?')) {
              // Thêm vị trí sau dấu câu làm điểm bắt đầu câu mới
              if (i + 1 < words.length) {
                sentenceStarts.push(i + 1);
              }
            }
          }
          
          // Với mỗi câu, thêm các cụm từ liên tiếp (3-5 từ)
          for (const start of sentenceStarts) {
            // Đảm bảo câu đủ dài
            if (start < words.length - 2) {
              // Thêm cụm 3 từ đầu tiên của câu
              for (let i = 0; i < Math.min(5, words.length - start); i++) {
                wordPositions.push(start + i);
              }
            }
          }
          
          console.log('Đã tạo ' + wordPositions.length + ' vị trí từ theo kiểu câu');
          return wordPositions;
        } else if (difficulty === 'phrase') {
          // Chế độ trung bình: Tập trung vào từ trong cụm từ
          return words.reduce((acc, word, index) => {
            const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');
            if (cleanWord.length > 3) {
              acc.push(index);
            }
        return acc;
      }, []);
        } else {
          // Chế độ dễ: Chỉ tập trung vào từ đơn lẻ, từ ngắn cũng được
          return words.reduce((acc, word, index) => {
            const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');
            if (cleanWord.length >= 2) {
              acc.push(index);
            }
            return acc;
          }, []);
        }
      };

      const eligiblePositions = getEligibleWords();
      console.log(`Tìm thấy ${eligiblePositions.length} vị trí hợp lệ theo mức độ ${difficulty}`);

      // Tính số lượng chỗ trống dựa trên tỷ lệ chỗ trống và số từ hợp lệ
      let blanksCount = Math.round((eligiblePositions.length * blanksPercentage) / 100);
      
      // Đảm bảo ít nhất 5 chỗ trống, tối đa 30 chỗ trống
      blanksCount = Math.max(5, Math.min(30, blanksCount));
      console.log(`Số chỗ trống sẽ tạo: ${blanksCount} (${blanksPercentage}% của ${eligiblePositions.length} từ hợp lệ)`);
      
      // Tạo mảng vị trí từ cần điền
      const usedIndices = new Set();
      let positions = [];

      // Xáo trộn mảng vị trí hợp lệ
      const shuffledEligiblePositions = [...eligiblePositions];
      for (let i = shuffledEligiblePositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledEligiblePositions[i], shuffledEligiblePositions[j]] = [shuffledEligiblePositions[j], shuffledEligiblePositions[i]];
      }

      // Thuật toán 1: Chọn với khoảng cách đủ lớn trước
      for (const pos of shuffledEligiblePositions) {
        if (positions.length >= blanksCount) break;
        
        // Kiểm tra khoảng cách với các vị trí đã chọn
        let isTooClose = false;
        for (const usedPos of usedIndices) {
          if (Math.abs(Number(pos) - Number(usedPos)) <= 2) {
            isTooClose = true;
            break;
          }
        }

        if (!isTooClose) {
          positions.push(pos);
          usedIndices.add(pos);
          // Thêm vùng đệm
          for (let i = -2; i <= 2; i++) {
            if (pos + i >= 0 && pos + i < totalWords) {
              usedIndices.add(pos + i);
            }
          }
        }
      }

      // Thuật toán 2: Nếu không đủ số lượng, nới lỏng ràng buộc khoảng cách
      if (positions.length < blanksCount) {
        console.log(`Không đủ vị trí với khoảng cách lớn, chỉ có ${positions.length}/${blanksCount}, đang nới lỏng ràng buộc...`);
        
        // Reset lại
        positions = [];
        const newUsedIndices = new Set();
        
        // Duyệt lại eligiblePositions với ràng buộc khoảng cách nhỏ hơn
        for (const pos of shuffledEligiblePositions) {
          if (positions.length >= blanksCount) break;
          
          // Kiểm tra khoảng cách nhỏ hơn (1 thay vì 2)
          let isTooClose = false;
          for (const usedPos of newUsedIndices) {
            if (Math.abs(Number(pos) - Number(usedPos)) <= 1) {
              isTooClose = true;
              break;
            }
          }

          if (!isTooClose) {
            positions.push(pos);
            newUsedIndices.add(pos);
            // Giảm vùng đệm
            for (let i = -1; i <= 1; i++) {
              if (pos + i >= 0 && pos + i < totalWords) {
                newUsedIndices.add(pos + i);
              }
            }
          }
        }
      }

      // Thuật toán 3: Nếu vẫn không đủ, thêm các vị trí còn lại
      if (positions.length < blanksCount) {
        console.log(`Vẫn thiếu ${blanksCount - positions.length} vị trí, thêm vị trí bất kỳ...`);
        
        // Lấy các vị trí còn lại chưa được chọn
        const remainingPositions = [];
        for (let i = 0; i < words.length; i++) {
          if (!positions.includes(i) && words[i].length >= 2) {
            remainingPositions.push(i);
          }
        }
        
        // Xáo trộn các vị trí còn lại
        for (let i = remainingPositions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remainingPositions[i], remainingPositions[j]] = [remainingPositions[j], remainingPositions[i]];
        }
        
        // Thêm vào cho đủ số lượng
        for (let i = 0; i < remainingPositions.length && positions.length < blanksCount; i++) {
          positions.push(remainingPositions[i]);
        }
      }
      
      // Sắp xếp mảng vị trí theo thứ tự tăng dần
      positions.sort((a, b) => a - b);
      console.log('Vị trí các từ cần điền:', positions);
      console.log('Tổng số chỗ trống:', positions.length);
      
      // Đảm bảo đủ số lượng
      if (positions.length !== blanksCount) {
        console.warn(`Không thể tạo đủ ${blanksCount} vị trí, chỉ tạo được ${positions.length} vị trí`);
      }
      
      // Cập nhật state
      setBlanksPositions(positions);
      setAnswers(new Array(positions.length).fill(''));
    }
  }, [question, studentCategory]);

  // Initialize timer when question data is loaded
  useEffect(() => {
    if (question?.time_limit) {
      const timeInSeconds = question.time_limit * 60;
      setTimeLimit(timeInSeconds);
      setRemainingTime(timeInSeconds);

      // Start countdown timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // console.log(`Starting timer with ${timeInSeconds} seconds`);
      
      timerRef.current = setInterval(() => {
        setRemainingTime((prevTime) => {
          if (prevTime <= 1) {
            // Time's up - submit answers
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            handleSubmit();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [question]);

  // Sửa lỗi cho hàm submitAnswersText và handleSubmitAnswersText
  const submitAnswersText = async (recordId: string, answersJsonText: string) => {
    try {
      // Kiểm tra nếu answersJsonText là null hoặc undefined
      if (!answersJsonText) {
        console.error('answersJsonText is null or undefined', { recordId });
        // Gửi mảng rỗng thay vì null để tránh lỗi FOR loop
        answersJsonText = JSON.stringify([]);
      }
      
      console.log('Submitting answers text:', { recordId, answersTextLength: answersJsonText.length });
      
      // Ensure proper headers with Accept: application/json
      const { data, error } = await supabase
        .from('student_answers')
        .update({
          answers_text: answersJsonText,
          is_completed: true,
          completed_at: new Date().toISOString(),
        }, {
          count: 'exact'
        })
        .eq('id', recordId);

      if (error) {
        console.error('Error in submitAnswersText:', error);
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      console.error('Error submitting answers:', error);
      return { success: false, message: 'Error submitting answers' };
    }
  };

  const handleSubmitAnswersText = async (recordId: string) => {
    try {
      // Kiểm tra và xử lý mảng answers trước khi stringify
      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        console.warn('Answers array is empty or invalid, creating default empty array');
        // Gửi mảng rỗng nếu answers không hợp lệ
        const result = await submitAnswersText(recordId, JSON.stringify([]));
        return result;
      }
      
      const answersJsonText = JSON.stringify(answers);
      const completedAt = new Date();
      console.log('Preparing to submit answers:', { recordId, answersCount: answers.length });
      const result = await submitAnswersText(recordId, answersJsonText);
      return result;
    } catch (error) {
      console.error('Error in text submission:', error);
      return { success: false, message: 'Error submitting answers text' };
    }
  };

  // Thêm hàm mới để gọi RPC function simple_update_score
  const updateScoreWithRPC = async (recordId: string, score: number, correctCount: number, incorrectCount: number): Promise<boolean> => {
    try {
      console.log('Gọi RPC function simple_update_score với:', {
        recordId, score, correctCount, incorrectCount
      });
      
      // Thay thế việc gọi RPC bằng direct fetch API
      const apiUrl = `${SUPABASE_URL}/rest/v1/student_answers?id=eq.${recordId}`;
      
      const payload = {
        score: score,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        is_completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Sử dụng direct fetch API để cập nhật điểm số...');
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Prefer': 'return=minimal',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lỗi khi cập nhật điểm trực tiếp:', response.status, errorText);
        throw new Error(`API failed: ${response.status} ${errorText}`);
      }
      
      console.log('Cập nhật điểm số thành công!');
      
      // Verify that score was saved correctly
      console.log('Verifying score was saved...');
      const verifyUrl = `${SUPABASE_URL}/rest/v1/student_answers?id=eq.${recordId}&select=score,correct_count,incorrect_count`;
      
      const verifyResponse = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      if (verifyResponse.ok) {
        const verificationData = await verifyResponse.json();
        console.log('Verification result:', verificationData);
        if (verificationData[0] && verificationData[0].score !== score) {
          console.warn(`Điểm số không khớp! Expected: ${score}, Got: ${verificationData[0].score}`);
        }
      }
      
      return true;
    } catch (e) {
      console.error('Exception khi cập nhật điểm số:', e);
      return false;
    }
  };

  // Cải thiện component FullscreenPrompt
  const FullscreenPrompt = () => {
    // Tạo ref cho dialog container và nút bấm
    const dialogRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Xử lý focus khi dialog hiển thị
    useEffect(() => {
      // Focus vào button khi dialog hiển thị
      if (buttonRef.current) {
        setTimeout(() => buttonRef.current?.focus(), 100);
      }

      // Tạo focus trap
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (dialogRef.current) {
            const focusableElements = dialogRef.current.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
            
            if (e.shiftKey && document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, []);

    return (
      <div 
        className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[100]"
        // Không sử dụng aria-hidden ở đây
        role="dialog"
        aria-modal="true"
        aria-labelledby="fullscreen-title"
        ref={dialogRef}
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl border border-blue-100 dark:border-blue-900 dialog-content animate-fade-in"
          tabIndex={-1}
        >
          <div className="text-center mb-6">
            <Maximize2 className="w-20 h-20 mx-auto text-primary mb-6" />
            <h3 id="fullscreen-title" className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Yêu cầu chế độ toàn màn hình</h3>
            <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
          Để làm bài kiểm tra, bạn cần cho phép chế độ toàn màn hình.
            </p>
            <p className="text-red-500 font-medium mb-2">
              Không thể xem hoặc làm bài nếu không ở chế độ toàn màn hình.
            </p>
          </div>
          
          <div className="space-y-4">
        <Button 
          onClick={enableFullscreen}
              className="w-full bg-primary hover:bg-primary/90 font-bold py-4 text-white text-lg interactive-button focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              ref={buttonRef}
              tabIndex={0}
        >
              <Maximize2 className="w-6 h-6 mr-2" />
          Bật chế độ toàn màn hình
        </Button>
            
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Hoặc nhấn <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border">F11</kbd> trên bàn phím để bật toàn màn hình</p>
            </div>
          </div>
      </div>
    </div>
  );
  };

  // Sửa phần useEffect cho fullscreen initialization
  useEffect(() => {
    // Kiểm tra xem đã ở chế độ toàn màn hình chưa
    if (document.fullscreenElement) {
      // Nếu đã ở chế độ toàn màn hình, chỉ cập nhật state
      setIsFullscreen(true);
      setHasFullscreenPermission(true);
      setShowFullscreenPrompt(false);
    } else {
      // Nếu chưa ở chế độ toàn màn hình, hiển thị prompt
      setShowFullscreenPrompt(true);
    }
  }, []);

  // Modify audio loading logic
  const audioRetryCountRef = useRef(0);
  
  const loadAudio = async (url: string) => {
    setIsAudioLoading(true);
    setErrorMessage('');
    
    try {
      if (!url) {
        setErrorMessage('Không có URL audio');
        setIsAudioLoading(false);
        return false;
      }
      
      // Make sure the audio element exists and is properly initialized
      if (!audioRef || !audioRef.current) {
        console.warn('Audio element not initialized yet, will retry shortly');
        setIsAudioLoading(false);
        
        // Retry after a short delay to give time for the ref to be initialized
        setTimeout(() => {
          if (audioRef && audioRef.current) {
            loadAudio(url);
          } else {
            setErrorMessage('Không thể khởi tạo player audio');
          }
        }, 1000);
        
        return false;
      }

      const audio = audioRef.current;

      // Add event listeners for better error handling
      const loadPromise = new Promise((resolve, reject) => {
        const onCanPlay = () => {
          console.log('Audio can play through:', url);
          resolve(true);
        };
        
        const onError = (e: Event) => {
          console.error('Audio element error:', audio.error);
          reject(new Error(audio.error ? audio.error.message : 'Không thể tải file audio'));
        };
        
        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });
        
        // Clean up function to remove event listeners if promise is rejected elsewhere
        return () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
        };
      });

      audio.src = url;
      console.log('Setting audio source and loading:', url);
      audio.load();
      
      // Wait for audio to be ready or timeout after 15 seconds
      await Promise.race([
        loadPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tải audio quá thời gian')), 15000)
        )
      ]);

      console.log('Audio loaded successfully');
      setIsAudioLoading(false);
      // Reset retry count on success
      audioRetryCountRef.current = 0;
      return true;
    } catch (error) {
      console.error('Error loading audio:', error);
      setIsAudioLoading(false);
      setErrorMessage(error.message || 'Không thể tải file audio');
      
      // Retry loading after 3 seconds, with a maximum of 3 attempts
      if (audioRetryCountRef.current >= 3) {
        console.warn('Maximum audio load retry attempts reached');
        audioRetryCountRef.current = 0;
        return false;
      }
      
      audioRetryCountRef.current += 1;
      console.log(`Retrying audio load (attempt ${audioRetryCountRef.current}/3) in 3 seconds...`);
      setTimeout(() => {
        if (url) loadAudio(url);
      }, 3000);
      
      return false;
    }
  };

  // Update useEffect for fullscreen initialization
  // Đã có useEffect thay thế ở trên rồi, nên xóa đoạn này
  /*
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!document.fullscreenElement && containerRef.current) {
        enableFullscreen();
      } else {
        // If already in fullscreen, just update states
        setIsFullscreen(true);
        setHasFullscreenPermission(true);
        setShowFullscreenPrompt(false);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  */

  // Update audio error handling in useEffect
  useEffect(() => {
    if (audioUrl) {
      loadAudio(audioUrl);
    }
  }, [audioUrl]);

  // Header content with timer
  const CardHeaderContent = useCallback(() => (
    <div className="flex items-center justify-between">
      <div className="truncate">
        <CardTitle className="truncate bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold">
          {question?.title}
        </CardTitle>
        <CardDescription className="truncate text-gray-600">
          Giáo viên: {question?.profiles?.full_name}
        </CardDescription>
        <div className="mt-2">
          <Badge variant="secondary" className="bg-blue-100/50 text-blue-700 border border-blue-200/50">
            Thời gian: {Math.ceil(timeLimit ? timeLimit / 60 : 0)} phút
          </Badge>
          <Badge variant="outline" className={`ml-2 ${
            studentCategory.category === 'good' 
              ? 'border-green-200 bg-green-50 text-green-700' 
              : studentCategory.category === 'weak' 
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            {studentCategory.categoryDisplay}
          </Badge>
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <div className={`text-2xl font-bold transition-colors duration-300 ${
          remainingTime < 60 ? 'text-red-500 animate-pulse' : 'text-primary'
        }`}>
          {formatTime(remainingTime)}
        </div>
        <div className="text-sm text-gray-500">
          Thời gian còn lại
        </div>
        {remainingTime < 60 && (
          <div className="text-xs text-red-500 mt-1">
            Sắp hết giờ!
          </div>
        )}
      </div>
    </div>
  ), [question, timeLimit, remainingTime, formatTime, studentCategory]);

  // Thiết lập startTime khi question được load
  useEffect(() => {
    if (question && startTime === null) {
      console.log('Thiết lập startTime khi trang load');
      setStartTime(Date.now());
    }
  }, [question, startTime]);

  // Thêm state cho dialog cảnh báo gian lận
  const [showAntiCheatingWarning, setShowAntiCheatingWarning] = useState(false);
  const [redirectTimer, setRedirectTimer] = useState(60); // 60 giây
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add this effect to handle the countdown timer
  useEffect(() => {
    if (showAntiCheatingWarning && redirectTimer > 0) {
      // Đặt hẹn giờ đếm ngược
      redirectTimerRef.current = setInterval(() => {
        setRedirectTimer(prev => {
          if (prev <= 1) {
            // Hủy hẹn giờ khi đếm ngược kết thúc
            if (redirectTimerRef.current) {
              clearInterval(redirectTimerRef.current);
              redirectTimerRef.current = null;
            }
            // Chuyển hướng về trang chủ
            navigate(`/student/question/${questionId}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [showAntiCheatingWarning, redirectTimer, navigate, questionId]);

  // Reset timer when dialog opens
  useEffect(() => {
    if (showAntiCheatingWarning) {
      setRedirectTimer(60); // Reset về 60 giây
    }
  }, [showAntiCheatingWarning]);

  // State for validation of previous steps
  const [isCheckingPreviousSteps, setIsCheckingPreviousSteps] = useState(true);

  // Validation to ensure users complete flashcards and vocabulary practice first
  useEffect(() => {
    if (!user?.id || !questionId) return;
    
    const validatePreviousStepsCompletion = async () => {
      try {
        setIsCheckingPreviousSteps(true);
        
        // Count total vocabulary items for this question
        const { count: totalVocabCount, error: countError } = await supabase
          .from('vocabulary_items')
          .select('id', { count: 'exact' })
          .eq('question_id', questionId);
          
        if (countError) {
          console.error('Error counting vocabulary items:', countError);
          setIsCheckingPreviousSteps(false);
          return;
        }
        
        // Check flashcard completion
        const { data: flashcardProgress, error: flashcardError } = await supabase
          .from('vocabulary_progress')
          .select('vocabulary_id')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .eq('flashcard_completed', true);
          
        if (flashcardError) {
          console.error('Error checking flashcard completion:', flashcardError);
          setIsCheckingPreviousSteps(false);
          return;
        }
        
        // Check vocabulary practice completion
        const { data: practiceProgress, error: practiceError } = await supabase
          .from('vocabulary_progress')
          .select('vocabulary_id')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .eq('listening_practice_completed', true);
          
        if (practiceError) {
          console.error('Error checking practice completion:', practiceError);
          setIsCheckingPreviousSteps(false);
          return;
        }
        
        const totalVocab = totalVocabCount || 0;
        const completedFlashcards = flashcardProgress?.length || 0;
        const completedPractice = practiceProgress?.length || 0;
        
        console.log(`Validating access: ${completedFlashcards}/${totalVocab} flashcards completed, ${completedPractice}/${totalVocab} practice completed`);
        
        // Check if flashcards are completed
        if (totalVocab > 0 && (completedFlashcards === 0 || completedFlashcards < totalVocab)) {
          toast.warning('Bạn cần học đầy đủ từ vựng ở bước flashcard trước khi làm bài dictation', {
            duration: 5000
          });
          
          setTimeout(() => {
            navigate(`/student/vocabulary-flashcards/${questionId}`);
          }, 2000);
          return;
        }
        
        // Check if vocabulary practice is completed
        if (totalVocab > 0 && (completedPractice === 0 || completedPractice < totalVocab)) {
          toast.warning('Bạn cần hoàn thành luyện tập từ vựng trước khi làm bài dictation', {
            duration: 5000
          });
          
          setTimeout(() => {
            navigate(`/student/vocabulary-practice/${questionId}`);
          }, 2000);
          return;
        }
        
        setIsCheckingPreviousSteps(false);
      } catch (error) {
        console.error('Error validating previous steps completion:', error);
        setIsCheckingPreviousSteps(false);
      }
    };
    
    validatePreviousStepsCompletion();
  }, [user?.id, questionId, navigate]);
  
  // Show loading indicator while validating
  if (isCheckingPreviousSteps) {
    return (
      <StudentLayout hideSidebar={true}>
        <div className="h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600">Đang kiểm tra tiến trình học tập...</p>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Fix calculateAdjustedScore inside the component
  const calculateAdjustedScore = (score: number) => {
    // Lấy thông tin từ state
    const category = studentCategory.category || 'average';
    
    // Định nghĩa hệ số nhân cho từng loại - thang điểm 10
    const multipliers: Record<string, number> = {
      'good': 10.0,   // Học sinh giỏi: 10 là điểm tối đa
      'average': 8.0, // Học sinh trung bình: 8 là điểm tối đa
      'poor': 7.0     // Học sinh yếu: 7 là điểm tối đa
    };
    
    // Tính điểm đã điều chỉnh thang điểm 10
    // Nếu score=100% thì điểm max theo level, nếu score=0% thì điểm = 0
    // Làm tròn lên 1 chữ số thập phân
    const adjustedScore = Math.ceil((score / 100) * multipliers[category] * 10) / 10;
    
    console.log('Điểm đã điều chỉnh (thang điểm 10):', {
      originalScore: score,
      studentCategory: category,
      multiplier: multipliers[category],
      adjustedScore
    });
    
    return adjustedScore;
  };

  // Update the percentages based on student level
  const getFillPercentage = (studentCategory: string) => {
    switch (studentCategory) {
      case 'good':
        return 0.5; // 50% for good students
      case 'average':
        return 0.4; // 40% for average students
      case 'poor':
        return 0.3; // 30% for poor students
      default:
        return 0.4; // Default to 40%
    }
  };

  // Modify the audio play button handler to not start the timer
  const handleAudioButtonClick = async () => {
    if (!audioRef.current) return;
    
    // Log current audio status for debugging
    console.log("Audio button clicked", {
      isPaused: audioRef.current.paused,
      currentTime: audioRef.current.currentTime,
      duration: audioRef.current.duration,
      readyState: audioRef.current.readyState,
      networkState: audioRef.current.networkState
    });

    // Set the playing state to display the correct button
    if (audioRef.current.paused) {
      setIsPlaying(true);
      audioRef.current.play();
      // Note: timer start code removed from here
    } else {
      setIsPlaying(false);
      audioRef.current.pause();
    }
    
    // Increment play count only if starting from the beginning
    if (audioRef.current.currentTime < 1) {
      setPlayCount(prev => prev + 1);
    }
  };

  const getBlankPercentage = (studentLevel: string): number => {
    switch (studentLevel) {
      case 'good':
        return 0.5; // 50% for good students
      case 'average':
        return 0.4; // 40% for average students
      case 'poor':
        return 0.3; // 30% for poor students
      default:
        return 0.4; // Default to 40%
    }
  };

  return (
    <>
      {/* Render app content */}
    <StudentLayout hideSidebar={true}>
      {/* Add style tag for fullscreen styles */}
      <style dangerouslySetInnerHTML={{ __html: fullscreenStyles }} />
        
        {/* Render FullscreenPrompt trong portal riêng biệt */}
        {showFullscreenPrompt && !hasFullscreenPermission && createPortal(
          <FullscreenPrompt />,
          document.body
        )}
      
      <div 
        ref={containerRef} 
        className="fullscreen-container"
          // Thêm inert attribute khi hiển thị prompt
          {...(showFullscreenPrompt && !hasFullscreenPermission ? {'inert': ''} : {})}
      >
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
                    onClick={() => {
                      if (isStarted) {
                        const confirmExit = window.confirm("Bạn có chắc muốn rời khỏi bài làm? Tiến trình sẽ không được lưu.");
                        if (confirmExit) {
                          navigate(`/student/question/${questionId}`);
                        }
                      } else {
                        navigate(`/student/question/${questionId}`);
                      }
                    }}
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

                {/* Bước 2: Flashcard */}
                <div className="flex-1 relative">
                  <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      if (isStarted) {
                        const confirmExit = window.confirm("Bạn có chắc muốn rời khỏi bài làm? Tiến trình sẽ không được lưu.");
                        if (confirmExit) {
                          navigate(`/student/vocabulary-flashcards/${questionId}`);
                        }
                      } else {
                        navigate(`/student/vocabulary-flashcards/${questionId}`);
                      }
                    }}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">2</span>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <Check className="h-3 w-3" />
                      </span>
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
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      if (isStarted) {
                        const confirmExit = window.confirm("Bạn có chắc muốn rời khỏi bài làm? Tiến trình sẽ không được lưu.");
                        if (confirmExit) {
                          navigate(`/student/vocabulary-practice/${questionId}`);
                        }
                      } else {
                        navigate(`/student/vocabulary-practice/${questionId}`);
                      }
                    }}
                  >
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">3</span>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <Check className="h-3 w-3" />
                      </span>
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
                  <div className="flex items-center">
                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg relative">
                      <span className="font-semibold">4</span>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <Check className="h-3 w-3" />
                      </span>
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

        {/* Nội dung bài dictation - Wrap in content-wrapper */}
        <div className="content-wrapper">
          <div className="container mx-auto px-2 sm:px-4 py-4 max-w-full sm:max-w-4xl">
            <Card className="backdrop-blur-md bg-white/90 border border-blue-50 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-blue-100/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-50"></div>
              <CardHeader className="relative z-10">
                <CardHeaderContent />
              </CardHeader>
              <CardContent className="space-y-6 relative z-10 card-content">
                {/* Audio Player */}
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg shadow-inner border border-blue-100/30 transition-all duration-300 hover:shadow-md">
                  <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
                    <div className="flex-1 w-full">
                      <audio
                        ref={audioRef}
                        controls
                        style={{ width: '100%' }}
                        aria-label="Audio player"
                        className="rounded-md shadow-sm hidden"
                      />
                      
                      <div className="flex items-center gap-3 w-full px-3 py-3 rounded-lg bg-white shadow-md border border-blue-200">
                        <Button
                          className="flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all duration-200 min-w-[110px]"
                          onClick={() => {
                            const audio = audioRef.current;
                            if (!audio) {
                              console.log('DEBUG: Audio ref is null');
                              return;
                            }
                            
                            // Check if audio source is set properly
                            if (!audio.src && audioUrl) {
                              console.log('DEBUG: Audio source not set, setting manually:', audioUrl);
                              audio.src = audioUrl;
                              audio.load();
                            }
                            
                            console.log('DEBUG: Audio button clicked, current state:', {
                              src: audio.src,
                              paused: audio.paused,
                              currentTime: audio.currentTime,
                              duration: audio.duration,
                              readyState: audio.readyState,
                              networkState: audio.networkState
                            });
                            
                            // Force display of duration even if event handling failed
                            if (audio.duration && audio.duration > 0 && duration === 0) {
                              console.log('DEBUG: Manually setting duration:', audio.duration);
                              setDuration(audio.duration);
                            }
                            
                            if (audio.paused) {
                              audio.play()
                                .then(() => {
                                  setAudioPlaying(true);
                                  // Update time immediately for better UI feedback
                                  setCurrentTime(audio.currentTime);
                                  console.log('DEBUG: Audio playback started successfully');
                                })
                                .catch(err => {
                                  console.error('DEBUG: Error playing audio:', err);
                                  setError('Không thể phát audio. Vui lòng thử lại sau.');
                                });
                            } else {
                              audio.pause();
                              setAudioPlaying(false);
                              console.log('DEBUG: Audio paused at', audio.currentTime);
                            }
                          }}
                        >
                          <span className="mr-2">
                            {audioPlaying ? (
                              <PauseCircle className="h-5 w-5" />
                            ) : (
                              <Play className="h-5 w-5" />
                            )}
                          </span>
                          {audioPlaying ? "Tạm dừng" : "Phát audio"}
                        </Button>
                        
                        <div 
                          className="w-full bg-blue-200 rounded-full h-4 overflow-hidden shadow-inner flex-1 relative cursor-pointer" 
                          onClick={(e) => {
                            const audio = audioRef.current;
                            if (!audio) return;
                            
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickPosition = (e.clientX - rect.left) / rect.width;
                            const newTime = clickPosition * (audio.duration || 0);
                            
                            audio.currentTime = newTime;
                            setCurrentTime(newTime);
                          }}
                        >
                          <div
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all"
                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                          ></div>
                          <div 
                            className="absolute h-6 w-6 bg-white rounded-full shadow-lg border-2 border-blue-600 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                            style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                          ></div>
                        </div>
                        
                        <div className="text-sm font-medium text-gray-800 shrink-0 ml-2 min-w-[80px] text-center bg-blue-50 px-2 py-1 rounded-md">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {error && (
                    <div className="mt-2 text-sm text-red-500 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm p-2 rounded-md border border-red-100/30">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}
                  
                  {errorMessage && (
                    <div className="mt-2 text-sm text-red-500 flex items-center gap-2 bg-red-50/50 backdrop-blur-sm p-2 rounded-md border border-red-100/30">
                      <AlertCircle className="h-4 w-4" />
                      {errorMessage}
                    </div>
                  )}
                  
                  {/* Remove audio URL display */}
                </div>
                
                {/* Script with blanks */}
                <div className="overflow-auto max-h-[50vh] p-4 bg-white/70 backdrop-blur-sm rounded-lg shadow-inner border border-blue-100/30 overflow-x-hidden">
                  {renderScript()}
                </div>

                {/* Submit button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSubmit}
                    disabled={isLoading}
                      className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-300 interactive-button focus-visible"
                      tabIndex={0}
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
            </div>
          </div>
        </div>

        {/* Render dialogs outside main content */}
        {showResults && (
        <Dialog open={showResults} onOpenChange={(open) => {
          if (!open) {
            navigate('/student/dashboard');
          }
          setShowResults(open);
        }}>
            <DialogContent className="sm:max-w-md md:max-w-xl backdrop-blur-lg bg-white/90 border border-white/40 shadow-xl dialog-content" tabIndex={-1}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-70 rounded-lg"></div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold">Kết quả bài làm</DialogTitle>
              <DialogDescription className="text-gray-600">
                Dưới đây là chi tiết kết quả bài làm của bạn
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4 relative z-10">
              {/* Hiển thị điểm số */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative">
                  <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">
                    {scoreInfo.totalScore}%
                  </div>
                  <div className="absolute -inset-4 bg-blue-500/5 rounded-full blur-sm animate-pulse"></div>
                </div>
                <p className="text-sm text-gray-600 bg-blue-50/50 px-3 py-1 rounded-full">
                  {scoreInfo.correctAnswers} đúng / {scoreInfo.correctAnswers + scoreInfo.incorrectAnswers} câu
                </p>
              </div>
              
              {/* Hiển thị các lỗi */}
              {scoreInfo.errors.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-lg text-gray-700">Các lỗi sai</h3>
                  <div className="border border-blue-100 rounded-md overflow-hidden backdrop-blur-sm bg-white/70">
                    <table className="min-w-full divide-y divide-blue-100">
                      <thead className="bg-blue-50/70">
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
                      <tbody className="bg-white/50 divide-y divide-blue-100">
                        {scoreInfo.errors.map((error, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-red-500 bg-red-50/30 rounded-md mx-2">
                              {error.userAnswer || '(Trống)'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-green-500 bg-green-50/30 rounded-md mx-2">
                              {error.correctAnswer}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="relative z-10">
              <Button 
                onClick={() => navigate('/student/dashboard')}
                variant="outline"
                className="border-blue-200 hover:border-blue-300 bg-white/60 hover:bg-white/80"
              >
                Quay lại trang chủ
              </Button>
              <Button 
                onClick={() => navigate(`/student/result/${questionId}`)}
                className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md"
              >
                Xem đầy đủ kết quả
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
        
        {showWarning && (
        <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent 
              className="backdrop-blur-lg bg-white/90 border border-white/40 shadow-xl dialog-content alert-dialog-content" 
              tabIndex={-1}
            >
            <div className="absolute inset-0 bg-gradient-to-br from-red-50/30 to-orange-50/30 opacity-70 rounded-lg"></div>
            <AlertDialogHeader className="relative z-10">
                <AlertDialogTitle className="text-xl text-red-600 font-bold">Cảnh báo gian lận!</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-700">
                  {cheatingMessage || 'Hệ thống đã phát hiện hành vi gian lận. Vui lòng không rời khỏi bài làm khi đang làm bài.'}
                <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                  <span className="font-semibold">Số lần cảnh báo: {cheatingAttempts}/{maxCheatingAttempts}</span>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="relative z-10">
              <AlertDialogAction 
                onClick={() => {
                  setShowWarning(false);
                  if (!isFullscreen) {
                    enableFullscreen();
                  }
                }}
                className="bg-gradient-to-r from-red-500 to-orange-500 shadow-md hover:shadow-xl transition-shadow"
              >
                {isFullscreen ? 'Đã hiểu' : 'Quay lại toàn màn hình'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        )}
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
    </StudentLayout>
    </>
  );
};

export default DictationExercise; 