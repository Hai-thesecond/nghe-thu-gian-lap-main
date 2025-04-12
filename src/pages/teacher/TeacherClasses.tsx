import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GraduationCap, Users, BookOpen, Plus, Pencil, Trash2, RefreshCw, Copy, ChevronRight } from 'lucide-react';
import TeacherLayout from '@/layouts/TeacherLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Class schema
const classSchema = z.object({
  name: z.string().min(2, {
    message: "Tên lớp phải có ít nhất 2 ký tự",
  }),
  description: z.string().optional(),
  custom_code: z.boolean().default(false),
  class_code: z.string().optional(),
});

interface Class {
  id: string;
  name: string;
  description: string | null;
  class_code: string;
  teacher_id: string;
  created_at: string;
  student_count?: number;
  assignment_count?: number;
}

const TeacherClasses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Form for creating/editing class
  const form = useForm<z.infer<typeof classSchema>>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      description: '',
      custom_code: false,
      class_code: '',
    },
  });

  // Watch for custom_code changes
  const useCustomCode = form.watch('custom_code');

  // Query to fetch teacher's classes
  const { 
    data: classes, 
    isLoading,
    error, 
    refetch 
  } = useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // For each class, get student and assignment counts
      const classesWithCounts = await Promise.all((data || []).map(async (classItem) => {
        // Get student count
        const { count: studentCount, error: studentError } = await supabase
          .from('student_classes')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classItem.id)
          .eq('is_active', true);
          
        if (studentError) {
          console.error('Error fetching student count:', studentError);
        }
        
        // Get assignment count
        const { count: assignmentCount, error: assignmentError } = await supabase
          .from('class_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classItem.id)
          .eq('is_active', true);
          
        if (assignmentError) {
          console.error('Error fetching assignment count:', assignmentError);
        }
        
        return {
          ...classItem,
          student_count: studentCount || 0,
          assignment_count: assignmentCount || 0,
        };
      }));
      
      return classesWithCounts as Class[];
    },
    enabled: !!user?.id,
  });

  // Mutation to create class
  const createClassMutation = useMutation({
    mutationFn: async (values: z.infer<typeof classSchema>) => {
      if (!user) throw new Error('User not authenticated');
      
      // Generate class code if not custom
      const classCode = values.custom_code && values.class_code 
        ? values.class_code 
        : generateClassCode();
      
      // Check if class code already exists (if custom)
      if (values.custom_code && values.class_code) {
        const { count, error: countError } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('class_code', values.class_code);
          
        if (countError) throw countError;
        
        if (count && count > 0) {
          throw new Error('Mã lớp học đã tồn tại, vui lòng chọn mã khác');
        }
      }
      
      // Create class
      const { data, error } = await supabase
        .from('classes')
        .insert([{
          name: values.name,
          description: values.description || null,
          class_code: classCode,
          teacher_id: user.id,
        }])
        .select();
        
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      toast.success('Tạo lớp học thành công');
      setIsCreateModalOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['teacher-classes', user?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể tạo lớp học');
    },
  });

  // Mutation to update class
  const updateClassMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string, values: z.infer<typeof classSchema> }) => {
      // Check if class code already exists (if custom and changed)
      if (values.custom_code && values.class_code && values.class_code !== selectedClass?.class_code) {
        const { count, error: countError } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('class_code', values.class_code);
          
        if (countError) throw countError;
        
        if (count && count > 0) {
          throw new Error('Mã lớp học đã tồn tại, vui lòng chọn mã khác');
        }
      }
      
      // Update class
      const { data, error } = await supabase
        .from('classes')
        .update({
          name: values.name,
          description: values.description || null,
          class_code: values.custom_code && values.class_code 
            ? values.class_code 
            : selectedClass?.class_code || generateClassCode(),
        })
        .eq('id', id)
        .select();
        
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      toast.success('Cập nhật lớp học thành công');
      setIsEditModalOpen(false);
      setSelectedClass(null);
      queryClient.invalidateQueries({ queryKey: ['teacher-classes', user?.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể cập nhật lớp học');
    },
  });

  // Mutation to delete class
  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id)
        .select();
        
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      toast.success('Xóa lớp học thành công');
      setIsDeleteModalOpen(false);
      setSelectedClass(null);
      queryClient.invalidateQueries({ queryKey: ['teacher-classes', user?.id] });
    },
    onError: (error) => {
      console.error('Error deleting class:', error);
      toast.error('Không thể xóa lớp học');
    },
  });

  // Handle create form submission
  const onCreateSubmit = (values: z.infer<typeof classSchema>) => {
    createClassMutation.mutate(values);
  };

  // Handle edit form submission
  const onEditSubmit = (values: z.infer<typeof classSchema>) => {
    if (!selectedClass) return;
    updateClassMutation.mutate({ id: selectedClass.id, values });
  };

  // Generate random class code
  const generateClassCode = () => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  // Reset form for creating new class
  const openCreateModal = () => {
    form.reset({
      name: '',
      description: '',
      custom_code: false,
      class_code: '',
    });
    setIsCreateModalOpen(true);
  };

  // Set up form for editing class
  const openEditModal = (classItem: Class) => {
    setSelectedClass(classItem);
    form.reset({
      name: classItem.name,
      description: classItem.description || '',
      custom_code: false,
      class_code: classItem.class_code,
    });
    setIsEditModalOpen(true);
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

  // Copy class code to clipboard
  const copyClassCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Đã sao chép mã lớp học vào clipboard');
  };

  return (
    <TeacherLayout>
      <div className="container mx-auto p-6">
        <div className="flex flex-col space-y-6">
          {/* Header and actions */}
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lớp học</h1>
              <p className="text-gray-600 mt-1">Quản lý các lớp học và học sinh của bạn</p>
            </div>
            <Button 
              onClick={openCreateModal}
              className="mt-4 md:mt-0"
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo lớp học mới
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
                  <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
                </Button>
              </CardContent>
            </Card>
          ) : classes?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Bạn chưa có lớp học nào</p>
                <Button onClick={openCreateModal}>
                  <Plus className="mr-2 h-4 w-4" /> Tạo lớp học mới
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes?.map((classItem) => (
                <Card key={classItem.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-bold">{classItem.name}</CardTitle>
                      <div className="flex">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(classItem)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Sửa lớp học</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedClass(classItem);
                                  setIsDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Xóa lớp học</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <CardDescription>
                      Tạo ngày {formatDate(classItem.created_at)}
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
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">Mã lớp:</span>
                        <Badge className="bg-primary text-primary-foreground">
                          {classItem.class_code}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="ml-1 h-7 w-7"
                          onClick={() => copyClassCode(classItem.class_code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-2 grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/teacher/classes/${classItem.id}/students`)}
                      className="w-full justify-between"
                    >
                      <span>Học sinh</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/teacher/classes/${classItem.id}/assignments`)}
                      className="w-full justify-between"
                    >
                      <span>Bài tập</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Class Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo lớp học mới</DialogTitle>
            <DialogDescription>
              Điền thông tin để tạo lớp học mới. Học sinh sẽ nhập mã lớp học để tham gia.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên lớp học</FormLabel>
                    <FormControl>
                      <Input placeholder="Ví dụ: Lớp 10A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả (không bắt buộc)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Nhập mô tả về lớp học..." 
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="custom_code"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Tùy chỉnh mã lớp học</FormLabel>
                      <FormDescription>
                        Nếu không chọn, hệ thống sẽ tự động tạo mã lớp học
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {useCustomCode && (
                <FormField
                  control={form.control}
                  name="class_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mã lớp học</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nhập mã lớp học (6-8 ký tự)" 
                          {...field}
                          maxLength={8}
                          className="uppercase"
                        />
                      </FormControl>
                      <FormDescription>
                        Mã lớp học gồm 6-8 ký tự (chữ hoa, số)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={createClassMutation.isPending}>
                  {createClassMutation.isPending ? 'Đang tạo...' : 'Tạo lớp học'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Class Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa lớp học</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin lớp học
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên lớp học</FormLabel>
                    <FormControl>
                      <Input placeholder="Ví dụ: Lớp 10A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả (không bắt buộc)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Nhập mô tả về lớp học..." 
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="custom_code"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Tùy chỉnh mã lớp học</FormLabel>
                      <FormDescription>
                        Thay đổi mã lớp học hiện tại
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {useCustomCode && (
                <FormField
                  control={form.control}
                  name="class_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mã lớp học mới</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nhập mã lớp học (6-8 ký tự)" 
                          {...field}
                          maxLength={8}
                          className="uppercase"
                        />
                      </FormControl>
                      <FormDescription>
                        Mã lớp học gồm 6-8 ký tự (chữ hoa, số)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={updateClassMutation.isPending}>
                  {updateClassMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa lớp học</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa lớp học "{selectedClass?.name}"? Thao tác này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Hủy
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedClass && deleteClassMutation.mutate(selectedClass.id)}
              disabled={deleteClassMutation.isPending}
            >
              {deleteClassMutation.isPending ? 'Đang xóa...' : 'Xóa lớp học'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
};

export default TeacherClasses; 