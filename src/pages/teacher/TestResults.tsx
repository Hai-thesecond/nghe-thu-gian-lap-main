import React, { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, LabelList } from 'recharts';
import { ChevronLeft, Check, X, Clock, Info, AlertCircle, Filter, Users, BarChart3, CheckCircle2, RefreshCw, Eye, CheckCircle, XCircle } from 'lucide-react';
import TeacherLayout from '@/layouts/TeacherLayout';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface AnswerData {
  question?: string;
  userAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  errorType?: string;
}

interface StudentResult {
  id: string;
  student_id: string;
  question_id: string;
  score: number;
  completedAt: string;
  student: {
    id: string;
    email: string;
    full_name: string;
  };
  answer_data?: {
    answers: AnswerData[];
    totalTime?: number;
  };
  question?: {
    title: string;
  };
  class?: {
    name: string;
    class_code: string;
  };
}

interface ClassDetails {
  id: string;
  name: string;
  class_code: string;
}

interface QuestionDetails {
  id: string;
  title: string;
  script: string;
  audio_url: string;
  difficulty: string;
  created_at: string;
}

const TestResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const classId = searchParams.get('class_id');
  const questionId = searchParams.get('question_id');
  const [activeTab, setActiveTab] = useState<string>('overview');

  // State cho filter
  const [selectedClassId, setSelectedClassId] = useState<string>(classId || 'all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(questionId || 'all');

  // Thêm state cho lọc loại lỗi
  const [errorFilterType, setErrorFilterType] = useState<string>('all');

  // Effect khi người dùng thay đổi lớp hoặc câu hỏi
  useEffect(() => {
    const params = {} as any;
    
    if (selectedClassId && selectedClassId !== 'all') {
      params.class_id = selectedClassId;
    }
    
    if (selectedQuestionId && selectedQuestionId !== 'all') {
      params.question_id = selectedQuestionId;
    }
    
    setSearchParams(params);
  }, [selectedClassId, selectedQuestionId, setSearchParams]);

  // Lấy danh sách lớp học
  const { 
    data: allClasses,
    isLoading: isAllClassesLoading 
  } = useQuery({
    queryKey: ['all-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, class_code');
        
      if (error) throw error;
      return data as ClassDetails[];
    }
  });

  // Lấy danh sách câu hỏi
  const { 
    data: allQuestions,
    isLoading: isAllQuestionsLoading 
  } = useQuery({
    queryKey: ['all-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('id, title');
        
      if (error) throw error;
      return data as QuestionDetails[];
    }
  });

  // Truy vấn thông tin lớp học
  const { 
    data: classDetails,
    isLoading: isClassLoading
  } = useQuery({
    queryKey: ['class-details', classId],
    queryFn: async () => {
      if (!classId) return null;
      
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, class_code')
        .eq('id', classId)
        .single();
        
      if (error) throw error;
      return data as ClassDetails;
    },
    enabled: !!classId
  });

  // Truy vấn thông tin câu hỏi
  const { 
    data: questionDetails,
    isLoading: isQuestionLoading
  } = useQuery({
    queryKey: ['question-details', questionId],
    queryFn: async () => {
      if (!questionId) return null;
      
      const { data, error } = await supabase
        .from('questions')
        .select('id, title, script, audio_url, difficulty, created_at')
        .eq('id', questionId)
        .single();
        
      if (error) throw error;
      return data as QuestionDetails;
    },
    enabled: !!questionId
  });

  // Truy vấn kết quả của học sinh
  const { 
    data: studentResults,
    isLoading: isResultsLoading
  } = useQuery({
    queryKey: ['student-results', classId, questionId],
    queryFn: async () => {
      try {
        console.log("Fetching results with params:", { classId, questionId });
        
        // 1. Lấy kết quả bài làm của học sinh
        let query = supabase.from('student_answers').select('*');
        
        // Lọc theo câu hỏi nếu có
        if (questionId) {
          query = query.eq('question_id', questionId);
        }
        
        // Thêm sắp xếp và giới hạn
        query = query.order('created_at', { ascending: false }).limit(50);
        
        // Thực hiện truy vấn
        const { data: results, error: resultsError } = await query;
        
        if (resultsError) {
          console.error("Error fetching student_answers:", resultsError);
          throw resultsError;
        }
        
        if (!results || results.length === 0) {
          console.log("No student results found");
          return [];
        }
        
        console.log("Found student results:", results.length);
        
        // 2. Lấy thông tin học sinh
        const studentIds = [...new Set(results.map(r => r.student_id))];
        const { data: students, error: studentsError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', studentIds);
          
        if (studentsError) {
          console.error("Error fetching student profiles:", studentsError);
          throw studentsError;
        }
        
        // 3. Lấy thông tin câu hỏi
        const questionIds = [...new Set(results.map(r => r.question_id))];
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('id, title')
          .in('id', questionIds);
          
        if (questionsError) {
          console.error("Error fetching questions:", questionsError);
          throw questionsError;
        }
        
        // 4. Lấy thông tin lớp học của các học sinh
        const { data: studentClasses, error: classesError } = await supabase
          .from('student_classes')
          .select('student_id, class_id, classes:classes(id, name, class_code)')
          .in('student_id', studentIds);
          
        if (classesError) {
          console.error("Error fetching student classes:", classesError);
          throw classesError;
        }
        
        // 5. Lọc kết quả nếu có class_id
        let filteredResults = [...results];
        if (classId) {
          const studentIdsInClass = studentClasses
            ?.filter(sc => sc.class_id === classId)
            .map(sc => sc.student_id) || [];
            
          console.log("Students in class:", studentIdsInClass.length);
          
          filteredResults = results.filter(r => 
            studentIdsInClass.includes(r.student_id)
          );
          
          console.log("Results after filtering by class:", filteredResults.length);
        }
        
        // 6. Kết hợp dữ liệu
        const formattedResults = filteredResults.map(result => {
          const student = students?.find(s => s.id === result.student_id);
          const question = questions?.find(q => q.id === result.question_id);
          
          // Tìm thông tin lớp học của học sinh này
          const studentClass = studentClasses?.find(sc => sc.student_id === result.student_id);
          const classInfo = studentClass?.classes;
          
          return {
            ...result,
            completedAt: result.created_at,
            student,
            question,
            class: classInfo
          };
        });
        
        console.log("Final results after formatting:", formattedResults.length);
        if (formattedResults.length > 0) {
          console.log("Sample result:", {
            id: formattedResults[0].id,
            student_name: formattedResults[0].student?.full_name,
            question_title: formattedResults[0].question?.title,
            class_name: formattedResults[0].class?.name
          });
        }
        
        return formattedResults as unknown as StudentResult[];
      } catch (error) {
        console.error("Error in results query:", error);
        toast.error('Không thể tải dữ liệu kết quả');
        return [];
      }
    },
    enabled: true,
    staleTime: 10000,
    retry: 2
  });

  // Chuẩn bị dữ liệu kết quả gần đây
  const recentResults = studentResults?.slice(0, 10) || [];

  // Function để tính toán phân loại điểm
  const getGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };
  
  // Function để lấy màu cho điểm
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Tính toán dữ liệu thống kê
  const stats = {
    totalStudents: studentResults?.length 
      ? new Set(studentResults.map(result => result.student_id)).size 
      : 0,
    averageScore: studentResults?.length 
      ? studentResults.reduce((acc, result) => acc + (result.score || 0), 0) / studentResults.length 
      : 0,
    completionRate: studentResults?.length ? 100 : 0
  };

  // Định nghĩa bảng màu chủ đạo của hệ thống - xanh blue
  const THEME_COLORS = {
    primary: '#3B82F6', // Blue-500
    secondary: '#60A5FA', // Blue-400
    accent: '#2563EB', // Blue-600
    light: '#DBEAFE', // Blue-100
    dark: '#1E40AF', // Blue-800
    lighter: '#EFF6FF', // Blue-50
    text: '#1E40AF', // Blue-800
  };

  // Cập nhật phần tính toán phân bố điểm số để chỉ tính mỗi học sinh một lần
  const getUniqueStudentResults = () => {
    const latestResultsByStudent = new Map();
    
    studentResults?.forEach(result => {
      const studentId = result.student_id;
      const existingResult = latestResultsByStudent.get(studentId);
      
      if (!existingResult || new Date(result.completedAt) > new Date(existingResult.completedAt)) {
        latestResultsByStudent.set(studentId, result);
      }
    });
    
    return Array.from(latestResultsByStudent.values());
  };

  const uniqueStudentResults = getUniqueStudentResults();

  // Cập nhật phân bố điểm số dựa trên kết quả học sinh duy nhất
  const scoreDistribution = [
    { 
      name: 'Xuất sắc (90-100)', 
      count: uniqueStudentResults?.filter(r => r.score >= 90).length || 0,
      color: THEME_COLORS.dark,
      label: 'Xuất sắc'
    },
    { 
      name: 'Giỏi (80-89)', 
      count: uniqueStudentResults?.filter(r => r.score >= 80 && r.score < 90).length || 0,
      color: THEME_COLORS.primary,
      label: 'Giỏi'
    },
    { 
      name: 'Khá (70-79)', 
      count: uniqueStudentResults?.filter(r => r.score >= 70 && r.score < 80).length || 0,
      color: THEME_COLORS.secondary,
      label: 'Khá'
    },
    { 
      name: 'Trung bình (60-69)', 
      count: uniqueStudentResults?.filter(r => r.score >= 60 && r.score < 70).length || 0,
      color: THEME_COLORS.light,
      label: 'TB'
    },
    { 
      name: 'Yếu (<60)', 
      count: uniqueStudentResults?.filter(r => r.score < 60).length || 0,
      color: '#E5E7EB', // Gray-200
      label: 'Yếu'
    },
  ];

  // Thêm phần trăm vào dữ liệu
  const totalUniqueStudents = uniqueStudentResults?.length || 0;
  const scoreDistributionWithPercentage = scoreDistribution.map(item => ({
    ...item,
    percentage: totalUniqueStudents > 0 ? ((item.count / totalUniqueStudents) * 100).toFixed(1) + '%' : '0%'
  }));

  // Kiểm tra loading
  const isLoading = isClassLoading || isQuestionLoading || isResultsLoading;

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch (error) {
      return dateString;
    }
  };

  // Tiêu đề trang
  const getPageTitle = () => {
    if (classId && questionId && classDetails && questionDetails) {
      return `Kết quả: ${questionDetails.title} - Lớp: ${classDetails.name}`;
    } else if (questionId && questionDetails) {
      return `Kết quả: ${questionDetails.title} - Tất cả lớp`;
    } else if (classId && classDetails) {
      return `Kết quả lớp: ${classDetails.name} - Tất cả bài tập`;
    } else {
      return 'Tất cả kết quả';
    }
  };

  // Hàm xử lý chi tiết lỗi sai
  const getErrorDetails = (result: StudentResult) => {
    if (!result.answer_data?.answers) return [];
    
    const errors = [];
    
    // Xử lý dữ liệu từ answer_data để trích xuất các lỗi
    for (const answer of result.answer_data.answers) {
      // Nếu câu trả lời sai
      if (!answer.isCorrect) {
        // Lọc theo loại lỗi nếu cần
        if (errorFilterType !== 'all' && answer.errorType !== errorFilterType) {
          continue;
        }
        
        errors.push({
          question: answer.question || 'Câu hỏi',
          wrongAnswer: answer.userAnswer || 'Không có đáp án',
          correctAnswer: answer.correctAnswer || 'Đáp án đúng',
          errorType: answer.errorType || 'unknown'
        });
      }
    }
    
    return errors.slice(0, 4); // Giới hạn hiển thị 4 lỗi
  };

  return (
    <TeacherLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="p-0 h-9 w-9"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
        <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isLoading ? (
                <Skeleton className="h-9 w-64" />
              ) : (
                getPageTitle()
              )}
            </h1>
          </div>
        </div>

        {/* Bộ lọc */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Bộ lọc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lớp học</label>
                <Select value={selectedClassId} onValueChange={(value) => setSelectedClassId(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn lớp học" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp học</SelectItem>
                    {allClasses?.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} ({cls.class_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bài tập</label>
                <Select value={selectedQuestionId} onValueChange={(value) => setSelectedQuestionId(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn bài tập" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả bài tập</SelectItem>
                    {allQuestions?.map(q => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-[400px]">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="recent">Kết quả gần đây</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="dashboard-card backdrop-blur-sm bg-white/80 border-l-4 border-blue-500 shadow-lg hover:shadow-blue-100 transition-all">
                <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Users className="h-4 w-4 mr-2 text-blue-500" />
                        Tổng số học sinh
                      </CardTitle>
                      <CardDescription>Số lượng học sinh đã làm bài</CardDescription>
                </CardHeader>
                <CardContent>
                      <div className="text-3xl font-bold text-blue-600">{stats.totalStudents}</div>
                </CardContent>
              </Card>
              
                  <Card className="dashboard-card backdrop-blur-sm bg-white/80 border-l-4 border-blue-500 shadow-lg hover:shadow-blue-100 transition-all">
                <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <BarChart3 className="h-4 w-4 mr-2 text-blue-500" />
                        Điểm trung bình
                      </CardTitle>
                      <CardDescription>Trung bình điểm của tất cả học sinh</CardDescription>
                </CardHeader>
                <CardContent>
                      <div className={`text-3xl font-bold flex items-end ${getScoreColor(stats.averageScore)}`}>
                        {stats.averageScore.toFixed(1)}
                        <span className="text-sm ml-1 text-gray-500">/100</span>
                  </div>
                </CardContent>
              </Card>
              
                  <Card className="dashboard-card backdrop-blur-sm bg-white/80 border-l-4 border-blue-500 shadow-lg hover:shadow-blue-100 transition-all">
                <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-blue-500" />
                        Tỷ lệ hoàn thành
                      </CardTitle>
                  <CardDescription>Phần trăm học sinh đã hoàn thành bài</CardDescription>
                </CardHeader>
                <CardContent>
                      <div className="flex items-end">
                        <div className="text-3xl font-bold text-blue-600">{stats.completionRate}%</div>
                        <Progress value={stats.completionRate} className="h-2 w-24 ml-3 mt-auto mb-2 bg-blue-100" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
                {studentResults && studentResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <Card className="dashboard-card backdrop-blur-sm bg-white/80 border border-blue-100 shadow-lg">
                <CardHeader>
                        <CardTitle className="text-blue-800">Phân bố điểm số</CardTitle>
                </CardHeader>
                      <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                            data={scoreDistributionWithPercentage}
                            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                            barSize={40}
                          >
                            <XAxis 
                              dataKey="label" 
                              tick={{ fontSize: 12, fill: THEME_COLORS.text }} 
                              tickLine={false}
                              axisLine={{ stroke: THEME_COLORS.light }}
                            />
                            <YAxis 
                              tickLine={false}
                              axisLine={{ stroke: THEME_COLORS.light }}
                              tick={{ fontSize: 12, fill: THEME_COLORS.text }}
                            />
                            <RechartsTooltip 
                              formatter={(value, name) => [`${value} học sinh`, 'Số lượng']}
                              labelFormatter={(label) => scoreDistributionWithPercentage.find(item => item.label === label)?.name}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)', background: 'rgba(255, 255, 255, 0.9)' }}
                            />
                            <Bar 
                              dataKey="count" 
                              fill={THEME_COLORS.primary} 
                              name="Số học sinh"
                              animationDuration={1500}
                              radius={[6, 6, 0, 0]}
                            >
                              {scoreDistributionWithPercentage.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                              <LabelList 
                                dataKey="count" 
                                position="top" 
                                style={{ fill: THEME_COLORS.text, fontSize: 12, fontWeight: 'bold' }} 
                              />
                            </Bar>
                  </BarChart>
                        </ResponsiveContainer>
                </CardContent>
              </Card>
              
                    <Card className="dashboard-card backdrop-blur-sm bg-white/80 border border-blue-100 shadow-lg">
                <CardHeader>
                        <CardTitle className="text-blue-800">Phân bố trình độ học sinh</CardTitle>
                </CardHeader>
                      <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={scoreDistributionWithPercentage}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="count"
                              nameKey="name"
                              animationDuration={1500}
                              label={({ name, count, percentage }) => 
                                count > 0 ? `${name.split(' ')[0]}: ${percentage}` : ''}
                              labelLine={false}
                            >
                              {scoreDistributionWithPercentage.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value, name) => [`${value} học sinh (${scoreDistributionWithPercentage.find(item => item.name === name)?.percentage})`, name]}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)', background: 'rgba(255, 255, 255, 0.9)' }}
                            />
                            <Legend 
                              layout="vertical" 
                              align="right" 
                              verticalAlign="middle"
                              formatter={(value) => {
                                const item = scoreDistributionWithPercentage.find(item => item.name === value);
                                return (
                                  <span style={{ color: THEME_COLORS.text, fontSize: '0.875rem' }}>
                                    {value.split(' ')[0]} ({item?.count || 0})
                                  </span>
                                );
                              }}
                              iconSize={10}
                              iconType="circle"
                            />
                  </PieChart>
                        </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
                ) : (
                  <Card className="mt-6">
                    <CardContent className="py-6">
                      <div className="text-center">
                        <div className="bg-yellow-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                          <AlertCircle className="h-10 w-10 text-yellow-500" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">Chưa có kết quả</h3>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">
                          Hiện chưa có học sinh nào làm bài kiểm tra này hoặc không tìm thấy dữ liệu phù hợp với điều kiện lọc.
                        </p>
                        <Button 
                          variant="outline" 
                          onClick={() => setSearchParams({})}
                          className="px-6 py-2 hover:bg-blue-50 transition-colors"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Xem tất cả kết quả
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="recent" className="mt-6">
          <Card className="dashboard-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Kết quả học sinh</CardTitle>
                  <CardDescription>Danh sách điểm số của học sinh</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : recentResults && recentResults.length > 0 ? (
                  <div className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Điểm số</TableHead>
                      <TableHead>Xếp loại</TableHead>
                          <TableHead>Thời gian hoàn thành</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead>Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                        {(() => {
                          const latestResultsByStudent = new Map();
                          
                          studentResults?.forEach(result => {
                            const studentId = result.student_id;
                            const existingResult = latestResultsByStudent.get(studentId);
                            
                            if (!existingResult || new Date(result.completedAt) > new Date(existingResult.completedAt)) {
                              latestResultsByStudent.set(studentId, result);
                            }
                          });
                          
                          const uniqueResults = Array.from(latestResultsByStudent.values());
                          
                          return uniqueResults.map((result, index) => {
                            const totalAnswers = result.answer_data?.answers?.length || 0;
                            const correctAnswers = result.answer_data?.answers?.filter(a => a.isCorrect)?.length || 0;
                            const accuracyRate = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
                            
                            return (
                              <TableRow key={result.id} className="hover:bg-gray-50">
                                <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium text-sm">
                                      {result.student?.full_name ? result.student.full_name.charAt(0).toUpperCase() : "?"}
                            </div>
                                    <span>{result.student?.full_name || "Không xác định"}</span>
                          </div>
                        </TableCell>
                                <TableCell className={`text-right font-bold ${getScoreColor(result.score || 0)}`}>
                                  {result.score?.toFixed(1) || 0}
                        </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className={`font-semibold ${
                                    result.score >= 90 ? "bg-green-100 text-green-800" :
                                    result.score >= 80 ? "bg-blue-100 text-blue-800" :
                                    result.score >= 70 ? "bg-yellow-100 text-yellow-800" :
                                    result.score >= 60 ? "bg-orange-100 text-orange-800" :
                                    "bg-gray-100 text-gray-800"
                                  }`}>
                                    {getGrade(result.score || 0)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                                  {result.completedAt 
                                    ? formatDate(result.completedAt) 
                                    : 'Chưa hoàn thành'}
                                </TableCell>
                                <TableCell>
                                  {accuracyRate >= 80 ? (
                                    <Badge className="bg-green-100 text-green-800">
                                      <CheckCircle className="h-4 w-4 mr-1" /> Đã đạt
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-800">
                                      <XCircle className="h-4 w-4 mr-1" /> Chưa đạt
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost"
                                    size="sm"
                                    className="hover:bg-blue-50"
                                    onClick={() => navigate(`/teacher/student-result/${result.id}`)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Xem chi tiết
                                  </Button>
                        </TableCell>
                      </TableRow>
                            );
                          });
                        })()}
                  </TableBody>
                </Table>
              </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="bg-yellow-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="h-10 w-10 text-yellow-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Chưa có kết quả</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                      Hiện chưa có học sinh nào làm bài kiểm tra.
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TeacherLayout>
  );
};

export default TestResults;
