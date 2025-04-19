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

export default function SimpleUploadForm() {
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

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
      const newQuestion = {
        title: title.trim(),
        script: script.trim(),
        audio_url: publicUrl,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        difficulty: 'easy',
        blanks_count: 5,
        time_limit: 5
      };
      
      console.log('Creating question record...', newQuestion);
      
      const { data, error: insertError } = await supabase
        .from('questions')
        .insert(newQuestion);
      
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
                      Đang tải lên...
                    </span>
                  ) : (
                    'Tải lên'
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