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
import {
  AlertOctagon,
  Award,
  Ban,
  BookOpen,
  Brain,
  CheckCircle,
  Eye,
  FileText,
  Glasses,
  Globe2,
  GraduationCap,
  History,
  Info,
  Layout,
  Loader2,
  MinusCircle,
  MousePointer2,
  Pencil,
  Plus,
  PlusCircle,
  School,
  Settings2,
  Shield,
  ShieldAlert,
  Timer,
  Trash2,
  Upload,
  Users,
  Volume2,
  Wand,
  Wand2,
  X,
  FilePlus2,
  UploadCloud,
  AlertTriangle,
  RefreshCw,
  Lock,
  FileIcon,
  Unlock,
  Sparkles as Magic
} from "lucide-react";
import {
  Label
} from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Client } from "@gradio/client";
import { imageGenerationService } from '@/lib/ImageGenerationService';
import { MousePointer, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// First, import the AudioPlayer component
import AudioPlayer from '@/components/AudioPlayer';
import { WordTiming as AzureWordTiming } from '@/lib/azure-speech';

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
  requireVocabularyPractice: z.boolean().default(true),
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
  definition?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
}

// Add the new callGeminiAPI function
const callGeminiAPI = async (scriptText: string, numVocab: number): Promise<VocabularyItem[]> => {
  try {
    console.log("Calling Gemini API for vocabulary generation");
    
    // Format the prompt for Gemini
    const prompt = `
Từ ngữ cảnh sau: ${scriptText}
Hãy lọc ra cho tôi ${numVocab} cụm từ collocations có nghĩa và cho tôi nghĩa tiếng việt, từ loại (chỉ lấy 1 từ loại chính), nghĩa tiếng anh (ngắn gọn), ví dụ (câu đơn giản), từ đồng nghĩa, từ trái nghĩa của các từ hoặc cụm từ dưới đây trong ngữ cảnh.
`;

    // Make the API call to Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      console.error("Error from Gemini API:", response.statusText);
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Gemini API response:", data);

    // Extract the text response
    const responseText = data.contents?.[0]?.parts?.[0]?.text;
    
    // Log more details about the response structure
    console.log("Response structure:", {
      hasContents: !!data.contents,
      contentsLength: data.contents?.length,
      hasCandidate: !!data.candidates?.[0],
      candidateContent: data.candidates?.[0]?.content
    });
    
    let extractedText = '';
    
    // Try to extract text from different possible response structures
    if (responseText) {
      extractedText = responseText;
    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      extractedText = data.candidates[0].content.parts[0].text;
    } else if (data.candidates?.[0]?.content?.text) {
      extractedText = data.candidates[0].content.text;
    }
    
    console.log("Extracted text:", extractedText ? extractedText.substring(0, 100) + "..." : "No text extracted");
    
    if (!extractedText) {
      throw new Error("No response text from Gemini API");
    }
    
    // Parse the response to extract vocabulary items
    const vocabularyItems = parseGeminiResponse(extractedText);
    return vocabularyItems;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};

// Improve the helper function to clean text content by removing asterisks and quotation marks
const cleanTextContent = (text: string): string => {
  return text
    .replace(/\*/g, '')           // Remove all asterisks (single and double)
    .replace(/["'"'"]/g, '')      // Remove all types of quotation marks
    .replace(/[_~`]/g, '')        // Remove other markdown characters
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();                      // Trim any extra whitespace
};

// Helper function to extract just the English word from potentially complex strings
const extractEnglishWord = (text: string): string => {
  // Remove any asterisks first
  let cleaned = text.replace(/\*/g, '');
  
  // Extract text before any parentheses containing Vietnamese
  const parenthesesMatch = cleaned.match(/^(.*?)\s*[\(\[].*[\)\]]|^(.*?)\s*[Nn]gh[iĩ]a/);
  if (parenthesesMatch) {
    return (parenthesesMatch[1] || parenthesesMatch[2] || cleaned).trim();
  }
  
  // Extract text before "Nghĩa tiếng Việt" or similar phrases
  const vietnameseMatch = cleaned.match(/^(.*?)\s*Nghĩa\s+tiếng\s+Việt/i);
  if (vietnameseMatch) {
    return vietnameseMatch[1].trim();
  }
  
  return cleaned.trim();
};

// Add a helper function to parse the Gemini API response
const parseGeminiResponse = (responseText: string): VocabularyItem[] => {
  try {
    const items: VocabularyItem[] = [];
    
    // Split the response by numbered items
    const itemRegex = /\d+\.\s+(.*?)(?=\d+\.|$)/gs;
    const matches = responseText.matchAll(itemRegex);
    
    for (const match of matches) {
      const content = match[1].trim();
      
      // Extract word/phrase with improved pattern matching
      const wordMatch = content.match(/^([^:]+?):/);
      if (!wordMatch) continue;
      
      // Clean and extract just the English word
      const rawWord = wordMatch[1].trim();
      const word = extractEnglishWord(rawWord);
      
      // Extract Vietnamese meaning
      const viMeaningMatch = content.match(/Nghĩa tiếng Việt:\s*(.*?)(?=Từ loại:|$)/s);
      const meaningVi = viMeaningMatch ? cleanTextContent(viMeaningMatch[1].trim()) : "";
      
      // Extract part of speech
      const posMatch = content.match(/Từ loại:\s*(.*?)(?=Nghĩa tiếng Anh:|$)/s);
      const partOfSpeech = posMatch ? cleanTextContent(posMatch[1].trim()) : "noun";
      
      // Extract English definition
      const enDefMatch = content.match(/Nghĩa tiếng Anh:\s*(.*?)(?=Ví dụ:|$)/s);
      const definition = enDefMatch ? cleanTextContent(enDefMatch[1].trim()) : "";
      
      // Extract example
      const exampleMatch = content.match(/Ví dụ:\s*(.*?)(?=Từ đồng nghĩa:|$)/s);
      const example = exampleMatch ? cleanTextContent(exampleMatch[1].trim()) : "";
      
      // Extract synonyms
      const synonymsMatch = content.match(/Từ đồng nghĩa:\s*(.*?)(?=Từ trái nghĩa:|$)/s);
      const synonyms = synonymsMatch ? cleanTextContent(synonymsMatch[1].trim()) : "";
      
      // Extract antonyms
      const antonymsMatch = content.match(/Từ trái nghĩa:\s*(.*?)$/s);
      const antonyms = antonymsMatch ? cleanTextContent(antonymsMatch[1].trim()) : "";
      
      // Skip if word is empty after cleaning
      if (!word) continue;
      
      // Create vocabulary item with all extracted information
      const vocabItem: VocabularyItem = {
        id: crypto.randomUUID(),
        word,
        part_of_speech: partOfSpeech,
        meaning_vi: meaningVi,
        audio_start_time: 0,
        audio_end_time: 0,
        image_url: null,
        definition,
        example,
        synonyms,
        antonyms: antonyms
      };
      
      items.push(vocabItem);
    }
    
    return items;
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    return [];
  }
};

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
      requireVocabularyPractice: true,
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
        definition: item.definition || null, // Thêm định nghĩa tiếng Anh
        example: item.example || null, // Thêm ví dụ
        synonyms: item.synonyms || null, // Thêm từ đồng nghĩa
        antonyms: item.antonyms || null, // Thêm từ trái nghĩa
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
    <div className="space-y-3">
      <div className="border-2 border-dashed border-gray-300 rounded-md p-3 transition-all hover:border-blue-500">
        <div className="flex items-center justify-center">
          {audioFile ? (
            // Display selected audio file inside the upload area
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileIcon className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-sm truncate max-w-[220px]">{audioFile.name}</span>
                  <Badge variant="outline" className="text-xs h-5">
                    {Math.round(audioFile.size / 1024)} KB
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setAudioFile(null)}
                  disabled={isSubmitting}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Add audio player */}
              <div className="my-2 p-2 border rounded bg-gray-50">
                <AudioPlayer 
                  audioUrl={audioFile ? URL.createObjectURL(audioFile) : null}
                  wordTimings={convertToAzureWordTiming(timingData)}
                  words={form.getValues('script')?.split(/\s+/) || []}
                />
              </div>
              
              <div className="flex gap-2 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateTranscript}
                  disabled={transcriptState === 'uploading' || transcriptState === 'processing' || isSubmitting || isTranscriptConfirmed}
                  className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 py-1 h-8"
                >
                  {transcriptState === 'uploading' || transcriptState === 'processing' ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">
                        {transcriptState === 'uploading' ? 'Đang tải lên...' : 'Đang xử lý...'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FilePlus2 className="h-3 w-3" />
                      <span className="text-xs">Tạo transcript tự động</span>
                    </div>
                  )}
                </Button>
                
                {form.getValues('script') && (
                  <Button
                    type="button"
                    variant={isTranscriptConfirmed ? "destructive" : "default"}
                    size="sm"
                    onClick={() => setIsTranscriptConfirmed(!isTranscriptConfirmed)}
                    className="flex items-center gap-2 py-1 h-8"
                  >
                    {isTranscriptConfirmed ? (
                      <>
                        <Unlock className="h-3 w-3" />
                        <span className="text-xs">Mở khóa</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        <span className="text-xs">Xác nhận</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Display upload UI when no file is selected
            <label
              htmlFor="audio-upload"
              className="cursor-pointer flex flex-col items-center justify-center w-full"
            >
              <div className="flex flex-col items-center justify-center">
                <UploadCloud className="h-6 w-6 text-gray-400 mb-1" />
                <p className="text-center text-gray-600 text-xs mb-1">Kéo và thả file âm thanh hoặc</p>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-3">Chọn file</Button>
                <Input
                  id="audio-upload"
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a"
                  className="hidden"
                  onChange={handleAudioChange}
                />
              </div>
            </label>
          )}
        </div>
      </div>
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
      
      .animate-progress-indeterminate {
        animation: progress-indeterminate 1.5s infinite linear;
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

  // Function to generate image using Hugging Face FLUX.1-schnell model
  const generateImageWithHuggingFace = async (prompt: string): Promise<string | null> => {
    try {
      console.log(`Generating image with Hugging Face for: ${prompt}`);
      toast.loading('Đang tạo hình ảnh với AI...');
      
      const client = await Client.connect("black-forest-labs/FLUX.1-schnell");
      const result = await client.predict("/infer", { 		
        prompt: prompt, 		
        seed: Math.floor(Math.random() * 1000), 		
        randomize_seed: true, 		
        width: 512, 		
        height: 512, 		
        num_inference_steps: 4, 
      });

      if (result.data && result.data[0]) {
        console.log('Generated image successfully');
        
        // The result.data[0] contains a base64 string of the image
        // We need to upload this to storage and get a URL
        const imageData = result.data[0];
        
        // Convert base64 to blob for upload
        const byteString = atob(imageData.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: 'image/png' });
        
        // Upload to Supabase storage
        const fileName = `ai-generated/${prompt.replace(/\s+/g, '-')}-${Date.now()}.png`;
        const { data, error } = await supabase.storage
          .from('vocabulary-images')
          .upload(fileName, blob, {
            contentType: 'image/png',
            cacheControl: '3600',
          });
        
        if (error) {
          console.error('Error uploading AI generated image:', error);
          toast.error('Không thể lưu hình ảnh AI đã tạo');
          return null;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('vocabulary-images')
          .getPublicUrl(fileName);
        
        toast.success('Đã tạo hình ảnh với AI thành công!');
        return urlData.publicUrl;
      }
      
      console.error('No image data returned from Hugging Face');
      return null;
    } catch (error) {
      console.error('Error generating image with Hugging Face:', error);
      toast.error('Không thể tạo hình ảnh với AI');
      return null;
    }
  };

  // Function to fetch image from Pixabay API
  const fetchPixabayImage = async (word: string): Promise<string | null> => {
    try {
      // First, clean the word by extracting just the English part
      const cleanWord = extractEnglishWord(word);
      console.log(`Fetching image for word: ${cleanWord} (original: ${word})`);
      
      const pixabayApiKey = import.meta.env.VITE_PIXABAY_API_KEY;
      if (!pixabayApiKey) {
        console.error("Pixabay API key not found in environment variables");
        toast.error("Không thể tải hình ảnh từ Pixabay: Thiếu API key");
        // Use Hugging Face as fallback
        return generateImageWithHuggingFace(cleanWord);
      }
      
      // Tìm kiếm hình ảnh liên quan đến từ vựng
      const url = `https://pixabay.com/api/?key=${pixabayApiKey}&q=${encodeURIComponent(cleanWord)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=3`;
      console.log(`Calling Pixabay API with URL: ${url.substring(0, url.indexOf('?key=') + 5)}***`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Error fetching from Pixabay: ${response.status} - ${response.statusText}`);
        toast.error(`Không thể tải hình ảnh từ Pixabay: ${response.statusText}`);
        // Use Hugging Face as fallback
        return generateImageWithHuggingFace(cleanWord);
      }
      
      const data = await response.json();
      console.log(`Pixabay results for ${cleanWord}:`, data.totalHits > 0 ? `Found ${data.totalHits} images` : "No images found");
      
      // Nếu có kết quả thì lấy URL của hình ảnh đầu tiên
      if (data.totalHits > 0) {
        const imageUrl = data.hits[0].largeImageURL;
        console.log(`Found image URL for ${cleanWord}`);
        return imageUrl;
      } else {
        console.log(`No images found for ${cleanWord}, trying simplified word`);
        // Nếu không có kết quả, thử tìm kiếm với từ đơn giản hơn hoặc một phần của từ
        // Ví dụ: "generate electricity" -> "electricity"
        const parts = cleanWord.split(' ');
        const simplifiedWord = parts.length > 1 ? parts[parts.length - 1] : cleanWord;
        
        if (simplifiedWord !== cleanWord && simplifiedWord.length > 3) {
          return fetchPixabayImage(simplifiedWord);
        }
        
        // If no images found or simplification doesn't help, use Hugging Face
        console.log(`No images found for ${cleanWord} or simplified version, using Hugging Face AI`);
        return generateImageWithHuggingFace(cleanWord);
      }
    } catch (error) {
      console.error(`Error fetching image for word ${word}:`, error);
      toast.error(`Lỗi khi tải hình ảnh cho từ "${word}"`);
      // Use Hugging Face as fallback
      const cleanWord = extractEnglishWord(word);
      return generateImageWithHuggingFace(cleanWord);
    }
  };

  // Cập nhật hàm generateVocabulary để sử dụng hàm dịch mới
  const generateVocabulary = async () => {
    if (!form.getValues('script')) {
      toast.error('Cần nhập nội dung bài đọc trước khi tạo từ vựng');
      return;
    }
    
    try {
      setIsGeneratingVocabulary(true);
      toast.loading('Đang phân tích nội dung và tạo danh sách từ vựng với Gemini AI...');
      
      // Set loading stages for better UX
      const setLoadingStage = (stage: number, message: string) => {
        setTimeout(() => {
          toast.loading(message);
        }, stage * 1000);
      };
      
      // Show progressive loading messages
      setLoadingStage(1, 'Đang phân tích văn bản...');
      setLoadingStage(3, 'Đang trích xuất từ vựng...');
      setLoadingStage(5, 'Đang dịch nghĩa và tìm ví dụ...');
      setLoadingStage(7, 'Đang tạo hình ảnh cho từ vựng...');
      
      // Lấy nội dung script
      const script = form.getValues('script');
      
      // Gọi Gemini API để tạo từ vựng
      let generatedItems: VocabularyItem[] = [];
      
      try {
        // Try using Gemini API first
        generatedItems = await callGeminiAPI(script, vocabCount);
        toast.success('Đã lấy từ vựng từ Gemini AI thành công!');
        
        // Simulate longer loading by adding delay 
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast.loading('Đang tìm hình ảnh phù hợp cho từng từ vựng...');
        
        // Fetch images for each vocabulary item
        const itemsWithImages = await Promise.all(
          generatedItems.map(async (item) => {
            // Fetch image from Pixabay
            const imageUrl = await fetchPixabayImage(item.word);
            
            return {
              ...item,
              image_url: imageUrl
            };
          })
        );
        
        // Update generated items with images
        generatedItems = itemsWithImages;
        
        // Additional delay before completion
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        toast.success('Đã tìm hình ảnh cho từ vựng thành công!');
      } catch (geminiError) {
        console.error('Lỗi khi gọi Gemini API:', geminiError);
        toast.error('Không thể sử dụng Gemini API, đang thử phương pháp thay thế...');
        
        // Fallback to the original method if Gemini API fails
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
        
        // Fetch images and get POS tags and translations in parallel
        toast.loading('Đang tìm hình ảnh cho từ vựng...');
        
        // Lấy từ loại, dịch nghĩa, và lấy hình ảnh của từng từ (song song)
        generatedItems = await Promise.all(
          tempItems.map(async (item) => {
            // Gọi song song cả 3 API
            const [posTag, meaning, imageUrl] = await Promise.all([
              getPosTag(item.word),
              translateToLocalVietnamese(item.word),
              fetchPixabayImage(item.word)
            ]);
            
            // Thông báo kết quả
            console.log(`Word: ${item.word}, POS: ${posTag}, Translation: ${meaning}, Image: ${imageUrl ? "Found" : "Not found"}`);
            
            return {
              ...item,
              part_of_speech: posTag,
              meaning_vi: meaning,
              image_url: imageUrl
            };
          })
        );
      }
      
      // Update the vocabulary items with the generated ones
      setVocabularyItems(generatedItems);
      setGeneratedVocabularyCount(generatedItems.length);
      
      toast.success(`Đã tạo ${generatedItems.length} từ vựng tự động với Gemini AI`);
      
      // Tự động bật tính năng yêu cầu học từ vựng
      form.setValue('requireVocabularyPractice', true);
    } catch (error) {
      console.error('Lỗi khi tạo từ vựng:', error);
      toast.error('Không thể tạo từ vựng tự động. Vui lòng thử lại sau.');
    } finally {
      setIsGeneratingVocabulary(false);
    }
  };

  // Add the regenerateVocabularyImage function
  const regenerateVocabularyImage = async (vocabId: string, word: string) => {
    try {
      // Show loading state for this specific item
      toast.loading(`Đang tạo lại hình ảnh cho từ "${word}"...`);
      
      // Generate a new image using the ImageGenerationService
      const imageUrl = await imageGenerationService.generateImage({
        prompt: word,
        width: 512,
        height: 512,
        randomize_seed: true
      });
      
      // Update the vocabulary item with the new image
      if (imageUrl) {
        setVocabularyItems(prev => 
          prev.map(item => 
            item.id === vocabId 
              ? { ...item, image_url: imageUrl }
              : item
          )
        );
        toast.success(`Đã tạo lại hình ảnh cho từ "${word}" thành công!`);
      } else {
        toast.error(`Không thể tạo hình ảnh cho từ "${word}"`);
      }
    } catch (error) {
      console.error('Error regenerating image:', error);
      toast.error(`Lỗi khi tạo lại hình ảnh cho từ "${word}"`);
    }
  };

  // Replace the renderVocabularySettings function with this enhanced version
  const renderVocabularySettings = () => (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-6 transition-all shadow-sm">
        <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-xl text-blue-800">Học từ vựng</span>
      </div>
          <FormField
            control={form.control}
            name="requireVocabularyPractice"
            render={({ field }) => (
          <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-700">Bắt buộc học từ vựng:</span>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
          </div>
            )}
          />
      </div>
      
        <Tabs 
          defaultValue="automatic" 
          value={vocabularyGenerationMode}
          onValueChange={(value) => setVocabularyGenerationMode(value as 'automatic' | 'manual')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger 
              value="automatic"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Tạo tự động với AI
            </TabsTrigger>
            <TabsTrigger 
              value="manual"
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              onClick={() => {
                // Only enable selection mode if we have a script
                if (form.getValues('script')) {
                  setIsSelectionModeActive(true);
                } else {
                  toast.error('Bạn cần nhập nội dung bài đọc trước khi chọn từ vựng');
                  setVocabularyGenerationMode('automatic');
                }
              }}
            >
              <MousePointer className="h-4 w-4 mr-2" />
              Chọn từ nội dung
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="automatic" className="space-y-4 animate-fadeIn">
            <div className="bg-white rounded-lg border border-blue-100 p-4">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-gray-700 font-medium">Số lượng từ vựng:</span>
                <div className="flex-1">
                  <Slider
                    defaultValue={[vocabCount]}
                    min={5}
                    max={20}
                    step={1}
                    onValueChange={(value) => setVocabCount(value[0])}
                    className="py-2"
                  />
                </div>
                <span className="text-blue-700 font-semibold w-10 text-center bg-blue-50 py-1 px-2 rounded-md">
                  {vocabCount}
                </span>
              </div>
              
              <Button 
                type="button"
                variant="default"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6"
                onClick={generateVocabulary}
                disabled={isGeneratingVocabulary || !form.getValues('script')}
              >
                {isGeneratingVocabulary ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-base font-medium">Đang tạo từ vựng...</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white/80 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Magic className="h-5 w-5" />
                    <span className="text-base font-medium">Tạo {vocabCount} từ vựng với AI</span>
                  </div>
                )}
              </Button>
              
              <p className="mt-4 text-sm text-gray-600">
                Hệ thống sẽ phân tích nội dung bài và tự động tạo danh sách từ vựng quan trọng, 
                sau đó dịch nghĩa sang tiếng Việt và tạo hình ảnh minh họa sử dụng AI.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4 animate-fadeIn">
            <div className="bg-white rounded-lg border border-amber-100 p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800 mb-1">Chọn từ vựng từ nội dung</h4>
                  <p className="text-sm text-gray-600">
                    Chọn từ và cụm từ trong nội dung bằng cách highlight chuột. Những từ được chọn sẽ xuất hiện ở đây.
                  </p>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  className="border-amber-300 text-amber-800"
                  onClick={() => setIsSelectionModeActive(!isSelectionModeActive)}
                >
                  {isSelectionModeActive ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      <span>Tắt chế độ chọn</span>
                  </>
                ) : (
                  <>
                      <MousePointer className="h-4 w-4 mr-2" />
                      <span>Bật chế độ chọn</span>
                  </>
                )}
              </Button>
              </div>
              
              {selectedVocabularyWords.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedVocabularyWords.map((word, index) => (
                      <Badge 
                        key={index} 
                        className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                      >
                        {word} 
                        <X 
                          className="h-3 w-3 ml-1 cursor-pointer" 
                          onClick={() => {
                            setSelectedVocabularyWords(prev => 
                              prev.filter((_, i) => i !== index)
                            );
                          }}
                        />
                      </Badge>
                    ))}
                </div>
                  
                  <Button
                    type="button"
                    variant="default"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-4 mt-2"
                    onClick={() => {
                      if (selectedVocabularyWords.length === 0) {
                        toast.error('Vui lòng chọn ít nhất một từ vựng');
                        return;
                      }
                      
                      // Create a modified prompt for selected words
                      const selectedWordsPrompt = `
Phân tích và cung cấp thông tin chi tiết về các từ sau đây: ${selectedVocabularyWords.join(', ')}
Cho mỗi từ, hãy cung cấp:
- Nghĩa tiếng Việt
- Từ loại (chỉ lấy 1 từ loại chính)
- Nghĩa tiếng Anh (ngắn gọn)
- Ví dụ (câu đơn giản)
- Từ đồng nghĩa
- Từ trái nghĩa
                      `;
                      
                      // Call the generateVocabulary function with the selected words
                      generateVocabularyFromSelectedWords(selectedWordsPrompt);
                    }}
                    disabled={isGeneratingVocabulary || selectedVocabularyWords.length === 0}
                  >
                    {isGeneratingVocabulary ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Đang tạo từ vựng...</span>
              </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Magic className="h-5 w-5" />
                        <span>Tạo {selectedVocabularyWords.length} từ vựng đã chọn</span>
                      </div>
                    )}
                  </Button>
                </div>
              )}
              
              {selectedVocabularyWords.length === 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Chưa có từ vựng nào được chọn</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Bật chế độ chọn và highlight các từ hoặc cụm từ trong nội dung để thêm vào danh sách từ vựng.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
          
      {/* Vocabulary Items List */}
      {vocabularyItems.length > 0 && (
        <div className="mt-8 space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
              Danh sách từ vựng ({vocabularyItems.length})
            </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={openAddVocabularyDialog}
              className="flex items-center gap-2 bg-white hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm từ mới</span>
                </Button>
              </div>
              
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {vocabularyItems.map((vocab) => (
              <div 
                key={vocab.id} 
                className="border rounded-lg p-5 hover:shadow-md transition-all bg-white hover:border-blue-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-xl text-blue-700">{vocab.word}</h4>
                    <p className="text-gray-600 italic">{vocab.part_of_speech}</p>
                  </div>
                  <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditVocabularyDialog(vocab)}
                      className="hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteVocabulary(vocab.id)}
                      className="hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                </div>
                
                {vocab.image_url && (
                  <div className="relative mb-4 rounded-md overflow-hidden shadow-sm" style={{ height: "180px" }}>
                    <img 
                      src={vocab.image_url} 
                      alt={vocab.word}
                      className="w-full h-full object-cover transition-all hover:scale-105"
                      style={{ objectPosition: "center" }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 right-2 bg-white/80 hover:bg-white shadow-sm"
                      onClick={() => regenerateVocabularyImage(vocab.id, vocab.word)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      <span className="text-xs">Tạo lại ảnh</span>
                    </Button>
                </div>
              )}
                
                <div className="space-y-3 text-sm">
                  <div className="flex">
                    <span className="w-1/3 font-medium text-blue-600">Nghĩa Tiếng Việt:</span>
                    <span className="w-2/3">{vocab.meaning_vi}</span>
            </div>
                  {vocab.definition && (
                    <div className="flex">
                      <span className="w-1/3 font-medium text-green-600">Definition:</span>
                      <span className="w-2/3">{vocab.definition}</span>
      </div>
                  )}
                  {vocab.example && (
                    <div className="flex">
                      <span className="w-1/3 font-medium text-purple-600">Example:</span>
                      <span className="w-2/3 italic">{vocab.example}</span>
                    </div>
                  )}
                  {vocab.synonyms && (
                    <div className="flex">
                      <span className="w-1/3 font-medium text-orange-600">Synonyms:</span>
                      <span className="w-2/3">{vocab.synonyms}</span>
                    </div>
                  )}
                  {vocab.antonyms && (
                    <div className="flex">
                      <span className="w-1/3 font-medium text-red-600">Antonyms:</span>
                      <span className="w-2/3">{vocab.antonyms}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Add new state for transcript confirmation
  const [isTranscriptConfirmed, setIsTranscriptConfirmed] = useState(false);
  
  // Add state for vocabulary word selection
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);
  const [selectedVocabularyWords, setSelectedVocabularyWords] = useState<string[]>([]);
  
  // Add state for vocabulary generation mode
  const [vocabularyGenerationMode, setVocabularyGenerationMode] = useState<'automatic' | 'manual'>('automatic');

  // After the generateVocabulary function, add the generateVocabularyFromSelectedWords function
  const generateVocabularyFromSelectedWords = async (customPrompt: string) => {
    if (selectedVocabularyWords.length === 0) {
      toast.error("Vui lòng chọn ít nhất một từ vựng");
      return;
    }

    setIsGeneratingVocabulary(true);
    toast.loading("Đang tạo từ vựng từ các từ đã chọn...");

    try {
      const response = await callGeminiAPI(customPrompt, "");
      
      if (!response) {
        toast.error("Không thể kết nối đến Gemini API. Vui lòng thử lại sau.");
        setIsGeneratingVocabulary(false);
        toast.dismiss();
        return;
      }

      const parsedResults = parseGeminiResponse(response);
      
      if (!parsedResults || parsedResults.length === 0) {
        toast.error("Không thể phân tích kết quả từ Gemini API. Vui lòng thử lại.");
        setIsGeneratingVocabulary(false);
        toast.dismiss();
        return;
      }

      // Process vocabulary items with images in parallel
      const newVocabItems = await Promise.all(
        parsedResults.map(async (item) => {
          const id = generateUUID();
          const imageResult = await getEnhancedImageForVocabulary(item.word, id);
          
          const newItem: VocabularyItem = {
            id: id,
            word: item.word,
            part_of_speech: item.partOfSpeech,
            meaning_vi: item.meaningVi,
            definition: item.definition,
            example: item.example,
            synonyms: item.synonyms,
            antonyms: item.antonyms,
            audio_start_time: 0,
            audio_end_time: 0,
            image_url: imageResult?.link || ""
          };
          
          return newItem;
        })
      );

      // Update vocabulary items state
      setVocabularyItems((prev) => [...prev, ...newVocabItems]);
      
      // Update form value
      if (form.getValues("vocabularyItems") === undefined) {
        form.setValue("vocabularyItems", newVocabItems);
      } else {
        form.setValue("vocabularyItems", [
          ...form.getValues("vocabularyItems"),
          ...newVocabItems,
        ]);
      }

      toast.dismiss();
      toast.success(`Đã tạo ${newVocabItems.length} từ vựng thành công!`);
      
      // Close selection mode after successful generation
      setIsSelectionModeActive(false);
      
    } catch (error) {
      console.error("Error generating vocabulary:", error);
      toast.dismiss();
      toast.error("Lỗi khi tạo từ vựng. Vui lòng thử lại sau.");
    } finally {
      setIsGeneratingVocabulary(false);
    }
  };

  // Add this function after the translateToVietnamese function
  const extractWordsFromContent = (content: string) => {
    // Clean the text to remove special characters and extract words
    const cleanContent = content.replace(/[^a-zA-Z0-9\s]/g, ' ');
    
    // Split into words and filter
    const words = cleanContent.split(/\s+/)
      .map(word => word.trim().toLowerCase())
      .filter(word => {
        // Filter out empty strings, numbers, and common English words (stopwords)
        const stopwords = ["the", "a", "an", "and", "in", "on", "at", "to", "for", "with", "by", "of", "is", "are", "was", "were"];
        return word.length > 2 && !stopwords.includes(word) && isNaN(Number(word));
      });
    
    // Remove duplicates and limit to first 30 words
    const uniqueWords = Array.from(new Set(words)).slice(0, 30);
    
    // Update state with extracted words
    setExtractedWords(uniqueWords);
  };

  // Add this state variable near the other state declarations
  const [extractedWords, setExtractedWords] = useState<string[]>([]);

  // Add this handler function to manage text selection for vocabulary
  const handleScriptSelection = () => {
    if (!isTranscriptConfirmed) return;
    
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText && selectedText.length > 0) {
      if (!isSelectionModeActive) {
        // Show a toast notification that selection mode should be enabled
        toast("Hãy bật chế độ chọn từ vựng trước khi highlight từ", {
          duration: 2000,
        });
        return;
      }
      
      // Add the word to selected words if not already there
      if (!selectedVocabularyWords.includes(selectedText)) {
        setSelectedVocabularyWords(prev => [...prev, selectedText]);
        toast.success(`Đã thêm "${selectedText}" vào danh sách từ vựng`, {
          duration: 1500,
        });
      }
    }
  };

  // Add styles for text highlighting when selection mode is active
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .highlight-enabled {
        position: relative;
        cursor: text;
      }
      .highlight-enabled::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: ${isSelectionModeActive ? 'rgba(255, 255, 255, 0)' : 'rgba(255, 255, 255, 0.7)'};
        pointer-events: ${isSelectionModeActive ? 'none' : 'auto'};
        z-index: 1;
      }
      .highlight-enabled::before {
        content: '${isSelectionModeActive ? "Chọn từ vựng bằng cách bôi đen văn bản" : "Bật chế độ chọn từ vựng để highlight từ"}';
        position: absolute;
        top: 10px;
        right: 10px;
        transform: none;
        background-color: ${isSelectionModeActive ? "rgba(234, 179, 8, 0.8)" : "rgba(100, 116, 139, 0.8)"};
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        z-index: 2;
        pointer-events: none;
        white-space: nowrap;
        display: ${isTranscriptConfirmed ? 'block' : 'none'};
      }
      
      /* Style for selected text */
      .highlight-enabled::selection,
      .highlight-enabled *::selection {
        background-color: rgba(234, 179, 8, 0.3);
        color: black;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [isTranscriptConfirmed, isSelectionModeActive]);

  // Add a helper function to convert AssemblyAI WordTiming to Azure format
  const convertToAzureWordTiming = (timings: any[] | null): AzureWordTiming[] => {
    if (!timings || !Array.isArray(timings) || timings.length === 0) {
      return [];
    }
    
    // Check if it already has the right format
    if (timings.length > 0 && 
        timings[0].hasOwnProperty('word') && 
        timings[0].hasOwnProperty('startTime') && 
        timings[0].hasOwnProperty('endTime')) {
      return timings as AzureWordTiming[];
    }
    
    // Convert from AssemblyAI format to Azure format
    return timings.map(timing => ({
      word: timing.text || '',
      startTime: (timing.start || 0) / 1000, // Convert ms to seconds
      endTime: (timing.end || 0) / 1000,     // Convert ms to seconds
    }));
  };

  return (
    <TooltipProvider delayDuration={0}>
    <TeacherLayout>
      <div className="max-w-4xl mx-auto animate-slide-up">
          <div className="mb-4">
            <div>
          <h1 className="text-3xl font-bold text-gray-900">Tạo câu hỏi mới</h1>
          <p className="text-gray-600 mt-1">Tạo bài tập dictation mới cho học sinh của bạn</p>
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
                          placeholder="Nhập nội dung..." 
                          {...field}
                          disabled={isTranscriptConfirmed}
                          className={`min-h-[200px] ${isTranscriptConfirmed ? 'bg-gray-50 cursor-text overflow-visible highlight-enabled' : ''}`}
                          style={isTranscriptConfirmed ? 
                            { resize: 'none', height: 'auto', overflow: 'visible', minHeight: '200px' } : 
                            { resize: 'vertical', minHeight: '200px' }
                          }
                          onMouseUp={isTranscriptConfirmed ? handleScriptSelection : undefined}
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
                        audio_end_time: item.audio_end_time || null,
                        definition: item.definition || null,
                        example: item.example || null,
                        synonyms: item.synonyms || null,
                        antonyms: item.antonyms || null
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

      {/* Dialog chỉnh sửa từ vựng */}
      <Dialog open={isVocabDialogOpen} onOpenChange={setIsVocabDialogOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Thêm từ vựng mới' : 'Chỉnh sửa từ vựng'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'add' 
                ? 'Nhập thông tin từ vựng mới' 
                : 'Chỉnh sửa thông tin từ vựng'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1">
                <Label htmlFor="vocab-word" className="text-right">
                  Từ vựng <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="vocab-word"
                  className="mt-1"
                  placeholder="Nhập từ vựng"
                  value={editingVocabulary?.word || ''}
                  onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, word: e.target.value} : null)}
                />
              </div>
              
              <div className="col-span-1">
                <Label htmlFor="part-of-speech" className="text-right">
                  Từ loại
                </Label>
                <Select 
                  value={editingVocabulary?.part_of_speech || 'noun'}
                  onValueChange={(value) => setEditingVocabulary(prev => prev ? {...prev, part_of_speech: value} : null)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn từ loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noun">Danh từ (noun)</SelectItem>
                    <SelectItem value="verb">Động từ (verb)</SelectItem>
                    <SelectItem value="adjective">Tính từ (adjective)</SelectItem>
                    <SelectItem value="adverb">Trạng từ (adverb)</SelectItem>
                    <SelectItem value="preposition">Giới từ (preposition)</SelectItem>
                    <SelectItem value="conjunction">Liên từ (conjunction)</SelectItem>
                    <SelectItem value="phrase">Cụm từ (phrase)</SelectItem>
                    <SelectItem value="pronoun">Đại từ (pronoun)</SelectItem>
                    <SelectItem value="interjection">Thán từ (interjection)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="meaning-vi" className="text-right">
                Nghĩa tiếng Việt <span className="text-red-500">*</span>
              </Label>
              <Input
                id="meaning-vi"
                className="mt-1"
                placeholder="Nhập nghĩa tiếng Việt"
                value={editingVocabulary?.meaning_vi || ''}
                onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, meaning_vi: e.target.value} : null)}
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="definition" className="text-right">
                Định nghĩa tiếng Anh
              </Label>
              <Input
                id="definition"
                className="mt-1"
                placeholder="Nhập định nghĩa tiếng Anh"
                value={editingVocabulary?.definition || ''}
                onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, definition: e.target.value} : null)}
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="example" className="text-right">
                Ví dụ
              </Label>
              <Input
                id="example"
                className="mt-1"
                placeholder="Nhập ví dụ"
                value={editingVocabulary?.example || ''}
                onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, example: e.target.value} : null)}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1">
                <Label htmlFor="synonyms" className="text-right">
                  Từ đồng nghĩa
                </Label>
                <Input
                  id="synonyms"
                  className="mt-1"
                  placeholder="Nhập từ đồng nghĩa"
                  value={editingVocabulary?.synonyms || ''}
                  onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, synonyms: e.target.value} : null)}
                />
              </div>
              
              <div className="col-span-1">
                <Label htmlFor="antonyms" className="text-right">
                  Từ trái nghĩa
                </Label>
                <Input
                  id="antonyms"
                  className="mt-1"
                  placeholder="Nhập từ trái nghĩa"
                  value={editingVocabulary?.antonyms || ''}
                  onChange={(e) => setEditingVocabulary(prev => prev ? {...prev, antonyms: e.target.value} : null)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1">
                <Label htmlFor="audio-start" className="text-right">
                  Thời gian bắt đầu (giây)
                </Label>
                <Input
                  id="audio-start"
                  className="mt-1"
                  type="number"
                  value={editingVocabulary?.audio_start_time || 0}
                  onChange={(e) => setEditingVocabulary(prev => prev ? 
                    {...prev, audio_start_time: parseInt(e.target.value) || 0} : null)}
                />
              </div>
              
              <div className="col-span-1">
                <Label htmlFor="audio-end" className="text-right">
                  Thời gian kết thúc (giây)
                </Label>
                <Input
                  id="audio-end"
                  className="mt-1"
                  type="number"
                  value={editingVocabulary?.audio_end_time || 0}
                  onChange={(e) => setEditingVocabulary(prev => prev ? 
                    {...prev, audio_end_time: parseInt(e.target.value) || 0} : null)}
                />
              </div>
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="image-url" className="text-right">
                URL hình ảnh
              </Label>
              <Input
                id="image-url"
                className="mt-1"
                placeholder="Nhập URL hình ảnh minh họa"
                value={editingVocabulary?.image_url || ''}
                onChange={(e) => setEditingVocabulary(prev => prev ? 
                  {...prev, image_url: e.target.value} : null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsVocabDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button 
              type="submit" 
              onClick={handleSaveVocabulary}
              disabled={!editingVocabulary?.word || !editingVocabulary?.meaning_vi}
            >
              {dialogMode === 'add' ? 'Thêm từ vựng' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
    </TooltipProvider>
  );
};

export default CreateQuestion;
