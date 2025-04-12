import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Loader2, RefreshCw, AlertTriangle, Wand2,
  Users, Sparkles, BookOpen, Timer, Volume2,
  Eye, EyeOff, Brain, Award, Settings2,
  Glasses, GraduationCap, School, X,
  MousePointer2, Globe2, Layout, Shield, ShieldAlert, ShieldCheck,
  AlertOctagon, History, Ban, CheckCircle, Plus,
  Bot, FileText, CheckCircle2, Wand, Info
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

// Update the form schema
const formSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tiêu đề"),
  script: z.string().min(1, "Vui lòng nhập script"),
  audioFile: z.any(),
  difficulty: z.enum(['sentence', 'phrase', 'word']).default('sentence'),
  blanksCount: z.number().min(1).default(5),
  timeLimit: z.number().min(1).default(5),
  enableAntiCheating: z.boolean().default(false),
  // Đã loại bỏ enableStudentCategorization vì luôn bắt buộc
  goodStudentsDifficulty: z.enum(['sentence', 'phrase', 'word']).default('sentence'),
  averageStudentsDifficulty: z.enum(['sentence', 'phrase', 'word']).default('phrase'),
  poorStudentsDifficulty: z.enum(['sentence', 'phrase', 'word']).default('word'),
  goodStudentsBlanksCount: z.number().min(1).default(7),
  averageStudentsBlanksCount: z.number().min(1).default(5),
  poorStudentsBlanksCount: z.number().min(1).default(3),
  goodStudentsTimeLimit: z.number().min(1).max(60).default(30),
  averageStudentsTimeLimit: z.number().min(1).max(60).default(45),
  poorStudentsTimeLimit: z.number().min(1).max(60).default(60),
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
  cheatingWarningMessage: z.string().default("Cảnh báo: Hệ thống đã phát hiện hành vi gian lận. Vui lòng không thực hiện các hành động không được phép. Sau {attempts} lần cảnh báo, bài làm sẽ tự động kết thúc."),
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
  id: string;
  word: string;
  part_of_speech: string;
  meaning_vi: string;
  audio_start_time: number;
  audio_end_time: number;
  image_url?: string | null;
}

