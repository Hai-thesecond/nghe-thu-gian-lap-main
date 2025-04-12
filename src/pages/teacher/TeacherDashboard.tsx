import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Trash2, 
  Play, 
  Plus, 
  RefreshCw, 
  Calendar as CalendarIcon,
  GraduationCap,
  BarChart,
  CheckCircle,
  BookOpen
} from 'lucide-react';
import TeacherLayout from '@/layouts/TeacherLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase, Question } from '@/lib/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Định nghĩa schema cho form giao bài tập
const assignmentSchema = z.object({
  class_id: z.string({
    required_error: "Vui lòng chọn lớp học",
  }),
  due_date: z.date().optional(),
});

// Định nghĩa interface cho lớp học
interface Class {
  id: string;
  name: string;
  class_code: string;
}

// Thêm interface cho kết quả bài làm học sinh
interface StudentResult {
  id: string;
  student_id: string;
  question_id: string;
  score: number;
  created_at: string;
  completed_at?: string;
  student?: {
    id: string;
    full_name: string;
  };
  question?: {
    id: string;
    title: string;
  };
  class?: {
    id: string;
    name: string;
  };
}

// Thêm interface cho bài tập đã giao
interface AssignmentWithStats {
  id: string;
  class_id: string;
  question_id: string;
  assigned_at: string;
  due_date: string | null;
  is_active: boolean;
  class?: {
    id: string;
    name: string;
    class_code: string;
  };
  question?: {
    id: string;
    title: string;
  };
  total_students: number;
  completed_count: number;
  low_score_count: number;
  completion_rate: number;
  success_rate: number;
}

const TeacherDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Thêm state để kiểm tra xem đang hiển thị tab nào
  const [activeTab, setActiveTab] = useState('questions'); // 'questions' hoặc 'results'
  
  // Thêm state để hiển thị kết quả chi tiết của một bài tập cụ thể
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  
  // State cho modal giao bài tập
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  
  // Form cho giao bài tập
  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      class_id: '',
      due_date: undefined,
    },
  });
  
  // Lấy danh sách lớp học của giáo viên
  const { 
    data: classes, 
    isLoading: isClassesLoading
  } = useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id);
        
      if (error) throw error;
      return data as Class[];
    },
    enabled: !!user,
  });
  
  // Thêm state và query để kiểm tra bài tập đã giao
  const [assignedQuestions, setAssignedQuestions] = useState<Record<string, string[]>>({});

  // Tải thông tin các bài tập đã giao
  const { data: classAssignments, isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ['class-assignments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('class_assignments')
        .select('class_id, question_id');
        
      if (error) throw error;
      
      // Tạo mapping cho bài đã giao: question_id -> [class_id1, class_id2,...]
      const assignmentMap: Record<string, string[]> = {};
      
      (data || []).forEach(assignment => {
        if (!assignmentMap[assignment.question_id]) {
          assignmentMap[assignment.question_id] = [];
        }
        assignmentMap[assignment.question_id].push(assignment.class_id);
      });
      
      setAssignedQuestions(assignmentMap);
      return data;
    },
    enabled: !!user,
  });

  // Cập nhật trạng thái is_published cho questions dựa trên assignedQuestions
  const { 
    data: questions, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['questions', user?.id],
    queryFn: async () => {
      console.log("Fetching questions for user:", user?.id);
      if (!user) {
        console.log("No user found, returning empty array");
        return [];
      }
      
      try {
        // Sửa query để không sử dụng nested relationship
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error("Error fetching questions:", error);
          throw error;
        }
        
        console.log("Questions fetched successfully:", data?.length || 0);
        return data as Question[];
      } catch (err) {
        console.error("Error in query function:", err);
        toast.error("Không thể tải câu hỏi. Vui lòng thử lại sau.");
        return [];
      }
    },
    enabled: !!user,
    retry: 2,
    staleTime: 30000, // 30 seconds
  });

  // Cập nhật thống kê số bài đã giao
  const assignedCount = Object.keys(assignedQuestions).length;

  // Thêm hàm kiểm tra lớp đã được giao bài tập chưa
  const isAssignedToClass = (questionId: string, classId: string) => {
    return assignedQuestions[questionId]?.includes(classId) || false;
  };

  // Cập nhật trong useEffect
  useEffect(() => {
    // Cập nhật trạng thái is_published cho questions dựa trên assignedQuestions
    if (questions && assignedQuestions) {
      const updatedQuestions = questions.map(q => ({
        ...q,
        is_published: !!assignedQuestions[q.id]
      }));
      // Sử dụng updatedQuestions nếu cần
    }
  }, [questions, assignedQuestions]);

  // Thêm lại đoạn code useEffect về xử lý xác thực
  useEffect(() => {
    console.log("TeacherDashboard mounted, user:", user?.id, "role:", user?.role, "authLoading:", authLoading);
    
    // Force re-render if no user after auth loading completes
    if (!authLoading && !user && retryCount < 3) {
      console.log(`No user after auth loading, retry attempt ${retryCount + 1}/3`);
      // Wait briefly before retry
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // If we've retried multiple times and still no user, redirect to login
    if (!authLoading && !user && retryCount >= 3) {
      console.log("Maximum retries reached with no user, redirecting to login");
      toast("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
      navigate('/login-teacher');
    }
  }, [user, authLoading, retryCount, navigate]);

  // Thêm useEffect để kiểm tra xem đang vào tab nào từ menu
  useEffect(() => {
    // Kiểm tra từ menu sidebar có truyền vào param nào không
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has('view') && searchParams.get('view') === 'results') {
      setActiveTab('results');
      
      // Nếu có assignment_id và class_id được truyền vào, hiển thị kết quả của assignment đó
      const assignmentId = searchParams.get('assignment_id');
      const classId = searchParams.get('class_id');
      
      if (assignmentId) {
        setSelectedAssignment(assignmentId);
      }
      
      if (classId) {
        setSelectedClass(classId);
      }
    } else {
      setActiveTab('questions');
      setSelectedAssignment(null);
      setSelectedClass(null);
    }
  }, [location.search]);

  const handleRefresh = () => {
    refetch();
    refetchResults();
    refetchAssignmentStats();
    if (selectedAssignment) {
      refetchAssignmentResults();
    }
    toast.success("Đã cập nhật dữ liệu mới nhất");
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getDifficultyText = (difficulty: string) => {
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
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Xử lý khi bấm nút Giao
  const handleAssignButton = (questionId: string) => {
    setSelectedQuestionId(questionId);
    form.reset();
    setIsAssignModalOpen(true);
  };

  // Cập nhật form xử lý giao bài tập
  const onAssignSubmit = async (values: z.infer<typeof assignmentSchema>) => {
    if (!selectedQuestionId) return;
    
    try {
      // Kiểm tra xem bài tập đã được giao cho lớp này chưa
      if (isAssignedToClass(selectedQuestionId, values.class_id)) {
        toast.error('Bài tập này đã được giao cho lớp học đã chọn', {
          description: 'Vui lòng chọn lớp học khác hoặc bài tập khác'
        });
        return;
      }

      // Giao bài tập cho lớp học
      const { error } = await supabase
        .from('class_assignments')
        .insert([{
          class_id: values.class_id,
          question_id: selectedQuestionId,
          assigned_at: new Date().toISOString(),
          due_date: values.due_date ? values.due_date.toISOString() : null,
          is_active: true,
        }]);
      
      if (error) throw error;
      
      toast.success('Đã giao bài tập thành công', {
        description: 'Học sinh có thể làm bài ngay bây giờ'
      });
      
      // Cập nhật state và đóng modal
      setAssignedQuestions(prev => {
        const updated = {...prev};
        if (!updated[selectedQuestionId]) {
          updated[selectedQuestionId] = [];
        }
        updated[selectedQuestionId].push(values.class_id);
        return updated;
      });
      setIsAssignModalOpen(false);
      refetch();
    } catch (err: any) {
      console.error('Error assigning question:', err);
      
      // Kiểm tra lỗi vi phạm ràng buộc duy nhất
      if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
        toast.error('Bài tập này đã được giao cho lớp học đã chọn', {
          description: 'Vui lòng chọn lớp học khác hoặc bài tập khác'
        });
      } else {
        toast.error('Không thể giao bài tập', {
          description: err.message || 'Đã có lỗi xảy ra, vui lòng thử lại'
        });
      }
    }
  };

  // Thêm state cho dropdown
  const [showClassDropdown, setShowClassDropdown] = useState<{[key: string]: boolean}>({});

  // Thêm function xử lý khi bấm vào nút Xem kết quả
  const handleViewResults = (questionId: string, classId: string) => {
    navigate(`/teacher/results?question_id=${questionId}&class_id=${classId}`);
    // Reset dropdown state
    setShowClassDropdown(prev => ({...prev, [questionId]: false}));
  };

  // Cập nhật renderAssignButton
  const renderAssignButton = (question: Question) => {
    // Kiểm tra xem câu hỏi đã được giao cho bất kỳ lớp nào chưa
    const isAssigned = !!assignedQuestions[question.id];
    
    return (
      <div className="inline-block relative">
        <Button 
          variant={isAssigned ? "outline" : "default"}
          size="sm"
          onClick={() => handleAssignButton(question.id)}
          className={`${
            isAssigned
              ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          {isAssigned ? (
            <>
              <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
              Đã giao
            </>
          ) : 'Giao'}
        </Button>
      </div>
    );
  };

  // Lấy danh sách bài tập đã giao và thống kê
  const {
    data: assignmentsWithStats,
    isLoading: isAssignmentsStatsLoading,
    refetch: refetchAssignmentStats
  } = useQuery({
    queryKey: ['assignments-stats', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      try {
        // Lấy tất cả các bài tập đã giao
        const { data: assignments, error: assignmentsError } = await supabase
          .from('class_assignments')
          .select(`
            id,
            class_id,
            question_id,
            assigned_at,
            due_date,
            is_active,
            classes(id, name, class_code),
            questions(id, title)
          `)
          .order('assigned_at', { ascending: false });
          
        if (assignmentsError) throw assignmentsError;
        
        // Lấy số lượng học sinh trong mỗi lớp
        const { data: studentCounts, error: studentCountsError } = await supabase
          .from('student_classes')
          .select('class_id, count')
          .eq('is_active', true)
          .select('class_id');
          
        if (studentCountsError) throw studentCountsError;
        
        // Map để đếm số học sinh theo lớp
        const classStudentCountMap: Record<string, number> = {};
        studentCounts?.forEach(sc => {
          if (!classStudentCountMap[sc.class_id]) {
            classStudentCountMap[sc.class_id] = 0;
          }
          classStudentCountMap[sc.class_id]++;
        });
        
        // Lấy danh sách học sinh đã làm bài - sửa để lấy tất cả bài làm, không chỉ đã hoàn thành
        const { data: completions, error: completionsError } = await supabase
          .from('student_answers')
          .select('id, student_id, question_id, score, created_at, completed_at')
          // Không có class_id trong bảng student_answers nên bỏ khỏi truy vấn
          .order('created_at', { ascending: false });
          
        if (completionsError) throw completionsError;
        
        // Tính toán thống kê cho mỗi bài tập - sửa cách lọc completions
        const assignmentsWithStatsData = assignments?.map(assignment => {
          // Xử lý thông tin lớp học và câu hỏi với type assertion
          let className = "Chưa xác định";
          let classCode = "";
          let questionTitle = "Chưa xác định";

          // Kiểm tra kiểu dữ liệu và trích xuất thông tin
          if (assignment.classes) {
            if (Array.isArray(assignment.classes) && assignment.classes.length > 0) {
              className = assignment.classes[0].name || "Chưa xác định";
              classCode = assignment.classes[0].class_code || "";
            } else {
              const c = assignment.classes as { name?: string; class_code?: string };
              className = c.name || "Chưa xác định";
              classCode = c.class_code || "";
            }
          }

          if (assignment.questions) {
            if (Array.isArray(assignment.questions) && assignment.questions.length > 0) {
              questionTitle = assignment.questions[0].title || "Chưa xác định";
            } else {
              const q = assignment.questions as { title?: string };
              questionTitle = q.title || "Chưa xác định";
            }
          }
          
          // Lấy tổng số học sinh trong lớp
          const totalStudents = classStudentCountMap[assignment.class_id] || 0;
          
          // Lọc các bài làm của học sinh cho bài tập này - sửa cách lọc
          const assignmentCompletions = completions?.filter(c => {
            // Kiểm tra match question_id
            const isMatchQuestion = c.question_id === assignment.question_id;
            
            // Tính tất cả bài làm có student_id
            // Không cần quan tâm completed_at có null hay không
            return isMatchQuestion && c.student_id;
          });
          
          // Số lượng unique học sinh đã làm bài
          const uniqueStudentIds = new Set(assignmentCompletions?.map(c => c.student_id) || []);
          const completedCount = uniqueStudentIds.size;
          
          // Đếm số học sinh có điểm thấp (dưới 60%)
          const lowScoreCount = assignmentCompletions?.filter(
            c => (c.score || 0) < 60
          ).length || 0;
          
          // Tính tỷ lệ hoàn thành và thành công
          const completionRate = totalStudents > 0 ? (completedCount / totalStudents) * 100 : 0;
          const successRate = completedCount > 0 ? 
            ((completedCount - lowScoreCount) / completedCount) * 100 : 0;
          
          return {
            ...assignment,
            class: {
              id: assignment.class_id,
              name: className,
              class_code: classCode
            },
            question: {
              id: assignment.question_id,
              title: questionTitle
            },
            total_students: totalStudents,
            completed_count: completedCount,
            low_score_count: lowScoreCount,
            completion_rate: completionRate,
            success_rate: successRate
          };
        });
        
        return assignmentsWithStatsData as AssignmentWithStats[];
    } catch (err) {
        console.error("Error fetching assignments stats:", err);
        toast.error("Không thể tải thông tin bài tập");
        return [];
      }
    },
    enabled: !!user && activeTab === 'results',
    refetchInterval: 300000, // Refresh mỗi 5 phút
  });
  
  // Lấy danh sách kết quả của một bài tập cụ thể
  const {
    data: assignmentResults,
    isLoading: isAssignmentResultsLoading,
    refetch: refetchAssignmentResults
  } = useQuery({
    queryKey: ['assignment-results', selectedAssignment, selectedClass],
    queryFn: async () => {
      if (!selectedAssignment || !selectedClass) return [];
      
      try {
        // Lấy danh sách học sinh trong lớp
        const { data: students, error: studentsError } = await supabase
          .from('student_classes')
          .select(`
            student_id,
            profiles:student_id(id, full_name)
          `)
          .eq('class_id', selectedClass)
          .eq('is_active', true);
          
        if (studentsError) throw studentsError;
        
        // Lấy thông tin bài tập
        const { data: assignment, error: assignmentError } = await supabase
          .from('class_assignments')
          .select(`
            id, 
            question_id,
            questions:question_id(id, title)
          `)
          .eq('id', selectedAssignment)
          .single();
          
        if (assignmentError) throw assignmentError;
        
        // Sử dụng type assertion để đảm bảo TypeScript hiểu cấu trúc
        type QuestionType = { id: string; title: string };
        const questionInfo = assignment.questions as unknown as QuestionType;
        
        // Lấy kết quả làm bài của học sinh
        const { data: answers, error: answersError } = await supabase
          .from('student_answers')
          .select(`
            id,
            student_id,
            question_id,
            score,
            created_at,
            completed_at,
            profiles(id, full_name)
          `)
          .eq('question_id', assignment.question_id)
          .order('created_at', { ascending: false });
          
        if (answersError) throw answersError;
        
        // Map kết quả học sinh
        const studentResultsMap: Record<string, StudentResult> = {};
        
        // Đưa vào map để lấy kết quả mới nhất của mỗi học sinh
        answers?.forEach(answer => {
          const studentId = answer.student_id;
          
          // Sửa lại cách lấy thông tin student từ profiles
          let studentName = "Không xác định";
          let studentId2 = answer.student_id;
          
          // Kiểm tra xem profiles có tồn tại không
          if (answer.profiles) {
            // Xử lý cả trường hợp profiles là object và array
            if (Array.isArray(answer.profiles) && answer.profiles.length > 0) {
              studentName = answer.profiles[0].full_name || "Không xác định";
              studentId2 = answer.profiles[0].id || answer.student_id;
            } else if (typeof answer.profiles === 'object') {
              // Nếu là object (không phải array)
              const p = answer.profiles as unknown as { id?: string; full_name?: string };
              studentName = p.full_name || "Không xác định";
              studentId2 = p.id || answer.student_id;
            }
          }
          
          // Nếu chưa có kết quả nào cho học sinh này
          // hoặc kết quả này mới hơn kết quả đã có
          if (!studentResultsMap[studentId] || 
              new Date(answer.created_at) > new Date(studentResultsMap[studentId].created_at)) {
            studentResultsMap[studentId] = {
              ...answer,
              student: {
                id: studentId2,
                full_name: studentName
              },
              question: {
                id: questionInfo.id,
                title: questionInfo.title
              },
              class: {
                id: selectedClass,
                name: '' // Sẽ được cập nhật sau
              }
            };
          }
        });
        
        // Lấy thông tin lớp học
        const { data: classInfo, error: classError } = await supabase
          .from('classes')
          .select('id, name')
          .eq('id', selectedClass)
          .single();
          
        if (classError) throw classError;
        
        // Tạo danh sách kết quả cuối cùng
        const results: StudentResult[] = Object.values(studentResultsMap).map(result => ({
          ...result,
          class: {
            id: selectedClass,
            name: classInfo.name
          }
        }));
        
        return results;
      } catch (err) {
        console.error("Error fetching assignment results:", err);
        toast.error("Không thể tải kết quả bài làm");
        return [];
      }
    },
    enabled: !!selectedAssignment && !!selectedClass && activeTab === 'results',
  });
  
  // Hàm xử lý khi click vào một bài tập
  const handleAssignmentClick = (assignmentId: string, classId: string) => {
    setSelectedAssignment(assignmentId);
    setSelectedClass(classId);
    
    // Cập nhật URL để lưu lại trạng thái
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('assignment_id', assignmentId);
    searchParams.set('class_id', classId);
    
    navigate(`/teacher/dashboard?view=results&assignment_id=${assignmentId}&class_id=${classId}`, { replace: true });
  };
  
  // Hàm xử lý khi quay lại danh sách bài tập
  const handleBackToAssignments = () => {
    setSelectedAssignment(null);
    setSelectedClass(null);
    
    // Xóa params khỏi URL
    navigate('/teacher/dashboard?view=results', { replace: true });
  };

  // Thêm hàm để định dạng thời gian
  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm - dd/MM/yyyy', { locale: vi });
    } catch (error) {
      return dateString;
    }
  };

  // Thêm hàm xử lý khi click vào xem chi tiết bài làm
  const handleViewStudentResult = (resultId: string) => {
    navigate(`/teacher/student-result/${resultId}`);
  };
  
  // Thêm hàm lấy màu cho điểm số
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Thêm biến refetchResults
  const { 
    data: recentResults, 
    isLoading: isResultsLoading,
    refetch: refetchResults
  } = useQuery({
    queryKey: ['recent-results', user?.id],
    queryFn: async () => {
      // Chỉ trả về danh sách trống vì chúng ta đã thay thế chức năng này
      return [] as StudentResult[];
    },
    enabled: false, // Không cần chạy query này nữa
  });

  // If still in auth loading state, show a loading spinner
  if (authLoading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="ml-4 text-gray-600">Đang xác thực...</p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {activeTab === 'questions' ? 'Câu hỏi' : 'Kết quả gần đây'}
            </h1>
            <p className="text-gray-600 mt-1">
              {activeTab === 'questions' 
                ? 'Quản lý các câu hỏi dictation của bạn'
                : 'Xem kết quả bài làm mới nhất của học sinh'}
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              disabled={isLoading}
              className="mr-2"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
            
            {activeTab === 'questions' && (
            <Link to="/teacher/create-question">
              <Button className="btn-gradient">
                <Plus className="mr-2 h-4 w-4" />
                Tạo câu hỏi
              </Button>
            </Link>
            )}
            
            {/* Thêm nút chuyển tab */}
            <Button
              variant="outline"
              onClick={() => setActiveTab(activeTab === 'questions' ? 'results' : 'questions')}
            >
              {activeTab === 'questions' ? (
                <>
                  <BarChart className="h-4 w-4 mr-2" />
                  Xem kết quả
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Xem câu hỏi
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Hiển thị nội dung tương ứng với tab đang chọn */}
        {activeTab === 'questions' ? (
          <>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <strong className="font-bold mr-1">Lỗi!</strong>
            <span className="block sm:inline">Đã xảy ra lỗi khi tải dữ liệu. Vui lòng tải lại trang.</span>
            <button 
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}
        
            {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card: Tổng số câu hỏi */}
              <Card>
                <CardContent className="flex flex-row items-center pt-6">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <BookOpen className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="ml-4">
                    <CardDescription className="text-sm font-medium text-gray-600">
                      Số lượng câu hỏi đã tạo
                    </CardDescription>
                    <CardTitle className="text-3xl font-bold">{questions?.length || 0}</CardTitle>
                  </div>
            </CardContent>
          </Card>
          
              {/* Card: Số câu hỏi đã giao */}
              <Card>
                <CardContent className="flex flex-row items-center pt-6">
                  <div className="bg-indigo-100 p-3 rounded-lg">
                    <GraduationCap className="h-8 w-8 text-indigo-500" />
                  </div>
                  <div className="ml-4">
                    <CardDescription className="text-sm font-medium text-gray-600">
                      Số lượng câu hỏi đã giao cho học sinh
                    </CardDescription>
                    <CardTitle className="text-3xl font-bold">{assignedCount || 0}</CardTitle>
                  </div>
            </CardContent>
          </Card>
          
              {/* Card: Số học sinh đã làm */}
              <Card>
                <CardContent className="flex flex-row items-center pt-6">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <BarChart className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="ml-4">
                    <CardDescription className="text-sm font-medium text-gray-600">
                      Số lượng câu hỏi học sinh đã làm
                    </CardDescription>
                    <CardTitle className="text-3xl font-bold">0</CardTitle>
                  </div>
            </CardContent>
          </Card>
        </div>
        
            {/* Bảng Questions */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle>Danh sách câu hỏi</CardTitle>
            <CardDescription>Tất cả các câu hỏi dictation đã tạo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : questions && questions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead>Độ khó</TableHead>
                      <TableHead>Số khoảng trống</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead>Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((question) => (
                      <TableRow key={question.id}>
                        <TableCell className="font-medium">{question.title}</TableCell>
                        <TableCell>
                          <Badge className={getDifficultyColor(question.difficulty)} variant="outline">
                            {getDifficultyText(question.difficulty)}
                          </Badge>
                        </TableCell>
                        <TableCell>{question.blanks_count}</TableCell>
                        <TableCell>{formatDate(question.created_at)}</TableCell>
                            <TableCell className="relative">
                          <div className="flex space-x-2">
                                {renderAssignButton(question)}
                            <Link 
                              to={`/teacher/edit-question/${question.id}`}
                              onClick={() => console.log('Navigating to edit question with ID:', question.id)}
                            >
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4 mr-1" />
                                <span>Sửa</span>
                              </Button>
                            </Link>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-500 hover:text-red-700"
                              onClick={async () => {
                                if (window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) {
                                  try {
                                    const { error } = await supabase
                                      .from('questions')
                                      .delete()
                                      .eq('id', question.id);
                                      
                                    if (error) throw error;
                                    
                                    toast.success('Đã xóa câu hỏi thành công');
                                    refetch(); // Refresh the questions list
                                  } catch (err) {
                                    console.error('Error deleting question:', err);
                                    toast.error('Không thể xóa câu hỏi. Vui lòng thử lại sau.');
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowClassDropdown(prev => ({...prev, [question.id]: !prev[question.id]}))}
                                >
                                  <BarChart className="h-4 w-4 mr-1" />
                                  Kết quả
                            </Button>
                          </div>
                              {showClassDropdown[question.id] && (
                                <div className="absolute mt-1 right-0 z-10 bg-white rounded-md shadow-lg p-2 min-w-[200px] border border-gray-200">
                                  <div className="text-sm font-medium px-2 py-1 text-gray-500">Chọn lớp học:</div>
                                  {isClassesLoading ? (
                                    <div className="px-2 py-1 text-sm text-gray-500">Đang tải...</div>
                                  ) : classes && classes.length > 0 ? (
                                    <div className="max-h-60 overflow-y-auto">
                                      {classes.map(cls => (
                                        <button
                                          key={cls.id}
                                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded-md"
                                          onClick={() => handleViewResults(question.id, cls.id)}
                                        >
                                          {cls.name} ({cls.class_code})
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="px-2 py-1 text-sm text-gray-500">Không có lớp học nào</div>
                                  )}
                                </div>
                              )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <p className="text-gray-500">Bạn chưa tạo câu hỏi nào</p>
                <p className="text-sm text-gray-400">
                  Sử dụng nút "Tạo câu hỏi" ở thanh bên để bắt đầu
                </p>
              </div>
            )}
          </CardContent>
        </Card>
          </>
        ) : (
          // Tab kết quả gần đây
          <>
            {selectedAssignment && selectedClass ? (
              // Hiển thị kết quả chi tiết của bài tập đã chọn
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <Button 
                      variant="ghost" 
                      onClick={handleBackToAssignments}
                      className="mb-2 -ml-4"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="m15 18-6-6 6-6"/></svg>
                      Quay lại danh sách
                    </Button>
                    <CardTitle className="text-xl font-bold">
                      {assignmentResults && assignmentResults[0]?.question?.title || "Kết quả bài tập"}
                    </CardTitle>
                    <CardDescription>
                      Lớp: {assignmentResults && assignmentResults[0]?.class?.name || ""}
                    </CardDescription>
      </div>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tải lại
                  </Button>
                </CardHeader>
                <CardContent>
                  {isAssignmentResultsLoading ? (
                    <div className="flex justify-center p-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : assignmentResults && assignmentResults.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Học sinh</TableHead>
                            <TableHead className="w-[180px]">Lớp</TableHead>
                            <TableHead>Bài tập</TableHead>
                            <TableHead className="w-[80px] text-right">Điểm</TableHead>
                            <TableHead className="w-[180px]">Thời gian nộp</TableHead>
                            <TableHead className="w-[100px] text-right">Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentResults.map((result) => (
                            <TableRow key={result.id} className="cursor-pointer hover:bg-gray-50">
                              <TableCell className="font-medium">
                                {result.student?.full_name || "Không xác định"}
                              </TableCell>
                              <TableCell>
                                {result.class?.name || "Không xác định"}
                              </TableCell>
                              <TableCell>
                                {result.question?.title || "Không xác định"}
                              </TableCell>
                              <TableCell className={`text-right font-bold ${getScoreColor(result.score || 0)}`}>
                                {result.score !== null && result.score !== undefined ? result.score.toFixed(1) : "N/A"}
                              </TableCell>
                              <TableCell>
                                {result.completed_at ? formatTime(result.completed_at) : formatTime(result.created_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewStudentResult(result.id);
                                  }}
                                >
                                  Xem chi tiết
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className="flex justify-center">
                        <div className="bg-blue-100 text-blue-700 rounded-full p-3">
                          <GraduationCap className="h-6 w-6" />
                        </div>
                      </div>
                      <h3 className="mt-3 text-gray-700 font-medium">Chưa có học sinh làm bài tập này</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Hãy kiểm tra lại bài tập hoặc nhắc nhở học sinh làm bài.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              // Hiển thị danh sách bài tập đã giao
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">Danh sách bài tập đã giao</CardTitle>
                    <CardDescription>Chọn một bài tập để xem kết quả chi tiết</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tải lại
                  </Button>
                </CardHeader>
                <CardContent>
                  {isAssignmentsStatsLoading ? (
                    <div className="flex justify-center p-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : assignmentsWithStats && assignmentsWithStats.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bài tập</TableHead>
                            <TableHead>Lớp</TableHead>
                            <TableHead className="text-center">Học sinh đã làm</TableHead>
                            <TableHead className="text-center">Tỷ lệ hoàn thành</TableHead>
                            <TableHead className="text-center">Tỷ lệ đạt yêu cầu</TableHead>
                            <TableHead>Ngày giao</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentsWithStats.map((assignment) => (
                            <TableRow 
                              key={assignment.id} 
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => handleAssignmentClick(assignment.id, assignment.class_id)}
                            >
                              <TableCell className="font-medium">
                                {assignment.question?.title || "Không xác định"}
                              </TableCell>
                              <TableCell>
                                {assignment.class?.name || "Không xác định"} 
                                {assignment.class?.class_code ? `(${assignment.class.class_code})` : ""}
                              </TableCell>
                              <TableCell className="text-center">
                                {assignment.completed_count}/{assignment.total_students}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-500 rounded-full" 
                                      style={{ width: `${Math.min(100, assignment.completion_rate)}%` }}
                                    ></div>
                                  </div>
                                  <span>{Math.round(assignment.completion_rate)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        assignment.success_rate >= 80 ? 'bg-green-500' : 
                                        assignment.success_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(100, assignment.success_rate)}%` }}
                                    ></div>
                                  </div>
                                  <span>{Math.round(assignment.success_rate)}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatTime(assignment.assigned_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignmentClick(assignment.id, assignment.class_id);
                                  }}
                                >
                                  Xem chi tiết
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className="flex justify-center">
                        <div className="bg-blue-100 text-blue-700 rounded-full p-3">
                          <GraduationCap className="h-6 w-6" />
                        </div>
                      </div>
                      <h3 className="mt-3 text-gray-700 font-medium">Chưa có bài tập nào được giao</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Hãy tạo câu hỏi và giao bài tập cho học sinh để xem kết quả.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      
      {/* Dialog Giao bài tập */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Giao bài tập</DialogTitle>
            <DialogDescription>
              Chọn lớp học và thời hạn để giao bài tập cho học sinh
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAssignSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="class_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lớp học</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn lớp học" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isClassesLoading ? (
                          <SelectItem value="loading" disabled>Đang tải...</SelectItem>
                        ) : classes?.length === 0 ? (
                          <SelectItem value="none" disabled>Không có lớp học nào</SelectItem>
                        ) : (
                          classes?.map((classItem) => {
                            const isAlreadyAssigned = selectedQuestionId && 
                              isAssignedToClass(selectedQuestionId, classItem.id);
                            
                            return (
                              <SelectItem 
                                key={classItem.id} 
                                value={classItem.id} 
                                disabled={isAlreadyAssigned}
                                className={isAlreadyAssigned ? "text-gray-400" : ""}
                              >
                                {classItem.name} ({classItem.class_code})
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
                  disabled={isClassesLoading || form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Giao bài tập
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
};

export default TeacherDashboard;
