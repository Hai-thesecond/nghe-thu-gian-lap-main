import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Badge } from '@/components/ui/badge';
import { GraduationCap, BookOpen, Plus, CheckCircle2, School, Users } from 'lucide-react';
import StudentLayout from '@/layouts/StudentLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

interface ClassInfo {
  id: string;
  name: string;
  description: string | null;
  class_code: string;
  teacher_id: string;
  created_at: string;
  joined_at: string;
  teacher_name: string;
  student_count: number;
  assignment_count: number;
}

// Schema for class join
const joinClassSchema = z.object({
  class_code: z.string().min(4, {
    message: "Mã lớp quá ngắn",
  }).max(10, {
    message: "Mã lớp quá dài",
  }),
});

const ClassesJoin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  
  // Form setup
  const form = useForm<z.infer<typeof joinClassSchema>>({
    resolver: zodResolver(joinClassSchema),
    defaultValues: {
      class_code: '',
    },
  });

  // Fetch classes that student has joined
  const { 
    data: classes, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['student-classes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      console.log('Fetching classes for student', user.id);
      
      try {
        // Get classes
        const { data: studentClasses, error: studentClassesError } = await supabase
          .from('student_classes')
          .select(`
            id,
            joined_at,
            class_id,
            classes:class_id (
              id,
              name,
              description,
              class_code,
              teacher_id,
              created_at,
              profiles:teacher_id (
                full_name
              )
            )
          `)
          .eq('student_id', user.id)
          .eq('is_active', true);
          
        if (studentClassesError) {
          console.error('Error fetching classes:', studentClassesError);
          throw studentClassesError;
        }
        
        console.log('Student classes data:', studentClasses);
        
        // For each class, get student and assignment counts
        const classesWithCounts = await Promise.all((studentClasses || []).map(async (item) => {
          // Get student count
          const { count: studentCount, error: studentError } = await supabase
            .from('student_classes')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', item.class_id)
            .eq('is_active', true);
            
          if (studentError) {
            console.error('Error fetching student count:', studentError);
          }
          
          // Get assignment count
          const { count: assignmentCount, error: assignmentError } = await supabase
            .from('class_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', item.class_id)
            .eq('is_active', true);
            
          if (assignmentError) {
            console.error('Error fetching assignment count:', assignmentError);
          }
          
          return {
            id: item.classes.id,
            name: item.classes.name,
            description: item.classes.description,
            class_code: item.classes.class_code,
            teacher_id: item.classes.teacher_id,
            created_at: item.classes.created_at,
            joined_at: item.joined_at,
            teacher_name: item.classes.profiles?.full_name || 'Giáo viên',
            student_count: studentCount || 0,
            assignment_count: assignmentCount || 0,
          };
        }));
        
        return classesWithCounts as ClassInfo[];
      } catch (error) {
        console.error('Error in fetching classes:', error);
        throw error;
      }
    },
    enabled: !!user?.id,
  });

  // Join a class
  const joinClassMutation = useMutation({
    mutationFn: async (values: z.infer<typeof joinClassSchema>) => {
      if (!user) throw new Error('Bạn cần đăng nhập để tham gia lớp học');
      
      console.log('Joining class with code', values.class_code);
      
      try {
        // First, find the class by code
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('id')
          .eq('class_code', values.class_code.toUpperCase())
          .single();
          
        if (classError) {
          console.error('Error finding class:', classError);
          if (classError.code === 'PGRST116') {
            throw new Error('Không tìm thấy lớp học với mã này');
          }
          throw classError;
        }
        
        console.log('Found class:', classData);
        
        // Check if already in class
        const { data: existingData, error: existingError } = await supabase
          .from('student_classes')
          .select('*')
          .eq('class_id', classData.id)
          .eq('student_id', user.id);
          
        if (existingError) {
          console.error('Error checking existing membership:', existingError);
          throw existingError;
        }
        
        console.log('Existing membership check:', existingData);
        
        if (existingData && existingData.length > 0) {
          // If already exists but inactive, update to active
          if (!existingData[0].is_active) {
            console.log('Reactivating membership');
            const { data, error } = await supabase
              .from('student_classes')
              .update({ is_active: true })
              .eq('id', existingData[0].id)
              .select();
              
            if (error) {
              console.error('Error reactivating membership:', error);
              throw error;
            }
            
            console.log('Reactivated membership:', data);
            return data[0];
          }
          
          throw new Error('Bạn đã tham gia lớp học này');
        }
        
        // Join the class
        console.log('Creating new membership');
        const { data, error } = await supabase
          .from('student_classes')
          .insert([{
            student_id: user.id,
            class_id: classData.id,
            is_active: true
          }])
          .select();
          
        if (error) {
          console.error('Error joining class:', error);
          throw error;
        }
        
        console.log('Joined class:', data);
        return data[0];
      } catch (error) {
        console.error('Error in joinClassMutation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Đã tham gia lớp học thành công');
      setIsJoinModalOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['student-classes', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error joining class:', error);
      toast.error(error.message || 'Không thể tham gia lớp học');
    },
  });

  // Handle join class form submission
  const onSubmit = (values: z.infer<typeof joinClassSchema>) => {
    joinClassMutation.mutate(values);
  };

  // Leave a class
  const leaveClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      if (!user) throw new Error('Bạn cần đăng nhập để rời lớp học');
      
      console.log('Leaving class', classId);
      
      try {
        // Soft delete - mark as inactive
        const { data, error } = await supabase
          .from('student_classes')
          .update({ is_active: false })
          .eq('class_id', classId)
          .eq('student_id', user.id)
          .select();
          
        if (error) {
          console.error('Error leaving class:', error);
          throw error;
        }
        
        console.log('Left class:', data);
        return data;
      } catch (error) {
        console.error('Error in leaveClassMutation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Đã rời khỏi lớp học');
      queryClient.invalidateQueries({ queryKey: ['student-classes', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error leaving class:', error);
      toast.error(error.message || 'Không thể rời khỏi lớp học');
    },
  });

  // View class assignments
  const viewAssignments = (classId: string) => {
    navigate(`/student/classes/${classId}/assignments`);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  return (
    <StudentLayout>
      <div className="container mx-auto p-6">
        <div className="flex flex-col space-y-6">
          {/* Header and actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lớp học của tôi</h1>
              <p className="text-gray-500">Quản lý các lớp học bạn đã tham gia</p>
            </div>
            
            <Button 
              onClick={() => setIsJoinModalOpen(true)}
              className="mt-4 md:mt-0"
            >
              <Plus className="mr-2 h-4 w-4" /> Tham gia lớp học
            </Button>
          </div>
          
          {/* Classes grid */}
          {isLoading ? (
            <div className="flex justify-center my-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-red-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <p className="text-gray-500 mb-4">Không thể tải danh sách lớp học</p>
                <Button variant="outline" onClick={() => refetch()}>
                  Thử lại
                </Button>
              </CardContent>
            </Card>
          ) : classes?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <School className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Bạn chưa tham gia lớp học nào</p>
                <Button onClick={() => setIsJoinModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Tham gia lớp học
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes?.map((classItem) => (
                <Card key={classItem.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold">{classItem.name}</CardTitle>
                    <CardDescription>
                      GV: {classItem.teacher_name}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-3 pb-2">
                    {classItem.description && (
                      <p className="text-gray-600 text-sm">
                        {classItem.description}
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{classItem.student_count} học sinh</span>
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          <span>{classItem.assignment_count} bài tập</span>
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
                      <div>
                        <span className="text-sm text-gray-500">Tham gia: </span>
                        <span className="text-sm">{formatDate(classItem.joined_at)}</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardContent className="pt-0 pb-4 flex justify-between">
                    <Button 
                      variant="outline" 
                      onClick={() => viewAssignments(classItem.id)}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Xem bài tập
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        if (window.confirm(`Bạn có chắc chắn muốn rời khỏi lớp ${classItem.name}?`)) {
                          leaveClassMutation.mutate(classItem.id);
                        }
                      }}
                    >
                      Rời lớp
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Join Class Modal */}
      <Dialog open={isJoinModalOpen} onOpenChange={setIsJoinModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tham gia lớp học</DialogTitle>
            <DialogDescription>
              Nhập mã lớp học để tham gia. Bạn cần hỏi giáo viên để lấy mã.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="class_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã lớp học</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nhập mã lớp học" 
                        {...field}
                        className="uppercase"
                      />
                    </FormControl>
                    <FormDescription>
                      Mã lớp học do giáo viên cung cấp
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setIsJoinModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={joinClassMutation.isPending}>
                  {joinClassMutation.isPending ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-0 border-white rounded-full" />
                      Đang tham gia...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Tham gia
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </StudentLayout>
  );
};

export default ClassesJoin; 