import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TeacherLayout from '@/layouts/TeacherLayout';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  Clock, 
  CheckCircle, 
  XCircle,
  FileAudio,
  User,
  School,
  BarChart3,
  AlertCircle,
  TrendingUp,
  BarChart,
  CircleAlert
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';

interface AnswerDetail {
  question?: string;
  userAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  errorType?: string;
}

interface StudentResultDetail {
  id: string;
  score: number;
  created_at: string;
  completed_at: string;
  student_id: string;
  question_id: string;
  answers?: string[]; // Mảng câu trả lời thô
  answers_text?: string; // Câu trả lời dạng text
  answer_data?: {
    answers: AnswerDetail[];
    totalTime?: number;
  };
  student?: {
    id: string;
    full_name: string;
    email: string;
    level?: string;
  };
  question?: {
    id: string;
    title: string;
    script: string;
    audio_url: string;
    difficulty: string;
    subquestions?: {
      id: string;
      content: string;
      correct_answer: string;
    }[];
  };
  class?: {
    id: string;
    name: string;
    class_code: string;
  };
  rank?: number;
  totalStudents?: number;
  attempt_count?: number;
}

const StudentResultDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('answers');
  const [processedAnswers, setProcessedAnswers] = useState<AnswerDetail[]>([]);
  const [totalTime, setTotalTime] = useState<number | undefined>(undefined);

  // Truy vấn chi tiết kết quả bài làm
  const { 
    data: resultDetail, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['student-result-detail', id],
    queryFn: async () => {
      if (!id) return null;
      
      try {
        console.log('===== DEBUG: Fetching result detail for ID:', id);
        
        // Lấy thông tin bài làm
        const { data: result, error: resultError } = await supabase
          .from('student_answers')
          .select('*')
          .eq('id', id)
          .single();
          
        if (resultError) {
          console.error('Error fetching student answer:', resultError);
          throw resultError;
        }
        
        if (!result) {
          console.error('No result found for ID:', id);
          throw new Error('Không tìm thấy dữ liệu bài làm');
        }
        
        console.log('===== DEBUG: Found student answer:', result);
        
        // Lấy thông tin học sinh
        const { data: student, error: studentError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', result.student_id)
          .single();
          
        if (studentError) {
          console.error('Error fetching student profile:', studentError);
          throw studentError;
        }
        
        console.log('===== DEBUG: Found student profile:', student);
        
        // Lấy thông tin level học sinh từ student_categories_view
        const { data: studentLevel, error: levelError } = await supabase
          .from('student_categories_view')
          .select('category, category_display, average_score')
          .eq('student_id', result.student_id)
          .maybeSingle();
          
        if (levelError) {
          console.error('Error fetching student level:', levelError);
          // Không throw lỗi, lấy level mặc định là "yếu"
        }
        
        // Cập nhật thông tin học sinh với level
        const studentWithLevel = {
          ...student,
          level: studentLevel?.category_display || "yếu"
        };
        
        console.log('===== DEBUG: Student level:', studentLevel || 'Default: yếu');
        
        // Lấy thông tin câu hỏi đầy đủ
        const { data: question, error: questionError } = await supabase
          .from('questions')
          .select('id, title, script, audio_url, difficulty')
          .eq('id', result.question_id)
          .single();
          
        if (questionError) {
          console.error('Error fetching question:', questionError);
          throw questionError;
        }
        
        console.log('===== DEBUG: Found question:', question);
        
        // Thử lấy câu hỏi con từ test_results
        let subquestions = [];
        try {
          const { data: testResults, error: testResultsError } = await supabase
            .from('test_results')
            .select('*')
            .eq('question_id', result.question_id);
            
          if (!testResultsError && testResults) {
            console.log('===== DEBUG: Found test results:', testResults);
            // Xử lý dữ liệu từ test_results để tạo subquestions nếu cần
            subquestions = testResults.map((item, index) => ({
              id: item.id || `sub-${index}`,
              content: item.question || `Câu hỏi ${index + 1}`,
              correct_answer: item.correct_answer || 'Không có đáp án'
            }));
          }
        } catch (subError) {
          console.error('Error fetching subquestions:', subError);
          // Không throw lỗi, chỉ log và tiếp tục
        }
        
        // Lấy thông tin lớp học của học sinh
        const { data: classData, error: classError } = await supabase
          .from('student_classes')
          .select('class:class_id(id, name, class_code)')
          .eq('student_id', result.student_id)
          .maybeSingle();
          
        if (classError) {
          console.error('Error fetching class data:', classError);
          // Không throw khi không tìm thấy lớp học
        }
        
        console.log('===== DEBUG: Found class data:', classData);
        
        // Xây dựng đối tượng kết quả
        const formattedQuestion = {
          ...question,
          subquestions: subquestions
        };
        
        // Lấy thứ hạng của học sinh cho câu hỏi này
        const { data: rankings, error: rankingError } = await supabase
          .from('student_answers')
          .select('id, score, student_id')
          .eq('question_id', result.question_id)
          .order('score', { ascending: false });
          
        if (rankingError) {
          console.error('Error fetching rankings:', rankingError);
          // Không throw lỗi, vẫn tiếp tục
        }
        
        // Tính thứ hạng của học sinh hiện tại
        let rank = 0;
        if (rankings) {
          // Lọc các điểm số lớn hơn điểm hiện tại để tính thứ hạng
          rank = rankings.findIndex(r => r.id === result.id) + 1;
          if (rank === 0) {
            // Nếu không tìm thấy (hiếm khi xảy ra), tính theo cách cũ
            rank = rankings.filter(r => r.score > result.score).length + 1;
          }
        }
        
        console.log('===== DEBUG: Found ranking:', { rank, totalStudents: rankings?.length || 0 });
        
        return {
          ...result,
          student: studentWithLevel,
          question: formattedQuestion,
          class: classData?.class || null,
          rank,
          totalStudents: rankings?.length || 0,
          attempt_count: result.attempt_count || 1
        } as unknown as StudentResultDetail;
      } catch (err) {
        console.error('===== DEBUG: Error fetching result detail:', err);
        throw err;
      }
    },
    enabled: !!id,
    retry: 2
  });

  // Xử lý dữ liệu câu trả lời sau khi có dữ liệu
  useEffect(() => {
    if (resultDetail) {
      try {
        console.log('===== DEBUG: Processing answers data:', resultDetail);
        
        // Khởi tạo dữ liệu mẫu mặc định nếu không có dữ liệu
        let defaultAnswers = Array.from({ length: 8 }, (_, index) => ({
          question: `Câu hỏi ${index + 1}`,
          userAnswer: "Không có câu trả lời",
          correctAnswer: "Không có thông tin",
          isCorrect: false,
          errorType: ""
        }));
        
        // Nếu có dữ liệu answers_text, ưu tiên sử dụng nó
        if (resultDetail.answers_text) {
          try {
            // Thử parse dữ liệu JSON từ answers_text
            const parsedData = JSON.parse(resultDetail.answers_text);
            console.log('===== DEBUG: Parsed answers_text:', parsedData);
            
            if (parsedData.answers && Array.isArray(parsedData.answers)) {
              setProcessedAnswers(parsedData.answers);
              
              if (parsedData.totalTime) {
                setTotalTime(parsedData.totalTime);
              }
              return; // Dừng xử lý nếu đã lấy được dữ liệu
            }
          } catch (e) {
            console.error('Failed to parse answers_text:', e);
          }
        } 
        
        // Nếu không parse được answers_text, thử dùng mảng answers
        if (resultDetail.answers && Array.isArray(resultDetail.answers) && resultDetail.answers.length > 0) {
          console.log('===== DEBUG: Using answers array:', resultDetail.answers);
          
          const processedData = resultDetail.answers.map((answer, index) => {
            // Tìm câu hỏi con tương ứng nếu có
            const subquestion = resultDetail.question?.subquestions && 
                                index < resultDetail.question.subquestions.length ? 
                                resultDetail.question.subquestions[index] : null;
            
            return {
              question: subquestion?.content || `Câu hỏi ${index + 1}`,
              userAnswer: answer,
              correctAnswer: subquestion?.correct_answer || "Không có thông tin",
              isCorrect: subquestion?.correct_answer === answer,
              errorType: ""
            };
          });
          
          setProcessedAnswers(processedData);
          return; // Dừng xử lý nếu đã lấy được dữ liệu
        }
        
        // Nếu không có dữ liệu, sử dụng dữ liệu mẫu
        console.log('===== DEBUG: Using default answers');
        setProcessedAnswers(defaultAnswers);
        
      } catch (err) {
        console.error('===== DEBUG: Error processing answer data:', err);
        
        // Sử dụng dữ liệu mẫu trong trường hợp lỗi
        const defaultAnswers = Array.from({ length: 8 }, (_, index) => ({
          question: `Câu hỏi ${index + 1}`,
          userAnswer: "Không có câu trả lời",
          correctAnswer: "Không có thông tin",
          isCorrect: false,
          errorType: ""
        }));
        
        setProcessedAnswers(defaultAnswers);
      }
    }
  }, [resultDetail]);

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Không có dữ liệu';
    
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch (error) {
      return dateString;
    }
  };

  // Convert seconds to minutes:seconds format
  const formatTime = (seconds?: number) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Function để xác định màu sắc dựa trên điểm số
  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return 'text-gray-600';
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Function để xác định xếp loại dựa trên điểm số
  const getGrade = (score: number | null | undefined) => {
    if (!score) return 'N/A';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  // Function để lấy màu cho badge xếp loại
  const getGradeBadgeColor = (score: number | null | undefined) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-blue-100 text-blue-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  // Tính toán thống kê
  const calculateStats = () => {
    if (!processedAnswers || processedAnswers.length === 0) return { 
      total: 0, 
      correct: 0, 
      incorrect: 0, 
      accuracyRate: 0 
    };
    
    const total = processedAnswers.length;
    const correct = processedAnswers.filter(a => a.isCorrect).length;
    
    return {
      total,
      correct,
      incorrect: total - correct,
      accuracyRate: total > 0 ? (correct / total) * 100 : 0
    };
  };

  const stats = calculateStats();
  
  // Tính điểm dựa trên số câu đúng/tổng số câu và level của học sinh
  const calculateScoreByLevel = () => {
    if (!stats.total) return 0;
    
    // Tính tỷ lệ phần trăm câu đúng (0-100%)
    const percentageCorrect = (stats.correct / stats.total) * 100;
    
    // Lấy level của học sinh từ dữ liệu, hoặc mặc định là "yếu"
    const studentLevel = resultDetail.student?.level?.toLowerCase() || "yếu";
    
    // Xác định điểm tối đa dựa trên level
    let maxScore;
    if (studentLevel === "yếu" || studentLevel === "kém") {
      maxScore = 7;
    } else if (studentLevel === "trung bình" || studentLevel === "khá") {
      maxScore = 8;
    } else {
      // Level "giỏi" hoặc cao hơn
      maxScore = 10;
    }
    
    // Tính điểm dựa trên phần trăm câu đúng và điểm tối đa
    const calculatedScore = (percentageCorrect / 100) * maxScore;
    
    // Làm tròn lên 1 chữ số sau dấu phẩy
    return Math.round(calculatedScore * 10) / 10;
  };
  
  const finalScore = calculateScoreByLevel();

  // Thêm hàm xử lý thống kê lỗi phổ biến và số lần làm cần thiết
  const calculateErrorStats = () => {
    if (!processedAnswers || processedAnswers.length === 0) return { 
      mostCommonErrors: [], 
      attemptsToReach80Percent: 0 
    };
    
    // Lọc các câu trả lời sai
    const incorrectAnswers = processedAnswers.filter(a => !a.isCorrect);
    
    // Nhóm các câu hỏi sai theo nội dung câu hỏi
    const errorsByQuestion = incorrectAnswers.reduce((acc: any, answer) => {
      const questionText = answer.question || 'Không xác định';
      acc[questionText] = (acc[questionText] || 0) + 1;
      return acc;
    }, {});
    
    // Chuyển đổi thành mảng và sắp xếp theo số lượng lỗi
    const sortedErrors = Object.entries(errorsByQuestion)
      .map(([question, count]) => ({ question, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // Lấy 3 lỗi phổ biến nhất
    
    // Tính toán số lần làm cần thiết để đạt 80% tỷ lệ chính xác
    const currentAccuracy = stats.accuracyRate;
    let attemptsToReach80Percent = 0;
    
    if (currentAccuracy < 80 && incorrectAnswers.length > 0) {
      // Giả định rằng mỗi lần làm bài, học sinh sẽ sửa được 20% số câu sai
      const improvementPerAttempt = 20; 
      const pointsNeeded = 80 - currentAccuracy;
      attemptsToReach80Percent = Math.ceil(pointsNeeded / improvementPerAttempt);
    }
    
    return {
      mostCommonErrors: sortedErrors,
      attemptsToReach80Percent
    };
  };

  const errorStats = calculateErrorStats();

  if (isLoading) {
    return (
      <TeacherLayout>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/teacher/results')}
              className="p-0 h-9 w-9"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </TeacherLayout>
    );
  }

  if (error || !resultDetail) {
    return (
      <TeacherLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-red-500 text-5xl mb-4">
            <XCircle className="w-20 h-20" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Không thể tải dữ liệu</h1>
          <p className="text-gray-500 mb-6">
            {error instanceof Error ? error.message : 'Không thể tìm thấy kết quả bài làm'}
          </p>
          <Button onClick={() => navigate('/teacher/results')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/teacher/results')}
            className="p-0 h-9 w-9"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Chi tiết bài làm
            </h1>
          </div>
          
          {/* Hiển thị số lần làm bài */}
          {resultDetail.attempt_count && resultDetail.attempt_count > 1 && (
            <Badge variant="outline" className="ml-2 px-3 py-1 text-orange-700 bg-orange-50 border-orange-200">
              Lần làm thứ {resultDetail.attempt_count}
            </Badge>
          )}
        </div>

        {/* Card thông tin học sinh và điểm số */}
        <Card className="backdrop-blur-sm bg-white/80 border-l-4 border-blue-500 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl">
                  {resultDetail.student?.full_name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-medium text-lg">{resultDetail.student?.full_name || 'Không xác định'}</div>
                  <div className="text-sm text-gray-500">{resultDetail.student?.email || 'Không có email'}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`text-4xl font-bold ${getScoreColor(finalScore)}`}>
                  {finalScore.toFixed(1)}
                </div>
                <Badge className={`px-3 py-1 text-lg ${getGradeBadgeColor(finalScore)}`}>
                  {getGrade(finalScore)}
                </Badge>
              </div>
            </div>
            
            {/* Thêm thông báo trạng thái đạt/chưa đạt */}
            {stats.accuracyRate < 80 ? (
              <div className="mt-4 bg-red-50 p-3 rounded-md border-l-4 border-red-500 flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
                <div>
                  <div className="font-medium text-red-800">Chưa đạt yêu cầu</div>
                  <div className="text-sm text-red-600">
                    Tỷ lệ chính xác hiện tại: {stats.accuracyRate.toFixed(1)}% (Yêu cầu: 80%)
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 bg-green-50 p-3 rounded-md border-l-4 border-green-500 flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                <div>
                  <div className="font-medium text-green-800">Đã đạt yêu cầu</div>
                  <div className="text-sm text-green-600">
                    Tỷ lệ chính xác: {stats.accuracyRate.toFixed(1)}% (Yêu cầu: 80%)
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Thứ hạng</div>
                  <div className="text-xl font-bold text-blue-600">
                    {resultDetail.rank || '?'}/{resultDetail.totalStudents || '?'}
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {resultDetail.rank && resultDetail.rank <= 3 ? '🏆' : `#${resultDetail.rank}`}
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-gray-500">Tỷ lệ chính xác</div>
                <div className="text-xl font-bold text-blue-600">{stats.accuracyRate.toFixed(1)}%</div>
                <div className="text-xs text-gray-500 mt-1">{stats.correct}/{stats.total} câu đúng</div>
              </div>
              <div className="col-span-2 bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-gray-500">Level học sinh</div>
                <div className="text-xl font-bold text-blue-600 capitalize">
                  {resultDetail.student?.level || 'Không xác định'} 
                  <span className="text-xs text-gray-500 ml-2">(Điểm tối đa: {
                    (resultDetail.student?.level?.toLowerCase() === "yếu" || resultDetail.student?.level?.toLowerCase() === "kém") ? 7 :
                    (resultDetail.student?.level?.toLowerCase() === "trung bình" || resultDetail.student?.level?.toLowerCase() === "khá") ? 8 : 10
                  })</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chi tiết câu trả lời */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {resultDetail.attempt_count && resultDetail.attempt_count > 1 ? (
                <>
                  <XCircle className="h-5 w-5 mr-2 text-red-500" />
                  Câu trả lời sai
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2 text-blue-500" />
                  Tất cả câu trả lời
                </>
              )}
            </CardTitle>
            <CardDescription>
              {resultDetail.attempt_count && resultDetail.attempt_count > 1 
                ? 'Chỉ hiển thị các câu làm sai trong lần làm này'
                : 'Danh sách tất cả các cáu trả lời và so sánh với đáp án đúng'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processedAnswers && processedAnswers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Câu hỏi</TableHead>
                      <TableHead>Câu trả lời của học sinh</TableHead>
                      <TableHead>Đáp án đúng</TableHead>
                      <TableHead className="w-[100px]">Kết quả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(resultDetail.attempt_count && resultDetail.attempt_count > 1 
                      ? processedAnswers.filter(answer => !answer.isCorrect) 
                      : processedAnswers
                    ).map((answer, index) => (
                      <TableRow 
                        key={index} 
                        className={!answer.isCorrect 
                          ? 'bg-red-50 border-l-4 border-red-500' 
                          : undefined
                        }
                      >
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>{answer.question || 'Không xác định'}</TableCell>
                        <TableCell className={!answer.isCorrect ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {answer.userAnswer || 'Không có câu trả lời'}
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">{answer.correctAnswer}</TableCell>
                        <TableCell>
                          {answer.isCorrect ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-4 w-4 mr-1" /> Đúng
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              <XCircle className="h-4 w-4 mr-1" /> Sai
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 flex flex-col items-center">
                <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                <p className="text-gray-700 font-medium">
                  {resultDetail.attempt_count && resultDetail.attempt_count > 1 
                    ? 'Không có câu trả lời sai trong lần làm này!' 
                    : 'Không có dữ liệu chi tiết câu trả lời'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  {resultDetail.attempt_count && resultDetail.attempt_count > 1 
                    ? 'Học sinh đã làm đúng tất cả các câu hỏi trong lần làm này.' 
                    : 'Dữ liệu chi tiết câu trả lời không có sẵn cho bài làm này.'}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {resultDetail.attempt_count && resultDetail.attempt_count > 1 && (
              <div className="text-sm text-gray-500">
                <Clock className="inline-block h-4 w-4 mr-1" /> Lần làm thứ {resultDetail.attempt_count}
                <span className="ml-2 text-amber-600">
                  <AlertCircle className="inline-block h-4 w-4 mr-1" /> 
                  Điểm số chỉ được tính trên lần làm đầu tiên
                </span>
              </div>
            )}
            <Button 
              variant="outline" 
              onClick={() => navigate('/teacher/results')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Quay lại
            </Button>
          </CardFooter>
        </Card>

        {/* Thống kê lỗi và dự đoán */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-orange-500" />
              Phân tích và dự đoán
            </CardTitle>
            <CardDescription>
              Phân tích lỗi phổ biến và dự đoán số lần làm cần thiết để cải thiện
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <BarChart className="h-5 w-5 mr-2 text-blue-500" />
                  Lỗi phổ biến nhất
                </h3>
                
                {errorStats.mostCommonErrors.length > 0 ? (
                  <div className="space-y-3">
                    {errorStats.mostCommonErrors.map((error, index) => (
                      <div key={index} className="flex items-center p-3 bg-red-50 rounded-md border-l-2 border-red-500">
                        <div className="h-7 w-7 bg-red-100 text-red-600 rounded-full flex items-center justify-center mr-3 font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{error.question}</div>
                          <div className="text-sm text-gray-500">
                            {error.count > 1 
                              ? `Sai ${error.count} lần` 
                              : 'Sai 1 lần'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-md">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600">Không có lỗi phổ biến</p>
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
                  Dự đoán cải thiện
                </h3>
                
                <div className="p-4 bg-blue-50 rounded-md">
                  <div className="flex items-center mb-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3">
                      <BarChart className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-800">
                        {stats.accuracyRate >= 80 
                          ? 'Đã đạt yêu cầu' 
                          : `Cần thêm ${errorStats.attemptsToReach80Percent} lần làm`}
                      </div>
                      <div className="text-sm text-blue-600">
                        Để đạt tỷ lệ chính xác 80%
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="text-sm mb-1 flex justify-between">
                      <span>Tỷ lệ hiện tại: {stats.accuracyRate.toFixed(1)}%</span>
                      <span>Mục tiêu: 80%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stats.accuracyRate >= 80 ? 'bg-green-500' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min(stats.accuracyRate, 100)}%` }}
                      ></div>
                    </div>
                    
                    {stats.accuracyRate < 80 && (
                      <div className="mt-3 text-sm text-gray-600">
                        <AlertCircle className="inline-block h-4 w-4 mr-1 text-orange-500" />
                        <span>Gợi ý: Tập trung vào các lỗi phổ biến được liệt kê</span>
                      </div>
                    )}
                    
                    {stats.accuracyRate >= 80 && (
                      <div className="mt-3 text-sm text-gray-600">
                        <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-500" />
                        <span>Học sinh đã đạt yêu cầu tỷ lệ chính xác tối thiểu</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
};

export default StudentResultDetail; 