const CreateQuestion = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rlsEnabled, setRlsEnabled] = useState<boolean | null>(null);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showTimingData, setShowTimingData] = useState(false);
  const [timingData, setTimingData] = useState<WordTiming[] | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Update the form configuration
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      script: '',
      difficulty: 'sentence',
      blanksCount: 5,
      timeLimit: 5,
      enableAntiCheating: true,
      // Đã loại bỏ enableStudentCategorization vì luôn bắt buộc
      goodStudentsDifficulty: 'sentence',
      averageStudentsDifficulty: 'phrase',
      poorStudentsDifficulty: 'word',
      goodStudentsBlanksCount: 7,
      averageStudentsBlanksCount: 5,
      poorStudentsBlanksCount: 3,
      goodStudentsTimeLimit: 30,
      averageStudentsTimeLimit: 45,
      poorStudentsTimeLimit: 60,
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

  // Update the state declarations
  const [loadingState, setLoadingState] = useState<LoadingState>({
    status: 'idle',
    progress: 0
  });

  const [transcriptState, setTranscriptState] = useState<TranscriptState>('idle');

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

  useEffect(() => {
    // If we get stuck in uploading state for more than 10 seconds after progress reaches 100%,
    // force redirect to dashboard
    if (uploading && uploadProgress === 100) {
      const redirectTimer = setTimeout(() => {
        console.log('Auto-redirecting after successful upload...');
        setUploading(false);
        navigate('/teacher/dashboard');
      }, 5000); // 5 seconds

      return () => clearTimeout(redirectTimer);
    }
  }, [uploading, uploadProgress, navigate]);

  // Check RLS status
  useEffect(() => {
    const checkRlsStatus = async () => {
      try {
        // Try inserting a test row with a random ID (should fail if RLS is enabled)
        const { error } = await supabase
          .from('questions')
          .insert([{ 
            id: 'test-' + Math.random().toString(36).substr(2, 9),
            created_by: 'test',
            title: 'RLS Test',
            created_at: new Date().toISOString()
          }]);
        
        // If no error, RLS might be disabled
        if (!error) {
          console.warn('RLS appears to be disabled for questions table!');
          setRlsEnabled(false);
          toast('Cảnh báo bảo mật: RLS bị vô hiệu hóa cho bảng questions. Điều này có thể gây rủi ro bảo mật. Vui lòng liên hệ quản trị viên.', {
            duration: 6000,
            icon: '⚠️'
          });
        } else if (error.code === 'PGRST204') {
          // This error code indicates RLS is enabled and blocking the operation
          console.log('RLS is correctly enabled for questions table');
          setRlsEnabled(true);
        } else {
          console.log('Unknown error when checking RLS status:', error);
        }
      } catch (e) {
        console.error('Error checking RLS status:', e);
      }
    };
    
    if (user) {
      checkRlsStatus();
    }
  }, [user]);

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

  // Sửa lại hàm onSubmit để đơn giản và trực tiếp hơn
  const onSubmit = async (values: any) => {
    try {
      console.log('Starting submit with values:', values);
      setIsSubmitting(true);
      
      // Thêm timeout để reset trạng thái nếu bị treo quá lâu
      const resetTimeout = setTimeout(() => {
        console.log('Submission timeout - auto resetting state');
        setIsSubmitting(false);
        toast.error('Quá thời gian xử lý - vui lòng thử lại');
      }, 15000); // 15 giây
      
      // Show loading toast
      const loadingToast = toast.loading('Đang xử lý yêu cầu...');
      
      // Kiểm tra authentication
      console.log('Checking authentication...');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.error('Authentication error:', authError);
        toast.error('Vui lòng đăng nhập để tiếp tục');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        clearTimeout(resetTimeout);
        return;
      }
      
      console.log('Authenticated user:', session.user.id);
      
      // Tạo dữ liệu câu hỏi đơn giản
      const questionData: any = {
        title: values.title || 'Câu hỏi mặc định',
        script: values.script || 'Nội dung mặc định',
        created_by: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        difficulty: 'easy'
      };
      
      // Kiểm tra xem có file không
      if (!audioFile) {
        console.error('No audio file selected');
        toast.error('Vui lòng chọn file audio');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        clearTimeout(resetTimeout);
        return;
      }
      
      // Upload file trực tiếp không qua helper
      try {
        toast.loading('Đang tải file lên...', { id: loadingToast });
        console.log('Starting direct file upload...');
        
        const timestamp = new Date().getTime();
        const filePath = `audio/${session.user.id}/${timestamp}-${audioFile.name}`;
        
        console.log('Upload path:', filePath);
        console.log('File details:', {
          name: audioFile.name,
          size: audioFile.size,
          type: audioFile.type
        });
        
        // Upload file âm thanh
        const { error: uploadError } = await supabase.storage
          .from('dictation')
          .upload(filePath, audioFile, {
            cacheControl: '3600',
            upsert: true
          });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Lỗi khi tải file lên: ' + uploadError.message);
          toast.dismiss(loadingToast);
          setIsSubmitting(false);
          clearTimeout(resetTimeout);
          return;
        }
        
        // Lấy URL công khai
        const { data: { publicUrl } } = supabase.storage
          .from('dictation')
          .getPublicUrl(filePath);
        
        console.log('File uploaded successfully. URL:', publicUrl);
        
        // Cập nhật URL trong dữ liệu câu hỏi
        questionData.audio_url = publicUrl;
        
      } catch (uploadErr: any) {
        console.error('Upload exception:', uploadErr);
        toast.error('Lỗi khi tải file: ' + (uploadErr.message || 'Không xác định'));
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        clearTimeout(resetTimeout);
        return;
      }
      
      // Lưu câu hỏi vào database
      try {
        toast.loading('Đang lưu câu hỏi...', { id: loadingToast });
        console.log('Saving question with data:', questionData);
        
        const { data, error } = await supabase
          .from('questions')
          .insert([
            {
              // ... các trường dữ liệu của câu hỏi ...
              good_students_difficulty: form.getValues('goodStudentsDifficulty'),
              average_students_difficulty: form.getValues('averageStudentsDifficulty'),
              poor_students_difficulty: form.getValues('poorStudentsDifficulty'),
              // ... other fields ...
            }
          ])
          .select('id')
          .single();
        
        if (error) {
          toast.error("Lỗi khi tạo câu hỏi");
          console.error(error);
          return;
        }
        
        const questionId = data.id;
        
        // Sau khi tạo câu hỏi thành công, lưu từ vựng
        if (vocabularyItems.length > 0) {
          const vocabularyToast = toast.loading("Đang lưu từ vựng...");
          await saveVocabularyItems(questionId, vocabularyToast);
        }
        
        toast.success("Đã tạo câu hỏi thành công!");
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        clearTimeout(resetTimeout);
        
        // Điều hướng sau khi thành công
        setTimeout(() => {
          navigate('/teacher/dashboard');
        }, 1500);
      } catch (dbErr: any) {
        console.error('Database exception:', dbErr);
        toast.error('Lỗi cơ sở dữ liệu: ' + (dbErr.message || 'Không xác định'));
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        clearTimeout(resetTimeout);
      }
      
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error('Có lỗi xảy ra: ' + (error.message || 'Lỗi không xác định'));
      setIsSubmitting(false);
    }
  };

  // Use debounce to prevent multiple submissions
  const onSubmitHandler = async (values: any) => {
    console.log('onSubmit called, form values:', values);
    console.log('Form state - audioFile:', !!audioFile, 'title:', !!values.title, 'script:', !!values.script);
    
    if (isSubmitting) {
      console.log('Already submitting, skipping');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('Form submission started, isSubmitting set to true');
      
      // Show loading toast
      const loadingToast = toast.loading('Đang xử lý yêu cầu...');
      
      // Check auth
      console.log('Checking authentication...');
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.error('Authentication failed:', authError);
        toast.error('Vui lòng đăng nhập để tiếp tục');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }
      console.log('User authenticated:', session.user.id);

      // Validate required fields
    if (!audioFile) {
        console.log('No audio file selected');
        toast.error('Vui lòng chọn file audio');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
      return;
    }
    
      if (!values.title?.trim()) {
        console.log('No title provided');
        toast.error('Vui lòng nhập tiêu đề');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
      return;
    }
    
      if (!values.script?.trim()) {
        console.log('No script provided');
        toast.error('Vui lòng nhập hoặc tạo transcript');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }

      // Upload audio file
      const timestamp = new Date().getTime();
      const filePath = `audio/${session.user.id}/${timestamp}-${audioFile.name}`;
      
      console.log('Uploading file:', {
        path: filePath,
        file: audioFile
      });

      let uploadResult: any; // Thêm type any để tránh lỗi
      try {
        toast.loading('Đang tải file lên...', { id: loadingToast });
        uploadResult = await uploadFile(filePath, audioFile);
        
        // Kiểm tra lỗi trong kết quả trả về
        if (uploadResult.error) {
          console.error('Error in upload result:', uploadResult.error);
          toast.error('Lỗi khi tải file lên: ' + (uploadResult.error.message || 'Không xác định'));
          toast.dismiss(loadingToast);
          setIsSubmitting(false);
          return;
        }
        
        // Kiểm tra publicUrl có tồn tại không
        if (!uploadResult.publicUrl) {
          console.error('Missing publicUrl in upload result');
          toast.error('Lỗi: Không nhận được URL công khai của file');
          toast.dismiss(loadingToast);
          setIsSubmitting(false);
          return;
        }
        
        console.log('File uploaded successfully:', uploadResult);
      } catch (uploadError: any) {
        console.error('Exception during file upload:', uploadError);
        toast.error('Lỗi khi tải file lên: ' + (uploadError.message || 'Không xác định'));
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }

      // Update loading toast
      toast.loading('Đang lưu thông tin câu hỏi...', { id: loadingToast });

      // Prepare question data
      const questionData = {
        title: values.title.trim(),
        audio_url: uploadResult.publicUrl,
        script: values.script.trim(),
        created_by: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Trường bắt buộc - phải dùng giá trị enum hợp lệ
        difficulty: 'easy', // Thay vì values.difficulty || 'sentence'
        // Các trường có giá trị mặc định
        blanks_count: values.blanksCount || 5,
        time_limit: values.timeLimit || 5,
        // Các cài đặt bổ sung
        enable_anti_cheating: values.enableAntiCheating || false,
        differentiate_levels: true, // Luôn bắt buộc phân loại học sinh
        // Thêm trường mới
        require_vocabulary_practice: values.requireVocabularyPractice || false,
        // Các trường thời gian và số lần nghe
        good_students_time_limit: values.goodStudentsTimeLimit || 30,
        average_students_time_limit: values.averageStudentsTimeLimit || 45,
        poor_students_time_limit: values.poorStudentsTimeLimit || 60,
        good_students_listening_attempts: values.goodStudentsListeningAttempts || 3,
        average_students_listening_attempts: values.averageStudentsListeningAttempts || 5,
        poor_students_listening_attempts: values.poorStudentsListeningAttempts || 7,
        // Các trường bool
        good_students_show_transcript: values.goodStudentsShowTranscript || false,
        average_students_show_transcript: values.averageStudentsShowTranscript || false,
        poor_students_show_transcript: values.poorStudentsShowTranscript || false,
        good_students_enable_highlight: values.goodStudentsEnableHighlight || false,
        average_students_enable_highlight: values.averageStudentsEnableHighlight || false,
        poor_students_enable_highlight: values.poorStudentsEnableHighlight || false,
        good_students_enable_hints: values.goodStudentsEnableHints || false,
        average_students_enable_hints: values.averageStudentsEnableHints || false,
        poor_students_enable_hints: values.poorStudentsEnableHints || false,
        // Các trường phần trăm
        good_students_blanks_percentage: values.goodStudentsBlanksPercentage || 60,
        average_students_blanks_percentage: values.averageStudentsBlanksPercentage || 50,
        poor_students_blanks_percentage: values.poorStudentsBlanksPercentage || 40,
        // Các trường difficulty cho mỗi cấp độ học sinh
        good_students_difficulty: values.goodStudentsDifficulty || 'sentence',
        average_students_difficulty: values.averageStudentsDifficulty || 'phrase',
        poor_students_difficulty: values.poorStudentsDifficulty || 'word',
        // Các cài đặt bổ sung
        minimum_passing_score: values.minimumPassingScore || 70,
        allow_retry: values.allowRetry !== undefined ? values.allowRetry : true,
        unlimited_time: values.unlimitedTime || false
      };

      console.log('Inserting question data:', questionData);

      // Insert question data
      try {
        const { data: questionResult, error: insertError } = await supabase
        .from('questions')
        .insert(questionData)
          .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting question:', insertError);
          
          // Log detailed error for debugging
          console.log('Insert error details:', {
            code: insertError.code,
            message: insertError.message,
            hint: insertError.hint,
            details: insertError.details
          });
          
          // Check if this is a permission error
          if (insertError.code === '42501' || insertError.message.includes('permission') || insertError.message.includes('policy')) {
            console.log('This appears to be a RLS/permission error, trying a workaround...');
            
            // Try a simpler insert without select and single
            const simpleInsert = await supabase
              .from('questions')
              .insert(questionData);
              
            if (simpleInsert.error) {
              console.error('Simple insert also failed:', simpleInsert.error);
              toast.error('Lỗi RLS: ' + simpleInsert.error.message);
            } else {
              console.log('Simple insert succeeded!');
              
              // Try to handle vocabulary if needed
              if (values.requireVocabularyPractice && vocabularyItems.length > 0) {
                // Since we couldn't get the ID from the insert, try to fetch the ID based on criteria
                const { data: createdQuestion } = await supabase
                  .from('questions')
                  .select('id')
                  .eq('title', questionData.title)
                  .eq('created_by', session.user.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single();
                  
                if (createdQuestion) {
                  await saveVocabularyItems(createdQuestion.id, loadingToast);
                }
              }
              
              toast.success('Tạo câu hỏi thành công!');
              toast.dismiss(loadingToast);
              
              // Reset form state before navigating
              setIsSubmitting(false);
              
              // Navigate after success
              setTimeout(() => {
                navigate('/teacher/dashboard');
              }, 1000);
              
              return;
            }
          }
          
        toast.error('Lỗi khi lưu câu hỏi: ' + insertError.message);
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }

        console.log('Question created successfully:', questionResult);
        
        // Save vocabulary items if needed
        if (values.requireVocabularyPractice && vocabularyItems.length > 0 && questionResult) {
          await saveVocabularyItems(questionResult.id, loadingToast);
        } else {
      toast.success('Tạo câu hỏi thành công!');
        }
        
      toast.dismiss(loadingToast);
        
        // Reset form state before navigating
        setIsSubmitting(false);

      // Navigate after success
      setTimeout(() => {
          navigate('/teacher/dashboard');
      }, 1500);
      } catch (dbError: any) {
        console.error('Database error:', dbError);
        console.log('Database error details:', dbError);
        toast.error('Lỗi cơ sở dữ liệu: ' + (dbError.message || 'Lỗi không xác định'));
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Error in form submission:', error);
      console.log('Error details:', error);
      toast.error('Có lỗi xảy ra: ' + (error.message || 'Lỗi không xác định'));
      setIsSubmitting(false);
    }
  };

  // Helper function to save vocabulary items
  const saveVocabularyItems = async (questionId: string, loadingToast: string) => {
    try {
      // Đảm bảo mọi từ vựng đều có đầy đủ thông tin trước khi lưu
      const vocabularyToSave = vocabularyItems.map(item => ({
        question_id: questionId,
        word: item.word,
        part_of_speech: item.part_of_speech || null, // Chấp nhận null
        meaning_vi: item.meaning_vi,
        image_url: item.image_url || null, // Chấp nhận null
        audio_start_time: item.audio_start_time || null, // Chấp nhận null
        audio_end_time: item.audio_end_time || null, // Chấp nhận null
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
        // Lưu ý: id sẽ được tạo tự động bởi Supabase
      }));

      const { data, error } = await supabase
        .from('vocabulary_items')
        .insert(vocabularyToSave);

      if (error) {
        console.error("Error saving vocabulary items:", error);
        toast.error("Lỗi khi lưu từ vựng", { id: loadingToast });
        return false;
      }

      toast.success("Đã lưu từ vựng thành công", { id: loadingToast });
      return true;
    } catch (err) {
      console.error("Exception when saving vocabulary:", err);
      toast.error("Lỗi khi lưu từ vựng", { id: loadingToast });
      return false;
    }
  };

  // Update handleGenerateTranscript function
  const handleGenerateTranscript = async () => {
    try {
      if (!audioFile) {
        toast.error('Vui lòng tải lên file audio trước khi tạo transcript');
        return;
      }

      setTranscriptState('uploading');
      setTimingData(null);

      // Upload progress simulation
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress <= 100) {
          setLoadingState(prev => ({ ...prev, progress }));
        } else {
          clearInterval(progressInterval);
        }
      }, 200);

      // Get actual audio duration
      const audioBlob = new Blob([audioFile], { type: audioFile.type });
      const audio = new Audio(URL.createObjectURL(audioBlob));
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve(true);
        });
      });
      const actualDuration = audio.duration;

      // Upload file to storage
      setTranscriptState('processing');
      const filePath = `temp/${Date.now()}-${audioFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('dictation')
        .upload(filePath, audioFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        clearInterval(progressInterval);
        setTranscriptState('error');
        setLoadingState({ status: 'error', progress: 0 });
        toast.error('Lỗi khi tải lên file audio');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('dictation')
        .getPublicUrl(filePath);

      setAudioUrl(publicUrl);

      // Generate transcript
      const transcript = await generateTranscript(publicUrl);
      form.setValue('script', transcript);

      // Create synthetic timing data
      console.log('Creating synthetic timing data from transcript');
      const syntheticTiming = generateSyntheticTiming(transcript, actualDuration);
      setTimingData(syntheticTiming);
      
      const wordCount = syntheticTiming.length;
      console.log('Synthetic timing data generated for', wordCount, 'words');
      
      const formattedTiming = formatTimingData(syntheticTiming);
      form.setValue('script', transcript + '\n\n--- Timing Data ---\n' + formattedTiming);
      
      clearInterval(progressInterval);
      setTranscriptState('completed');
      setLoadingState({ status: 'completed', progress: 100 });
      toast.success(`Tạo transcript thành công! Đã tạo transcript với ${wordCount} từ`);
    } catch (error) {
      console.error('Error generating transcript:', error);
      setTranscriptState('error');
      setLoadingState({ status: 'error', progress: 0 });
      toast.error('Lỗi khi tạo transcript');
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
            {/* Thêm FormField để chọn loại dictation cho học sinh giỏi */}
            <FormField
              control={form.control}
              name="goodStudentsDifficulty"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Loại dictation cho học sinh giỏi</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Loại dictation</span>
                  </div>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn loại dictation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="word">Điền từ</SelectItem>
                        <SelectItem value="phrase">Điền cụm từ (2-3 từ)</SelectItem>
                        <SelectItem value="sentence">Điền câu</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <div className="mt-2 text-xs text-gray-500">
                    Chọn mức độ khó dictation cho học sinh giỏi
                  </div>
                </div>
              )}
            />

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
            {/* Thêm FormField để chọn loại dictation cho học sinh trung bình */}
            <FormField
              control={form.control}
              name="averageStudentsDifficulty"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Loại dictation cho học sinh trung bình</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Loại dictation</span>
                  </div>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn loại dictation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="word">Điền từ</SelectItem>
                        <SelectItem value="phrase">Điền cụm từ (2-3 từ)</SelectItem>
                        <SelectItem value="sentence">Điền câu</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <div className="mt-2 text-xs text-gray-500">
                    Chọn mức độ khó dictation cho học sinh trung bình
                  </div>
                </div>
              )}
            />

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
            {/* Thêm FormField để chọn loại dictation cho học sinh yếu */}
            <FormField
              control={form.control}
              name="poorStudentsDifficulty"
              render={({ field }) => (
                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="transition-all hover:scale-105">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Loại dictation cho học sinh yếu</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium">Loại dictation</span>
                  </div>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn loại dictation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="word">Điền từ</SelectItem>
                        <SelectItem value="phrase">Điền cụm từ (2-3 từ)</SelectItem>
                        <SelectItem value="sentence">Điền câu</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <div className="mt-2 text-xs text-gray-500">
                    Chọn mức độ khó dictation cho học sinh yếu
                  </div>
                </div>
              )}
            />

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
    <div className="mt-2 space-y-4">
      <Input
        id="audio"
        type="file"
        accept="audio/*"
        onChange={handleAudioChange}
        className="py-2"
        disabled={loadingState.status === 'uploading' || loadingState.status === 'processing'}
      />
      <FormDescription>
        Tải lên tệp âm thanh cho bài dictation. Hỗ trợ các định dạng MP3, WAV, M4A (tối đa {FILE_SIZE_LIMIT / (1024 * 1024)}MB).
      </FormDescription>
      
      {audioFile && (
        <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm text-green-600">
                <span className="font-medium">Đã tải lên:</span> {audioFile.name}
              </div>
              <span className="text-xs text-gray-500">
                ({(audioFile.size / (1024 * 1024)).toFixed(2)}MB)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAudioFile(null);
                setLoadingState({ status: 'idle', progress: 0 });
                form.setValue('script', '');
              }}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerateTranscript}
              disabled={transcriptState !== 'idle'}
              className="relative"
            >
              {transcriptState !== 'idle' ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {transcriptState === 'uploading' ? 'Đang tải lên...' :
                     transcriptState === 'processing' ? 'Đang xử lý...' :
                     transcriptState === 'completed' ? 'Hoàn thành' : 'Lỗi'}
                  </span>
                </div>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Tạo transcript tự động
                </>
              )}
            </Button>
            
            {/* Bỏ nút "Tạo transcript mẫu" */}
            
          </div>

          {transcriptState !== 'idle' && transcriptState !== 'completed' && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {transcriptState === 'uploading' ? 'Đang tải lên file...' :
                   transcriptState === 'processing' ? 'Đang xử lý transcript...' : 'Lỗi'}
                </span>
                <span className="text-sm text-gray-500">{loadingState.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    loadingState.status === 'completed' ? 'bg-green-600' :
                    loadingState.status === 'error' ? 'bg-red-600' :
                    'bg-blue-600'
                  }`}
                  style={{ width: `${loadingState.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
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
    if (isSubmitting) {
      const resetTimer = setTimeout(() => {
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
  const [vocabularyItems, setVocabularyItems] = useState<VocabularyItem[]>([]);
  const [editingVocabulary, setEditingVocabulary] = useState<VocabularyItem | null>(null);
  const [isVocabDialogOpen, setIsVocabDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');

  // Thêm API lấy từ loại (POS) từ proxy server
  const getPosTag = async (word: string): Promise<string> => {
    try {
      console.log("Getting POS tag for:", word);
      
      // Gọi API từ proxy server để lấy từ loại
      const response = await fetch(`http://localhost:3000/api/get-pos?word=${encodeURIComponent(word)}`);
      
      if (!response.ok) {
        console.error("Error fetching POS:", response.statusText);
        return 'noun'; // Default fallback
      }
      
      const data = await response.json();
      console.log("POS tagging result:", data);
      
      if (data && data.partOfSpeech) {
        return data.partOfSpeech;
      }
      
      return 'noun'; // Default fallback
    } catch (error) {
      console.error("Error getting POS tag:", error);
      return 'noun'; // Default fallback
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
      image_url: null
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

  // Hàm dịch nghĩa từ vựng sang tiếng Việt
  const translateToLocalVietnamese = async (text: string) => {
    try {
      console.log("Translating:", text);
      
      // Sử dụng từ điển có sẵn để tránh gọi API quá nhiều
      const mockMeaning = getMockVietnameseMeaning(text);
      if (mockMeaning !== `Nghĩa tiếng Việt của "${text}"`) {
        console.log("Using pre-defined meaning for:", text);
        return mockMeaning;
      }
      
      // Sử dụng hàm dịch an toàn từ lib/supabase
      console.log("Using safe translation function");
      const result = await translateToVietnamese(text);
      
      console.log("Translation result:", result);
      return result;
    } catch (error) {
      console.error("Translation error:", error);
      return `Nghĩa tiếng Việt của "${text}"`;
    }
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

  // Cập nhật hàm generateVocabulary để sử dụng hàm dịch mới
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
        image_url: null
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

  return (
    <TooltipProvider delayDuration={0}>
    <TeacherLayout>
      <div className="max-w-4xl mx-auto animate-slide-up">
          <div className="mb-4 flex justify-between items-center">
            <div>
          <h1 className="text-3xl font-bold text-gray-900">Tạo câu hỏi mới</h1>
          <p className="text-gray-600 mt-1">Tạo bài tập dictation mới cho học sinh của bạn</p>
        </div>
            <div className="flex space-x-2">
              <Button
                variant="outline" 
                onClick={resetForm}
                className="flex items-center"
                type="button" 
                size="sm"
              >
                Đặt lại
              </Button>
              <Button 
                variant="outline"
                onClick={clearCache}
                className="flex items-center"
                type="button"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Xóa Cache & Làm mới
              </Button>
            </div>
        </div>
        
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Form submitted directly, bypassing validation");
              
              if (isSubmitting) {
                console.log("Already submitting, skipping");
                return;
              }
              
              // Kiểm tra điều kiện tối thiểu
              if (!audioFile) {
                toast.error("Vui lòng chọn file audio");
                return;
              }
              
              const values = form.getValues();
              onSubmit(values);
            }} 
            className="space-y-4"
          >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiêu đề</FormLabel>
                      <FormControl>
                        <Input placeholder="Nhập tiêu đề bài tập" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div>
                  <FormLabel htmlFor="audio">Tệp âm thanh</FormLabel>
                  {renderFileUpload()}
                </div>
                
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

            <div className="space-y-8 mt-8">
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">Cài đặt nâng cao</h2>
                
                  <div className="space-y-6">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="student-settings">
                      <AccordionTrigger className="text-lg font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          <span>Phân loại học sinh theo năng lực</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="mb-6">
                          <Alert className="bg-blue-50">
                            <Info className="h-5 w-5 text-blue-600" />
                            <AlertTitle>Tính năng tự động phân loại học sinh</AlertTitle>
                            <AlertDescription>
                              Hệ thống sẽ tự động áp dụng các cài đặt khác nhau dựa trên phân loại học sinh (Tốt, Trung bình, Yếu).
                              Bạn có thể tùy chỉnh các cài đặt cho từng nhóm học sinh bên dưới.
                            </AlertDescription>
                          </Alert>
                        </div>
                        
                        {/* Luôn hiển thị cài đặt phân loại học sinh */}
                        {renderStudentSettings()}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="vocabulary-settings">
                      <AccordionTrigger className="text-lg font-medium">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-green-600" />
                          <span>Học từ vựng</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        {renderVocabularySettings()}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="anti-cheating">
                      <AccordionTrigger className="text-lg font-medium">
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-red-600" />
                          <span>Chống gian lận</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                    <FormField
                      control={form.control}
                        name="enableAntiCheating"
                      render={({ field }) => (
                            <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md mb-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                      <div className="transition-colors hover:text-red-500">
                                        <ShieldAlert className="h-5 w-5" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p>Bật hệ thống chống gian lận khi làm bài</p>
                                  </TooltipContent>
                                </Tooltip>
                                  <span className="font-medium">Bật chế độ chống gian lận</span>
                              </div>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </div>
                          </div>
                        )}
                      />

                      {form.watch("enableAntiCheating") && (
                          <div className="space-y-4">
                    <FormField
                      control={form.control}
                            name="maxCheatingAttempts"
                      render={({ field }) => (
                              <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="transition-all hover:scale-105">
                                          <History className="h-5 w-5 text-amber-500" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Số lần cảnh báo tối đa trước khi kết thúc bài làm</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <span className="font-medium">Số lần cảnh báo tối đa</span>
                                  </div>
                          <FormControl>
                                    <Slider
                                      defaultValue={[field.value]}
                                      value={[field.value]}
                                        max={5}
                                      min={1}
                                      step={1}
                                      onValueChange={(value) => field.onChange(value[0])}
                                      className="mt-2"
                                      />
                                    </FormControl>
                                  <div className="mt-2 text-sm text-gray-500 text-right">{field.value} lần</div>
                              </div>
                            )}
                          />

                    <FormField
                      control={form.control}
                              name="enableMouseLeaveDetection"
                      render={({ field }) => (
                                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                          <div className="transition-all hover:scale-105">
                                            <MousePointer2 className="h-5 w-5 text-blue-500" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Phát hiện khi người dùng chuyển sang tab hoặc ứng dụng khác</p>
                                      </TooltipContent>
                                    </Tooltip>
                                      <span className="font-medium">Phát hiện rời trang</span>
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
                              name="enableMultipleIPDetection"
                      render={({ field }) => (
                                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                          <div className="transition-all hover:scale-105">
                                            <Globe2 className="h-5 w-5 text-green-500" />
                          </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Phát hiện khi có nhiều địa chỉ IP truy cập cùng một tài khoản</p>
                                      </TooltipContent>
                                    </Tooltip>
                                      <span className="font-medium">Phát hiện nhiều IP</span>
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
                              name="enableMultipleTabPrevention"
                      render={({ field }) => (
                                <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                          <div className="transition-all hover:scale-105">
                                            <Layout className="h-5 w-5 text-purple-500" />
                          </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Ngăn chặn mở nhiều tab cùng một lúc</p>
                                      </TooltipContent>
                                    </Tooltip>
                                      <span className="font-medium">Chống mở nhiều tab</span>
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
                              name="cheatingWarningMessage"
                              render={({ field }) => (
                          <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                  <div className="flex items-center gap-2 mb-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                        <div className="transition-all hover:scale-105">
                                          <AlertOctagon className="h-5 w-5 text-red-500" />
                                    </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Thông báo hiển thị khi phát hiện gian lận. Sử dụng {"{{attempts}}"} để hiển thị số lần cảnh báo còn lại.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <span className="font-medium">Thông báo cảnh báo</span>
                                  </div>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      className="min-h-20"
                                    />
                                  </FormControl>
                                </div>
                              )}
                            />
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="general-settings">
                      <AccordionTrigger className="text-lg font-medium">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-5 w-5 text-gray-600" />
                          <span>Cài đặt chung</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="minimumPassingScore"
                            render={({ field }) => (
                              <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                <div className="flex items-center gap-2 mb-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="transition-all hover:scale-105">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                  </div>
                                </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Điểm tối thiểu để đạt</p>
                                </TooltipContent>
                              </Tooltip>
                                  <span className="font-medium">Điểm đạt tối thiểu</span>
                                </div>
                                <FormControl>
                                  <Slider
                                    defaultValue={[field.value]}
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
                            name="allowRetry"
                            render={({ field }) => (
                              <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                        <div className="transition-all hover:scale-105">
                                          <Ban className="h-5 w-5 text-orange-500" />
                                    </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Cho phép làm lại bài nếu không đạt điểm tối thiểu</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <span className="font-medium">Cho phép làm lại</span>
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
                            name="unlimitedTime"
                            render={({ field }) => (
                              <div className="rounded-lg border bg-white p-4 transition-all hover:shadow-md">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="transition-all hover:scale-105">
                                          <Timer className="h-5 w-5 text-purple-500" />
                                  </div>
                                </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Không giới hạn thời gian làm bài</p>
                                </TooltipContent>
                              </Tooltip>
                                    <span className="font-medium">Không giới hạn thời gian</span>
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
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4 mt-8 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                className="bg-gray-100 hover:bg-gray-200"
                disabled={isSubmitting}
                onClick={() => {
                  console.log("Reset form");
                  form.reset({
                    title: '',
                    script: '',
                  });
                  setAudioFile(null);
                  setVocabularyItems([]);
                }}
              >
                Làm mới
              </Button>
              
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
                disabled={isSubmitting}
                onClick={async () => {
                  console.log("Tạo câu hỏi button clicked");
                  
                  if (isSubmitting) {
                    console.log("Already submitting, skipping");
                    return;
                  }
                  
                  // Kiểm tra điều kiện tối thiểu
                  if (!audioFile) {
                    toast.error("Vui lòng chọn file audio");
                    return;
                  }
                  
                  setIsSubmitting(true);
                  const loadingToast = toast.loading("Đang xử lý...");
                  
                  try {
                    // 1. Kiểm tra session
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      throw new Error("Vui lòng đăng nhập");
                    }
                    
                    console.log("1. Session verified:", session.user.id);
                    
                    // 2. Upload file sử dụng hàm đơn giản
                    const uploadResult = await simpleUploadFile(audioFile, session.user.id);
                    
                    if (!uploadResult.success) {
                      throw new Error("Lỗi tải file: " + uploadResult.error);
                    }
                    
                    console.log("2. File uploaded successfully:", uploadResult.url);
                    
                    // 3. Get form values
                    const values = form.getValues();
                    
                    // 4. Insert question với dữ liệu tối thiểu
                    const questionData = {
                      title: values.title || "Câu hỏi mới",
                      script: values.script || "Nội dung",
                      audio_url: uploadResult.url,
                      created_by: session.user.id,
                      require_vocabulary_practice: vocabularyItems.length > 0 // Thêm trường này để đánh dấu có yêu cầu học từ vựng
                    };
                    
                    console.log("3. Inserting question data:", questionData);
                    
                    const { data: insertedQuestion, error: insertError } = await supabase
                      .from('questions')
                      .insert(questionData)
                      .select();
                    
                    if (insertError) {
                      throw new Error("Lỗi tạo câu hỏi: " + insertError.message);
                    }
                    
                    if (!insertedQuestion || insertedQuestion.length === 0) {
                      throw new Error("Không nhận được dữ liệu câu hỏi sau khi tạo");
                    }
                    
                    console.log("4. Question created successfully:", insertedQuestion[0].id);
                    
                    // 5. Save vocabulary items if available
                    if (vocabularyItems.length > 0) {
                      const question_id = insertedQuestion[0].id;
                      
                      const vocabToInsert = vocabularyItems.map(item => ({
                        question_id: question_id,
                        word: item.word,
                        part_of_speech: item.part_of_speech || null,
                        meaning_vi: item.meaning_vi,
                        image_url: item.image_url || null,
                        audio_start_time: item.audio_start_time || null,
                        audio_end_time: item.audio_end_time || null
                      }));
                      
                      console.log("5. Inserting vocabulary items:", vocabToInsert.length);
                      
                      const { error: vocabError } = await supabase
                        .from('vocabulary_items')
                        .insert(vocabToInsert);
                        
                      if (vocabError) {
                        console.warn("Lỗi khi lưu từ vựng:", vocabError);
                        toast.error("Câu hỏi đã được tạo nhưng có lỗi khi lưu từ vựng");
                      } else {
                        console.log("6. Vocabulary items saved successfully");
                        toast.success("Đã lưu từ vựng thành công!");
                      }
                    }
                    
                    // Success
                    toast.success("Tạo câu hỏi thành công!");
                    console.log("Process completed successfully");
                    
                    // Navigate after success
                    setTimeout(() => {
                      navigate('/teacher/dashboard');
                    }, 1500);
                    
                  } catch (err: any) {
                    console.error("Error during submission:", err);
                    toast.error(err.message || "Lỗi không xác định khi tạo câu hỏi");
                  } finally {
                    toast.dismiss(loadingToast);
                    setIsSubmitting(false);
                  }
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {"Đang xử lý..."}
                  </>
                ) : (
                  'Tạo câu hỏi'
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

export default CreateQuestion;
