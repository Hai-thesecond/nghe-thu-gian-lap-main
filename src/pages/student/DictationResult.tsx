import React, { useState, useEffect, useRef } from 'react';
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
import { Trophy, ArrowLeft, CheckCircle2, Book, HeartHandshake, ArrowRight, XCircle, AlertCircle, Clock, Volume2, Play, Pause, RefreshCw, Award, Star, HelpCircle, Medal, TrendingUp, Users, ListFilter, BarChart2, AlertTriangle, Info, Crown, User, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import StudentLayout from '@/layouts/StudentLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { WordTiming, getOrCreateWordTimings } from '@/lib/azure-speech';
import AudioPlayer from '@/components/AudioPlayer';
import { css } from '@emotion/css';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { toast as hotToast } from "react-hot-toast";

interface ErrorItem {
  index: number;
  userAnswer: string;
  correctAnswer: string;
  position?: number;
}

interface ScoreInfo {
  totalScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  errors: ErrorItem[];
  completedAt?: string;
  timeTaken?: number;
  audioPlayCount?: number;
}

interface MetadataType {
  blanksPositions?: number[];
  timeTaken?: number;
  audioPlayCount?: number;
  timestamp?: number;
  [key: string]: any;
}

interface QuestionData {
  title: string;
  time_limit: number;
  profiles: {
    full_name: string;
  };
}

// Thêm interface để lưu trữ thông tin từ và số thứ tự
interface IndexedWord {
  word: string;
  occurrence: number; // Số thứ tự xuất hiện
  globalIndex: number; // Vị trí trong mảng scriptWords
}

// Thêm lại type definitions trước DictationResult
type StudentLevelType = 'good' | 'average' | 'weak';
interface LevelInfo {
  name: string;
  multiplier: number;
  label: string;
}

// Add studentLevelInfo definition to the component
type StudentLevelInfo = {
  [key: string]: {
    label: string;
    multiplier: number;
  };
};

const studentLevelInfo: StudentLevelInfo = {
  'good': { label: 'Học sinh giỏi', multiplier: 10 },
  'average': { label: 'Học sinh trung bình', multiplier: 8 },
  'weak': { label: 'Học sinh yếu', multiplier: 7 }
};

// First, add these animation styles at the beginning, around line 76 where the CSS styles start
// Add this after the studentLevelInfo definition and before the DictationResult component

// Define enhanced animation styles
const enhancedAnimations = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideInUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes slideInDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes slideInRight {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.8s ease-in-out forwards;
  }
  
  .animate-slideInUp {
    animation: slideInUp 0.8s ease-out forwards;
  }
  
  .animate-slideInDown {
    animation: slideInDown 0.8s ease-out forwards;
  }
  
  .animate-slideInRight {
    animation: slideInRight 0.8s ease-out forwards;
  }
  
  .animate-pulse-custom {
    animation: pulse 2s infinite;
  }
  
  .animate-bounce-custom {
    animation: bounce 2s infinite;
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  
  .delay-100 { animation-delay: 0.1s; }
  .delay-200 { animation-delay: 0.2s; }
  .delay-300 { animation-delay: 0.3s; }
  .delay-400 { animation-delay: 0.4s; }
  .delay-500 { animation-delay: 0.5s; }
  
  /* Add animation for the hourglass timer */
  @keyframes pulse-hourglass {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
  }
  
  @keyframes sand-falling {
    0% { height: 0; }
    100% { height: 6px; }
  }
  
  .hourglass-container {
    animation: pulse-hourglass 2s infinite ease-in-out;
  }
  
  .sand-animation {
    animation: sand-falling 1s infinite alternate ease-in-out;
  }
`;

// Add tooltip styles after the enhancedAnimations definition, around line 116
const tooltipStyles = `
  .tooltip-container {
    position: relative;
    display: inline-block;
  }

  .tooltip-text {
    visibility: hidden;
    position: absolute;
    z-index: 100;
    background-color: #333;
    color: white;
    text-align: center;
    padding: 6px 10px;
    border-radius: 6px;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s, visibility 0.3s;
    width: max-content;
    max-width: 250px;
    font-size: 0.75rem;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    pointer-events: none;
  }

  .tooltip-text::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }

  .tooltip-container:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }

  /* Enhanced result card styles with hover effects */
  .result-card {
    @apply relative bg-white rounded-lg p-3 shadow-sm border border-gray-100 transition-all duration-300;
    overflow: hidden;
  }

  .result-card:hover {
    @apply shadow-md;
    transform: translateY(-3px);
    border-color: rgba(59, 130, 246, 0.3);
    background-color: rgba(243, 244, 246, 0.5);
  }

  .result-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(to right, #3b82f6, #6366f1);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease;
  }

  .result-card:hover::after {
    transform: scaleX(1);
  }

  .result-card-icon {
    @apply rounded-full p-2 flex-shrink-0 transition-all duration-300;
  }

  .result-card:hover .result-card-icon {
    transform: scale(1.1);
  }

  .result-card-value {
    @apply text-xl font-bold transition-all duration-300;
  }

  .result-card:hover .result-card-value {
    color: #3b82f6;
  }

  .result-card-label {
    @apply text-xs text-gray-500 transition-all duration-300;
  }

  /* More compact UI for smaller screens */
  @media (max-width: 640px) {
    .result-card {
      @apply p-2;
    }
    
    .result-card-icon {
      @apply p-1.5;
    }
    
    .result-card-value {
      @apply text-lg;
    }
  }
  
  /* New tooltip styles based on user's requirements */
  .custom-tooltip-container {
    --background: #333333;
    --color: #e8e8e8;
    position: relative;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 1rem;
    border: 1px solid #eaeaea;
    text-align: center;
    min-height: 120px;
  }
  
  .tooltip-icon {
    font-size: 24px;
    height: 40px;
    width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #fff;
    transition: all 0.3s ease;
    margin-bottom: 8px;
  }
  
  .tooltip-value {
    font-weight: 600;
    font-size: 16px;
    color: #333;
    margin-top: 4px;
  }
  
  .tooltip-label {
    font-size: 12px;
    color: #666;
    margin-top: 2px;
  }
  
  .tooltip-icon-blue { background-color: #3b82f6; }
  .tooltip-icon-purple { background-color: #8b5cf6; }
  .tooltip-icon-amber { background-color: #f59e0b; }
  .tooltip-icon-slate { background-color: #64748b; }
  
  .custom-tooltip {
    position: absolute;
    bottom: 5px;
    left: 0;
    right: 0;
    padding: 0.5em 0.75em;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s ease;
    background: var(--background);
    z-index: 10;
    border-radius: 8px;
    transform: translateY(10px);
    font-weight: 400;
    font-size: 12px;
    color: var(--color);
    box-shadow: rgba(0, 0, 0, 0.25) 0 4px 8px;
    width: 90%;
    max-width: 200px;
    text-align: center;
    margin: 0 auto;
  }
  
  .custom-tooltip-container:hover .custom-tooltip {
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
  }
`;

const DictationResult = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<number | null>(null);
  const [scriptWords, setScriptWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isPlayingScript, setIsPlayingScript] = useState(false);
  const [questionScript, setQuestionScript] = useState<string>('');
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Add countdown timer states
  const [countdownTime, setCountdownTime] = useState<number>(0);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Add state to track if audio is paused (vs completely stopped)
  const [isPaused, setIsPaused] = useState(false);
  
  // Get score information from API
  const [scoreInfo, setScoreInfo] = useState<ScoreInfo>({
    totalScore: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    errors: [],
    completedAt: new Date().toISOString(),
    timeTaken: 0,
    audioPlayCount: 0
  });
  
  const [questionDetails, setQuestionDetails] = useState<{
    title: string;
    teacher: string;
    timeLimit: number;
  }>({
    title: '',
    teacher: '',
    timeLimit: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Thêm state cho word timings
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const timerIdsRef = useRef<NodeJS.Timeout[]>([]);
  
  // State để theo dõi việc đang tạo timing data mới
  const [isGeneratingTimings, setIsGeneratingTimings] = useState(false);
  
  // Thêm biến để tracking thời gian audio và hiển thị debug UI
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  
  // Sửa state để lưu trữ thông tin từng từ với số thứ tự
  const [indexedScriptWords, setIndexedScriptWords] = useState<IndexedWord[]>([]);
  
  // Thêm state lưu thông tin diagnostic
  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    timingWords: string[];
    scriptWords: string[];
    normalizedTimingWords: string[];
    normalizedScriptWords: string[];
    occurrenceMap: Record<string, number[]>;
    currentMatchInfo: any | null;
  }>({
    timingWords: [],
    scriptWords: [],
    normalizedTimingWords: [],
    normalizedScriptWords: [],
    occurrenceMap: {},
    currentMatchInfo: null
  });
  
  // Thêm state quản lý tốc độ phát
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  
  // Thêm state quản lý tab hiện tại
  const [activeTab, setActiveTab] = useState<'script' | 'difficultWords' | 'results'>('results');
  
  // Thêm state quản lý từ khó
  const [difficultWords, setDifficultWords] = useState<{ word: string; translation?: string; phonetic?: string }[]>([]);
  
  // Thêm state cho answerData
  const [answerData, setAnswerData] = useState<any>(null);
  
  // Thêm style cho tabs
  const tabsStyles = css`
    .tabs {
      display: flex;
      position: relative;
      background-color: #fff;
      box-shadow: 0 0 1px 0 rgba(24, 94, 224, 0.15), 0 6px 12px 0 rgba(24, 94, 224, 0.15);
      padding: 0.75rem;
      border-radius: 99px;
      margin-bottom: 1rem;
      max-width: 450px;
      margin-left: auto;
      margin-right: auto;
    }

    .tabs * {
      z-index: 2;
    }

    .container input[type="radio"] {
      display: none;
    }

    .tab {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 30px;
      width: 150px;
      font-size: .9rem;
      color: black;
      font-weight: 500;
      border-radius: 99px;
      cursor: pointer;
      transition: color 0.15s ease-in;
    }

    .container input[type="radio"]:checked + label {
      color: #185ee0;
    }

    .container input[id="radio-1"]:checked ~ .glider {
      transform: translateX(0);
    }

    .container input[id="radio-2"]:checked ~ .glider {
      transform: translateX(100%);
    }

    .container input[id="radio-3"]:checked ~ .glider {
      transform: translateX(200%);
    }

    .glider {
      position: absolute;
      display: flex;
      height: 30px;
      width: 150px;
      background-color: #e6eef9;
      z-index: 1;
      border-radius: 99px;
      transition: 0.25s ease-out;
    }

    @media (max-width: 700px) {
      .tabs {
        transform: scale(0.8);
      }
    }

    /* Audio progress bar styles */
    .audio-progress-container {
      width: 100%;
      height: 8px;
      background-color: #e6eef9;
      border-radius: 4px;
      margin: 10px 0;
      cursor: pointer;
      position: relative;
    }

    .audio-progress-bar {
      height: 100%;
      background-color: #185ee0;
      border-radius: 4px;
      transition: width 0.1s linear;
    }

    .audio-progress-thumb {
      width: 12px;
      height: 12px;
      background-color: #185ee0;
      border-radius: 50%;
      position: absolute;
      top: -2px;
      transform: translateX(-50%);
      cursor: pointer;
    }

    .word-clickable {
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .word-clickable:hover {
      background-color: #e6eef9;
      transform: scale(1.05);
    }
    
    /* Custom Audio Control Buttons */
    .audio-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 15px 0;
    }
    
    .audio-control-btn {
      position: relative;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      color: #4d4d4d;
      background-color: #fff;
      margin: 0 8px;
      border: none;
      transition: all 0.3s ease-in-out;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .audio-control-btn:hover:not(:disabled) {
      box-shadow: 3px 2px 15px 0px rgba(0, 0, 0, 0.15);
      color: white;
    }
    
    .audio-control-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .audio-control-btn svg {
      position: relative;
      z-index: 2;
      width: 24px;
      height: 24px;
    }
    
    .audio-control-btn .filled {
      position: absolute;
      top: auto;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 0;
      background-color: #185ee0;
      transition: all 0.3s ease-in-out;
      z-index: 1;
    }
    
    .audio-control-btn:hover:not(:disabled) .filled {
      height: 100%;
    }
    
    .audio-control-btn .tooltip {
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      color: #fff;
      padding: 6px 10px;
      border-radius: 5px;
      opacity: 0;
      visibility: hidden;
      font-size: 12px;
      transition: all 0.3s ease;
      background-color: #185ee0;
      white-space: nowrap;
      z-index: 10;
    }
    
    .audio-control-btn:hover .tooltip {
      opacity: 1;
      visibility: visible;
      top: -40px;
    }
    
    .audio-control-play .filled,
    .audio-control-play .tooltip {
      background-color: #4caf50;
    }
    
    .audio-control-pause .filled,
    .audio-control-pause .tooltip {
      background-color: #ff9800;
    }
    
    .audio-control-backward .filled,
    .audio-control-backward .tooltip {
      background-color: #2196f3;
    }
    
    .audio-control-forward .filled,
    .audio-control-forward .tooltip {
      background-color: #2196f3;
    }
    
    .audio-control-speed .filled,
    .audio-control-speed .tooltip {
      background-color: #9c27b0;
    }
    
    .playback-speed-dropdown {
      position: absolute;
      top: 55px;
      left: 50%;
      transform: translateX(-50%);
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      z-index: 100;
      padding: 5px 0;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    
    .audio-control-speed:hover .playback-speed-dropdown {
      opacity: 1;
      visibility: visible;
    }
    
    .speed-option {
      padding: 8px 20px;
      cursor: pointer;
      transition: background-color 0.2s;
      text-align: center;
    }
    
    .speed-option:hover {
      background-color: #f5f5f5;
    }
    
    .speed-option.active {
      background-color: #e3f2fd;
      font-weight: 600;
      color: #185ee0;
    }
    
    .audio-time-display {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
      text-align: center;
    }
  `;
  
  // Thêm state variables
  const [studentLevel, setStudentLevel] = useState<StudentLevelType>('good');
  const [adjustedScore, setAdjustedScore] = useState<number | null>(null);
  const [classRank, setClassRank] = useState<{position: number, total: number, percentile: string}>({
    position: 0, 
    total: 0, 
    percentile: ''
  });

  // Define pass threshold
  const PASS_THRESHOLD = 70;
  const isPassed = scoreInfo.totalScore >= PASS_THRESHOLD;
  
  // Add state for highest score
  const [highestScore, setHighestScore] = useState<number | null>(null);
  
  // Start countdown timer if user hasn't passed
  useEffect(() => {
    if (!isPassed && questionId) {
      console.log("User hasn't passed, checking audio duration...");
      
      // Check if there's a saved end time in localStorage
      const storageKey = `dictation_countdown_${questionId}`;
      const savedEndTimeStr = localStorage.getItem(storageKey);
      const savedEndTime = savedEndTimeStr ? parseInt(savedEndTimeStr, 10) : null;
      const currentTime = Date.now();
      
      // If there's a valid saved end time that's in the future
      if (savedEndTime && savedEndTime > currentTime) {
        // Calculate remaining time from saved end time
        const remainingMs = savedEndTime - currentTime;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        console.log("Using saved end time, remaining seconds:", remainingSeconds);
        
        setCountdownTime(remainingSeconds);
      } else {
        // No valid saved end time, create a new one
        // Set a default duration if audio isn't loaded yet
        const audioDuration = audioRef.current?.duration || 60;
        console.log("Using audio duration:", audioDuration);
        
        const countdownDuration = Math.ceil(audioDuration * 3);
        console.log("Setting countdown duration to:", countdownDuration);
        
        // Calculate and save end time
        const endTime = currentTime + (countdownDuration * 1000);
        localStorage.setItem(storageKey, endTime.toString());
        
        setCountdownTime(countdownDuration);
      }
      
      // Start the countdown
      const interval = setInterval(() => {
        setCountdownTime(prevTime => {
          if (prevTime <= 1) {
            // Time's up, clear interval and redirect
            clearInterval(interval);
            // Clear the saved end time
            localStorage.removeItem(storageKey);
            navigate(`/student/question/${questionId}`);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
      
      // Save interval ID for cleanup
      setCountdownInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [isPassed, navigate, questionId]);

  // Add separate effect to check for audio duration changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !questionId || isPassed) return;

    // Force audio to load metadata if possible
    if (audio.src && !audio.duration) {
      try {
        audio.load();
      } catch (e) {
        console.error("Error loading audio:", e);
      }
    }

    // When duration becomes available
    const handleDurationChange = () => {
      console.log("Audio duration changed:", audio.duration);
      
      const storageKey = `dictation_countdown_${questionId}`;
      const savedEndTimeStr = localStorage.getItem(storageKey);
      
      // Only update if we don't have a saved end time already
      if (!savedEndTimeStr) {
        // Update countdown time when we get the actual duration
        const newDuration = Math.ceil(audio.duration * 3);
        console.log("Updating countdown based on actual duration:", newDuration);
        
        // Calculate and save new end time
        const endTime = Date.now() + (newDuration * 1000);
        localStorage.setItem(storageKey, endTime.toString());
        
        setCountdownTime(newDuration);
        
        // Clear and restart the interval with the correct time
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }
        
        const newInterval = setInterval(() => {
          setCountdownTime(prevTime => {
            if (prevTime <= 1) {
              clearInterval(newInterval);
              // Clear the saved end time
              localStorage.removeItem(storageKey);
              navigate(`/student/question/${questionId}`);
              return 0;
            }
            return prevTime - 1;
          });
        }, 1000);
        
        setCountdownInterval(newInterval);
      }
    };

    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadedmetadata', handleDurationChange);
    
    return () => {
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadedmetadata', handleDurationChange);
    };
  }, [audioRef.current, isPassed, countdownInterval, navigate, questionId]);

  // Add cleanup effect for when component unmounts but user hasn't been redirected
  useEffect(() => {
    return () => {
      // Don't clear the localStorage when unmounting
      // It needs to persist for when the user refreshes the page
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [countdownInterval]);
  
  // Fetch question details and results if not provided in location state
  useEffect(() => {
    if (!user || !questionId) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch student result data from the student_results view that combines all required data
        const { data: resultData, error: resultError } = await supabase
          .from('student_results_view')
          .select('*')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .order('attempt_timestamp', { ascending: false })
          .limit(1)
          .single();
          
        if (resultError) {
          console.error('Không thể tải dữ liệu kết quả:', resultError);
          throw new Error('Không thể tải dữ liệu bài làm');
        }
        
        if (!resultData) {
          console.error('Không tìm thấy dữ liệu kết quả');
          throw new Error('Không tìm thấy bài làm');
        }
        
        console.log('Dữ liệu kết quả từ database:', resultData);
        
        // Get additional error details directly from student_answers table
        const { data: studentAnswerData, error: answerError } = await supabase
          .from('student_answers')
          .select('error_details, metadata')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();
          
        if (answerError) {
          console.error('Không thể tải chi tiết lỗi:', answerError);
        }
        
        // Set the answer data state
        setAnswerData(studentAnswerData);
        
        // Use error details from studentAnswerData if available
        const errorDetails = (studentAnswerData && studentAnswerData.error_details) 
          ? studentAnswerData.error_details 
          : resultData.error_details || [];
          
        console.log('Chi tiết lỗi:', errorDetails);
        
        // Set score info with the correct error details
        const finalScoreInfo = {
          totalScore: resultData.score || 0,
          correctAnswers: resultData.correct_count || 0,
          incorrectAnswers: resultData.incorrect_count || 0,
          errors: errorDetails,
          completedAt: resultData.completed_at,
          timeTaken: resultData.time_taken || 0,
          audioPlayCount: resultData.audio_play_count || 0
        };
        
        console.log('Final score info being set:', finalScoreInfo);
        setScoreInfo(finalScoreInfo);
        
        // Set student level from the result data if available
        if (resultData.student_level) {
          setStudentLevel(resultData.student_level);
        }
        
        // Fetch question details
        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('title, time_limit, profiles:created_by(full_name)')
          .eq('id', questionId)
          .single();
          
        if (questionError) {
          console.error('Không thể tải thông tin bài thi:', questionError);
          throw new Error('Không thể tải thông tin bài thi');
        }
        
        // Format question details correctly
        setQuestionDetails({
          title: questionData?.title || 'Bài thi không tên',
          teacher: questionData?.profiles?.[0]?.full_name || 'Giáo viên không xác định',
          timeLimit: questionData?.time_limit || 0
        });
        
        // Fetch error analysis data separately
        if (user?.id) {
          await fetchErrorAnalysisData();
        }
        
        // Get ranking data if needed
        if (resultData.score !== null) {
          await calculateRanking();
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
        toast.error('Không thể tải kết quả bài làm. Vui lòng thử lại sau.');
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [questionId, user, navigate]);
  
  // Calculate performance metrics
  const accuracy = scoreInfo.correctAnswers / (scoreInfo.correctAnswers + scoreInfo.incorrectAnswers) * 100 || 0;
  
  // Get grade based on score
  const getGrade = (score: number) => {
    if (score >= 90) return { grade: 'A', text: 'Xuất sắc', color: 'text-emerald-500' };
    if (score >= 80) return { grade: 'B', text: 'Tốt', color: 'text-green-500' };
    if (score >= 70) return { grade: 'C', text: 'Khá', color: 'text-blue-500' };
    if (score >= 60) return { grade: 'D', text: 'Trung bình', color: 'text-yellow-500' };
    return { grade: 'F', text: 'Cần cải thiện', color: 'text-red-500' };
  };
  
  const grade = getGrade(scoreInfo.totalScore);
  
  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  // Format time
  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0 phút 0 giây";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes} phút ${remainingSeconds} giây`;
  };
  
  // Thêm useEffect để log mỗi khi scoreInfo thay đổi
  useEffect(() => {
    // Log chi tiết cho debug
    console.log('Score info changed:', {
      correctAnswers: scoreInfo.correctAnswers,
      incorrectAnswers: scoreInfo.incorrectAnswers,
      total: scoreInfo.correctAnswers + scoreInfo.incorrectAnswers,
      score: scoreInfo.totalScore,
      errorsLength: scoreInfo.errors?.length || 0,
      errorsData: scoreInfo.errors,
      timeTaken: scoreInfo.timeTaken,
      audioPlayCount: scoreInfo.audioPlayCount
    });
  }, [scoreInfo]);
  
  // Hàm để lấy URL audio của bài thi
  const getAudioUrl = async (path: string): Promise<string> => {
    try {
      if (!path) {
        console.error('Audio path is empty');
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
      return '';
    }
  };

  // Load word timings khi audio URL đã sẵn sàng
  useEffect(() => {
    if (audioUrl && questionId) {
      console.log('Audio URL đã sẵn sàng, loading word timings:', { audioUrl, questionId });
      loadWordTimings();
    } else {
      console.log('Chưa thể load word timings, thiếu:', { 
        audioUrl: audioUrl ? 'có' : 'không có', 
        questionId: questionId ? 'có' : 'không có' 
      });
    }
  }, [audioUrl, questionId]);

  // Hàm tải word timings
  const loadWordTimings = async (forceRefresh = false) => {
    if (!questionId || !audioUrl) {
      console.error('Không thể tải word timings, thiếu dữ liệu:', {
        questionId,
        audioUrl,
      });
      return;
    }
    
    console.log('Đang tải word timings cho câu hỏi:', questionId);
    
    if (forceRefresh) {
      setIsGeneratingTimings(true);
      toast.loading('Đang tạo mới timing data từ Azure...', { id: 'azure-timing-generation' });
    }
    
    // Thử lấy từ cache của Azure trước
    setTimeout(async () => {
      try {
        // Đọc script từ câu hỏi nếu cần
        if (questionScript.length === 0) {
          await fetchQuestionScript();
        }
        
        // Gọi hàm lấy/tạo word timings
        // Xử lý chỉ truyền 3 tham số hoặc thêm type chuẩn cho hàm
        const timings = await getOrCreateWordTimings(
          questionId, 
          audioUrl, 
          forceRefresh
        );
        
        console.log(`Loaded ${timings.length} word timings from Azure Speech`);
        
        if (timings.length === 0) {
          console.log('No timings returned, using synthetic timings');
          // Nếu không có timings, tạo synthetic timings từ script
          const syntheticTimings = createSyntheticTimings();
          setWordTimings(syntheticTimings);
        } else {
          setWordTimings(timings);
        }
        
        if (forceRefresh) {
          setIsGeneratingTimings(false);
          toast.success('Đã tạo mới timing data từ Azure thành công', { id: 'azure-timing-generation' });
        }
        
        if (wordTimings && wordTimings.length > 0) {
          // Lưu thông tin về các từ trong timing
          const timingWords = wordTimings.map(t => t.word);
          const normalizedTimingWords = wordTimings.map(t => 
            t.word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '')
          );
          
          setDiagnosticInfo(prev => ({
            ...prev,
            timingWords,
            normalizedTimingWords
          }));
          
          console.log('Timing words:', {
            count: wordTimings.length,
            words: timingWords,
            normalizedWords: normalizedTimingWords,
            uniqueWords: new Set(normalizedTimingWords).size
          });
          
          return wordTimings;
        }
      } catch (innerError) {
        console.error('Lỗi tải word timings:', innerError);
        if (forceRefresh) {
          setIsGeneratingTimings(false);
          toast.error('Lỗi khi tạo timing data', { id: 'azure-timing-generation' });
        }
        
        // Fallback to synthetic timings
        const syntheticTimings = createSyntheticTimings();
        setWordTimings(syntheticTimings);
      }
    }, 100); // Slight delay to ensure interface is updated
  };

  // Thêm hàm tạo synthetic timings cải tiến
  const createSyntheticTimings = (): WordTiming[] => {
    if (!questionScript || !audioRef.current) return [];
    
    // Xử lý script để có danh sách từ
    const words = questionScript
      .replace(/([.,!?;:()])/g, ' $1 ')  // Thêm khoảng trắng xung quanh dấu câu
      .replace(/\s+/g, ' ')             // Gộp nhiều khoảng trắng
      .trim()
      .split(' ')
      .filter(w => w.length > 0);       // Loại bỏ các phần tử rỗng
    
    // Lấy tổng thời lượng audio
    const totalDuration = audioRef.current.duration || 60; // Mặc định 60s nếu không lấy được
    
    // Xác định thời gian cho mỗi từ
    const timings: WordTiming[] = [];
    const wordsPerSecond = words.length / totalDuration; // Số từ trung bình mỗi giây
    
    // Phân đoạn text để phân bố thời gian tốt hơn
    const segments: string[][] = [];
    let currentSegment: string[] = [];
    
    words.forEach(word => {
      currentSegment.push(word);
      // Kết thúc đoạn khi gặp dấu câu kết thúc
      if (['.', '?', '!'].includes(word)) {
        if (currentSegment.length > 0) {
          segments.push([...currentSegment]);
          currentSegment = [];
        }
      }
    });
    
    // Thêm đoạn cuối cùng nếu còn
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    // Tính thời gian cho từng đoạn
    let currentTime = 0;
    segments.forEach(segment => {
      // Tính thời gian cho đoạn này
      const segmentDuration = (segment.length / words.length) * totalDuration;
      const wordDuration = segmentDuration / segment.length;
      
      // Tạo timing cho từng từ trong đoạn
      segment.forEach((word, index) => {
        const startTime = currentTime + (index * wordDuration);
        const endTime = startTime + wordDuration;
        
        timings.push({
          word,
          startTime,
          endTime
          // Không thêm thuộc tính confidence không hợp lệ
        });
      });
      
      // Cập nhật thời gian bắt đầu cho đoạn tiếp theo
      currentTime += segmentDuration;
    });
    
    return timings;
  };

  // Thêm toggle debug function
  const toggleDebug = () => {
    setShowDebug(prev => !prev);
  };
  
  // Thêm hàm scroll để tự động cuộn đến từ đang highlight
  const scrollToWord = (index: number) => {
    // Chỉ scroll nếu có ref đến từ và từ đó nằm ngoài vùng nhìn thấy
    if (wordRefs.current[index]) {
      const wordElement = wordRefs.current[index];
      const scriptElement = document.querySelector('.script-container');
      
      if (wordElement && scriptElement) {
        // Tính toán vị trí scroll
        const scriptRect = scriptElement.getBoundingClientRect();
        const wordRect = wordElement.getBoundingClientRect();
        
        // Kiểm tra xem từ có nằm trong vùng nhìn thấy không
        const isVisible = (
          wordRect.top >= scriptRect.top &&
          wordRect.bottom <= scriptRect.bottom
        );
        
        // Nếu không nằm trong vùng nhìn thấy, scroll đến từ đó
        if (!isVisible) {
          // Sử dụng getBoundingClientRect thay vì offsetTop
          const scrollTop = wordRect.top - scriptRect.top - 
            (scriptElement.clientHeight / 2) + (wordElement.offsetHeight / 2);
            
          scriptElement.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          });
        }
      }
    }
  };
  
  // Thêm hàm findWordAtTime để lấy từ dựa vào thời gian audio
  const findWordAtTime = (time: number) => {
    if (wordTimings.length === 0) return null;
    
    // Lặp từ cuối lên để tìm từ gần nhất nhỏ hơn hoặc bằng time
    for (let i = wordTimings.length - 1; i >= 0; i--) {
      if (wordTimings[i].startTime <= time) {
        const word = wordTimings[i].word;
        const normalizedWord = word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
        
        // Tìm số lần xuất hiện của từ này trong wordTimings trước vị trí hiện tại
        let occurrence = 1;
        for (let j = 0; j < i; j++) {
          const prevWord = wordTimings[j].word;
          const normalizedPrevWord = prevWord.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
          if (normalizedPrevWord === normalizedWord) {
            occurrence++;
          }
        }
        
        return {
          word: normalizedWord,
          rawWord: word,
          time: wordTimings[i].startTime,
          occurrence,
          index: i
        };
      }
    }
    
    return null;
  };
  
  // Thêm tham số parseScript cho loadWordTimings
  const fetchQuestionScript = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('script')
        .eq('id', questionId)
        .single();
        
      if (error) {
        console.error('Error fetching question script:', error);
        return;
      }
      
      if (data?.script) {
        setQuestionScript(data.script);
        
        // Xử lý script thành mảng các từ để hiển thị
        const words = data.script
          .replace(/[.,!?;:()[\]{}"""'']/g, ' $& ')  // Thêm khoảng trắng trước dấu câu
          .replace(/\s+/g, ' ')  // Chuẩn hóa khoảng trắng
          .trim()
          .split(' ')
          .filter(word => word.trim() !== '');
          
        setScriptWords(words);
        console.log('Script words:', words);
      }
    } catch (err) {
      console.error('Exception fetching question script:', err);
    }
  };

  // Thêm hàm phân tích script để đánh số thứ tự
  const analyzeScript = (words: string[]) => {
    const occurrenceMap = new Map<string, number>();
    const occurrencePositions: Record<string, number[]> = {};
    const normalizedWords: string[] = [];
    const result: IndexedWord[] = [];
    
    words.forEach((word, index) => {
      const normalizedWord = word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
      normalizedWords.push(normalizedWord);
      
      // Bỏ qua từ rỗng và dấu câu
      if (normalizedWord.trim() === '' || /^[.,!?;:()[\]{}"""'']+$/.test(word)) {
        result.push({ word, occurrence: 0, globalIndex: index });
        return;
      }
      
      const count = (occurrenceMap.get(normalizedWord) || 0) + 1;
      occurrenceMap.set(normalizedWord, count);
      
      // Lưu vị trí xuất hiện của từng từ
      if (!occurrencePositions[normalizedWord]) {
        occurrencePositions[normalizedWord] = [];
      }
      occurrencePositions[normalizedWord].push(index);
      
      result.push({
        word,
        occurrence: count,
        globalIndex: index
      });
    });
    
    // Cập nhật thông tin diagnostic
    setDiagnosticInfo(prev => ({
      ...prev,
      scriptWords: words,
      normalizedScriptWords: normalizedWords,
      occurrenceMap: occurrencePositions
    }));
    
    console.log('Script analysis:', {
      words: words.length,
      normalizedWords: normalizedWords.length,
      uniqueWords: new Set(normalizedWords).size,
      occurrencePositions
    });
    
    return result;
  };

  // Thêm useEffect để phân tích script và tạo indexedScriptWords
  useEffect(() => {
    if (scriptWords.length > 0) {
      const analyzed = analyzeScript(scriptWords);
      setIndexedScriptWords(analyzed);
      
      // Logging để debug
      const duplicateWords = [...new Set(
        analyzed
          .filter(w => w.occurrence > 1)
          .map(w => w.word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, ''))
      )];
      
      console.log(`Found ${duplicateWords.length} duplicate words:`, duplicateWords);
      
      duplicateWords.forEach(word => {
        const occurrences = analyzed
          .filter(w => w.word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '') === word)
          .map(w => ({ occurrence: w.occurrence, index: w.globalIndex }));
        
        console.log(`Word "${word}" appears ${occurrences.length} times at:`, occurrences);
      });
    }
  }, [scriptWords]);

  // Hàm mới để tìm từ trong script dựa trên text và số thứ tự xuất hiện
  const findWordInScript = (word: string, occurrence: number): number => {
    const normalizedWord = word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
    
    // Tìm từ khớp với số thứ tự xuất hiện
    const match = indexedScriptWords.find(w => {
      const normalizedScriptWord = w.word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
      return normalizedScriptWord === normalizedWord && w.occurrence === occurrence;
    });
    
    if (match) {
      return match.globalIndex;
    }
    
    // Fallback: tìm từ đầu tiên phù hợp nếu không tìm thấy theo số thứ tự
    const firstMatch = indexedScriptWords.findIndex(w => {
      const normalizedScriptWord = w.word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
      return normalizedScriptWord === normalizedWord;
    });
    
    return firstMatch >= 0 ? firstMatch : -1;
  };

  // Cập nhật hàm timeupdate để highlight từ theo thời gian thực
  const handleTimeUpdate = () => {
    if (!audioRef.current || wordTimings.length === 0) return;
    
    const currentTime = audioRef.current.currentTime;
    setCurrentAudioTime(currentTime);
    
    // Tìm từ hiện tại dựa vào thời gian
    const currentWordInfo = findWordAtTime(currentTime);
    
    if (currentWordInfo) {
      // Tìm vị trí từ trong script dựa vào từ và số thứ tự xuất hiện
      const scriptIndex = findWordInScript(currentWordInfo.word, currentWordInfo.occurrence);
      
      // Lưu thông tin diagnostic về matching hiện tại
      const matchInfo = {
        audioTime: currentTime,
        wordFromTiming: currentWordInfo.rawWord,
        normalizedWord: currentWordInfo.word,
        occurrence: currentWordInfo.occurrence,
        timingIndex: currentWordInfo.index,
        scriptIndex: scriptIndex,
        scriptWord: scriptIndex >= 0 ? scriptWords[scriptIndex] : null,
        scriptOccurrence: scriptIndex >= 0 ? indexedScriptWords[scriptIndex]?.occurrence : null,
        isMatch: scriptIndex >= 0 && scriptIndex === currentWordIndex
      };
      
      setDiagnosticInfo(prev => ({
        ...prev,
        currentMatchInfo: matchInfo
      }));
      
      if (scriptIndex >= 0 && scriptIndex !== currentWordIndex) {
        console.log(`Word match at ${currentTime.toFixed(2)}s:`, matchInfo);
        setCurrentWordIndex(scriptIndex);
        scrollToWord(scriptIndex);
      }
    }
  };

  // Cập nhật playFullScript để hỗ trợ pause/resume
  const playFullScript = () => {
    if (!audioRef.current || !audioUrl || wordTimings.length === 0) {
      console.log('Cannot play: missing audio element, URL, or word timings');
      toast.error('Không thể phát audio. Vui lòng thử lại sau.');
      return;
    }
    
    // If we're already playing, pause instead of restarting
    if (isPlayingScript) {
      pausePlayback();
      return;
    }
    
    // If we're paused, resume from current position
    if (isPaused) {
      resumePlayback();
      return;
    }
    
    // Otherwise start from beginning (normal flow)
    // Xóa các timeout cũ
    timerIdsRef.current.forEach(id => clearTimeout(id));
    timerIdsRef.current = [];
    
    // Reset current word if not resuming
    setCurrentWordIndex(-1);
    
    // Setup audio
    if (audioRef.current.src !== audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
    
    // Đặt tốc độ phát
    audioRef.current.playbackRate = playbackRate;
    
    // Thêm event listener để cập nhật thời gian và từ được highlight
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    
    // Thêm cleanup event
    const cleanupFunction = () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
      setIsPlayingScript(false);
      setIsPaused(false);
      console.log('Audio playback ended or stopped');
    };
    
    audioRef.current.addEventListener('ended', cleanupFunction);
    
    // Phát audio
    audioRef.current.play()
      .then(() => {
        setIsPlayingScript(true);
        setIsPaused(false);
        console.log('Audio playback started successfully');
      })
      .catch(error => {
        console.error('Error playing audio:', error);
        toast.error('Không thể phát audio. Vui lòng thử lại sau.');
        cleanupFunction();
      });
  };

  // Add new function to pause playback without resetting
  const pausePlayback = () => {
    if (!audioRef.current) return;
    
    // Just pause the audio without resetting position
    audioRef.current.pause();
    
    // Update state to reflect paused status
    setIsPlayingScript(false);
    setIsPaused(true);
    console.log('Audio playback paused at', audioRef.current.currentTime);
  };
  
  // Add new function to resume playback
  const resumePlayback = () => {
    if (!audioRef.current) return;
    
    // Make sure timeupdate handler is attached
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    
    // Resume playback
    audioRef.current.play()
      .then(() => {
        setIsPlayingScript(true);
        setIsPaused(false);
        console.log('Audio playback resumed from', audioRef.current.currentTime);
      })
      .catch(error => {
        console.error('Error resuming audio:', error);
        toast.error('Không thể tiếp tục phát audio.');
      });
  };

  // Update stopPlayingScript to reset everything
  const stopPlayingScript = () => {
    if (!audioRef.current) return;
    
    // Dừng audio
    audioRef.current.pause();
    
    // Reset audio
    audioRef.current.currentTime = 0;
    
    // Xóa event listener
    audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
    
    // Xóa timeouts
    timerIdsRef.current.forEach(clearTimeout);
    timerIdsRef.current = [];
    
    // Cập nhật trạng thái
    setIsPlayingScript(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
  };

  useEffect(() => {
    if (questionId) {
      fetchQuestionAudio();
    }
  }, [questionId]);

  // Load audio URL when question data is available
  const fetchQuestionAudio = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('audio_url')
        .eq('id', questionId)
        .single();
        
      if (error) {
        console.error('Error fetching question audio URL:', error);
        return;
      }
      
      if (data?.audio_url) {
        const url = await getAudioUrl(data.audio_url);
        console.log('Loaded audio URL:', url);
        toast.success('Đã tải audio thành công');
      }
    } catch (err) {
      console.error('Exception fetching question audio URL:', err);
      toast.error('Không thể tải file audio');
    }
  };

  // Khôi phục lại nội dung đầy đủ của hàm forceReloadTimings
  const forceReloadTimings = () => {
    if (!audioUrl || !questionId) {
      toast.error('Không thể tạo timing mới, thiếu file audio hoặc ID bài');
      return;
    }
    
    if (isGeneratingTimings) {
      toast.info('Đang tạo timing data, vui lòng đợi');
      return;
    }
    
    // Xác nhận trước khi tạo mới
    if (confirm('Bạn có chắc muốn tạo mới timing data từ Azure API không? Quá trình này có thể mất vài giây.')) {
      loadWordTimings(true);
    }
  };

  // Audio ended event handler
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleEnded = () => {
      console.log('Audio playback ended');
      stopPlayingScript();
    };
    
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Fetch question script when loading
  useEffect(() => {
    if (questionId) {
      fetchQuestionScript();
    }
  }, [questionId]);

  // Thêm hàm điều chỉnh tốc độ phát
  const changePlaybackRate = (newRate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  // Thêm hàm tua tiến/lùi
  const seekAudio = (seconds: number) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      audioRef.current.currentTime = Math.max(0, Math.min(newTime, audioRef.current.duration));
    }
  };

  // Hàm cập nhật từ khó khi component mount
  useEffect(() => {
    if (scriptWords.length > 0) {
      // Giả lập danh sách từ khó (trong thực tế có thể lấy từ API)
      const commonWords = ['the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it'];
      const extractedDifficultWords = scriptWords
        .filter(word => {
          const normalizedWord = word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
          return normalizedWord.length > 4 && !commonWords.includes(normalizedWord);
        })
        .map(word => ({
          word,
          translation: '',
          phonetic: ''
        }));
      
      // Lấy unique words
      const uniqueWords = Array.from(new Set(extractedDifficultWords.map(w => w.word)))
        .map(word => extractedDifficultWords.find(w => w.word === word))
        .filter(Boolean) as { word: string; translation?: string; phonetic?: string }[];
      
      setDifficultWords(uniqueWords.slice(0, 10)); // Lấy tối đa 10 từ
    }
  }, [scriptWords]);

  // Hàm xử lý khi click vào thanh progress
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * audioRef.current.duration;
    
    audioRef.current.currentTime = newTime;
  };

  // Hàm phát âm từ khi click
  const playWordSound = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    } else {
      toast.error('Trình duyệt của bạn không hỗ trợ chức năng này');
    }
  };

  // Thay đổi hàm calculateRanking để đọc cấp độ từ bảng student_categories
  const calculateRanking = async () => {
    if (!user?.id || !questionId || !scoreInfo.totalScore) return;
    
    try {
      // Định nghĩa các cấp độ và hệ số tương ứng
      const levels: Record<StudentLevelType, LevelInfo> = {
        good: { name: 'good', multiplier: 10, label: 'Học sinh giỏi' },
        average: { name: 'average', multiplier: 8, label: 'Học sinh trung bình' },
        weak: { name: 'weak', multiplier: 7, label: 'Học sinh yếu' }
      };
      
      // Đọc cấp độ học sinh từ bảng student_categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('student_categories')
        .select('category')
        .eq('student_id', user.id)
        .order('last_updated', { ascending: false })
        .limit(1);
        
      // Map category từ DB sang StudentLevelType
      let userLevel: StudentLevelType = 'good'; // Mặc định là good
      
      if (!categoryError && categoryData && categoryData.length > 0) {
        const category = categoryData[0].category;
        // Map từ category trong DB sang StudentLevelType
        if (category === 'poor') {
          userLevel = 'weak';
        } else if (category === 'average') {
          userLevel = 'average';
        } else if (category === 'good') {
          userLevel = 'good';
        }
        console.log('Đọc được phân loại học sinh:', { category, userLevel });
      } else {
        console.log('Không tìm thấy phân loại học sinh, sử dụng mặc định:', userLevel);
        if (categoryError) {
          console.error('Lỗi khi đọc phân loại học sinh:', categoryError);
        }
      }
      
      // Cập nhật state với cấp độ đọc được
      setStudentLevel(userLevel);
      
      // Lấy điểm của tất cả học sinh đã hoàn thành bài tập này
      const { data, error } = await supabase
        .from('student_answers')
        .select('student_id, score, metadata, is_completed')
        .eq('question_id', questionId)
        .not('score', 'is', null);
        
      if (error) {
        console.error('Error fetching class scores:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        setClassRank({ position: 1, total: 1, percentile: '100%' });
        return;
      }
      
      // First, get student categories for all students
      const studentIds = [...new Set(data.map(item => item.student_id))];
      const { data: studentCategories, error: categoriesError } = await supabase
        .from('student_categories')
        .select('student_id, category, last_updated')
        .in('student_id', studentIds)
        .order('last_updated', { ascending: false });
      
      // Create a map of student id to their category
      const studentCategoryMap: Record<string, string> = {};
      if (studentCategories && !categoriesError) {
        studentIds.forEach(id => {
          // Find the most recent category for this student
          const studentCategory = studentCategories
            .filter(c => c.student_id === id)
            .sort((a, b) => (b.last_updated || '').localeCompare(a.last_updated || ''))
            .shift();
          
          studentCategoryMap[id] = studentCategory?.category || 'average'; // Default to average
        });
      }
      
      // Group scores by student id and find the highest adjusted score for each student
      const studentBestScores: Record<string, number> = {};
      
      data.forEach(item => {
        if (item.score !== null && item.score !== undefined) {
          const studentId = item.student_id;
          // Get the student's category from the map
          const category = studentCategoryMap[studentId] || 'average';
          // Map to student level
          let studentLevel: StudentLevelType = 'average';
          if (category === 'poor') studentLevel = 'weak';
          else if (category === 'average') studentLevel = 'average';
          else if (category === 'good') studentLevel = 'good';
          
          // Calculate the adjusted score for this student using their level
          const multiplier = levels[studentLevel].multiplier;
          const adjustedScore = Math.ceil((item.score / 100) * multiplier * 10) / 10;
          
          // Keep the highest score for this student
          if (!studentBestScores[studentId] || adjustedScore > studentBestScores[studentId]) {
            studentBestScores[studentId] = adjustedScore;
          }
        }
      });
      
      // Calculate current student's adjusted score with ceiling
      const currentAdjustedScore = Math.ceil((scoreInfo.totalScore / 100) * levels[userLevel].multiplier * 10) / 10;
      
      // Update the adjusted score with ceiling
      setAdjustedScore(currentAdjustedScore);
      
      // Get all unique scores and sort them
      const allScores = Object.values(studentBestScores);
        const sortedScores = [...allScores].sort((a, b) => b - a);
        
      // Find current student's position
      const userScore = studentBestScores[user.id] || currentAdjustedScore;
      const position = sortedScores.findIndex(score => score === userScore) + 1;
        const finalPosition = position > 0 ? position : sortedScores.length;
      const total = Object.keys(studentBestScores).length;
        
      // Calculate percentile
        const percentile = Math.round((1 - (finalPosition / total)) * 100);
        const percentileText = `Top ${percentile}%`;
        
      // Update rank
      const currentRank = { position: finalPosition, total, percentile: percentileText };
      setClassRank(currentRank);
      
      console.log('Ranking calculated with adjusted scores:', {
        level: userLevel,
        adjustedScore: currentAdjustedScore,
        baseScore: scoreInfo.totalScore,
        rank: currentRank
      });
    } catch (error) {
      console.error('Error calculating ranking:', error);
      setClassRank({ position: 1, total: 1, percentile: '100%' });
      setAdjustedScore(Math.ceil((scoreInfo.totalScore / 100) * 10 * 10) / 10); // Default fallback
    }
  };

  // Xóa hàm changeStudentLevel vì không cần thiết nữa

  // Thay đổi phần UI hiển thị cấp độ để loại bỏ các nút chọn
  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
    <div className="text-center">
      <div className="text-sm text-gray-600 mb-2">Cấp độ của bạn</div>
      
      <div className="text-lg font-semibold mb-3 px-4 py-2 inline-block bg-white rounded-full border">
        {studentLevel === 'weak' ? 'Học sinh yếu' : 
         studentLevel === 'average' ? 'Học sinh trung bình' : 'Học sinh giỏi'}
        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
          Hệ số: {studentLevel === 'weak' ? '7' : studentLevel === 'average' ? '8' : '10'}
        </span>
      </div>
      
      <div className="flex justify-between mb-2">
        <span className="text-sm text-gray-600">Điểm gốc:</span>
        <span className="text-sm font-semibold">{scoreInfo.totalScore || 0}%</span>
      </div>
      
      <div className="flex justify-between mb-4">
        <span className="text-sm text-gray-600">Điểm theo cấp độ:</span>
        <span className="text-sm font-semibold text-blue-600">{adjustedScore || 0}</span>
      </div>
      
      <div className="flex justify-center items-center mt-2">
        <div className="bg-gray-200 h-2 w-full max-w-xs rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full" 
            style={{ 
              width: `${Math.min(100, classRank.position / Math.max(1, classRank.total) * 100)}%` 
            }}
          ></div>
        </div>
      </div>
      
      <div className="text-sm text-gray-600 mt-2">
        Vị trí {classRank.position} trong {classRank.total} học sinh ({classRank.percentile})
      </div>
      
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className={`border rounded p-2 ${studentLevel === 'good' ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
          <div className="font-semibold text-green-600">Học sinh giỏi</div>
          <div className="mt-1">Hệ số: 10</div>
          <div className="mt-1">Điểm: {Math.round((scoreInfo.totalScore / 100) * 10 * 10)}</div>
        </div>
        <div className={`border rounded p-2 ${studentLevel === 'average' ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
          <div className="font-semibold text-amber-600">Học sinh trung bình</div>
          <div className="mt-1">Hệ số: 8</div>
          <div className="mt-1">Điểm: {Math.round((scoreInfo.totalScore / 100) * 8 * 10)}</div>
        </div>
        <div className={`border rounded p-2 ${studentLevel === 'weak' ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <div className="font-semibold text-red-600">Học sinh yếu</div>
          <div className="mt-1">Hệ số: 7</div>
          <div className="mt-1">Điểm: {Math.round((scoreInfo.totalScore / 100) * 7 * 10)}</div>
        </div>
      </div>
    </div>
  </div>

  // Thêm useEffect để tính toán xếp hạng
  useEffect(() => {
    if (scoreInfo.totalScore > 0) {
      calculateRanking();
    }
  }, [scoreInfo.totalScore, user?.id, questionId]);

  // Thêm useEffect để lấy dữ liệu phân tích lỗi từ bảng error_analysis
  useEffect(() => {
    if (!user?.id || !questionId) return;
    
    const fetchErrorAnalysis = async () => {
      try {
        // Lấy phân tích lỗi từ bảng error_analysis
        const { data: errorAnalysisData, error: errorAnalysisError } = await supabase
          .from('error_analysis')
          .select('*')
          .eq('student_id', user.id)
          .eq('question_id', questionId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (errorAnalysisError) {
          console.error('Lỗi khi lấy dữ liệu phân tích lỗi:', errorAnalysisError);
          return;
        }
        
        if (errorAnalysisData && errorAnalysisData.length > 0) {
          const analysisData = errorAnalysisData[0];
          console.log('Dữ liệu phân tích lỗi:', analysisData);
          
          // Cập nhật state để hiển thị phân tích lỗi
          setErrorAnalysis(analysisData.error_types);
          setErrorDetails(analysisData.error_details);
          
          // Lấy gợi ý cải thiện
          fetchImprovementSuggestions(user.id);
        } else {
          console.log('Không có dữ liệu phân tích lỗi cho bài làm này');
          
          // Thử lấy từ metadata trong student_answers
          const { data: answerData, error: answerError } = await supabase
            .from('student_answers')
            .select('metadata, error_details, wrong_answers')
            .eq('student_id', user.id)
            .eq('question_id', questionId)
            .order('completed_at', { ascending: false })
            .limit(1);
          
          if (answerError) {
            console.error('Lỗi khi lấy metadata từ student_answers:', answerError);
            return;
          }
          
          if (answerData && answerData.length > 0) {
            const answer = answerData[0];
            
            // Kiểm tra nếu có errors trong metadata
            if (answer.metadata && answer.metadata.errors) {
              console.log('Lấy phân tích lỗi từ metadata:', answer.metadata.errors);
              setErrorAnalysis(answer.metadata.errors);
            }
            
            // Lấy error_details nếu có
            if (answer.error_details) {
              console.log('Lấy chi tiết lỗi từ error_details:', answer.error_details);
              setErrorDetails(answer.error_details);
            }
            
            // Lấy wrong_answers nếu có
            if (answer.wrong_answers) {
              console.log('Lấy đáp án sai từ wrong_answers:', answer.wrong_answers);
              // Có thể xử lý thêm wrong_answers tại đây nếu cần
            }
          }
        }
      } catch (error) {
        console.error('Lỗi khi xử lý dữ liệu phân tích lỗi:', error);
      }
    };
    
    const fetchImprovementSuggestions = async (studentId: string) => {
      try {
        const { data: suggestions, error } = await supabase
          .from('improvement_suggestions')
          .select('*')
          .eq('student_id', studentId)
          .limit(1);
        
        if (error) {
          console.error('Lỗi khi lấy gợi ý cải thiện:', error);
          return;
        }
        
        if (suggestions && suggestions.length > 0) {
          console.log('Gợi ý cải thiện:', suggestions[0]);
          setImprovementSuggestions(suggestions[0]);
        }
      } catch (error) {
        console.error('Lỗi khi xử lý gợi ý cải thiện:', error);
      }
    };
    
    fetchErrorAnalysis();
  }, [user?.id, questionId, supabase]);

  // Thêm các state cần thiết ở đầu component
  const [errorAnalysis, setErrorAnalysis] = useState<Record<string, number> | null>(null);
  const [errorDetails, setErrorDetails] = useState<any[] | null>(null);
  const [improvementSuggestions, setImprovementSuggestions] = useState<any | null>(null);

  // Hàm tạo biểu đồ phân tích lỗi
  const renderErrorChart = () => {
    if (!errorAnalysis) return null;
    
    // Chuyển đổi errorAnalysis thành mảng để dễ xử lý
    const errors = Object.entries(errorAnalysis)
      .map(([type, count]) => ({
        type: translateErrorType(type),
        count
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
    
    if (errors.length === 0) return null;
    
    return (
      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Phân tích lỗi</h3>
        
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="flex space-x-4">
            {errors.map((error, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="text-sm font-medium text-gray-500">{error.type}</div>
                <div className="mt-1 relative pt-1">
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-200">
                    <div
                      style={{ width: `${Math.min(100, error.count * 20)}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                    ></div>
                  </div>
                </div>
                <div className="mt-1 text-sm font-bold text-blue-600">{error.count}</div>
              </div>
            ))}
          </div>
        </div>
        
        {improvementSuggestions && (
          <div className="bg-white rounded-lg p-4 shadow">
            <h4 className="text-md font-medium text-gray-900 mb-2">Gợi ý cải thiện</h4>
            
            {improvementSuggestions.strengths && improvementSuggestions.strengths.length > 0 && (
              <div className="mb-3">
                <div className="text-sm font-medium text-green-600">Điểm mạnh:</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {improvementSuggestions.strengths.map((strength: string, index: number) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {improvementSuggestions.weaknesses && improvementSuggestions.weaknesses.length > 0 && (
              <div className="mb-3">
                <div className="text-sm font-medium text-red-600">Cần cải thiện:</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {improvementSuggestions.weaknesses.map((weakness: string, index: number) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {weakness}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {improvementSuggestions.suggested_exercises && improvementSuggestions.suggested_exercises.exercises && (
              <div>
                <div className="text-sm font-medium text-gray-600">Bài tập gợi ý:</div>
                <div className="space-y-2 mt-1">
                  {improvementSuggestions.suggested_exercises.exercises.map((exercise: any, index: number) => (
                    <div key={index} className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                      <div className="font-medium">{exercise.title}</div>
                      <div>{exercise.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Hàm dịch loại lỗi
  const translateErrorType = (type: string): string => {
    switch (type) {
      case 'spelling': return 'Chính tả';
      case 'grammar': return 'Ngữ pháp';
      case 'missing': return 'Thiếu từ';
      case 'meaning': return 'Sai nghĩa';
      case 'blank': return 'Không điền';
      case 'tense': return 'Sai thì';
      default: return type;
    }
  };

  // Add this state for the ranking information
  const [showRankings, setShowRankings] = useState(false);
  const [rankingInfo, setRankingInfo] = useState<{
    rank: number;
    total: number;
    className: string;
    topScores: Array<{
      studentName: string; 
      score: number; 
      adjustedScore: number; 
      studentId: string;
      className?: string;
    }>;
  }>({
    rank: 0,
    total: 0,
    className: '',
    topScores: []
  });

  // Add this function to fetch ranking data with class filtering
  const fetchRankingData = async () => {
    try {
      setRankingInfo({
        rank: 0,
        total: 0,
        className: 'Đang tải...',
        topScores: []
      });
      
      // First, get the current user's class information
      const { data: userClassData, error: userClassError } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('student_id', user.id)
        .single();
        
      if (userClassError) {
        console.error('Error fetching user class:', userClassError);
        return;
      }
      
      const userClassId = userClassData?.class_id;
      
      if (!userClassId) {
        console.error('User not assigned to any class');
        hotToast.error('Bạn chưa được xếp vào lớp nào');
        return;
      }
      
      // Get class information
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', userClassId)
        .single();
        
      if (classError) {
        console.error('Error fetching class details:', classError);
      }
      
      const className = classData?.name || 'Lớp của bạn';
      
      // Try to get ranking data from class_rankings table first
      const { data: classRankingsData, error: classRankingsError } = await supabase
        .from('class_rankings')
        .select('student_id, score, adjusted_score, rank')
        .eq('question_id', questionId)
        .eq('class_id', userClassId)
        .order('rank', { ascending: true });
        
      if (classRankingsError || !classRankingsData || classRankingsData.length === 0) {
        console.error('Error fetching from class_rankings or no data:', classRankingsError);
        hotToast.error('Dữ liệu bảng xếp hạng chưa được cập nhật, đang dùng phương pháp thủ công');
        
        // Fallback to manual calculation
        // Get all students in the same class
        const { data: classStudents, error: classStudentsError } = await supabase
          .from('student_classes')
          .select('student_id')
          .eq('class_id', userClassId);
          
        if (classStudentsError) {
          console.error('Error fetching class students:', classStudentsError);
          return;
        }
        
        const classStudentIds = classStudents.map(student => student.student_id);
        
        // Get student categories for all students in the class
        const { data: studentCategories, error: categoriesError } = await supabase
          .from('student_categories')
          .select('student_id, category')
          .in('student_id', classStudentIds)
          .order('last_updated', { ascending: false });
          
        if (categoriesError) {
          console.error('Error fetching student categories:', categoriesError);
        }
        
        // Create a map of student id to category
        const studentCategoryMap: Record<string, string> = {};
        
        if (studentCategories) {
          // Group categories by student_id
          const categoriesByStudent: Record<string, any[]> = {};
          
          studentCategories.forEach(cat => {
            if (!categoriesByStudent[cat.student_id]) {
              categoriesByStudent[cat.student_id] = [];
            }
            categoriesByStudent[cat.student_id].push(cat);
          });
          
          // For each student, use their most recent category
          Object.entries(categoriesByStudent).forEach(([studentId, categories]) => {
            if (categories.length > 0) {
              studentCategoryMap[studentId] = categories[0].category;
            }
          });
        }
        
        // Manual approach: Fetch all student answers and do the grouping in JS
      const { data: answersData, error: answersError } = await supabase
        .from('student_answers')
          .select('id, student_id, score, metadata, adjusted_score, completed_at')
        .eq('question_id', questionId)
          .in('student_id', classStudentIds)
          .eq('is_completed', true)
          .not('score', 'is', null);
        
      if (answersError) {
        console.error('Error fetching student answers:', answersError);
        return;
      }
        
        if (!answersData || answersData.length === 0) {
          hotToast.error('Không tìm thấy dữ liệu điểm số cho bài này trong lớp của bạn');
        return;
      }
      
      // Then, fetch students' profiles to get names
        const studentIds = [...new Set(answersData.map(answer => answer.student_id))];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds);
        
      if (profilesError) {
        console.error('Error fetching student profiles:', profilesError);
      }
      
      // Create a map of student IDs to names
      const studentNameMap: Record<string, string> = {};
      if (profilesData) {
        profilesData.forEach(profile => {
            studentNameMap[profile.id] = profile.full_name || 'Học sinh';
          });
        }
        
        // Group answers by student to get their best score
        const bestScoresByStudent: Record<string, any> = {};
        
        answersData.forEach(answer => {
          const studentId = answer.student_id;
          
          // Check if this is a better score than what we have already
          if (!bestScoresByStudent[studentId] || 
              (answer.adjusted_score && 
               parseFloat(answer.adjusted_score) > parseFloat(bestScoresByStudent[studentId].adjustedScore || '0'))) {
            
            // Calculate adjusted score if not already available
            let adjustedScore = answer.adjusted_score ? parseFloat(answer.adjusted_score) : null;
            
            if (!adjustedScore && answer.score) {
              // Get student category to determine multiplier
              const category = studentCategoryMap[studentId] || 'average';
              let multiplier = 8; // Default for average
              
              if (category === 'good') multiplier = 10;
              else if (category === 'poor') multiplier = 7;
              
              // Calculate adjusted score
              adjustedScore = Math.ceil((answer.score / 100) * multiplier * 10) / 10;
            }
            
            bestScoresByStudent[studentId] = {
              studentId,
              studentName: studentNameMap[studentId] || 'Học sinh',
              rawScore: answer.score || 0,
          adjustedScore: adjustedScore || 0,
              className
        };
          }
      });
      
        // Convert to array and sort by adjusted score
        const allStudentScores = Object.values(bestScoresByStudent)
          .sort((a, b) => b.adjustedScore - a.adjustedScore);
      
        // Find current user's rank
        const userRank = allStudentScores.findIndex(score => score.studentId === user.id) + 1;
      
        // Take top 10 scores
        const top10Scores = allStudentScores.slice(0, 10);
      
      setRankingInfo({
          rank: userRank > 0 ? userRank : allStudentScores.length + 1,
          total: allStudentScores.length,
          className: className,
          topScores: top10Scores.map(score => ({
            studentId: score.studentId,
            studentName: score.studentName,
            score: score.rawScore,
            adjustedScore: score.adjustedScore,
            className: score.className
          }))
        });
      } else {
        // We have data from class_rankings table, use it
        console.log('Using class_rankings data:', classRankingsData);
        
        // Fetch student names
        const studentIds = classRankingsData.map(item => item.student_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds);
          
        if (profilesError) {
          console.error('Error fetching student profiles:', profilesError);
        }
        
        // Create a map of student IDs to names
        const studentNameMap: Record<string, string> = {};
        if (profilesData) {
          profilesData.forEach(profile => {
            studentNameMap[profile.id] = profile.full_name || 'Học sinh';
          });
        }
        
        // Find current user's rank
        const userRankData = classRankingsData.find(item => item.student_id === user.id);
        
        // Get top 10 scores
        const top10Data = classRankingsData.slice(0, 10);
        
        setRankingInfo({
          rank: userRankData ? userRankData.rank : classRankingsData.length + 1,
          total: classRankingsData.length,
          className: className,
          topScores: top10Data.map(item => ({
            studentId: item.student_id,
            studentName: studentNameMap[item.student_id] || 'Học sinh',
            score: item.score || 0,
            adjustedScore: parseFloat(item.adjusted_score) || 0,
            className: className
          }))
        });
      }
    } catch (error) {
      console.error('Error fetching rankings:', error);
      hotToast.error('Có lỗi khi tải bảng xếp hạng');
    }
  };

  const updateScoreInDatabase = async (studentId: string, questionId: string, rawScore: number, adjustedScore: number) => {
    try {
      console.log('Updating score in database:', { 
        studentId, 
        questionId, 
        rawScore, 
        adjustedScore 
      });
      
      const { data, error } = await supabase
        .from('student_answers')
        .update({
          score: rawScore,
          adjusted_score: adjustedScore,
          metadata: {
            ...answerData?.metadata,
            adjusted_score: adjustedScore,
            score_calculation: {
              original_score: rawScore,
              adjusted_score: adjustedScore,
              calculation_method: 'percentage_correct',
              updated_at: new Date().toISOString()
            }
          }
        })
        .eq('student_id', studentId)
        .eq('question_id', questionId)
        .eq('id', answerData?.id)
        .select();
      
      if (error) {
        console.error('Error updating score:', error);
        return false;
      }
      
      console.log('Score updated successfully:', data);
      return true;
    } catch (error) {
      console.error('Exception updating score:', error);
      return false;
    }
  };

  // After the fetchData function, add this helper function
  const fetchErrorAnalysisData = async () => {
    try {
      // Lấy phân tích lỗi từ bảng error_analysis
      const { data: errorAnalysisData, error: errorAnalysisError } = await supabase
        .from('error_analysis')
        .select('*')
        .eq('student_id', user.id)
        .eq('question_id', questionId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (errorAnalysisError) {
        console.error('Lỗi khi lấy dữ liệu phân tích lỗi:', errorAnalysisError);
        return;
      }
      
      if (errorAnalysisData && errorAnalysisData.length > 0) {
        const analysisData = errorAnalysisData[0];
        console.log('Dữ liệu phân tích lỗi:', analysisData);
        
        // Cập nhật state để hiển thị phân tích lỗi
        setErrorAnalysis(analysisData.error_types);
        setErrorDetails(analysisData.error_details);
      }
    } catch (error) {
      console.error('Lỗi khi xử lý dữ liệu phân tích lỗi:', error);
    }
  };

  return (
    <StudentLayout hideSidebar={true}>
      {/* Add the animation styles properly */}
      <style dangerouslySetInnerHTML={{ __html: `${tabsStyles}\n${enhancedAnimations}\n${tooltipStyles}` }} />
      
      {/* Not passed notification at the top with hourglass UI */}
      {!isPassed && (
        <div className="fixed top-0 left-0 w-full z-50 bg-red-50 border-b-2 border-red-200 px-4 py-3 shadow-lg animate-slideInDown">
          <div className="container mx-auto flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mr-3 animate-pulse-custom" />
              <div>
                <h1 className="text-xl font-bold text-red-600">Bạn chưa đạt yêu cầu!</h1>
                <p className="text-red-600 text-sm">Bạn cần đạt tối thiểu 70% để hoàn thành.</p>
              </div>
            </div>
            
            {countdownTime > 0 && (
              <div className="flex items-center mx-4">
                <div className="relative w-16 h-16 flex items-center justify-center hourglass-container">
                  {/* Hourglass animation */}
                  <svg 
                    className="absolute w-full h-full" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="M12 2V22M7 3H17V9L12 12L7 9V3Z" 
                      stroke="#dc2626" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                    <path 
                      d="M7 21H17V15L12 12L7 15V21Z" 
                      stroke="#dc2626" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                    <path 
                      d="M7 15V21H17V15L12 12L7 15Z" 
                      fill="#fee2e2" 
                    />
                    <path 
                      d="M7 9V3H17V9L12 12L7 9Z" 
                      fill="#fee2e2" 
                    />
                    {/* Sand falling animation */}
                    <rect 
                      x="7" 
                      y="15" 
                      width="10" 
                      height={`${(countdownTime / (audioRef.current?.duration || 60) / 3) * 6}`} 
                      fill="#f87171" 
                      className="sand-animation transition-all duration-1000"
                    />
                  </svg>
                  <div className="text-red-600 font-bold z-10 bg-white bg-opacity-70 px-2 py-1 rounded text-center">
                    {Math.floor(countdownTime / 60)}:{(countdownTime % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <div className="text-red-600 font-medium ml-2">
                  Tự động quay lại sau <span className="font-bold">{Math.floor(countdownTime / 60)}:{(countdownTime % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            )}
            
            <Button 
              onClick={() => navigate(`/student/question/${questionId}`)}
              className="bg-gradient-to-r from-indigo-600 to-blue-700 px-6 py-2 text-md rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-bounce-custom"
            >
              Làm lại bài tập
              <span aria-hidden="true">
                <ArrowRight className="ml-2 h-5 w-5" />
              </span>
            </Button>
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-8 overflow-hidden">
        {(() => {
          if (isLoading) {
            return (
              <div className="flex flex-col items-center justify-center h-[60vh]">
                <div className="animate-bounce-custom">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
                </div>
                <p className="mt-6 text-lg text-gray-600 font-medium animate-pulse-custom">Đang tải kết quả bài làm...</p>
              </div>
            );
          }
          
          return (
            <>
              {/* Main Result Card - Enhanced with detailed scores at the top */}
              <Card className="bg-white/60 backdrop-blur-sm border border-blue-100 shadow-xl mb-8 overflow-hidden transform transition-all duration-500 hover:shadow-2xl animate-slideInUp">
                <CardHeader className="border-b border-blue-50 bg-gradient-to-r from-blue-50 to-indigo-50 py-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="animate-fadeIn">
                      <CardTitle className="text-3xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 font-bold">
                        <Book className="inline-block mr-2 h-7 w-7 text-primary" /> {questionDetails.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-lg mt-2 flex items-center">
                        <Users className="h-5 w-5 mr-2 text-gray-500" />
                        Giáo viên: {questionDetails.teacher}
                      </CardDescription>
                    </div>
                    
                    <div className="flex flex-col items-end animate-slideInRight">
                      {/* Ranking button moved here with animation */}
                      <Dialog>
                        <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                            className="relative overflow-hidden flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 text-blue-600 font-semibold border-blue-300 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 px-5 py-3 h-auto w-full rounded-xl mb-2"
                            onClick={fetchRankingData}
                          >
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-yellow-300/20 via-transparent to-yellow-300/20 animate-shimmer"></div>
                            <div className="relative z-10 flex items-center justify-center gap-2">
                              <div className="relative">
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                                <Trophy className="h-5 w-5 text-yellow-500" />
                              </div>
                              <span className="text-md font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Xếp hạng</span>
                              <div className="text-yellow-500 animate-bounce">✨</div>
                            </div>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-gradient-to-b from-white to-blue-50/30 rounded-xl border-0 shadow-xl overflow-hidden">
                          <DialogHeader className="pb-2">
                            <DialogTitle className="flex items-center justify-center gap-3 text-2xl text-center bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500 font-bold">
                              <div className="relative">
                                <div className="absolute -top-3 -left-2 w-6 h-6 bg-yellow-400 rounded-full animate-ping opacity-70"></div>
                                <Trophy className="h-8 w-8 text-yellow-500 animate-bounce-custom" />
                              </div>
                              Bảng xếp hạng lớp {rankingInfo.className}
                            </DialogTitle>
                          </DialogHeader>
                          
                          <div className="py-2">
                            {/* User ranking card with confetti effect */}
                            <div className="relative bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-5 rounded-xl mb-5 shadow-md border border-indigo-100 overflow-hidden">
                              {/* Decorative circles */}
                              <div className="absolute top-0 left-0 w-20 h-20 bg-yellow-300/20 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                              <div className="absolute bottom-0 right-0 w-16 h-16 bg-purple-400/20 rounded-full translate-x-1/3 translate-y-1/3"></div>
                              
                              {/* Animated stars */}
                              <div className="absolute top-4 right-10 text-yellow-400 animate-pulse-custom">✨</div>
                              <div className="absolute bottom-6 left-8 text-yellow-400 animate-pulse-custom" style={{animationDelay: '0.5s'}}>✨</div>
                              <div className="absolute top-10 left-20 text-yellow-400 animate-pulse-custom" style={{animationDelay: '1s'}}>✨</div>
                              
                              <div className="flex items-center justify-between relative z-10">
                                <div>
                                  <div className="text-sm font-medium text-purple-800">Hạng của bạn trong lớp</div>
                                  <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 mt-1">
                                    {rankingInfo.rank || '-'}/{rankingInfo.total || '-'}
                                  </div>
                                  <div className="text-xs text-indigo-600 mt-1 font-medium">
                                    <Users className="h-3 w-3 inline-block mr-1" />
                                    Lớp {rankingInfo.className}
                                  </div>
                                </div>
                                
                                <div className="relative">
                                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full blur-sm animate-pulse-custom"></div>
                                  <div className="bg-white p-4 rounded-full shadow-lg border border-yellow-200 relative z-10">
                                    {rankingInfo.rank === 1 ? (
                                      <Crown className="h-12 w-12 text-yellow-500 animate-bounce-custom" />
                                    ) : rankingInfo.rank === 2 ? (
                                      <Medal className="h-12 w-12 text-gray-400 animate-pulse-custom" />
                                    ) : rankingInfo.rank === 3 ? (
                                      <Medal className="h-12 w-12 text-amber-600 animate-pulse-custom" />
                                    ) : (
                                      <Medal className="h-12 w-12 text-blue-500 animate-pulse-custom" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="relative bg-white rounded-xl p-4 shadow-md border border-blue-100">
                              <h3 className="font-semibold text-blue-800 flex items-center gap-2 mb-4 text-lg">
                                <div className="relative">
                                  <div className="absolute inset-0 bg-blue-300 rounded-full blur-sm animate-pulse-custom"></div>
                                  <ListFilter className="h-5 w-5 text-blue-600 relative z-10" />
                                </div>
                                Top 10 điểm cao nhất
                              </h3>
                              
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 rounded-xl">
                                {rankingInfo.topScores.map((score, index) => (
                                  <div 
                                    key={index} 
                                    style={{animationDelay: `${index * 0.1}s`}}
                                    className={`flex justify-between items-center p-3 rounded-lg animate-fadeIn ${
                                      score.studentId === user.id 
                                        ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-300 shadow-md' 
                                        : 'bg-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50 border border-gray-200'
                                    } hover:shadow-md transition-all duration-300`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                        index === 0 ? 'bg-gradient-to-r from-yellow-300 to-amber-400 text-white shadow-md' :
                                        index === 1 ? 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 shadow-sm' :
                                        index === 2 ? 'bg-gradient-to-r from-amber-200 to-amber-300 text-amber-800 shadow-sm' :
                                        'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700'
                                      }`}>
                                        {index === 0 ? (
                                          <Crown className="h-5 w-5" />
                                        ) : (
                                          index + 1
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {index < 3 && index === 0 && (
                                          <span className="text-lg text-yellow-500">🏆</span>
                                        )}
                                        {index < 3 && index === 1 && (
                                          <span className="text-lg">🥈</span>
                                        )}
                                        {index < 3 && index === 2 && (
                                          <span className="text-lg">🥉</span>
                                        )}
                                        {score.studentId === user.id ? (
                                          <span className="text-blue-700 font-semibold flex items-center gap-1">
                                            <User className="h-4 w-4 text-blue-600" />
                                            Bạn
                                          </span>
                                        ) : (
                                          score.studentName
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-4">
                                      <div className="text-right">
                                        <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
                                          <AlertCircle className="h-3 w-3" /> Điểm gốc
                                        </div>
                                        <div className="text-blue-600 font-medium">{score.score}%</div>
                                      </div>
                                      <div className="text-right min-w-[60px]">
                                        <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
                                          <TrendingUp className="h-3 w-3" /> Quy đổi
                                        </div>
                                        <div className="text-indigo-600 font-bold flex items-center justify-end">
                                          {parseFloat(score.adjustedScore.toString()).toFixed(1)}
                                          {index === 0 && <Star className="h-4 w-4 ml-1 text-yellow-400 animate-pulse-custom" />}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {rankingInfo.topScores.length === 0 && (
                                  <div className="text-center p-6">
                                    <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                                    <p className="text-gray-500">Chưa có dữ liệu xếp hạng</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                
                {/* Score Information Section */}
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                    {/* Score Cards */}
                    <div className="col-span-1 md:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:translate-y-[-3px] animate-fadeIn delay-100">
                          <div className="text-3xl font-bold text-blue-600 mb-2 flex items-center">
                            <BarChart2 className="h-6 w-6 mr-2 text-blue-500" />
                            {scoreInfo.totalScore}%
                          </div>
                          <div className="text-sm text-gray-500">
                            Điểm gốc
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:translate-y-[-3px] animate-fadeIn delay-200">
                          <div className="text-3xl font-bold text-green-600 mb-2 flex items-center">
                            <TrendingUp className="h-6 w-6 mr-2 text-green-500" />
                            {adjustedScore !== null && adjustedScore !== undefined ? adjustedScore.toFixed(1) : "0.0"}
                          </div>
                          <div className="text-sm text-gray-500">
                            Điểm theo cấp độ
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:translate-y-[-3px] animate-fadeIn delay-300">
                          <div className="text-3xl font-bold text-purple-600 mb-2 flex items-center">
                            <Trophy className="h-6 w-6 mr-2 text-purple-500" />
                            {highestScore}
                          </div>
                          <div className="text-sm text-gray-500">
                            Điểm cao nhất đạt được
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:translate-y-[-3px] relative group animate-fadeIn delay-400">
                          <div className="text-3xl font-bold text-amber-600 mb-2 flex items-center">
                            <Users className="h-6 w-6 mr-2 text-amber-500" />
                            {studentLevel ? studentLevelInfo[studentLevel].label.split(' ')[2] : 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            Cấp độ của bạn
                          </div>
                          <div className="absolute invisible group-hover:visible z-10 p-3 bg-white rounded-lg shadow-lg text-sm w-52 top-full mt-2 left-0 transition-all duration-300 border border-gray-100">
                            Điểm được tính theo cấp độ học sinh: Giỏi (×10), Trung bình (×8), Yếu (×7)
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 mt-4 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md animate-fadeIn delay-500">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-base font-medium text-gray-700 flex items-center">
                            <ListFilter className="h-5 w-5 mr-1.5 text-blue-500" />
                            Tiến độ
                        </div>
                          <div className="text-sm font-medium text-blue-600">{scoreInfo.totalScore}%</div>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${scoreInfo.totalScore || 0}%` }}
                          ></div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                          <div className="bg-green-50 rounded-md p-3 border border-green-100 transition-all duration-300 hover:bg-green-100">
                            <div className="font-semibold text-green-700 text-lg flex items-center justify-center">
                              <CheckCircle2 className="h-5 w-5 mr-1.5 text-green-500" />
                              {scoreInfo.correctAnswers}
                          </div>
                            <div className="text-gray-500 text-sm mt-1">Đúng</div>
                          </div>
                          <div className="bg-red-50 rounded-md p-3 border border-red-100 transition-all duration-300 hover:bg-red-100">
                            <div className="font-semibold text-red-700 text-lg flex items-center justify-center">
                              <XCircle className="h-5 w-5 mr-1.5 text-red-500" />
                              {scoreInfo.incorrectAnswers}
                          </div>
                            <div className="text-gray-500 text-sm mt-1">Sai</div>
                        </div>
                          <div className="bg-blue-50 rounded-md p-3 border border-blue-100 transition-all duration-300 hover:bg-blue-100">
                            <div className="font-semibold text-blue-700 text-lg flex items-center justify-center">
                              <AlertCircle className="h-5 w-5 mr-1.5 text-blue-500" />
                              {(scoreInfo.correctAnswers + scoreInfo.incorrectAnswers)}
                      </div>
                            <div className="text-gray-500 text-sm mt-1">Tổng</div>
                    </div>
                      </div>
                      </div>
                        </div>
                              
                    <div className="flex flex-col gap-3">
                      {/* Info card - Without heading */}
                      <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 shadow-sm border border-slate-200 relative overflow-hidden transition-all duration-300 hover:shadow hover:translate-y-[-3px] animate-fadeIn delay-600 flex-grow">
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-slate-200/30 to-gray-300/30 rounded-full"></div>
                        
                        <div className="grid grid-cols-2 gap-4 relative z-10">
                          {/* Time information */}
                          <div className="custom-tooltip-container">
                            <div className="tooltip-icon tooltip-icon-blue">
                              <Clock className="h-5 w-5" />
                      </div>
                            <div className="tooltip-value">{formatTime(scoreInfo.timeTaken || 0)}</div>
                            <div className="custom-tooltip">
                              Thời gian làm bài
                                      </div>
                    </div>
                    
                          {/* Audio play count information */}
                          <div className="custom-tooltip-container">
                            <div className="tooltip-icon tooltip-icon-purple">
                              <Volume2 className="h-5 w-5" />
                          </div>
                            <div className="tooltip-value">{scoreInfo.audioPlayCount || 0}</div>
                            <div className="custom-tooltip">
                              Số lần nghe audio
                          </div>
                      </div>
                      
                          {/* Accuracy information */}
                          <div className="custom-tooltip-container">
                            <div className="tooltip-icon tooltip-icon-slate">
                              <CheckCircle2 className="h-5 w-5" />
                          </div>
                            <div className="tooltip-value">{accuracy.toFixed(1)}%</div>
                            <div className="custom-tooltip">
                              Độ chính xác của bài làm
                          </div>
                      </div>
                      
                          {/* Completion time information */}
                          <div className="custom-tooltip-container">
                            <div className="tooltip-icon tooltip-icon-amber">
                              <Award className="h-5 w-5" />
                          </div>
                            <div className="tooltip-value">{formatDate(scoreInfo.completedAt || new Date().toISOString()).split(' ')[0]}</div>
                            <div className="custom-tooltip">
                              Thời gian hoàn thành bài tập
                      </div>
                    </div>
                  </div>
                      </div>
                    </div>
                    </div>
                  </div>
                  
                <CardContent className="pt-6 overflow-visible">
                  {/* Tabs */}
                  <div className={tabsStyles}>
                    {/* Tabs */}
                    <div className="container">
                      <div className="tabs">
                        <input type="radio" id="radio-1" name="tabs" checked={activeTab === 'results'} onChange={() => setActiveTab('results')} />
                        <label className="tab" htmlFor="radio-1">Kết quả</label>

                        <input type="radio" id="radio-2" name="tabs" checked={activeTab === 'script'} onChange={() => setActiveTab('script')} />
                        <label className="tab" htmlFor="radio-2">Script</label>

                        <input type="radio" id="radio-3" name="tabs" checked={activeTab === 'difficultWords'} onChange={() => setActiveTab('difficultWords')} />
                        <label className="tab" htmlFor="radio-3">Từ khó</label>

                        <span className="glider"></span>
                      </div>
                    </div>

                    {/* Audio controls and progress bar - Only show in Script tab */}
                    {activeTab === 'script' && (
                      <>
                        <div className="audio-controls">
                          {/* Backward button */}
                          <button
                            onClick={() => seekAudio(-5)}
                            disabled={!audioUrl || isGeneratingTimings}
                            className="audio-control-btn audio-control-backward"
                            title="Tua lùi 5 giây"
                          >
                            <span className="tooltip">Lùi 5 giây</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 17l-5-5 5-5"/>
                              <path d="M18 17l-5-5 5-5"/>
                            </svg>
                            <div className="filled"></div>
                          </button>
                          
                          {/* Play/Pause button */}
                          {isPlayingScript ? (
                            <button 
                              onClick={pausePlayback}
                              className="audio-control-btn audio-control-pause"
                              title="Tạm dừng"
                            >
                              <span className="tooltip">Tạm dừng</span>
                              <Pause />
                              <div className="filled"></div>
                            </button>
                          ) : (
                            <button
                              onClick={playFullScript}
                              disabled={wordTimings.length === 0 || isGeneratingTimings}
                              className="audio-control-btn audio-control-play"
                              title={wordTimings.length === 0 
                                ? 'Đang tải timing...' 
                                : isPaused ? 'Tiếp tục' : 'Nghe và xem từng từ'
                              }
                            >
                              <span className="tooltip">
                                {wordTimings.length === 0 
                                  ? 'Đang tải timing...' 
                                  : isPaused ? 'Tiếp tục' : 'Nghe và xem từng từ'
                                }
                              </span>
                              <Play />
                              <div className="filled"></div>
                            </button>
                          )}
                          
                          {/* Forward button */}
                          <button
                            onClick={() => seekAudio(5)}
                            disabled={!audioUrl || isGeneratingTimings}
                            className="audio-control-btn audio-control-forward"
                            title="Tua tiến 5 giây"
                          >
                            <span className="tooltip">Tiến 5 giây</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13 17l5-5-5-5"/>
                              <path d="M6 17l5-5-5-5"/>
                            </svg>
                            <div className="filled"></div>
                          </button>
                          
                          {/* Playback speed button */}
                          <div className="relative">
                            <button
                              className="audio-control-btn audio-control-speed"
                              title="Tốc độ phát"
                            >
                              <span className="tooltip">Tốc độ: {playbackRate}x</span>
                              <div className="text-center font-semibold text-sm">{playbackRate}x</div>
                              <div className="filled"></div>
                              
                              <div className="playback-speed-dropdown">
                                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
                                  <div
                                    key={rate}
                                    className={`speed-option ${playbackRate === rate ? 'active' : ''}`}
                                    onClick={() => changePlaybackRate(rate)}
                                  >
                                    {rate}x
                                  </div>
                                ))}
                              </div>
                            </button>
                          </div>
                  </div>
                  
                        {/* Audio progress bar */}
                        <div 
                          className="audio-progress-container"
                          onClick={handleProgressBarClick}
                        >
                          <div 
                            className="audio-progress-bar"
                            style={{ width: `${(currentAudioTime / (audioRef.current?.duration || 1)) * 100}%` }}
                          ></div>
                          <div 
                            className="audio-progress-thumb"
                            style={{ left: `${(currentAudioTime / (audioRef.current?.duration || 1)) * 100}%` }}
                          ></div>
                        </div>
                        
                        <div className="audio-time-display">
                          {formatTime(Math.floor(currentAudioTime))} / {formatTime(Math.floor(audioRef.current?.duration || 0))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Tab content - Using a single container with a single scrollbar */}
                  <div className="p-4 bg-white rounded-lg shadow-inner border border-blue-100 max-h-[calc(100vh-300px)] overflow-y-auto w-full">
                    {activeTab === 'results' && (
                      <div className="w-full">
                        {/* Results tab content - Simplified */}
                        <div className="mb-4 py-2 px-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex justify-between items-center">
                            <div className="text-blue-700 font-medium">Lần làm thứ: {answerData?.attempt_count || 1}</div>
                            <div className="text-gray-500 text-sm">{formatDate(scoreInfo.completedAt || '')}</div>
                          </div>
                        </div>
                        
                        {/* Hiển thị các câu sai */}
                        {scoreInfo.errors && scoreInfo.errors.length > 0 ? (
                          <div className="mt-4 mb-6 bg-white rounded-lg p-4 shadow-md border border-red-100">
                            <h3 className="font-medium text-gray-800 mb-3 flex items-center text-lg">
                              <XCircle className="h-5 w-5 mr-2 text-red-500" />
                              Các câu trả lời chưa chính xác: ({scoreInfo.errors.length})
                            </h3>
                            <div className="border rounded-md overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                STT
                              </th>
                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Đáp án của bạn
                              </th>
                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Đáp án đúng
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {scoreInfo.errors.map((error, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {index + 1}
                                </td>
                                      <td className="px-3 py-2 text-sm">
                                  <span className="inline-block bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100">
                                    {error.userAnswer || '(Trống)'}
                                  </span>
                                </td>
                                      <td className="px-3 py-2 text-sm">
                                        <div className="flex items-center">
                                          <button
                                            onClick={() => playWordSound(error.correctAnswer)}
                                            className="mr-2 inline-flex items-center justify-center rounded-full w-6 h-6 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                            title="Nghe từ này"
                                          >
                                            <Volume2 className="h-3 w-3" />
                                          </button>
                                  <span className="inline-block bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                                    {error.correctAnswer}
                                  </span>
                                        </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                        ) : (
                          <div className="mt-4 mb-6 text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                            <p className="text-lg font-medium text-gray-700">Tất cả câu trả lời đều đúng!</p>
                    </div>
                        )}
                        
                        {/* Add error analysis chart */}
                        {renderErrorChart()}
                        </div>
                    )}

                    {activeTab === 'script' && (
                      <div className="text-gray-700 leading-relaxed w-full">
                        {/* Script tab content */}
                        {scriptWords.map((word, index) => {
                          const occurInfo = indexedScriptWords[index];
                          const occurrenceCount = occurInfo?.occurrence || 0;
                          const showOccurrence = occurrenceCount > 1;
                          const isPunctuation = /^[.,!?;:()[\]{}"""'']+$/.test(word);
                          
                          return (
                            <span
                              key={index}
                              ref={el => wordRefs.current[index] = el}
                              className={`inline-block mr-1 mb-1 px-1 py-0.5 rounded word-clickable
                                ${currentWordIndex === index && !isPunctuation ? 'highlight-animation' : 'hover:bg-gray-200'}`}
                              style={{
                                position: 'relative',
                                backgroundColor: currentWordIndex === index && !isPunctuation ? '#fde047' : 'transparent',
                                color: currentWordIndex === index && !isPunctuation ? 'black' : 'inherit',
                                fontWeight: currentWordIndex === index && !isPunctuation ? 'bold' : 'normal',
                                transform: currentWordIndex === index && !isPunctuation ? 'scale(1.1)' : 'scale(1)',
                                transition: 'all 0.3s ease-out',
                                zIndex: currentWordIndex === index ? 10 : 'auto',
                                // Add border if word appears multiple times and not punctuation
                                border: showOccurrence && !isPunctuation ? '1px dashed #60a5fa' : 'none'
                              }}
                              title={`${index}: ${word}${showOccurrence && !isPunctuation ? ` (${occurrenceCount})` : ''}`}
                              onClick={() => !isPunctuation && playWordSound(word)}
                            >
                              {word}
                              {/* Display occurrence number if the word appears multiple times and is not punctuation */}
                              {showOccurrence && !isPunctuation && (
                                <sup className="text-[8px] text-blue-500 ml-0.5 font-bold">
                                  {occurrenceCount}
                                </sup>
                              )}
                              {wordTimings.some(t => t.word.toLowerCase() === word.toLowerCase()) && !isPunctuation && (
                                <span className="timing-info text-[8px] text-gray-500 block">
                                  {wordTimings.find(t => t.word.toLowerCase() === word.toLowerCase())?.startTime.toFixed(1)}s
                          </span>
                              )}
                            </span>
                          );
                        })}
                        </div>
                      )}

                    {activeTab === 'difficultWords' && (
                      <div className="w-full">
                        {difficultWords.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {difficultWords.map((word, index) => (
                              <div 
                                key={index} 
                                className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-300 flex flex-col"
                              >
                                <div className="flex justify-between items-start">
                                  <h3 className="text-lg font-medium text-gray-900">{word.word}</h3>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => playWordSound(word.word)}
                                  >
                                    <Volume2 className="h-4 w-4 text-blue-500" />
                                  </Button>
                            </div>
                                
                                {word.phonetic && (
                                  <div className="text-sm text-gray-500 mt-1">{word.phonetic}</div>
                                )}
                                
                                {word.translation && (
                                  <div className="mt-2 text-gray-700">{word.translation}</div>
                                )}
                            </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="text-gray-400 mb-4">
                              <AlertTriangle className="h-12 w-12 mx-auto" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-700">Không có từ khó</h3>
                            <p className="text-gray-500 mt-2">Bạn chưa đánh dấu từ khó nào trong bài này.</p>
                    </div>
                  )}
                      </div>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="flex flex-col sm:flex-row gap-4 border-t border-blue-50 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                  {!isPassed ? (
                    <>
                      {/* Empty footer when score is below 70% as the notification is now at the top */}
                    </>
                  ) : (
                    <>
                      {/* Show all navigation buttons when score is 70% or above */}
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/student/dashboard')}
                    className="w-full sm:w-auto"
                  >
                    Quay lại trang chủ
                  </Button>
                  
                  <Button 
                    onClick={() => navigate(`/student/vocabulary-flashcards/${questionId}`)}
                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-indigo-600"
                  >
                    <span aria-hidden="true">
                      <Book className="mr-2 h-4 w-4" />
                    </span>
                    Học lại từ vựng
                  </Button>
                  
                  <Button 
                    onClick={() => navigate(`/student/dictation/${questionId}`)}
                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-700"
                  >
                    Làm lại bài tập
                    <span aria-hidden="true">
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                  </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            </>
          );
        })()}
        
        {/* The bottom buttons have been removed as requested */}
      </div>
      <audio ref={audioRef} className="hidden" />
      {false && showDebug && (
        <div className="fixed bottom-4 right-4 z-50 bg-white p-3 rounded-md shadow-md border border-gray-200 text-xs font-mono max-w-xs overflow-auto" style={{ maxHeight: '80vh' }}>
          <div className="font-bold mb-1">Debug Info</div>
          <div className="grid grid-cols-2 gap-1">
            <div>Audio time:</div>
            <div>{currentAudioTime.toFixed(2)}s</div>
            
            <div>Playback rate:</div>
            <div>{audioRef.current?.playbackRate || 1}x</div>
            
            <div>Timings:</div>
            <div>{wordTimings.length}</div>
            
            <div>Script words:</div>
            <div>{scriptWords.length}</div>
            
            <div>Current index:</div>
            <div>{currentWordIndex}</div>
            
            <div>Current word:</div>
            <div>
              {currentWordIndex >= 0 && currentWordIndex < scriptWords.length 
                ? `${scriptWords[currentWordIndex]} ${
                    indexedScriptWords[currentWordIndex]?.occurrence > 1 
                      ? `(${indexedScriptWords[currentWordIndex]?.occurrence})` 
                      : ''
                  }` 
                : 'none'}
            </div>
          </div>
          
          <div className="mt-2 mb-1 font-bold">Current match info:</div>
          {diagnosticInfo.currentMatchInfo ? (
            <div className="grid grid-cols-2 gap-1 border p-1 rounded bg-gray-50">
              <div>Audio time:</div>
              <div>{diagnosticInfo.currentMatchInfo.audioTime.toFixed(2)}s</div>
              
              <div>From timing:</div>
              <div>{diagnosticInfo.currentMatchInfo.wordFromTiming}</div>
              
              <div>Normalized:</div>
              <div>{diagnosticInfo.currentMatchInfo.normalizedWord}</div>
              
              <div>Timing occurrence:</div>
              <div>{diagnosticInfo.currentMatchInfo.occurrence}</div>
              
              <div>Script index:</div>
              <div>{diagnosticInfo.currentMatchInfo.scriptIndex}</div>
              
              <div>Script word:</div>
              <div>{diagnosticInfo.currentMatchInfo.scriptWord}</div>
              
              <div>Script occurrence:</div>
              <div>{diagnosticInfo.currentMatchInfo.scriptOccurrence}</div>
              
              <div>Match success:</div>
              <div className={diagnosticInfo.currentMatchInfo.isMatch ? "text-green-500" : "text-red-500"}>
                {diagnosticInfo.currentMatchInfo.isMatch ? "Yes" : "No"}
              </div>
            </div>
          ) : (
            <div>No current match</div>
          )}
          
          <div className="mt-2 mb-1 font-bold">Word occurrences:</div>
          <div className="max-h-[100px] overflow-y-auto border p-1 rounded bg-gray-50">
            {Object.entries(diagnosticInfo.occurrenceMap)
              .filter(([word]) => word.trim() !== '')
              .filter(([_, positions]) => positions.length > 1)
              .slice(0, 10)
              .map(([word, positions]) => (
                <div key={word} className="flex justify-between">
                  <span>{word}</span>
                  <span>{positions.length} occurrences at: {positions.slice(0, 3).join(', ')}{positions.length > 3 ? '...' : ''}</span>
                </div>
              ))}
          </div>
          
          <div className="mt-2 mb-1 font-bold">Current word by time:</div>
          <div>
            {(() => {
              const info = findWordAtTime(currentAudioTime);
              return info 
                ? `"${info.word}" (${info.occurrence}) at ${info.time.toFixed(2)}s` 
                : 'none';
            })()}
          </div>
          
          <div className="mt-2 mb-1 font-bold">Next words in timing:</div>
          <div className="max-h-[80px] overflow-y-auto border p-1 rounded bg-gray-50">
            {wordTimings
              .filter(timing => timing.startTime > currentAudioTime)
              .slice(0, 5)
              .map((timing, idx) => {
                // Find occurrence
                const normalizedWord = timing.word.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
                let occurrence = 1;
                const timeIndex = wordTimings.findIndex(t => t === timing);
                
                for (let j = 0; j < timeIndex; j++) {
                  const prevWord = wordTimings[j].word;
                  const normalizedPrevWord = prevWord.toLowerCase().replace(/[.,!?;:()[\]{}"""'']/g, '');
                  if (normalizedPrevWord === normalizedWord) {
                    occurrence++;
                  }
                }
                
                return (
                  <div key={idx} className="flex justify-between">
                    <span>{timing.word}{occurrence > 1 ? ` (${occurrence})` : ''}</span>
                    <span>{timing.startTime.toFixed(1)}s</span>
                  </div>
                );
              })}
          </div>
          
          <Button 
            onClick={() => console.log('Full diagnostic:', diagnosticInfo)} 
            variant="outline"
            size="sm"
            className="mt-2 w-full"
          >
            Log Full Diagnostic to Console
          </Button>
        </div>
      )}
    </StudentLayout>
  );
};

export default DictationResult; 