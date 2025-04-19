import React, { useState, useEffect } from 'react';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import StudentLayout from '@/layouts/StudentLayout';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ').optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  newPassword: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

const StudentProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.full_name || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Vui lòng tải lên tệp hình ảnh hợp lệ');
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Kích thước tệp không được vượt quá 5MB');
        return;
      }
      
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const updateProfile = async (values: z.infer<typeof profileSchema>) => {
    if (!user) {
      toast.error('Bạn cần đăng nhập để cập nhật hồ sơ');
      return;
    }
    
    try {
      setLoading(true);
      
      // Upload avatar if a new one was selected
      let avatarUrl = user.avatar_url;
      if (avatarFile) {
        const fileName = `avatars/${user.id}/${Date.now()}-${avatarFile.name}`;
        const { data: fileData, error: fileError } = await supabase.storage
          .from('dictation')
          .upload(fileName, avatarFile);
          
        if (fileError) throw fileError;
        
        // Get public URL for the uploaded file
        const { data: urlData } = await supabase.storage
          .from('dictation')
          .getPublicUrl(fileName);
          
        avatarUrl = urlData.publicUrl;
      }
      
      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: values.fullName,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      toast.success('Cập nhật hồ sơ thành công');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (values: z.infer<typeof passwordSchema>) => {
    try {
      setLoading(true);
      
      // In a real application, we would verify the current password first
      // For this demo, we'll just update the password
      
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });
      
      if (error) throw error;
      
      toast.success('Cập nhật mật khẩu thành công');
      passwordForm.reset();
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Có lỗi xảy ra khi cập nhật mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  // State cho dữ liệu thống kê sinh viên
  const [studentStats, setStudentStats] = useState({
    level: 'Đang tải...',
    classRank: 'Đang tải...',
    testsCompleted: 0,
    averageScore: 0,
  });

  // Hàm lấy thống kê học tập thực tế của học sinh
  useEffect(() => {
    const fetchStudentStats = async () => {
      if (!user?.id) return;
      
      try {
        // Lấy tổng số bài đã hoàn thành
        const { count: testsCompleted, error: countError } = await supabase
          .from('student_answers')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user.id)
          .eq('is_completed', true);
        
        if (countError) throw countError;
        
        // Lấy điểm trung bình
        const { data: scoreData, error: scoreError } = await supabase
          .from('student_answers')
          .select('score')
          .eq('student_id', user.id)
          .eq('is_completed', true)
          .not('score', 'is', null);
        
        if (scoreError) throw scoreError;
        
        // Tính điểm trung bình
        let averageScore = 0;
        if (scoreData && scoreData.length > 0) {
          const totalScore = scoreData.reduce((sum, item) => sum + (item.score || 0), 0);
          averageScore = Math.round(totalScore / scoreData.length);
        }
        
        // Xác định xếp hạng
        let classRank = 'N/A';
        let level = 'Mới bắt đầu';
        
        // Xếp loại trình độ dựa trên điểm trung bình
        if (averageScore >= 90) level = 'Xuất sắc';
        else if (averageScore >= 80) level = 'Giỏi';
        else if (averageScore >= 70) level = 'Khá';
        else if (averageScore >= 60) level = 'Trung bình';
        else if (averageScore > 0) level = 'Cần cải thiện';
        
        // Lấy xếp hạng thực tế trong lớp dựa trên điểm trung bình
        // 1. Lấy danh sách tất cả học sinh có vai trò "student"
        const { data: allStudents, error: studentsError } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'student');
          
        if (studentsError) throw studentsError;
        
        if (allStudents && allStudents.length > 0) {
          // 2. Tính điểm trung bình của tất cả học sinh
          const studentScoresPromises = allStudents.map(async (student) => {
            const { data: scores, error: scoresError } = await supabase
              .from('student_answers')
              .select('score')
              .eq('student_id', student.id)
              .eq('is_completed', true)
              .not('score', 'is', null);
              
            if (scoresError || !scores || scores.length === 0) {
              return { studentId: student.id, avgScore: 0 };
            }
            
            const total = scores.reduce((sum, item) => sum + (item.score || 0), 0);
            return { 
              studentId: student.id, 
              avgScore: Math.round(total / scores.length) 
            };
          });
          
          // 3. Đợi tất cả các promises hoàn thành
          const studentScores = await Promise.all(studentScoresPromises);
          
          // 4. Sắp xếp điểm từ cao đến thấp
          studentScores.sort((a, b) => b.avgScore - a.avgScore);
          
          // 5. Tìm thứ hạng của học sinh hiện tại
          const currentStudentIndex = studentScores.findIndex(s => s.studentId === user.id);
          
          if (currentStudentIndex !== -1) {
            const rank = currentStudentIndex + 1; // +1 vì index bắt đầu từ 0
            classRank = `${rank} / ${studentScores.length}`;
          }
        }
        
        // Cập nhật state với dữ liệu thực tế
        setStudentStats({
          level,
          classRank,
          testsCompleted: testsCompleted || 0,
          averageScore,
        });
      } catch (error) {
        console.error('Error fetching student stats:', error);
        toast.error('Không thể tải thông tin thống kê học tập');
      }
    };
    
    fetchStudentStats();
  }, [user]);

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto animate-slide-up">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
          <p className="text-gray-600 mt-1">Quản lý thông tin cá nhân của bạn</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card className="dashboard-card">
              <CardContent className="pt-6 flex flex-col items-center">
                <div className="relative group">
                  <Avatar className="h-32 w-32">
                    <AvatarImage src={avatarPreview || undefined} />
                    <AvatarFallback className="text-3xl bg-primary text-white">
                      {user ? getInitials(user.full_name) : 'HS'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <label 
                    htmlFor="avatar-upload" 
                    className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                  >
                    Thay đổi
                  </label>
                  <input 
                    type="file" 
                    id="avatar-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarChange}
                  />
                </div>
                
                <div className="mt-4 text-center">
                  <h3 className="text-xl font-semibold">{user?.full_name}</h3>
                  <p className="text-gray-500">{user?.email}</p>
                  <p className="mt-2 inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                    Học sinh
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg">Thống kê học tập</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Trình độ</span>
                  <Badge className="bg-green-100 text-green-800" variant="outline">
                    {studentStats.level}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Xếp hạng lớp</span>
                  <span className="font-medium">{studentStats.classRank}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bài đã hoàn thành</span>
                  <span className="font-medium">{studentStats.testsCompleted}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Điểm trung bình</span>
                  <span className="font-medium text-blue-600">{studentStats.averageScore}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-1 md:col-span-2 space-y-6">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
                <CardDescription>Cập nhật thông tin cá nhân của bạn</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(updateProfile)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Họ và tên</FormLabel>
                          <FormControl>
                            <Input placeholder="Nguyễn Văn A" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="email@example.com" 
                              disabled 
                              {...field} 
                              className="bg-gray-100"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="mt-4"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Đang cập nhật...
                        </span>
                      ) : 'Cập nhật thông tin'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Đổi mật khẩu</CardTitle>
                <CardDescription>Cập nhật mật khẩu đăng nhập của bạn</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(updatePassword)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mật khẩu hiện tại</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="******" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mật khẩu mới</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="******" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Xác nhận mật khẩu mới</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="******" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      variant="outline"
                      className="mt-4"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Đang cập nhật...
                        </span>
                      ) : 'Đổi mật khẩu'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentProfile;
