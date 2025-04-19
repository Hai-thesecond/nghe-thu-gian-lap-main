import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import TeacherLayout from '@/layouts/TeacherLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useMutation } from 'react-query';
import { useQueryClient } from 'react-query';
import { useQuery } from 'react-query';
import { z } from 'zod';

export default function SimpleUploadForm() {
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submission started');

    // Validate form
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }

    if (!script.trim()) {
      toast.error('Vui lòng nhập nội dung');
      return;
    }

    if (!audioFile) {
      toast.error('Vui lòng chọn file âm thanh');
      return;
    }

    try {
      setIsSubmitting(true);
      const loadingToast = toast.loading('Đang xử lý...');

      // 1. Get the current user session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        toast.error('Vui lòng đăng nhập lại');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }
      
      const userId = sessionData.session.user.id;
      
      // 2. Upload the file
      const timestamp = Date.now();
      const filePath = `simple/${userId}/${timestamp}-${audioFile.name}`;
      
      console.log('Uploading file...', filePath);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('dictation')
        .upload(filePath, audioFile, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        console.error('File upload failed:', uploadError);
        toast.error('Không thể tải file lên');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }
      
      // 3. Get the file URL
      const { data: { publicUrl } } = supabase.storage
        .from('dictation')
        .getPublicUrl(filePath);
      
      // 4. Create the database record
      const questionData = {
        title: title.trim(),
        script: script.trim(),
        audio_url: publicUrl,
        created_by: userId,
        created_at: new Date().toISOString(),
        status: 'active',
        type: 'dictation'
      };
      
      console.log('Creating question record...', questionData);
      
      const { data: questionData, error: insertError } = await supabase
        .from('questions')
        .insert(questionData);
      
      if (insertError) {
        console.error('Database insert failed:', insertError);
        toast.error('Không thể lưu câu hỏi');
        toast.dismiss(loadingToast);
        setIsSubmitting(false);
        return;
      }
      
      // Success!
      toast.success('Tạo câu hỏi thành công!');
      toast.dismiss(loadingToast);
      
      // Navigate to the questions list
      setTimeout(() => {
        navigate('/teacher/dashboard');
      }, 1000);
      
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Đã xảy ra lỗi không mong muốn');
      setIsSubmitting(false);
    }
  };

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      // Cập nhật trạng thái
      const { data, error } = await supabase
        .from('class_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId);
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Đã hủy bài tập thành công');
      
      // Force refetch để cập nhật UI
      queryClient.invalidateQueries(['class-assignments', id]);
      
      // Hoặc tự cập nhật state locally nếu refetch không hiệu quả
      setAssignments(prev => prev.filter(a => a.id !== selectedAssignmentId));
      
      // Đóng modal
      setIsDeleteModalOpen(false);
    }
  });

  const { data: assignments } = useQuery({
    queryKey: ['class-assignments', id],
    queryFn: async () => {
      // Chỉ lấy các bài tập đang active
      const { data, error } = await supabase
        .from('class_assignments')
        .select('*, question(*)')
        .eq('class_id', id)
        .eq('is_active', true); // Chỉ lấy bài tập active

      if (error) throw error;
      return data;
    }
  });

  const assignQuestionMutation = useMutation({
    mutationFn: async (values: z.infer<typeof assignmentSchema>) => {
      try {
        if (!id) throw new Error('Class ID is required');
        
        // Log thông tin để debug
        console.log('Giao bài tập:', values, 'cho lớp:', id);
        
        // Kiểm tra xem bài tập đã được giao chưa - thêm phần debug log
        const { data: existingAssignment, error: checkError } = await supabase
          .from('class_assignments')
          .select('id')
          .eq('class_id', id)
          .eq('question_id', values.question_id)
          .eq('is_active', true)
          .maybeSingle();
        
        console.log('Kiểm tra bài tập đã tồn tại:', { existingAssignment, checkError });
          
        if (checkError) {
          console.error('Lỗi kiểm tra bài tập:', checkError);
          throw checkError;
        }
        
        if (existingAssignment) {
          throw new Error('Bài tập này đã được giao cho lớp học');
        }
        
        // Giao bài tập - đơn giản hóa và thêm log
        console.log('Bắt đầu giao bài tập');
        const { data, error } = await supabase
          .from('class_assignments')
          .insert([{
            class_id: id,
            question_id: values.question_id,
            assigned_at: new Date().toISOString(),
            due_date: values.due_date ? values.due_date.toISOString() : null,
            is_active: true
          }]);
        
        console.log('Kết quả insert:', { data, error });
        
        if (error) throw error;
        
        return { success: true };
      } catch (err) {
        console.error('Lỗi giao bài tập:', err);
        throw err;
      }
    },
    onSuccess: () => {
      toast.success('Giao bài tập thành công');
      setIsAssignModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['class-assignments', id] });
      
      // Làm mới dữ liệu ngay lập tức
      refetch();
    },
    onError: (error: any) => {
      // Hiển thị lỗi chi tiết hơn
      const errorMessage = error?.message || 'Không thể giao bài tập';
      console.error('Chi tiết lỗi:', error);
      
      toast.error('Không thể giao bài tập: ' + errorMessage);
    },
  });

  // Hàm dịch tiếng Việt sử dụng SQL Function
  const translateToVietnamese = async (text: string): Promise<string> => {
    try {
      console.log("Translating:", text);
      
      // Gọi SQL function thông qua Supabase RPC
      const { data, error } = await supabase.rpc('translate_to_vietnamese', {
        text_to_translate: text
      });
      
      if (error) {
        console.error("Translation error:", error);
        return `Nghĩa tiếng Việt của "${text}"`;
      }
      
      console.log("Translation result:", data);
      return data || `Nghĩa tiếng Việt của "${text}"`;
    } catch (error) {
      console.error("Translation error:", error);
      return `Nghĩa tiếng Việt của "${text}"`;
    }
  };

  // Hàm lấy loại từ sử dụng SQL Function
  const getWordTypeFromAPI = async (word: string): Promise<string> => {
    try {
      console.log("Getting word type for:", word);
      
      // Gọi SQL function thông qua Supabase RPC
      const { data, error } = await supabase.rpc('get_word_type', {
        word: word.toLowerCase()
      });
      
      if (error) {
        console.error("Error getting word type:", error);
        return getDefaultWordType(word); // Fallback vào hàm đơn giản
      }
      
      console.log("Word type result:", data);
      return data || 'noun';
    } catch (error) {
      console.error("Error in getWordTypeFromAPI:", error);
      return getDefaultWordType(word);
    }
  };

  // Hàm fallback để xác định loại từ khi API gặp lỗi
  const getDefaultWordType = (word: string): string => {
    if (word.endsWith('ly')) return 'adverb';
    if (word.endsWith('ing')) return 'verb';
    if (word.endsWith('ed')) return 'verb';
    if (word.endsWith('ion')) return 'noun';
    if (word.endsWith('ment')) return 'noun';
    if (word.endsWith('ity')) return 'noun';
    if (word.endsWith('ness')) return 'noun';
    if (word.endsWith('er') || word.endsWith('or')) return 'noun';
    
    return 'noun';
  };

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
      const targetWordCount = Math.min(vocabCount, uniqueWords.length);
      
      // Sao chép mảng để tránh ảnh hưởng đến mảng gốc khi shuffle
      const shuffledWords = [...uniqueWords];
      
      // Shuffle mảng (Fisher-Yates algorithm)
      for (let i = shuffledWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
      }
      
      // Lấy số lượng từ cần thiết từ đầu mảng đã shuffle
      const selectedWords = shuffledWords.slice(0, targetWordCount);
      
      console.log("Selected words:", selectedWords);
      
      // Tạo danh sách từ vựng tạm thời
      const tempItems: VocabularyItem[] = selectedWords.map((word) => ({
        id: crypto.randomUUID(),
        word: word,
        part_of_speech: 'noun', // Giá trị mặc định, sẽ được cập nhật sau
        meaning_vi: `Đang dịch...`,
        audio_start_time: Math.floor(Math.random() * 100),
        audio_end_time: Math.floor(Math.random() * 100) + 100,
        image_url: null
      }));
      
      // Cập nhật state ban đầu
      setVocabularyItems(tempItems);
      
      // Dịch nghĩa và xác định loại từ cho từng từ
      const updatedItems = await Promise.all(
        tempItems.map(async (item) => {
          // Xử lý song song cả dịch nghĩa và xác định loại từ
          const [meaning, wordType] = await Promise.all([
            translateToVietnamese(item.word),
            getWordTypeFromAPI(item.word)
          ]);
          
          return {
            ...item,
            meaning_vi: meaning,
            part_of_speech: wordType
          };
        })
      );
      
      // Cập nhật state với nghĩa đã dịch và loại từ đã xác định
      setVocabularyItems(updatedItems);
      setGeneratedVocabularyCount(updatedItems.length);
      
      toast.success(`Đã tạo ${updatedItems.length} từ vựng tự động`);
      
      // Tự động bật tính năng yêu cầu học từ vựng
      form.setValue('requireVocabularyPractice', true);
    } catch (error) {
      console.error('Lỗi khi tạo từ vựng:', error);
      toast.error('Không thể tạo từ vựng tự động. Vui lòng thử lại sau.');
    } finally {
      setIsGeneratingVocabulary(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Tạo câu hỏi đơn giản</h1>
        
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề</Label>
                <Input 
                  id="title" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề" 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="audio">Tệp âm thanh</Label>
                <Input 
                  id="audio" 
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                />
                {audioFile && (
                  <p className="text-sm text-gray-500">
                    Đã chọn: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="script">Nội dung</Label>
                <Textarea 
                  id="script" 
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Nhập nội dung" 
                  className="min-h-[150px]"
                />
              </div>
              
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting || !title || !script || !audioFile}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : (
                    'Tạo câu hỏi'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
} 