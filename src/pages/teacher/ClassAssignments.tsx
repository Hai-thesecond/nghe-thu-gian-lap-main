import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronLeft, Search, Book, AlertCircle, Calendar as CalendarIcon2, Trash2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import TeacherLayout from '@/layouts/TeacherLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ClassDetails {
  id: string;
  name: string;
  description: string | null;
  class_code: string;
  teacher_id: string;
}

interface Question {
  id: string;
  title: string;
  difficulty: string;
  created_at: string;
  audio_url: string;
}

interface ClassAssignment {
  id: string;
  class_id: string;
  question_id: string;
  assigned_at: string;
  due_date: string | null;
  is_active: boolean;
  question: Question;
  completed_count?: number;
  total_students?: number;
}

// Assignment form schema
const assignmentSchema = z.object({
  question_id: z.string({
    required_error: "Vui lòng chọn bài tập",
  }),
  due_date: z.date().optional(),
});

const ClassAssignments = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ClassAssignment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form for assigning exercise
  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      question_id: '',
    },
  });

  // Reset form when opening modal
  useEffect(() => {
    if (isAssignModalOpen) {
      form.reset({
        question_id: '',
        due_date: undefined,
      });
    }
  }, [isAssignModalOpen, form]);

  // Query to fetch class details
  const { 
    data: classDetails, 
    isLoading: isClassLoading,
    error: classError
  } = useQuery({
    queryKey: ['class-details', id],
    queryFn: async () => {
      if (!id || !user) return null;
      
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .eq('teacher_id', user.id)
        .single();
        
      if (error) throw error;
      return data as ClassDetails;
    },
    enabled: !!id && !!user?.id,
  });

  // Query to fetch available questions (exercises)
  const { 
    data: questions, 
    isLoading: isQuestionsLoading
  } = useQuery({
    queryKey: ['teacher-questions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('questions')
        .select('id, title, difficulty, created_at, audio_url')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data as Question[];
    },
    enabled: !!user?.id,
  });

  // Query to fetch current assignments for the class
  const { 
    data: assignments, 
    isLoading: isAssignmentsLoading, 
    error: assignmentsError,
    refetch 
  } = useQuery({
    queryKey: ['class-assignments', id],
    queryFn: async () => {
      if (!id) return [];
      
      console.log('Đang truy vấn bài tập cho lớp:', id);
      
      try {
        // Truy vấn để lấy bài tập với đầy đủ thông tin về câu hỏi
        const { data, error } = await supabase
          .from('class_assignments')
          .select('*, question:questions(*)')
          .eq('class_id', id);
          
        if (error) {
          console.error('Lỗi truy vấn bài tập:', error);
          throw error;
        }
        
        // Thêm log để debug
        console.log('Đã lấy được', data?.length || 0, 'bài tập');
        
        return data as ClassAssignment[];
      } catch (err) {
        console.error('Lỗi xử lý truy vấn:', err);
        throw err;
      }
    },
    enabled: !!id,
  });

  // Mutation to assign question to class
  const assignQuestionMutation = useMutation({
    mutationFn: async (values: z.infer<typeof assignmentSchema>) => {
      if (!id) throw new Error('Class ID is required');
      
      try {
        // Kiểm tra xem bài tập đã được giao cho lớp học này chưa
        const { data: existingAssignment, error: checkError } = await supabase
          .from('class_assignments')
          .select('id')
          .eq('class_id', id)
          .eq('question_id', values.question_id)
          .maybeSingle();
          
        if (checkError) throw checkError;
        
        if (existingAssignment) {
          throw new Error('duplicate_key: Bài tập này đã được giao cho lớp học');
        }
        
        // Giao bài tập cho lớp học
        const { data, error } = await supabase
          .from('class_assignments')
          .insert([{
            class_id: id,
            question_id: values.question_id,
            assigned_at: new Date().toISOString(),
            due_date: values.due_date ? values.due_date.toISOString() : null,
            is_active: true,
          }])
          .select();
          
        if (error) {
          // Xử lý lỗi vi phạm ràng buộc duy nhất
          if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
            throw new Error('duplicate_key: Bài tập này đã được giao cho lớp học');
          }
          throw error;
        }
        
        return data[0];
      } catch (err: any) {
        // Trả về message với prefix để xử lý ở onError
        if (err.message && typeof err.message === 'string') {
          throw new Error(err.message);
        }
        throw err;
      }
    },
    onSuccess: () => {
      toast.success('Giao bài tập thành công');
      setIsAssignModalOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['class-assignments', id] });
    },
    onError: (error: Error) => {
      // Xử lý các loại lỗi cụ thể
      if (error.message.startsWith('duplicate_key:')) {
        toast.error('Bài tập đã tồn tại', {
          description: 'Bài tập này đã được giao cho lớp học'
        });
      } else {
        toast.error(error.message || 'Không thể giao bài tập');
      }
    },
  });

  // Mutation to remove assignment
  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      // Thay vì update, thực hiện xóa hoàn toàn bản ghi
      const { data, error } = await supabase
        .from('class_assignments')
        .delete()  // Thay đổi từ update thành delete
        .eq('id', assignmentId)
        .select();
        
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      toast.success('Đã xóa bài tập');
      setIsDeleteModalOpen(false);
      setSelectedAssignment(null);
      
      // Đảm bảo query được invalidate để load lại dữ liệu
      queryClient.invalidateQueries({ queryKey: ['class-assignments', id] });
      
      // Thực hiện refetch ngay lập tức để cập nhật UI
      refetch();
    },
    onError: (error) => {
      console.error('Error deleting assignment:', error);
      toast.error('Không thể xóa bài tập: ' + (error as Error).message);
    }
  });

  // Handle assignment form submission
  const onAssignSubmit = (values: z.infer<typeof assignmentSchema>) => {
    assignQuestionMutation.mutate(values);
  };

  // Filter assignments based on search term
  const filteredAssignments = assignments?.filter(assignment => 
    assignment.question.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Không giới hạn';
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy', { locale: vi });
  };

  // Get difficulty badge color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-amber-100 text-amber-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get Vietnamese difficulty name
  const getDifficultyName = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'Dễ';
      case 'medium':
        return 'Trung bình';
      case 'hard':
        return 'Khó';
      default:
        return 'Không xác định';
    }
  };

  // Calculate completion percentage
  const getCompletionPercentage = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  // Loading and error states
  const pageLoading = isClassLoading || isAssignmentsLoading || isQuestionsLoading;
  const pageError = classError || assignmentsError;

  return (
    <TeacherLayout>
      <div className="container mx-auto p-6">
        <div className="flex flex-col space-y-6">
          {/* Header with navigation, title, and actions */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/teacher/classes')}
                className="mr-2"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {pageLoading ? 'Đang tải...' : classDetails?.name || 'Bài tập lớp học'}
                </h1>
                <p className="text-gray-600">Quản lý bài tập được giao cho lớp học</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Tìm kiếm bài tập..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button onClick={() => setIsAssignModalOpen(true)}>
                <Book className="mr-2 h-4 w-4" /> Giao bài tập
              </Button>
            </div>
          </div>

          {/* Assignment list */}
          {pageLoading ? (
            <div className="flex justify-center my-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : pageError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Không thể tải danh sách bài tập</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Thử lại
                </Button>
              </CardContent>
            </Card>
          ) : filteredAssignments?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Book className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'Không tìm thấy bài tập phù hợp' : 'Lớp học chưa có bài tập nào'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsAssignModalOpen(true)}>
                    <Book className="mr-2 h-4 w-4" /> Giao bài tập mới
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssignments?.map((assignment) => (
                <Card key={assignment.id} className="overflow-hidden border border-gray-200">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-bold">{assignment.question.title}</CardTitle>
                        <div className="flex items-center mt-1">
                          <Badge className={`${getDifficultyColor(assignment.question.difficulty)}`}>
                            {getDifficultyName(assignment.question.difficulty)}
                          </Badge>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setIsDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Hủy bài tập</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-2">
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                      <CalendarIcon2 className="h-4 w-4 mr-1" />
                      <span>Giao ngày: {formatDate(assignment.assigned_at)}</span>
                    </div>
                    
                    {assignment.due_date && (
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>Hạn nộp: {formatDate(assignment.due_date)}</span>
                      </div>
                    )}
                    
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Hoàn thành</span>
                        <span className="font-medium">
                          {assignment.completed_count}/{assignment.total_students}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${getCompletionPercentage(assignment.completed_count || 0, assignment.total_students || 0)}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate(`/teacher/results?class_id=${id}&question_id=${assignment.question_id}`)}
                    >
                      Xem kết quả
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign Exercise Modal */}
      {isAssignModalOpen && (
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Giao bài tập mới</DialogTitle>
              <DialogDescription>
                Chọn bài tập để giao cho lớp {classDetails?.name}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAssignSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="question_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bài tập</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn bài tập" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isQuestionsLoading ? (
                            <SelectItem value="loading" disabled>Đang tải...</SelectItem>
                          ) : !questions || questions.length === 0 ? (
                            <SelectItem value="none" disabled>Không có bài tập nào</SelectItem>
                          ) : (
                            questions.map((question) => {
                              // Kiểm tra xem bài tập đã được giao cho lớp học này chưa
                              const isAlreadyAssigned = assignments?.some(
                                assignment => assignment.question_id === question.id && assignment.is_active
                              );
                              
                              return (
                                <SelectItem 
                                  key={question.id} 
                                  value={question.id}
                                  disabled={isAlreadyAssigned}
                                  className={isAlreadyAssigned ? "text-gray-400" : ""}
                                >
                                  {question.title}
                                  {isAlreadyAssigned && " - Đã giao"}
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Hạn nộp (không bắt buộc)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, 'dd/MM/yyyy', { locale: vi })
                              ) : (
                                <span>Chọn ngày</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAssignModalOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button 
                    type="submit"
                    disabled={assignQuestionMutation.isPending}
                  >
                    {assignQuestionMutation.isPending ? 'Đang giao...' : 'Giao bài tập'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận hủy bài tập</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn hủy bài tập "{selectedAssignment?.question.title}" khỏi lớp học này?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Không
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedAssignment && removeAssignmentMutation.mutate(selectedAssignment.id)}
              disabled={removeAssignmentMutation.isPending}
            >
              {removeAssignmentMutation.isPending ? 'Đang hủy...' : 'Hủy bài tập'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
};

export default ClassAssignments; 