import React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import TeacherLayout from '@/layouts/TeacherLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase, UserProfile } from '@/lib/supabase';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface StudentCategory {
  student_id: string;
  category: string;
  category_display: string;
  average_score: number;
}

interface StudentWithStats extends UserProfile {
  completionRate: number;
  completedCount: number;
  totalAssignments: number;
  cheatingAttempts: number;
  answersCount: number;
}

const StudentsList = () => {
  const { user } = useAuth();
  
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students-with-categories'],
    queryFn: async () => {
      if (!user) return { students: [], categories: [], completionData: [] };
      
      const [studentsResponse, categoriesResponse, classAssignmentsResponse, studentAnswersResponse] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .order('full_name', { ascending: true }),
        
        supabase
          .from('student_categories')
          .select('student_id, category, category_display, average_score'),
        
        supabase
          .from('class_assignments')
          .select('id, class_id, question_id'),
        
        supabase
          .from('student_answers')
          .select('id, student_id, question_id, is_completed, score, cheating_detected')
      ]);
      
      let students = [];
      let categories = [];
      let classAssignments = [];
      let studentAnswers = [];
      
      if (studentsResponse.status === 'fulfilled' && studentsResponse.value.data) {
        students = studentsResponse.value.data;
      }
      
      if (categoriesResponse.status === 'fulfilled' && categoriesResponse.value.data) {
        categories = categoriesResponse.value.data;
      }
      
      if (classAssignmentsResponse.status === 'fulfilled' && classAssignmentsResponse.value.data) {
        classAssignments = classAssignmentsResponse.value.data;
      }
      
      if (studentAnswersResponse.status === 'fulfilled' && studentAnswersResponse.value.data) {
        studentAnswers = studentAnswersResponse.value.data;
      }
      
      const studentsWithStats = students.map((student: UserProfile) => {
        const studentCompletedAnswers = studentAnswers.filter(
          (answer: any) => answer.student_id === student.id && answer.is_completed
        );
        
        const totalAssignments = classAssignments.length;
        
        const completedCount = studentCompletedAnswers.length;
        
        const completionRate = totalAssignments > 0 
          ? Math.round((completedCount / totalAssignments) * 100) 
          : 0;
        
        const cheatingAttempts = studentAnswers.filter(
          (answer: any) => answer.student_id === student.id && answer.cheating_detected
        ).length;
        
        const answersCount = studentAnswers.filter(
          (answer: any) => answer.student_id === student.id
        ).length;
        
        return {
          ...student,
          completionRate,
          completedCount,
          totalAssignments,
          cheatingAttempts,
          answersCount
        };
      });
      
      return { 
        students: studentsWithStats as StudentWithStats[], 
        categories: categories as StudentCategory[] 
      };
    },
  });
  
  const students = studentsData?.students || [];
  const studentCategories = studentsData?.categories || [];

  const getStudentCategory = (student: any) => {
    if (student.category?.category) {
      return { 
        label: student.category.category_display, 
        value: student.category.category,
        color: getCategoryColor(student.category.category),
        isManual: true
      };
    }

    if (!student.results || student.results.length < 5) {
      return { label: 'Yếu', value: 'poor', color: 'bg-red-100 text-red-800', isManual: false };
    }

    let totalScore = 0;
    let count = 0;
    student.results.forEach((result: any) => {
      if (result.score !== null) {
        totalScore += result.score;
        count++;
      }
    });
    const avgScore = count > 0 ? totalScore / count : 0;

    if (avgScore > 90) return { label: 'Tốt', value: 'good', color: 'bg-green-100 text-green-800', isManual: false };
    if (avgScore >= 80) return { label: 'Trung bình', value: 'average', color: 'bg-blue-100 text-blue-800', isManual: false };
    if (avgScore >= 70) return { label: 'Yếu', value: 'poor', color: 'bg-red-100 text-red-800', isManual: false };
    return { label: 'Yếu', value: 'poor', color: 'bg-red-100 text-red-800', isManual: false };
  };
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'average':
        return 'bg-blue-100 text-blue-800';
      case 'poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const metrics = [
    { title: 'Tổng số học sinh', value: students?.length || 0, description: 'Số lượng học sinh đã đăng ký' },
    { title: 'Hoạt động', value: students?.length || 0, description: 'Học sinh đã làm bài trong 7 ngày qua' },
    { title: 'Đang chờ phê duyệt', value: '0', description: 'Yêu cầu tham gia chưa được phê duyệt' },
  ];

  return (
    <TeacherLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Học sinh</h1>
          <p className="text-gray-600 mt-1">Quản lý và theo dõi tiến độ của học sinh</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric, index) => (
            <Card key={index} className="dashboard-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{metric.title}</CardTitle>
                <CardDescription>{metric.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metric.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle>Danh sách học sinh</CardTitle>
            <CardDescription>Tất cả học sinh đã đăng ký vào hệ thống</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : students && students.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Học sinh</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Trình độ</TableHead>
                      <TableHead>Hoàn thành</TableHead>
                      <TableHead>Gian lận</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                      return (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarImage src={student.avatar_url} />
                                <AvatarFallback className="bg-primary text-white">
                                  {getInitials(student.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{student.full_name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const categoryInfo = getStudentCategory(student);
                                return (
                                  <Badge className={`${categoryInfo.color} px-2 py-1`}>
                                    {categoryInfo.label}
                                  </Badge>
                                );
                              })()}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 rounded-full hover:bg-gray-100 border border-gray-200 flex items-center justify-center" 
                                title={getStudentCategory(student).isManual ? "Quay lại tính toán tự động" : "Đang sử dụng tính toán tự động"}
                                onClick={async () => {
                                  const categoryInfo = getStudentCategory(student);
                                  
                                  if (!categoryInfo.isManual) {
                                    toast.info('Đã đang sử dụng tính toán tự động');
                                    return;
                                  }
                                  
                                  try {
                                    const { error } = await supabase
                                      .from('student_categories')
                                      .delete()
                                      .eq('student_id', student.id);
                                    
                                    if (error) throw error;
                                    
                                    toast.success('Đã cập nhật về chế độ tính toán tự động');
                                    
                                    const updatedStudents = students.map(s => {
                                      if (s.id === student.id) {
                                        const updatedStudent = {...s};
                                        delete updatedStudent.category;
                                        return updatedStudent;
                                      }
                                      return s;
                                    });
                                    
                                    setTimeout(() => {
                                      window.location.reload();
                                    }, 300);
                                  } catch (error) {
                                    console.error('Error resetting student level:', error);
                                    toast.error('Không thể cập nhật trình độ học sinh');
                                  }
                                }}
                              >
                                <RefreshCw className={`h-3 w-3 ${!getStudentCategory(student).isManual ? "text-gray-400" : "text-blue-500"}`} />
                              </Button>
                              {student.answersCount < 5 && (
                                <span className="ml-1 text-xs text-amber-600">
                                  (thiếu dữ liệu)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full" 
                                  style={{ width: `${student.completionRate}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium">{student.completionRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm ${student.cheatingAttempts > 0 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                              {student.cheatingAttempts} lần
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link to={`/teacher/student/${student.id}`}>
                              <Button variant="outline" size="sm">Chi tiết</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <p className="text-gray-500">Chưa có học sinh nào đăng ký</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
};

export default StudentsList;
