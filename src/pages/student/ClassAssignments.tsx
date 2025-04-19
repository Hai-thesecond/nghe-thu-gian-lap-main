import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, Clock, AlertCircle, Check, CheckCircle, Hourglass, Calendar } from 'lucide-react';
import StudentLayout from '@/layouts/StudentLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  is_completed: boolean;
  completed_at: string | null;
  score: number | null;
  max_score: number;
  attempt_count: number;
  rank?: number;  // Xếp hạng trong lớp
  questions: any[];
}

interface ClassDetails {
  id: string;
  name: string;
  description: string | null;
  teacher_name: string;
}

const ClassAssignments = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [studentAnswersMap, setStudentAnswersMap] = useState<Record<string, any>>({});
  const [studentRankings, setStudentRankings] = useState<Record<string, number>>({});
  
  // Fetch class details
  const { data: classDetails, isLoading: isLoadingClass } = useQuery({
    queryKey: ['class-details', id],
    queryFn: async () => {
      if (!id || !user) return null;
      
      // Get class details
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          description,
          profiles:teacher_id (full_name)
        `)
        .eq('id', id)
        .single();
        
      if (classError) throw classError;
      
      return {
        id: classData.id,
        name: classData.name,
        description: classData.description,
        teacher_name: classData.profiles?.full_name || 'Giáo viên',
      } as ClassDetails;
    },
    enabled: !!id && !!user?.id,
  });
  
  // Fetch assignments for this class
  const { 
    data: assignments, 
    isLoading: isLoadingAssignments,
    error: assignmentsError, 
  } = useQuery({
    queryKey: ['class-assignments', id, user?.id],
    queryFn: async () => {
      if (!id || !user) return [];
      
      // Get assignments for this class
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('class_assignments')
        .select(`
          id,
          question_id,
          title,
          description,
          due_date,
          created_at
        `)
        .eq('class_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
        
      if (assignmentsError) throw assignmentsError;
      
      // For each assignment, check if student has completed it
      const assignmentsWithStatus = await Promise.all((assignmentsData || []).map(async (assignment) => {
        if (!assignment.question_id) {
          return {
            ...assignment,
            is_completed: false,
            completed_at: null,
            score: null,
            max_score: 0,
            attempt_count: 0,
            questions: [],
          };
        }
        
        // Get student answers
        const { data: answers, error: answersError } = await supabase
          .from('student_answers')
          .select('*')
          .eq('student_id', user.id)
          .eq('question_id', assignment.question_id);
          
        if (answersError || !answers || answers.length === 0) {
          return {
            ...assignment,
            is_completed: false,
            completed_at: null,
            score: null,
            max_score: 10,
            attempt_count: 0,
            questions: [{ question_id: assignment.question_id }],
          };
        }
        
        const studentAnswer = answers[0];
        
        return {
          ...assignment,
          is_completed: studentAnswer.is_completed || false,
          completed_at: studentAnswer.completed_at || null,
          started_at: studentAnswer.started_at || null,
          score: studentAnswer.score || null,
          max_score: 10,
          attempt_count: studentAnswer.attempt_count || 0,
          questions: [{ question_id: assignment.question_id }],
        };
      }));
      
      return assignmentsWithStatus as Assignment[];
    },
    enabled: !!id && !!user?.id,
  });
  
  useEffect(() => {
    const fetchAllStudentAnswers = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('student_answers')
          .select('*')
          .eq('student_id', user.id);
          
        if (error) throw error;
        
        const answersMap: Record<string, any> = {};
        data?.forEach(answer => {
          answersMap[answer.question_id] = answer;
        });
        
        setStudentAnswersMap(answersMap);
      } catch (err) {
        console.error('Error fetching all student answers:', err);
      }
    };
    
    fetchAllStudentAnswers();
  }, [user?.id]);
  
  useEffect(() => {
    const fetchRankings = async () => {
      if (!user?.id || !completedQuestionIds.size) return;
      
      try {
        // Tạo object để lưu xếp hạng
        const rankings: Record<string, number> = {};
        
        // Lặp qua các câu hỏi đã hoàn thành để lấy xếp hạng
        for (const questionId of completedQuestionIds) {
          // Lấy tất cả điểm số của bài tập này, sắp xếp giảm dần
          const { data, error } = await supabase
            .from('student_answers')
            .select('id, score, student_id')
            .eq('question_id', questionId)
            .eq('is_completed', true)
            .not('score', 'is', null)
            .order('score', { ascending: false });
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            // Tìm vị trí của học sinh hiện tại
            const studentIndex = data.findIndex(item => item.student_id === user.id);
            if (studentIndex !== -1) {
              rankings[questionId] = studentIndex + 1; // +1 vì index bắt đầu từ 0
            }
          }
        }
        
        console.log('Student rankings:', rankings);
        setStudentRankings(rankings);
      } catch (err) {
        console.error('Error fetching rankings:', err);
      }
    };
    
    fetchRankings();
  }, [user?.id, completedQuestionIds]);
  
  // Thêm hàm hỗ trợ để xác định trạng thái của deadline
  const isDeadlineApproaching = (dateString: string | null) => {
    if (!dateString) return false;
    
    const deadline = new Date(dateString);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 && diffDays <= 2; // Còn 2 ngày hoặc ít hơn
  };

  const isPastDeadline = (dateString: string | null) => {
    if (!dateString) return false;
    
    const deadline = new Date(dateString);
    const now = new Date();
    
    return now > deadline;
  };

  // Cập nhật hàm formatDate để hiển thị định dạng Việt Nam
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Không có hạn';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Lấy màu sắc dựa trên trạng thái deadline
  const getDeadlineColorClass = (dateString: string | null) => {
    if (!dateString) return 'text-gray-500';
    
    if (isPastDeadline(dateString)) {
      return 'text-red-600 font-medium';
    }
    
    if (isDeadlineApproaching(dateString)) {
      return 'text-orange-600 font-medium';
    }
    
    return 'text-green-600'; // Còn nhiều thời gian
  };
  
  // Calculate status and style based on completion status
  const getAssignmentStatus = (assignment: Assignment) => {
    if (assignment.is_completed) {
      // Đã hoàn thành (có is_completed = true)
      return {
        label: 'Đã hoàn thành',
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="h-4 w-4 mr-1" />,
      };
    }
    
    if (assignment.started_at) {
      // Đã làm (có started_at nhưng is_completed = false)
      return {
        label: 'Đã làm',
        color: 'bg-yellow-100 text-yellow-800',
        icon: <Clock className="h-4 w-4 mr-1" />,
      };
    }
    
    // Chưa làm (không có started_at)
    return {
      label: 'Chưa làm',
      color: 'bg-blue-100 text-blue-800',
      icon: <BookOpen className="h-4 w-4 mr-1" />,
    };
  };
  
  // Filter assignments based on search term
  const filteredAssignments = assignments?.filter(assignment => 
    assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (assignment.description && assignment.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Start an assignment
  const startAssignment = (assignment: Assignment) => {
    // Currently just navigate to the first question
    if (assignment.questions && assignment.questions.length > 0) {
      navigate(`/student/question/${assignment.questions[0].question_id}`);
    } else {
      toast.error('Bài tập này không có câu hỏi nào');
    }
  };
  
  // Loading and error states
  const isLoading = isLoadingClass || isLoadingAssignments;
  const error = assignmentsError;
  
  return (
    <StudentLayout>
      <div className="container mx-auto p-6">
        <div className="flex flex-col space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="mr-2" 
                onClick={() => navigate('/student/classes')}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Quay lại
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isLoadingClass ? 'Đang tải...' : classDetails?.name}
                </h1>
                <p className="text-gray-500">
                  {classDetails?.teacher_name ? `GV: ${classDetails.teacher_name}` : 'Bài tập trong lớp học'}
                </p>
              </div>
            </div>
            
            <div className="mt-4 md:mt-0 w-full md:w-64">
              <div className="relative">
                <Input
                  placeholder="Tìm kiếm bài tập..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          {/* Assignments list */}
          {isLoading ? (
            <div className="flex justify-center my-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                <p className="text-gray-500 mb-4">Không thể tải danh sách bài tập</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Thử lại
                </Button>
              </CardContent>
            </Card>
          ) : filteredAssignments?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">
                  {searchTerm 
                    ? 'Không tìm thấy bài tập phù hợp với từ khóa tìm kiếm' 
                    : 'Lớp học này chưa có bài tập nào'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Danh sách bài tập</CardTitle>
                <CardDescription>
                  Các bài tập trong lớp học này ({filteredAssignments?.length} bài tập)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tiêu đề</TableHead>
                        <TableHead>Mô tả</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Số lần làm</TableHead>
                        <TableHead>Điểm</TableHead>
                        <TableHead>Xếp hạng</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments?.map((assignment) => {
                        const status = getAssignmentStatus(assignment);
                        const isExpired = assignment.due_date && new Date(assignment.due_date) < new Date();
                        const answerDetails = studentAnswersMap[assignment.question_id];
                        const isCompleted = answerDetails?.is_completed || false;
                        const hasStarted = answerDetails?.started_at != null;
                        const attemptCount = answerDetails?.attempt_count || 0;
                        const score = answerDetails?.score;
                        const ranking = studentRankings[assignment.question_id];
                        
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">{assignment.title}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {assignment.description || 'Không có mô tả'}
                            </TableCell>
                            <TableCell>
                              {assignment.due_date ? (
                                <div className="flex flex-col">
                                  <span className={getDeadlineColorClass(assignment.due_date)}>
                                    {formatDate(assignment.due_date)}
                                  </span>
                                  {isPastDeadline(assignment.due_date) && !assignment.is_completed && (
                                    <span className="text-red-500 text-xs mt-1">Đã quá hạn</span>
                                  )}
                                  {isDeadlineApproaching(assignment.due_date) && !assignment.is_completed && (
                                    <span className="text-orange-500 text-xs mt-1">Sắp hết hạn</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">Không có hạn nộp</span>
                              )}
                            </TableCell>
                            <TableCell>{attemptCount}</TableCell>
                            <TableCell>
                              {assignment.is_completed ? (
                                <span className="font-medium">
                                  {assignment.score !== null && assignment.score !== undefined 
                                    ? assignment.score 
                                    : 0}/10
                                </span>
                              ) : (
                                <span className="text-gray-500">0/10</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isCompleted && ranking ? (
                                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                  #{ranking}
                                </Badge>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={status.color + " flex items-center whitespace-nowrap"}>
                                {status.icon}
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                size="sm"
                                onClick={() => startAssignment(assignment)}
                              >
                                {isCompleted ? 'Xem lại' : (hasStarted ? 'Tiếp tục' : 'Bắt đầu làm')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </StudentLayout>
  );
};

export default ClassAssignments; 