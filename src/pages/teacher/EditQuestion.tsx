import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import { supabase, uploadFile, checkAuth, isTeacher, supabaseUrl, translateToVietnamese } from '@/lib/supabase';
import { processAudioFile, generateTranscript, formatTimingData, WordTiming, generateSyntheticTiming } from '@/lib/assemblyai';
import { useAuth } from '@/contexts/AuthContext';
import TeacherLayout from '@/layouts/TeacherLayout';
import {
  Check,
  Loader,
  Loader2,
  FileAudio,
  Sparkles,
  Download,
  RefreshCw,
  Volume2,
  Brain,
  Timer,
  Glasses,
  Eye,
  Settings2,
  Award,
  GraduationCap,
  School,
  MousePointer2, Globe2, Layout, Shield, ShieldAlert, ShieldCheck,
  AlertOctagon, History, Ban, CheckCircle, Plus,
  Bot, FileText, CheckCircle2, Wand,
  Settings, Boxes, Music2, BookOpen, 
  AlertTriangle
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
// Thêm import cho component Label
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
// Thêm import component CheatingManagement
import CheatingManagement from '@/components/teacher/CheatingManagement';

// Add type definition for the form
type QuestionFormValues = {
  title: string;
  script: string;
  audioFile: File | null;
  goodStudentsBlanksPercentage: number;
  averageStudentsBlanksPercentage: number;
  poorStudentsBlanksPercentage: number;
  minimumPassingScore: number;
  allowRetry: boolean;
  unlimitedTime: boolean;
  goodStudentsTimeLimit: number;
  averageStudentsTimeLimit: number;
  poorStudentsTimeLimit: number;
  goodStudentsListeningAttempts: number;
  averageStudentsListeningAttempts: number;
  poorStudentsListeningAttempts: number;
  goodStudentsEnableHighlight: boolean;
  averageStudentsEnableHighlight: boolean;
  poorStudentsEnableHighlight: boolean;
  goodStudentsShowTranscript: boolean;
  averageStudentsShowTranscript: boolean;
  poorStudentsShowTranscript: boolean;
  goodStudentsEnableHints: boolean;
  averageStudentsEnableHints: boolean;
  poorStudentsEnableHints: boolean;
  enableAntiCheating: boolean;
  maxCheatingAttempts: number;
  enableMouseLeaveDetection: boolean;
  enableMultipleIPDetection: boolean;
  enableMultipleTabPrevention: boolean;
  cheatingWarningMessage: string;
  requireVocabularyPractice: boolean;
  autoGenerateVocabulary: boolean;
};

// Update the form schema with stricter validation
const formSchema = z.object({
  title: z.string()
    .min(1, "Vui lòng nhập tiêu đề")
    .max(255, "Tiêu đề không được quá 255 ký tự"),
  script: z.string()
    .min(1, "Vui lòng nhập script")
    .max(10000, "Script không được quá 10000 ký tự"),
  audioFile: z.any(),
  difficulty: z.enum(['sentence', 'phrase', 'word']).default('sentence'),
  blanksCount: z.number().min(1, "Số từ cần điền phải lớn hơn 0").max(100, "Số từ cần điền không được quá 100").default(5),
  timeLimit: z.number().min(1, "Thời gian làm bài phải lớn hơn 0").max(300, "Thời gian làm bài không được quá 300 phút"),
  enableAntiCheating: z.boolean().default(false),
  enableStudentCategorization: z.boolean().default(false),
  goodStudentsDifficulty: z.enum(['sentence', 'phrase', 'word']).default('sentence'),
  averageStudentsDifficulty: z.enum(['sentence', 'phrase', 'word']).default('phrase'),
  poorStudentsDifficulty: z.enum(['sentence', 'phrase', 'word']).default('word'),
  goodStudentsBlanksCount: z.number().min(1).max(100).default(7),
  averageStudentsBlanksCount: z.number().min(1).max(100).default(5),
  poorStudentsBlanksCount: z.number().min(1).max(100).default(3),
  goodStudentsTimeLimit: z.number().min(1).max(300),
  averageStudentsTimeLimit: z.number().min(1).max(300),
  poorStudentsTimeLimit: z.number().min(1).max(300),
  goodStudentsListeningAttempts: z.number().min(1).max(10).default(3),
  averageStudentsListeningAttempts: z.number().min(1).max(10).default(5),
  poorStudentsListeningAttempts: z.number().min(1).max(10).default(7),
  goodStudentsShowTranscript: z.boolean().default(false),
  averageStudentsShowTranscript: z.boolean().default(true),
  poorStudentsShowTranscript: z.boolean().default(true),
  goodStudentsEnableHighlight: z.boolean().default(true),
  averageStudentsEnableHighlight: z.boolean().default(true),
  poorStudentsEnableHighlight: z.boolean().default(true),
  goodStudentsEnableHints: z.boolean().default(false),
  averageStudentsEnableHints: z.boolean().default(true),
  poorStudentsEnableHints: z.boolean().default(true),
  enableAudioScriptHighlight: z.boolean().default(false),
  goodStudentsBlanksPercentage: z.number().min(1).max(100).default(60),
  averageStudentsBlanksPercentage: z.number().min(1).max(100).default(50),
  poorStudentsBlanksPercentage: z.number().min(1).max(100).default(40),
  minimumPassingScore: z.number().min(1).max(100).default(70),
  allowRetry: z.boolean().default(true),
  unlimitedTime: z.boolean().default(false),
  maxCheatingAttempts: z.number().min(1).max(5).default(2),
  enableMouseLeaveDetection: z.boolean().default(true),
  enableMultipleIPDetection: z.boolean().default(true),
  enableMultipleTabPrevention: z.boolean().default(true),
  cheatingWarningMessage: z.string()
    .min(10, "Cảnh báo phải có ít nhất 10 ký tự")
    .max(500, "Cảnh báo không được quá 500 ký tự")
    .default("Cảnh báo: Hệ thống đã phát hiện hành vi gian lận. Vui lòng không thực hiện các hành động không được phép. Sau {attempts} lần cảnh báo, bài làm sẽ tự động kết thúc."),
  requireVocabularyPractice: z.boolean().default(false),
  autoGenerateVocabulary: z.boolean().default(false),
});

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB

// Update the state types at the top of the file
type LoadingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

type LoadingState = {
  status: LoadingStatus;
  progress: number;
};

type TranscriptState = LoadingStatus;

// Thêm interface cho từ vựng
interface VocabularyItem {
  id?: string;
  word: string;
  part_of_speech: string;
  meaning_vi: string;
  audio_start_time: number;
  audio_end_time: number;
  image_url?: string | null;
}

// Thêm các biến API ở đầu file
const API_URL = "https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M";
const API_HEADERS = { 
  "Authorization": "Bearer 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",
  "Content-Type": "application/json"
};

const EditQuestion = () => {
  // State cho thông tin chính
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rlsEnabled, setRlsEnabled] = useState<boolean | null>(null);
  
  // State cho transcript và timing
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showTimingData, setShowTimingData] = useState(false);
  const [timingData, setTimingData] = useState<WordTiming[] | null>(null);
  
  // State cho trạng thái loading
  const [loadingState, setLoadingState] = useState<LoadingState>({
    status: 'idle',
    progress: 0
  });
  const [transcriptState, setTranscriptState] = useState<TranscriptState>('idle');
  
  // State cho từ vựng
  const [vocabularyItems, setVocabularyItems] = useState<VocabularyItem[]>([]);
  
  // Form setup với react-hook-form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      script: '',
      difficulty: 'sentence',
      blanksCount: 5,
      timeLimit: undefined, // Loại bỏ default value
      enableAntiCheating: true,
      enableStudentCategorization: false,
      goodStudentsDifficulty: 'sentence',
      averageStudentsDifficulty: 'phrase',
      poorStudentsDifficulty: 'word',
      goodStudentsBlanksCount: 7,
      averageStudentsBlanksCount: 5,
      poorStudentsBlanksCount: 3,
      goodStudentsTimeLimit: undefined, // Loại bỏ default value
      averageStudentsTimeLimit: undefined, // Loại bỏ default value
      poorStudentsTimeLimit: undefined, // Loại bỏ default value
      goodStudentsListeningAttempts: 3,
      averageStudentsListeningAttempts: 5,
      poorStudentsListeningAttempts: 7,
      goodStudentsShowTranscript: false,
      averageStudentsShowTranscript: true,
      poorStudentsShowTranscript: true,
      goodStudentsEnableHighlight: true,
      averageStudentsEnableHighlight: true,
      poorStudentsEnableHighlight: true,
      goodStudentsEnableHints: false,
      averageStudentsEnableHints: true,
      poorStudentsEnableHints: true,
      enableAudioScriptHighlight: false,
      goodStudentsBlanksPercentage: 60,
      averageStudentsBlanksPercentage: 50,
      poorStudentsBlanksPercentage: 40,
      minimumPassingScore: 70,
      allowRetry: true,
      unlimitedTime: false,
      maxCheatingAttempts: 2,
      enableMouseLeaveDetection: true,
      enableMultipleIPDetection: true,
      enableMultipleTabPrevention: true,
      cheatingWarningMessage: "Cảnh báo: Hệ thống đã phát hiện hành vi gian lận. Vui lòng không thực hiện các hành động không được phép. Sau {attempts} lần cảnh báo, bài làm sẽ tự động kết thúc.",
      requireVocabularyPractice: false,
      autoGenerateVocabulary: false,
    },
    mode: "onChange"
  });

  // State cho mode edit
  const [isEditMode, setIsEditMode] = useState(true);
  const [originalQuestionData, setOriginalQuestionData] = useState<any>(null);
  
  // Router và Auth
  const { id } = useParams();
  const questionId = id; // Map route param 'id' to 'questionId'
  const { user } = useAuth();
  const navigate = useNavigate();

  // Add new state for audio duration
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Add loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add function to calculate time limit based on audio duration and listening attempts
  const calculateTimeLimit = (listeningAttempts: number) => {
    const baseTime = audioDuration * listeningAttempts;
    const extraTime = baseTime * 0.5;
    return Math.ceil(baseTime + extraTime);
  };

  // Clear any previously stored upload data when component mounts
  useEffect(() => {
    // Check for incomplete uploads in localStorage
    const incompleteUpload = localStorage.getItem('incompleteUpload');
    if (incompleteUpload) {
      console.log('Found incomplete upload, clearing');
      localStorage.removeItem('incompleteUpload');
    }
    
    // Check bucket existence
    const checkBucket = async () => {
      try {
        console.log('Checking if dictation bucket exists...');
        // Attempt to list files in the bucket as a test
        const { data, error } = await supabase.storage.from('dictation').list('');
        
        if (error) {
          console.error('Error accessing dictation bucket:', error);
          toast.error('Không thể truy cập vào thư mục lưu trữ. Vui lòng kiểm tra kết nối hoặc tải lại trang.');
        } else {
          console.log('Bucket is accessible, available files:', data?.length || 0);
        }
      } catch (err) {
        console.error('Error checking bucket:', err);
      }
    };
    
    checkBucket();
  }, []);

  // Check RLS status
  useEffect(() => {
    const checkRlsStatus = async () => {
      try {
        // Check if questionId is a valid UUID before proceeding
        if (!questionId || questionId === 'test' || !isValidUUID(questionId)) {
          console.log('Invalid questionId for RLS check:', questionId);
          return;
        }

        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('id', questionId)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST116') {
            console.error('RLS error:', error);
          setRlsEnabled(false);
          toast('Cảnh báo bảo mật: RLS bị vô hiệu hóa cho bảng questions. Điều này có thể gây rủi ro bảo mật. Vui lòng liên hệ quản trị viên.', {
            duration: 6000,
            icon: '⚠️'
          });
        } else if (error.code === 'PGRST204') {
            console.log('RLS is enabled (not found error)');
          setRlsEnabled(true);
        } else {
            console.error('Unknown error when checking RLS status:', error);
          }
        } else {
          console.log('RLS status check result:', data);
          setRlsEnabled(!!data); // If data exists, RLS is enabled and user has access
        }
      } catch (err) {
        console.error('Error checking RLS status:', err);
      }
    };
    
      checkRlsStatus();
  }, [user, questionId]);

  // Thêm useEffect để tải dữ liệu câu hỏi khi component mount
  useEffect(() => {
    console.log('EditQuestion component mounted');
    console.log('Current questionId from useParams:', questionId);
    
    if (questionId) {
      console.log('Fetching question data for ID:', questionId);
      fetchQuestionData();
    } else {
      console.warn('No questionId available in URL params');
      // Thông báo lỗi nhưng không tự động chuyển hướng để người dùng có thể thấy
      toast.error('Không thể tải dữ liệu câu hỏi. ID không hợp lệ.');
    }
  }, [questionId]); // Chỉ phụ thuộc vào questionId

  // Xóa useEffect tự động redirect
  useEffect(() => {
    // Chỉ giữ lại logic cleanup timer, bỏ auto-redirect
    let redirectTimer: NodeJS.Timeout;
    
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, []);

  // Helper function to check if a string is a valid UUID
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  // Update handleAudioChange to get audio duration
  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file type
      if (!file.type.startsWith('audio/')) {
        toast.error('Vui lòng tải lên tệp âm thanh hợp lệ');
        return;
      }
      
      // Check file size
      if (file.size > FILE_SIZE_LIMIT) {
        setUploadError(`File quá lớn (${(file.size / (1024 * 1024)).toFixed(2)}MB). Kích thước tệp tối đa là ${FILE_SIZE_LIMIT / (1024 * 1024)}MB.`);
        toast.error(`Kích thước tệp không được vượt quá ${FILE_SIZE_LIMIT / (1024 * 1024)}MB`);
        return;
      }

      // Get audio duration
      const audio = new Audio(URL.createObjectURL(file));
      audio.addEventListener('loadedmetadata', () => {
        const duration = Math.ceil(audio.duration / 60); // Convert to minutes
        setAudioDuration(duration);
        
        // Update time limits for each level
        form.setValue('goodStudentsTimeLimit', calculateTimeLimit(form.getValues('goodStudentsListeningAttempts')));
        form.setValue('averageStudentsTimeLimit', calculateTimeLimit(form.getValues('averageStudentsListeningAttempts')));
        form.setValue('poorStudentsTimeLimit', calculateTimeLimit(form.getValues('poorStudentsListeningAttempts')));
      });
      
      setAudioFile(file);
      toast.success(`Đã chọn file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      
      // Set audio file mới
      setAudioFile(file);
      
      // Tạo URL tạm thời để nghe thử
      const tempUrl = URL.createObjectURL(file);
      setAudioUrl(tempUrl);
      
      // Reset transcript khi chọn file mới
      form.setValue('script', '');
      setTimingData(null);
    }
  };

  // Function to clear browser cache
  const clearCache = async () => {
    try {
      // Clear localStorage items related to uploads
      localStorage.removeItem('incompleteUpload');
      
      // Clear any Supabase cached data
      await supabase.auth.refreshSession();
      
      // Reset form and state
      form.reset();
      setAudioFile(null);
      setUploadProgress(0);
      setUploadError(null);
      
      // Clear IndexedDB caches if needed
      if (window.indexedDB) {
        const DBDeleteRequest = window.indexedDB.deleteDatabase('supabase');
        DBDeleteRequest.onerror = () => {
          console.error("Error deleting IndexedDB");
        };
        DBDeleteRequest.onsuccess = () => {
          console.log("IndexedDB deleted successfully");
        };
      }
      
      toast.success('Đã xóa cache và làm mới trạng thái');
      
      // Force reload the page after a short delay to ensure everything is reset
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Không thể xóa cache. Vui lòng tải lại trang thủ công.');
    }
  };
  
  // Reset the form and state
  const resetForm = () => {
    form.reset();
    setAudioFile(null);
    setUploadProgress(0);
    setUploadError(null);
    toast('Đã đặt lại form');
  };

  // Add button state debugging
  useEffect(() => {
    const checkSubmitButton = () => {
      const isDisabled = !audioFile || !form.getValues('title') || !form.getValues('script') || isSubmitting;
      console.log('Submit button state:', {
        isDisabled,
        audioFile: !!audioFile,
        hasTitle: !!form.getValues('title'),
        hasScript: !!form.getValues('script'),
        isSubmitting
      });
    };
    
    // Check initial state
    checkSubmitButton();
    
    // Set up interval to check state
    const interval = setInterval(checkSubmitButton, 3000);
    return () => clearInterval(interval);
  }, [audioFile, form, isSubmitting]);

  // Thêm useEffect để in log trạng thái form mỗi khi nó thay đổi
  useEffect(() => {
    console.log("Form state updated:", {
      isValid: form.formState.isValid,
      isDirty: form.formState.isDirty,
      isSubmitting: form.formState.isSubmitting,
      errors: form.formState.errors
    });
  }, [form.formState]);

  // Thêm useEffect để fetch dữ liệu khi component mount
  useEffect(() => {
    if (!questionId) {
      toast.error("Không tìm thấy ID câu hỏi");
      navigate('/teacher/dashboard');
        return;
      }
      
    fetchQuestionData();
  }, [questionId, navigate]);

  // Thêm onSubmitHandler
  const onSubmitHandler = async (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const loadingToast = toast.loading('Đang cập nhật câu hỏi...');
      
      // Validate session
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        toast.error('Vui lòng đăng nhập để tiếp tục');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }
      
      // Prepare question data for update
      const questionData = {
        title: values.title.trim(),
        script: values.script.trim(),
        updated_at: new Date().toISOString(),
        difficulty: values.difficulty,
        blanks_count: values.blanksCount,
        time_limit: values.timeLimit,
        enable_anti_cheating: values.enableAntiCheating,
        differentiate_levels: values.enableStudentCategorization,
        require_vocabulary_practice: values.requireVocabularyPractice,
        good_students_difficulty: values.goodStudentsDifficulty,
        average_students_difficulty: values.averageStudentsDifficulty,
        poor_students_difficulty: values.poorStudentsDifficulty,
        good_students_blanks_count: values.goodStudentsBlanksCount,
        average_students_blanks_count: values.averageStudentsBlanksCount,
        poor_students_blanks_count: values.poorStudentsBlanksCount,
        good_students_time_limit: values.goodStudentsTimeLimit,
        average_students_time_limit: values.averageStudentsTimeLimit,
        poor_students_time_limit: values.poorStudentsTimeLimit,
        good_students_listening_attempts: values.goodStudentsListeningAttempts,
        average_students_listening_attempts: values.averageStudentsListeningAttempts,
        poor_students_listening_attempts: values.poorStudentsListeningAttempts,
        good_students_show_transcript: values.goodStudentsShowTranscript,
        average_students_show_transcript: values.averageStudentsShowTranscript,
        poor_students_show_transcript: values.poorStudentsShowTranscript,
        good_students_enable_highlight: values.goodStudentsEnableHighlight,
        average_students_enable_highlight: values.averageStudentsEnableHighlight,
        poor_students_enable_highlight: values.poorStudentsEnableHighlight,
        good_students_enable_hints: values.goodStudentsEnableHints,
        average_students_enable_hints: values.averageStudentsEnableHints,
        poor_students_enable_hints: values.poorStudentsEnableHints,
        good_students_blanks_percentage: values.goodStudentsBlanksPercentage,
        average_students_blanks_percentage: values.averageStudentsBlanksPercentage,
        poor_students_blanks_percentage: values.poorStudentsBlanksPercentage,
        minimum_passing_score: values.minimumPassingScore,
        allow_retry: values.allowRetry,
        unlimited_time: values.unlimitedTime,
        max_cheating_attempts: values.maxCheatingAttempts,
        enable_mouse_leave_detection: values.enableMouseLeaveDetection,
        enable_multiple_ip_detection: values.enableMultipleIPDetection,
        enable_multiple_tab_prevention: values.enableMultipleTabPrevention,
        cheating_warning_message: values.cheatingWarningMessage
      };
      
      // Use UPDATE operation with the questionId
      const { error: updateError } = await supabase
        .from('questions')
        .update(questionData)
        .eq('id', questionId);
      
      if (updateError) {
        console.error('Error updating question:', updateError);
        toast.error('Lỗi khi cập nhật câu hỏi: ' + updateError.message);
              toast.dismiss(loadingToast);
              setIsSubmitting(false);
              return;
      }
      
      // Update vocabulary items if needed
      if (values.requireVocabularyPractice && vocabularyItems.length > 0) {
        await saveVocabularyItems(questionId, loadingToast);
        }
        
      toast.dismiss(loadingToast);
      toast.success('Cập nhật câu hỏi thành công!');
          navigate('/teacher/dashboard');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Có lỗi xảy ra khi cập nhật câu hỏi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Thêm hàm tạo transcript giả ngay trong component
  const generateDummyTranscriptLocally = async () => {
    try {
      if (!audioFile) {
        toast.error('Vui lòng tải lên file audio trước khi tạo transcript');
        return;
      }

      // Show loading state
      setTranscriptState('uploading');
      setTimingData(null);
      toast.loading('Đang tạo bản nháp transcript...');

      // Upload progress simulation
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 100) {
          setLoadingState(prev => ({ ...prev, progress }));
        } else {
          clearInterval(progressInterval);
        }
      }, 100);

      // Get actual audio duration
      let actualDuration = 60; // Default
      try {
        const audioBlob = new Blob([audioFile], { type: audioFile.type });
        const audio = new Audio(URL.createObjectURL(audioBlob));
        await new Promise((resolve) => {
          audio.addEventListener('loadedmetadata', () => {
            resolve(true);
          });
        });
        actualDuration = audio.duration;
      } catch (e) {
        console.warn('Could not get audio duration:', e);
      }

      // Mock transcript sentences
      const sampleSentences = [
        "Hello, how are you today?",
        "The weather is quite nice this morning.",
        "I'm planning to go to the beach this weekend.",
        "Have you finished reading that book I recommended?",
        "The concert last night was absolutely amazing.",
        "Could you please help me with this assignment?",
        "I think we should meet up for coffee sometime.",
        "The new restaurant downtown has excellent food.",
        "My brother just got a new job at a tech company.",
        "Do you think it will rain later today?"
      ];
      
      // Generate random transcript based on audio length
      const sentenceCount = Math.max(3, Math.round(actualDuration / 10));
      let dummyText = '';
      for (let i = 0; i < sentenceCount; i++) {
        const randomSentence = sampleSentences[Math.floor(Math.random() * sampleSentences.length)];
        dummyText += randomSentence + ' ';
      }
      dummyText = dummyText.trim();
      
      // Add warning message
      dummyText += "\n\n[Lưu ý: Đây là transcript mẫu được tạo tự động. Vui lòng sửa lại nội dung cho phù hợp với file âm thanh.]";
      
      // Set the transcript
      form.setValue('script', dummyText);
      
      // Create synthetic timing data
      console.log('Creating synthetic timing data from transcript');
      const syntheticTiming = generateSyntheticTiming(dummyText, actualDuration);
      setTimingData(syntheticTiming);
      
      clearInterval(progressInterval);
      setTranscriptState('completed');
      setLoadingState({ status: 'completed', progress: 100 });
      toast.dismiss();
      toast.success('Đã tạo transcript mẫu. Vui lòng chỉnh sửa cho phù hợp.');
    } catch (error) {
      console.error('Error generating dummy transcript:', error);
      setTranscriptState('error');
      setLoadingState({ status: 'error', progress: 0 });
      toast.error('Lỗi khi tạo transcript mẫu');
    }
  };

  // Update transcript when showTimingData changes
  useEffect(() => {
    if (timingData && timingData.length > 0) {
      const scriptValue = form.getValues('script');
      
      // Check if timing data is already included in the script
      const hasTiming = scriptValue.includes('--- Timing Data ---');
      
      if (showTimingData && !hasTiming) {
        // Add timing data to the script
        const formattedTiming = formatTimingData(timingData);
        form.setValue('script', scriptValue + '\n\n--- Timing Data ---\n' + formattedTiming);
      } else if (!showTimingData && hasTiming) {
        // Remove timing data from the script
        const scriptWithoutTiming = scriptValue.split('--- Timing Data ---')[0].trim();
        form.setValue('script', scriptWithoutTiming);
      }
    }
  }, [showTimingData, timingData]);

  // Add student settings tabs
  const renderStudentSettings = () => (
    <Tabs defaultValue="good" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="good" className="flex items-center gap-2 data-[state=active]:bg-yellow-100/50 data-[state=active]:text-yellow-900">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 transition-all hover:scale-105">
                <Award className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">Giỏi</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-yellow-50 text-yellow-900">
              <p>Học viên giỏi (≥90%)</p>
            </TooltipContent>
          </Tooltip>
        </TabsTrigger>
        
        <TabsTrigger value="average" className="flex items-center gap-2 data-[state=active]:bg-blue-100/50 data-[state=active]:text-blue-900">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 transition-all hover:scale-105">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Trung bình</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-blue-50 text-blue-900">
              <p>Học viên trung bình (80-90%)</p>
            </TooltipContent>
          </Tooltip>
        </TabsTrigger>
        
        <TabsTrigger value="poor" className="flex items-center gap-2 data-[state=active]:bg-gray-100/50 data-[state=active]:text-gray-900">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 transition-all hover:scale-105">
                <School className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Yếu</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-gray-50 text-gray-900">
              <p>Học viên yếu (70-80%)</p>
            </TooltipContent>
          </Tooltip>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="good" className="space-y-4 rounded-lg border p-6 bg-yellow-50/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="goodStudentsBlanksPercentage"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Brain className="h-5 w-5 text-purple-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tỷ lệ thông tin cần điền trong script</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Tỷ lệ điền</span>
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[60]}
                      value={[field.value]}
                      max={100}
                      min={1}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">{field.value}%</div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="goodStudentsListeningAttempts"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Volume2 className="h-5 w-5 text-green-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Số lần nghe tối đa</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Số lần nghe</span>
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      max={10}
                      min={1}
                      step={1}
                      onValueChange={(value) => {
                        field.onChange(value[0]);
                        if (audioDuration > 0) {
                          form.setValue('goodStudentsTimeLimit', calculateTimeLimit(value[0]));
                        }
                      }}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">{field.value} lần</div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="goodStudentsTimeLimit"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Timer className="h-5 w-5 text-orange-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Thời gian làm bài (phút)</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Thời gian</span>
                    {audioDuration > 0 && (
                      <span className="text-xs text-gray-500">
                        (Tự động: {calculateTimeLimit(form.getValues('goodStudentsListeningAttempts'))} phút)
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      max={120}
                      min={1}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      disabled={form.watch("unlimitedTime")}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">
                    {form.watch("unlimitedTime") ? "Không giới hạn" : `${field.value} phút`}
                  </div>
                </div>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="goodStudentsEnableHighlight"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Glasses className="h-5 w-5 text-indigo-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bật tính năng highlight script theo audio</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Highlighting</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!timingData}
                    />
                  </div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="goodStudentsShowTranscript"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Eye className="h-5 w-5 text-teal-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Hiện transcript sau khi nộp bài</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Hiện script</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="goodStudentsEnableHints"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Settings2 className="h-5 w-5 text-rose-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bật hệ thống gợi ý</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Gợi ý</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="average" className="space-y-4 rounded-lg border p-6 bg-blue-50/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="averageStudentsBlanksPercentage"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Brain className="h-5 w-5 text-purple-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tỷ lệ thông tin cần điền trong script</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Tỷ lệ điền</span>
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[50]}
                      value={[field.value]}
                      max={100}
                      min={1}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">{field.value}%</div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="averageStudentsListeningAttempts"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Volume2 className="h-5 w-5 text-green-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Số lần nghe tối đa</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Số lần nghe</span>
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      max={10}
                      min={1}
                      step={1}
                      onValueChange={(value) => {
                        field.onChange(value[0]);
                        if (audioDuration > 0) {
                          form.setValue('averageStudentsTimeLimit', calculateTimeLimit(value[0]));
                        }
                      }}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">{field.value} lần</div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="averageStudentsTimeLimit"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Timer className="h-5 w-5 text-orange-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Thời gian làm bài (phút)</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Thời gian</span>
                    {audioDuration > 0 && (
                      <span className="text-xs text-gray-500">
                        (Tự động: {calculateTimeLimit(form.getValues('averageStudentsListeningAttempts'))} phút)
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      max={120}
                      min={1}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      disabled={form.watch("unlimitedTime")}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">
                    {form.watch("unlimitedTime") ? "Không giới hạn" : `${field.value} phút`}
                  </div>
                </div>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="averageStudentsEnableHighlight"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Glasses className="h-5 w-5 text-indigo-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bật tính năng highlight script theo audio</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Highlighting</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!timingData}
                    />
                  </div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="averageStudentsShowTranscript"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Eye className="h-5 w-5 text-teal-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Hiện transcript sau khi nộp bài</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Hiện script</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="averageStudentsEnableHints"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Settings2 className="h-5 w-5 text-rose-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bật hệ thống gợi ý</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Gợi ý</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="poor" className="space-y-4 rounded-lg border p-6 bg-gray-50/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="poorStudentsBlanksPercentage"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Brain className="h-5 w-5 text-purple-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tỷ lệ thông tin cần điền trong script</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Tỷ lệ điền</span>
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[40]}
                      value={[field.value]}
                      max={100}
                      min={1}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">{field.value}%</div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="poorStudentsListeningAttempts"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Volume2 className="h-5 w-5 text-green-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Số lần nghe tối đa</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Số lần nghe</span>
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      max={10}
                      min={1}
                      step={1}
                      onValueChange={(value) => {
                        field.onChange(value[0]);
                        if (audioDuration > 0) {
                          form.setValue('poorStudentsTimeLimit', calculateTimeLimit(value[0]));
                        }
                      }}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">{field.value} lần</div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="poorStudentsTimeLimit"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <Timer className="h-5 w-5 text-orange-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Thời gian làm bài (phút)</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Thời gian</span>
                    {audioDuration > 0 && (
                      <span className="text-xs text-gray-500">
                        (Tự động: {calculateTimeLimit(form.getValues('poorStudentsListeningAttempts'))} phút)
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      max={120}
                      min={1}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      disabled={form.watch("unlimitedTime")}
                      className="mt-2"
                    />
                  </FormControl>
                  <div className="mt-2 text-sm text-gray-500 text-right">
                    {form.watch("unlimitedTime") ? "Không giới hạn" : `${field.value} phút`}
                  </div>
                </div>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="poorStudentsEnableHighlight"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Glasses className="h-5 w-5 text-indigo-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bật tính năng highlight script theo audio</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Highlighting</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!timingData}
                    />
                  </div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="poorStudentsShowTranscript"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Eye className="h-5 w-5 text-teal-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Hiện transcript sau khi nộp bài</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Hiện script</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="poorStudentsEnableHints"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="transition-all hover:scale-105">
                            <Settings2 className="h-5 w-5 text-rose-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bật hệ thống gợi ý</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="font-medium">Gợi ý</span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );

  // Add file upload section
  const renderFileUpload = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Tải lên tệp âm thanh</h3>
      
      {/* Hiển thị audio player nếu có URL */}
      {audioUrl ? (
        <div className="mt-4 border rounded-md p-4 bg-gray-50">
          <div className="font-medium mb-2">File âm thanh hiện tại:</div>
          <div className="bg-white p-3 rounded border">
            <p className="mb-2 text-sm">URL: <a href={audioUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{audioUrl}</a></p>
            <audio 
              controls 
              className="w-full" 
              src={audioUrl}
              onError={(e) => {
                console.error('Audio player error:', e);
                const target = e.target as HTMLAudioElement;
                if (target.error) {
                  console.error('Audio error code:', target.error.code);
                  console.error('Audio error message:', target.error.message);
                }
              }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            * Chỉ hiển thị để kiểm tra, không thể chỉnh sửa file âm thanh
          </div>
                </div>
              ) : (
        // Chỉ hiển thị phần chọn tệp khi không có audio URL
        <>
          <p className="text-sm text-gray-500">
            Tải lên tệp âm thanh cho bài dictation. Hỗ trợ các định dạng MP3, WAV, M4A (tối đa 50MB).
          </p>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="picture">Chọn tệp</Label>
            <Input
              id="audio-file"
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
            />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Progress value={uploadProgress} className="w-full" />
            )}
            {uploadError && <p className="text-red-500 text-sm">{uploadError}</p>}
        </div>
        </>
      )}
    </div>
  );

  // Add global styles for the animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes progress-indeterminate {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Thêm useEffect để tự động reset isSubmitting sau 30s nếu bị treo
  useEffect(() => {
    let resetTimer: NodeJS.Timeout;
    
    if (isSubmitting) {
      resetTimer = setTimeout(() => {
        console.log('Auto-reset isSubmitting after timeout');
        setIsSubmitting(false);
      }, 30000); // 30 seconds timeout
      
      return () => clearTimeout(resetTimer);
    }
  }, [isSubmitting]);

  // Thêm hàm upload file đơn giản
  const simpleUploadFile = async (file: File, userId: string) => {
    try {
      console.log('Starting simple file upload');
      
      const timestamp = new Date().getTime();
      const filePath = `audio/${userId}/${timestamp}-${file.name}`;
      
      console.log('Upload path:', filePath);
      
      // Upload trực tiếp không qua helper function
      const { data, error } = await supabase.storage
        .from('dictation')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (error) {
        console.error('Simple upload error:', error);
        return { success: false, error, filePath: null, url: null };
      }
      
      // Lấy public URL
      const { data: { publicUrl } } = supabase.storage
        .from('dictation')
        .getPublicUrl(filePath);
        
      console.log('Simple upload success, URL:', publicUrl);
      
      return {
        success: true, 
        filePath,
        url: publicUrl,
        error: null
      };
    } catch (error) {
      console.error('Simple upload exception:', error);
      return { success: false, error, filePath: null, url: null };
    }
  };

  // Thêm hàm upload đơn giản nhất, không phụ thuộc vào helper function
  const basicUploadFile = async (file: File) => {
    console.log('Starting basic upload with minimal dependencies...');
    
    try {
      // Lấy thông tin session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        console.error('No active session found');
        return { success: false, error: 'No active session', url: null };
      }
      
      // Tạo đường dẫn file đơn giản
      const timestamp = new Date().getTime();
      const userId = sessionData.session.user.id;
      const filePath = `audio-${timestamp}-${file.name.replace(/\s+/g, '_')}`;
      
      console.log('Basic upload path:', filePath);
      
      // Tạo form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload trực tiếp không qua API
      const response = await fetch(`${supabaseUrl}/storage/v1/object/dictation/${filePath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Basic upload failed:', errorText);
        return { success: false, error: errorText, url: null };
      }
      
      // Tạo public URL
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/dictation/${filePath}`;
      console.log('Basic upload success, URL:', publicUrl);
      
      return { success: true, url: publicUrl, error: null };
    } catch (error) {
      console.error('Basic upload exception:', error);
      return { success: false, error, url: null };
    }
  };

  // Thêm state để theo dõi quá trình tạo từ vựng tự động
  const [isGeneratingVocabulary, setIsGeneratingVocabulary] = useState(false);
  const [generatedVocabularyCount, setGeneratedVocabularyCount] = useState(0);

  // Thêm state để quản lý danh sách từ vựng và dialog
  const [editingVocabulary, setEditingVocabulary] = useState<VocabularyItem | null>(null);
  const [isVocabDialogOpen, setIsVocabDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');

  // Thêm API lấy từ loại (POS) từ proxy server
  const getPosTag = async (word: string): Promise<string> => {
    try {
      const loadingToast = toast.loading('Đang xác định từ loại...');
      
      const response = await fetch(`http://localhost:3000/api/get-pos?word=${encodeURIComponent(word)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      toast.dismiss(loadingToast);
      
      if (data && data.part_of_speech) {
        console.log("POS tagging result:", data);
        return data.part_of_speech;
      }
      
      console.warn("No part of speech returned, using default");
      return 'noun';
    } catch (error) {
      console.error("Error getting POS tag:", error);
      toast.error('Lỗi khi xác định từ loại, sử dụng mặc định');
      return 'noun';
    }
  };

  const handleAutoDetectPos = async () => {
    if (!editingVocabulary) return;
    
    try {
      const part_of_speech = await getPosTag(editingVocabulary.word);
      setEditingVocabulary(prev => prev ? {...prev, part_of_speech} : null);
      
      if (part_of_speech) {
        console.log(`Đã tự động xác định từ loại: ${part_of_speech} cho từ: ${editingVocabulary.word}`);
        
        const updatedVocab = {...editingVocabulary, part_of_speech};
        setEditingVocabulary(updatedVocab);
        
        toast.success(`Đã thêm từ vựng mới: ${updatedVocab.word} (${part_of_speech})`);
      }
    } catch (error) {
      console.error('Error auto-detecting POS:', error);
      toast.error('Lỗi khi tự động xác định từ loại');
    }
  };

  // Thêm function để mở dialog thêm từ vựng
  const openAddVocabularyDialog = async () => {
    setEditingVocabulary({
      id: crypto.randomUUID(),
      word: '',
      part_of_speech: 'noun',
      meaning_vi: '',
      audio_start_time: 0,
      audio_end_time: 0,
    });
    setDialogMode('add');
    setIsVocabDialogOpen(true);
  };

  // Thêm function để mở dialog chỉnh sửa từ vựng
  const openEditVocabularyDialog = (vocab: VocabularyItem) => {
    setEditingVocabulary({...vocab});
    setDialogMode('edit');
    setIsVocabDialogOpen(true);
  };

  // Thêm function để xử lý việc lưu từ vựng
  const handleSaveVocabulary = async () => {
    if (!editingVocabulary) return;
    
    try {
      // Nếu đang thêm từ mới, tự động lấy từ loại từ proxy server
      if (dialogMode === 'add' && editingVocabulary.word && (!editingVocabulary.part_of_speech || editingVocabulary.part_of_speech === 'noun')) {
        // Hiển thị toast loading
        const loadingToast = toast.loading('Đang xác định từ loại...');
        
        // Lấy từ loại tự động
        const partOfSpeech = await getPosTag(editingVocabulary.word);
        
        // Cập nhật từ loại
        setEditingVocabulary(prev => prev ? {...prev, part_of_speech: partOfSpeech} : null);
        
        // Kết thúc toast loading
        toast.dismiss(loadingToast);
        console.log(`Đã tự động xác định từ loại: ${partOfSpeech} cho từ: ${editingVocabulary.word}`);
        
        // Cập nhật editingVocabulary với từ loại mới
        const updatedVocab = {...editingVocabulary, part_of_speech: partOfSpeech};
        
        // Thêm từ vựng vào danh sách
        setVocabularyItems(prev => [...prev, updatedVocab]);
        toast.success(`Đã thêm từ vựng mới: ${updatedVocab.word} (${partOfSpeech})`);
      } else if (dialogMode === 'add') {
        // Nếu đã có từ loại, thêm trực tiếp
        setVocabularyItems(prev => [...prev, editingVocabulary]);
        toast.success('Đã thêm từ vựng mới');
      } else {
        // Trường hợp chỉnh sửa
        setVocabularyItems(prev => 
          prev.map(item => item.id === editingVocabulary.id ? editingVocabulary : item)
        );
        toast.success('Đã cập nhật từ vựng');
      }
    } catch (error) {
      console.error("Error saving vocabulary:", error);
      toast.error("Lỗi khi lưu từ vựng");
      
      // Vẫn thêm từ vựng với từ loại mặc định nếu có lỗi
      if (dialogMode === 'add') {
        setVocabularyItems(prev => [...prev, editingVocabulary]);
      } else {
        setVocabularyItems(prev => 
          prev.map(item => item.id === editingVocabulary.id ? editingVocabulary : item)
        );
      }
    } finally {
      setIsVocabDialogOpen(false);
    }
  };

  // Thêm function để xóa từ vựng
  const handleDeleteVocabulary = (id: string) => {
    setVocabularyItems(prev => prev.filter(item => item.id !== id));
    toast.success('Đã xóa từ vựng');
  };
  
  // Hàm tạo nghĩa tiếng Việt giả định dựa trên từ tiếng Anh
  const getMockVietnameseMeaning = (word: string) => {
    const meanings: Record<string, string> = {
      // Thêm các từ phổ biến
      "water": "nước",
      "built": "xây dựng",
      "turbine": "tuabin",
      "rivers": "sông ngòi",
      "generator": "máy phát điện",
      "explain": "giải thích",
      "needed": "cần thiết",
      "because": "bởi vì",
      "reservoir": "hồ chứa",
      "hydroelectric": "thủy điện",
      "produces": "tạo ra",
      "engineering": "kỹ thuật",
      "construction": "xây dựng",
      "natural": "tự nhiên",
      "different": "khác nhau",
      "mountain": "núi",
      "between": "giữa",
      "through": "thông qua",
      "valley": "thung lũng",
      "station": "trạm", 
      "control": "điều khiển",
      "electricity": "điện",
      "dams": "đập",
      "large": "lớn",
      "small": "nhỏ",
      "pressure": "áp suất",
      "power": "năng lượng",
      "stored": "được lưu trữ",
      "supply": "cung cấp",
      "place": "địa điểm",
      "create": "tạo ra",
      "during": "trong",
      "amount": "số lượng",
      "comes": "đến",
      "inside": "bên trong",
      "pipes": "ống",
      "makes": "làm cho",
      "first": "đầu tiên",
      "second": "thứ hai",
      "third": "thứ ba",
      "force": "lực",
      "plants": "nhà máy",
      "major": "chính",
      "source": "nguồn",
      "example": "ví dụ",
      "machine": "máy móc",
      "technology": "công nghệ",
      "energy": "năng lượng",
      "system": "hệ thống",
      "factory": "nhà máy",
      "build": "xây dựng",
      "important": "quan trọng",
      "people": "người dân",
      "country": "quốc gia",
      "government": "chính phủ",
      "school": "trường học",
      "student": "học sinh",
      "teacher": "giáo viên",
      "hospital": "bệnh viện",
      "doctor": "bác sĩ",
      "patient": "bệnh nhân",
      "company": "công ty",
      "business": "kinh doanh",
      "money": "tiền",
      "market": "thị trường",
      "product": "sản phẩm",
      "service": "dịch vụ",
      "computer": "máy tính",
      "internet": "internet",
      "phone": "điện thoại",
      "information": "thông tin",
      "knowledge": "kiến thức",
      "language": "ngôn ngữ",
      "family": "gia đình",
      "friend": "bạn bè",
      "community": "cộng đồng",
      "society": "xã hội",
      "culture": "văn hóa",
      "history": "lịch sử",
      "future": "tương lai",
      "environment": "môi trường",
      "nature": "thiên nhiên", 
      "climate": "khí hậu",
      "weather": "thời tiết",
      "change": "thay đổi"
    };
    
    // Trả về nghĩa nếu từ có trong danh sách, nếu không thì trả về nghĩa mặc định
    return meanings[word.toLowerCase()] || `Nghĩa tiếng Việt của "${word}"`;
  };

  // Thêm state quản lý số lượng từ vựng
  const [vocabCount, setVocabCount] = useState<number>(5);

  // Cập nhật hàm generateVocabulary để thêm các từ vựng mẫu và tránh trùng lặp
  const generateVocabulary = async () => {
    if (!form.getValues('script')) {
      toast.error('Cần nhập nội dung bài đọc trước khi tạo từ vựng');
      return;
    }
    
    try {
      setIsGeneratingVocabulary(true);
      toast.loading('Đang phân tích nội dung và tạo danh sách từ vựng...');
      
      // Lấy nội dung script
      const script = form.getValues('script');
      
      // Phân tích và tạo từ vựng
      const words = script.split(/\s+/)
        .filter(w => w.length > 4) // Lọc từ có độ dài > 4
        .map(w => w.replace(/[.,;!?]/g, '').toLowerCase()) // Loại bỏ dấu câu và chuyển thành chữ thường
        .filter(w => /^[a-zA-Z]+$/.test(w)); // Chỉ lấy từ tiếng Anh
      
      if (words.length === 0) {
        toast.error('Không tìm thấy từ vựng phù hợp trong nội dung');
        setIsGeneratingVocabulary(false);
        return;
      }
      
      // Loại bỏ từ trùng lặp
      const uniqueWords = Array.from(new Set(words));
      console.log("Unique words found:", uniqueWords.length);
      
      // Nếu không đủ số lượng từ
      if (uniqueWords.length < vocabCount) {
        console.log("Not enough unique words, using all available words");
        toast.error(`Chỉ tìm thấy ${uniqueWords.length} từ vựng trong văn bản`);
      }
      
      // Chọn ngẫu nhiên từ trong danh sách không trùng lặp
      const selectedWords: string[] = [];
      const targetWordCount = Math.min(vocabCount, uniqueWords.length);
      
      // Sao chép mảng để tránh ảnh hưởng đến mảng gốc khi shuffle
      const shuffledWords = [...uniqueWords];
      
      // Shuffle mảng (Fisher-Yates algorithm)
      for (let i = shuffledWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
      }
      
      // Lấy số lượng từ cần thiết từ đầu mảng đã shuffle
      selectedWords.push(...shuffledWords.slice(0, targetWordCount));
      
      console.log("Selected words:", selectedWords);
      
      // Tạo danh sách từ vựng tạm thời với từ loại placeholder
      const tempItems: VocabularyItem[] = selectedWords.map((word) => ({
        id: crypto.randomUUID(),
        word: word,
        part_of_speech: 'noun', // Mặc định, sẽ được cập nhật sau
        meaning_vi: `Đang dịch...`,
        audio_start_time: Math.floor(Math.random() * 100),
        audio_end_time: Math.floor(Math.random() * 100) + 100,
      }));
      
      // Cập nhật state ban đầu
      setVocabularyItems(tempItems);
      
      // Lấy từ loại và dịch nghĩa của từng từ (song song)
      const updatedItems = await Promise.all(
        tempItems.map(async (item) => {
          // Gọi song song cả 2 API
          const [posTag, meaning] = await Promise.all([
            getPosTag(item.word),
            translateToLocalVietnamese(item.word)
          ]);
          
          // Thông báo kết quả
          console.log(`Word: ${item.word}, POS: ${posTag}, Translation: ${meaning}`);
          
          return {
            ...item,
            part_of_speech: posTag,
            meaning_vi: meaning
          };
        })
      );
      
      // Cập nhật state với từ loại và nghĩa đã dịch
      setVocabularyItems(updatedItems);
      setGeneratedVocabularyCount(updatedItems.length);
      
      toast.success(`Đã tạo ${updatedItems.length} từ vựng tự động với từ loại`);
      
      // Tự động bật tính năng yêu cầu học từ vựng
      form.setValue('requireVocabularyPractice', true);
    } catch (error) {
      console.error('Lỗi khi tạo từ vựng:', error);
      toast.error('Không thể tạo từ vựng tự động. Vui lòng thử lại sau.');
    } finally {
      setIsGeneratingVocabulary(false);
    }
  };

  // Sửa lại phần renderVocabularySettings để hiển thị bảng và quản lý từ vựng
  const renderVocabularySettings = () => (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Cài đặt học từ vựng</h3>
      </div>
      
      <Alert className="bg-green-50 border-green-200">
        <BookOpen className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 flex items-center gap-2">
          <span>Hỗ trợ học từ vựng</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                <AlertOctagon className="h-4 w-4 text-green-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm">
              <p>Yêu cầu học sinh phải hoàn thành bước học từ vựng (flashcard, luyện tập) trước khi làm bài chính</p>
            </TooltipContent>
          </Tooltip>
        </AlertTitle>
        <AlertDescription className="text-green-700 mt-2">
          <div className="grid grid-cols-1 gap-2">
            <p>Giúp học sinh nắm được các từ vựng chính trước khi làm bài dictation, cải thiện kết quả và tính hiệu quả của bài học.</p>
          </div>
        </AlertDescription>
      </Alert>
      
      <FormField
        control={form.control}
        name="requireVocabularyPractice"
        render={({ field }) => (
          <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="transition-colors hover:text-green-500">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Yêu cầu học sinh học từ vựng trước khi làm bài</p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-medium">Yêu cầu học từ vựng</span>
              </div>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          </div>
        )}
      />
      
      {form.watch("requireVocabularyPractice") && (
        <div className="space-y-4 animate-slide-down">
          <Tabs defaultValue="generate" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate">Tạo tự động</TabsTrigger>
              <TabsTrigger value="manage">Quản lý từ vựng</TabsTrigger>
            </TabsList>
            
            <TabsContent value="generate" className="space-y-4 mt-2">
              <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wand className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Tạo từ vựng tự động</span>
                  </div>
                </div>
                
                <div className="mb-4">
                  <Label htmlFor="vocab-count">Số lượng từ vựng cần tạo: {vocabCount}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Slider
                      id="vocab-count"
                      defaultValue={[5]}
                      max={15}
                      min={1}
                      step={1}
                      value={[vocabCount]}
                      onValueChange={(values) => setVocabCount(values[0])}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateVocabulary}
                  disabled={isGeneratingVocabulary || !form.getValues('script')}
                  className="flex items-center gap-2"
                >
                  {isGeneratingVocabulary ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <Wand className="h-4 w-4" />
                      <span>Tạo {vocabCount} từ vựng</span>
                    </>
                  )}
                </Button>
                
                {generatedVocabularyCount > 0 && (
                  <div className="mt-3 text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Đã tạo {generatedVocabularyCount} từ vựng tự động</span>
                  </div>
                )}
                
                <div className="mt-2 text-xs text-gray-500">
                  Hệ thống sẽ phân tích nội dung và tự động tạo danh sách từ vựng từ script, 
                  sau đó dịch tự động nghĩa sang tiếng Việt sử dụng AI.
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="manage" className="mt-2">
              <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Danh sách từ vựng</span>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={openAddVocabularyDialog}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Thêm từ mới</span>
                  </Button>
                </div>
                
                {vocabularyItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Chưa có từ vựng nào. Hãy tạo tự động hoặc thêm thủ công.</p>
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Từ vựng</TableHead>
                          <TableHead>Từ loại</TableHead>
                          <TableHead>Nghĩa Tiếng Việt</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vocabularyItems.map((vocab) => (
                          <TableRow key={vocab.id}>
                            <TableCell className="font-medium">{vocab.word}</TableCell>
                            <TableCell>{vocab.part_of_speech}</TableCell>
                            <TableCell>{vocab.meaning_vi}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditVocabularyDialog(vocab)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteVocabulary(vocab.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
      
      {/* Dialog thêm/chỉnh sửa từ vựng */}
      <Dialog open={isVocabDialogOpen} onOpenChange={setIsVocabDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'add' ? 'Thêm từ vựng mới' : 'Chỉnh sửa từ vựng'}
            </DialogTitle>
            <DialogDescription>
              Nhập thông tin chi tiết về từ vựng.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="word">Từ vựng</Label>
                <Input
                  id="word"
                  value={editingVocabulary?.word || ''}
                  onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, word: e.target.value} : null)}
                  placeholder="Nhập từ vựng"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="part_of_speech">Từ loại</Label>
                <Select
                  value={editingVocabulary?.part_of_speech || 'noun'}
                  onValueChange={(value) => setEditingVocabulary(prev => prev ? {...prev, part_of_speech: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn từ loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noun">Danh từ</SelectItem>
                    <SelectItem value="verb">Động từ</SelectItem>
                    <SelectItem value="adjective">Tính từ</SelectItem>
                    <SelectItem value="adverb">Trạng từ</SelectItem>
                    <SelectItem value="preposition">Giới từ</SelectItem>
                    <SelectItem value="conjunction">Liên từ</SelectItem>
                    <SelectItem value="pronoun">Đại từ</SelectItem>
                    <SelectItem value="interjection">Thán từ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="meaning_vi">Nghĩa Tiếng Việt</Label>
              <Input
                id="meaning_vi"
                value={editingVocabulary?.meaning_vi || ''}
                onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, meaning_vi: e.target.value} : null)}
                placeholder="Nhập nghĩa tiếng Việt"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="audio_start">Thời điểm bắt đầu (giây)</Label>
                <Input
                  id="audio_start"
                  type="number"
                  min="0"
                  step="0.1"
                  value={editingVocabulary?.audio_start_time || 0}
                  onChange={(e) => setEditingVocabulary(prev => prev ? 
                    {...prev, audio_start_time: parseFloat(e.target.value)} : null)}
                  placeholder="0.0"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="audio_end">Thời điểm kết thúc (giây)</Label>
                <Input
                  id="audio_end"
                  type="number"
                  min="0"
                  step="0.1"
                  value={editingVocabulary?.audio_end_time || 0}
                  onChange={(e) => setEditingVocabulary(prev => prev ? 
                    {...prev, audio_end_time: parseFloat(e.target.value)} : null)}
                  placeholder="0.0"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="image_url">Hình ảnh minh họa (URL)</Label>
              <Input
                id="image_url"
                value={editingVocabulary?.image_url || ''}
                onChange={(e) => setEditingVocabulary(prev => prev ? 
                  {...prev, image_url: e.target.value || null} : null)}
                placeholder="https://example.com/image.jpg (Không bắt buộc)"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsVocabDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button 
              type="button"
              onClick={handleSaveVocabulary}
              disabled={!editingVocabulary?.word || !editingVocabulary?.meaning_vi}
            >
              {dialogMode === 'add' ? 'Thêm từ vựng' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Thêm hàm saveVocabularyItems
  const saveVocabularyItems = async (questionId: string, loadingToast: string) => {
    try {
      // Xóa các vocabulary items cũ
      const { error: deleteError } = await supabase
        .from('vocabulary_items')
        .delete()
        .eq('question_id', questionId);
        
      if (deleteError) {
        console.error('Error deleting old vocabulary items:', deleteError);
        toast.error('Lỗi khi xóa từ vựng cũ');
        toast.dismiss(loadingToast);
                return;
              }
              
      // Thêm các vocabulary items mới
      const { error: insertError } = await supabase
        .from('vocabulary_items')
        .insert(
          vocabularyItems.map(item => ({
            question_id: questionId,
            word: item.word,
            part_of_speech: item.part_of_speech,
            meaning_vi: item.meaning_vi,
            audio_start_time: item.audio_start_time,
            audio_end_time: item.audio_end_time
          }))
        );
        
      if (insertError) {
        console.error('Error inserting new vocabulary items:', insertError);
        toast.error('Lỗi khi thêm từ vựng mới');
        toast.dismiss(loadingToast);
                return;
              }
    } catch (error) {
      console.error('Error saving vocabulary items:', error);
      toast.error('Lỗi khi lưu từ vựng');
      toast.dismiss(loadingToast);
    }
  };

  // Thêm hàm fetchQuestionData
  const fetchQuestionData = async () => {
    try {
      // Show loading state
      const loadingToast = toast.loading('Đang tải thông tin câu hỏi...');
      
      // Fetch question data with error handling - Sửa để bỏ nested query
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();
        
      if (questionError) {
        console.error('Error fetching question:', questionError);
        toast.error('Lỗi khi tải thông tin câu hỏi');
        toast.dismiss(loadingToast);
        navigate('/teacher/dashboard');
        return;
      }
      
      if (!questionData) {
        toast.error('Không tìm thấy câu hỏi');
        toast.dismiss(loadingToast);
        navigate('/teacher/dashboard');
        return;
      }

      // Tách riêng việc lấy vocabulary items bằng một truy vấn riêng
      const { data: vocabularyData, error: vocabularyError } = await supabase
        .from('vocabulary_items')
        .select('id, word, part_of_speech, meaning_vi, audio_start_time, audio_end_time, image_url')
        .eq('question_id', questionId);
        
      if (vocabularyError) {
        console.error('Error fetching vocabulary items:', vocabularyError);
        toast.error('Có lỗi khi tải từ vựng của câu hỏi');
        // Không return ở đây, vẫn tiếp tục xử lý dữ liệu câu hỏi
      } else {
        // Gán thủ công vocabulary_items vào questionData
        questionData.vocabulary_items = vocabularyData || [];
      }
      
      // Set audio URL from questionData
      if (questionData.audio_url) {
        setAudioUrl(questionData.audio_url);
      }
      
      // Set original question data for comparison
      setOriginalQuestionData(questionData);
      
      // Update form with question data
      form.reset({
        title: questionData.title || '',
        script: questionData.script || '',
        difficulty: questionData.difficulty || 'sentence',
        blanksCount: questionData.blanks_count || 5,
        timeLimit: questionData.time_limit, // Loại bỏ giá trị mặc định, sử dụng giá trị từ DB
        enableAntiCheating: questionData.enable_anti_cheating || false,
        enableStudentCategorization: questionData.differentiate_levels || false,
        requireVocabularyPractice: questionData.require_vocabulary_practice || false,
        goodStudentsTimeLimit: questionData.good_students_time_limit, // Loại bỏ giá trị mặc định
        averageStudentsTimeLimit: questionData.average_students_time_limit, // Loại bỏ giá trị mặc định
        poorStudentsTimeLimit: questionData.poor_students_time_limit, // Loại bỏ giá trị mặc định
        goodStudentsListeningAttempts: questionData.good_students_listening_attempts || 3,
        averageStudentsListeningAttempts: questionData.average_students_listening_attempts || 5,
        poorStudentsListeningAttempts: questionData.poor_students_listening_attempts || 7,
        goodStudentsShowTranscript: questionData.good_students_show_transcript || false,
        averageStudentsShowTranscript: questionData.average_students_show_transcript || true,
        poorStudentsShowTranscript: questionData.poor_students_show_transcript || true,
        goodStudentsEnableHighlight: questionData.good_students_enable_highlight || true,
        averageStudentsEnableHighlight: questionData.average_students_enable_highlight || true,
        poorStudentsEnableHighlight: questionData.poor_students_enable_highlight || true,
        goodStudentsEnableHints: questionData.good_students_enable_hints || false,
        averageStudentsEnableHints: questionData.average_students_enable_hints || true,
        poorStudentsEnableHints: questionData.poor_students_enable_hints || true,
        goodStudentsBlanksPercentage: questionData.good_students_blanks_percentage || 60,
        averageStudentsBlanksPercentage: questionData.average_students_blanks_percentage || 50,
        poorStudentsBlanksPercentage: questionData.poor_students_blanks_percentage || 40,
        minimumPassingScore: questionData.minimum_passing_score || 70,
        allowRetry: questionData.allow_retry ?? true,
        unlimitedTime: questionData.unlimited_time || false,
        maxCheatingAttempts: questionData.max_cheating_attempts || 2,
        enableMouseLeaveDetection: questionData.enable_mouse_leave_detection ?? true,
        enableMultipleIPDetection: questionData.enable_multiple_ip_detection ?? true,
        enableMultipleTabPrevention: questionData.enable_multiple_tab_prevention ?? true,
        cheatingWarningMessage: questionData.cheating_warning_message || "Cảnh báo: Hệ thống đã phát hiện hành vi gian lận. Vui lòng không thực hiện các hành động không được phép. Sau {attempts} lần cảnh báo, bài làm sẽ tự động kết thúc."
      });
      
      // Update vocabulary items if they exist
      if (questionData.vocabulary_items && questionData.vocabulary_items.length > 0) {
        setVocabularyItems(questionData.vocabulary_items);
        setGeneratedVocabularyCount(questionData.vocabulary_items.length);
      }
      
      // If there's an audio file, set it up
      if (questionData.audio_url) {
        try {
          console.log('Original audio path from database:', questionData.audio_url);
          
          // Sử dụng URL trực tiếp từ database mà không thêm prefix
          // Kiểm tra xem đường dẫn có phải là URL đầy đủ chưa
          if (questionData.audio_url.startsWith('http')) {
            // Nếu là URL đầy đủ, sử dụng trực tiếp
            setAudioUrl(questionData.audio_url);
            console.log('Using direct URL from database:', questionData.audio_url);
          } else {
            // Nếu chỉ là đường dẫn tương đối, thêm prefix
            const cleanPath = questionData.audio_url.replace(/^\//, '').trim();
            const fullAudioUrl = `${supabaseUrl}/storage/v1/object/public/dictation/${cleanPath}`;
            setAudioUrl(fullAudioUrl);
            console.log('Constructed URL:', fullAudioUrl);
          }
          
          toast.success('Đã tạo URL cho file âm thanh');
        } catch (error) {
          console.error('Exception during audio setup:', error);
          toast.error('Lỗi khi thiết lập file âm thanh: ' + (error instanceof Error ? error.message : String(error)));
        }
      }
      
      // Update timing data if it exists in the script
      if (questionData.script) {
        const timingMatch = questionData.script.match(/--- Timing Data ---\n([\s\S]*)$/);
        if (timingMatch) {
          const timingText = timingMatch[1];
          const timingData = timingText.split('\n')
            .filter(line => line.trim())
            .map(line => {
              const [word, start, end] = line.split('|').map(s => s.trim());
              return {
                word,
                start: parseFloat(start),
                end: parseFloat(end)
              };
            });
          setTimingData(timingData);
        }
      }
      
      toast.dismiss(loadingToast);
      toast.success('Đã tải thông tin câu hỏi thành công');
    } catch (error) {
      console.error('Error fetching question data:', error);
      toast.error('Lỗi khi tải dữ liệu câu hỏi');
    }
  };

  const handleGenerateTranscript = async () => {
                  if (!audioFile) {
      toast.error('Vui lòng chọn file audio trước');
                    return;
                  }
                  
    setTranscriptState('uploading');
    const loadingToast = toast.loading('Đang xử lý audio...');
    
    try {
      const audioUrlToUse = audioUrl || URL.createObjectURL(audioFile);
      
      // Update loading state
      setLoadingState(prev => ({ ...prev, status: 'processing', progress: 0 }));
      
      // Generate transcript
      const transcript = await generateTranscript(audioUrlToUse);
      
      if (!transcript) {
        throw new Error('Không nhận được kết quả từ API');
      }
      
      // Update form with transcript
      form.setValue('script', transcript);
      
      // Generate timing data if audio duration is available
      if (audioDuration > 0) {
        const syntheticTiming = generateSyntheticTiming(transcript, audioDuration);
        setTimingData(syntheticTiming);
      }
      
      setTranscriptState('completed');
      setLoadingState(prev => ({ ...prev, status: 'completed', progress: 100 }));
      toast.dismiss(loadingToast);
      toast.success('Tạo transcript thành công!');
    } catch (error) {
      console.error('Error generating transcript:', error);
      setTranscriptState('error');
      setLoadingState(prev => ({ ...prev, status: 'error', progress: 0 }));
      toast.dismiss(loadingToast);
      toast.error('Lỗi khi tạo transcript, vui lòng thử lại sau');
    }
  };

  // Hàm tạo nghĩa tiếng Việt giả định dựa trên từ tiếng Anh
  const translateToLocalVietnamese = async (text: string): Promise<string> => {
    try {
      console.log("Translating:", text);
      
      // Check mock dictionary first
      const mockMeaning = getMockVietnameseMeaning(text);
      if (mockMeaning !== `Nghĩa tiếng Việt của "${text}"`) {
        console.log("Using pre-defined meaning for:", text);
        return mockMeaning;
      }
      
      // Use the centralized safe translation function
      console.log("Using safe translation function");
      return await translateToVietnamese(text);
    } catch (error) {
      console.error("Translation error:", error);
      toast.error('Lỗi khi dịch từ vựng, sử dụng mặc định');
      return `Nghĩa tiếng Việt của "${text}"`;
    }
  };

  // Update renderMainSettings with "Vi phạm quy chế" tab
  const renderMainSettings = () => (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="w-full grid grid-cols-1 md:grid-cols-5 gap-1">
        <TabsTrigger value="general" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span>Chung</span>
        </TabsTrigger>
        <TabsTrigger value="advanced" className="flex items-center gap-2">
          <Boxes className="h-4 w-4" />
          <span>Nâng cao</span>
        </TabsTrigger>
        <TabsTrigger value="vocabulary" className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span>Từ vựng</span>
        </TabsTrigger>
        <TabsTrigger value="audio" className="flex items-center gap-2">
          <Music2 className="h-4 w-4" />
          <span>Âm thanh</span>
        </TabsTrigger>
        <TabsTrigger value="violations" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>Vi phạm quy chế</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-2">
        {renderStudentSettings()}
      </TabsContent>
      
      <TabsContent value="advanced" className="mt-2">
        {renderVocabularySettings()}
      </TabsContent>
      
      <TabsContent value="vocabulary" className="mt-2">
        {renderVocabularySettings()}
      </TabsContent>
      
      <TabsContent value="audio" className="mt-2">
        {renderFileUpload()}
      </TabsContent>
      
      <TabsContent value="violations" className="mt-2">
        {questionId && <CheatingManagement questionId={questionId} />}
      </TabsContent>
    </Tabs>
  );

  return (
    <TooltipProvider delayDuration={0}>
    <TeacherLayout>
      <div className="container mx-auto py-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Pencil className="h-6 w-6" />
          Chỉnh sửa câu hỏi
        </h1>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-8">
            {/* Các trường form */}
            
            {/* Thông tin cơ bản */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiêu đề</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập tiêu đề bài dictation" {...field} />
                    </FormControl>
                    <FormDescription>
                      Đặt tiêu đề ngắn gọn, dễ nhớ
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Upload file */}
            {renderFileUpload()}
            
            {/* Transcript */}
            <FormField
              control={form.control}
              name="script"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nội dung</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Nhập toàn bộ nội dung của đoạn audio"
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                      Nhập chính xác nội dung của đoạn audio. {audioFile && !field.value && 
                        "Bạn có thể tạo transcript tự động từ file âm thanh bằng nút 'Tạo transcript tự động'."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tabs cài đặt */}
            {renderMainSettings()}
            
            {/* Nút submit */}
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/teacher/dashboard')}
              >
                Hủy
              </Button>
              <Button 
                type="submit"
                disabled={!audioUrl || !form.getValues('title') || !form.getValues('script') || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Cập nhật câu hỏi
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </TeacherLayout>
    </TooltipProvider>
  );
};

export default EditQuestion;
