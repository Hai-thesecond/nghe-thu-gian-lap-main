import React, { useEffect, useState, useCallback } from 'react';
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
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import StudentLayout from '@/layouts/StudentLayout';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Award, 
  BarChart3, 
  BookOpen, 
  Calendar, 
  ChevronDown, 
  Clock, 
  GraduationCap, 
  LineChart as LineChartIcon, 
  Medal, 
  Sparkles, 
  Star, 
  TrendingUp, 
  Trophy, 
  Users,
  AlertCircle,
  HelpCircle,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { debounce } from 'lodash';
import { Bar } from 'react-chartjs-2';
import { TabsContent } from '@/components/ui/tabs';

interface Test {
  id: string;
  title: string;
  date: string;
  score: number;
  accuracy: number;
  timeTaken: string;
  isCompleted?: boolean;
}

interface ErrorType {
  type: string;
  count: number;
}

interface ProgressDataPoint {
  date: Date;
  score: number;
  fullDate?: string;
  scoreRange?: {
    min: number;
    max: number;
  };
}

// Thêm interface để mô tả cấu trúc của question
interface QuestionDetails {
  id: string;
  title: string;
  time_limit?: number;
}

// Thêm interface cho thông tin lớp học
interface ClassInfo {
  id: string;
  name: string;
}

// Thêm interface cho danh hiệu học sinh
interface StudentTitle {
  title: string;
  emoji: string;
  description: string;
  color: string;
}

// Thêm interface cho danh hiệu xếp hạng
interface RankTitle {
  title: string;
  emoji: string;
  description: string;
  color: string;
  bgColor: string;
}

// Thêm interface cho danh hiệu điểm số
interface ScoreTitle {
  title: string;
  emoji: string;
  description: string;
  color: string;
  bgColor: string;
}

// Thêm interface cho hệ thống thành tích
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'score' | 'streak' | 'rank' | 'milestone';
  condition: number;
  achieved: boolean;
  achievedDate?: string;
  progress: number;
}

// Thêm interface cho theo dõi chuỗi thành tích
interface StreakRecord {
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string;
  streakHistory: {
    date: string;
    maintained: boolean;
  }[];
}

// Thêm interface cho dự đoán và phân tích
interface ProgressPrediction {
  nextScore: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  factors: {
    factor: string;
    impact: number;
  }[];
}

// Thêm interface cho mốc tiến độ
interface ProgressMilestone {
  id: string;
  title: string;
  description: string;
  threshold: number;
  achieved: boolean;
  achievedDate?: string;
  icon: string;
}

interface ClassData {
  class_id: string;
  classes: ClassInfo | ClassInfo[];
}

// Add after other interfaces
interface HighestScorePoint {
  testId: string;
  testTitle: string;
  date: Date;
  highestScore: number;
  attempts: number;
  improvement: number;
}

interface TestProgressData {
  highest: HighestScorePoint[];
  current: ProgressDataPoint[];
}

// Add proper types for the Supabase response
interface QuestionData {
  id: string;
  title: string;
}

interface AnswerData {
  question_id: string;
  questions: QuestionData | QuestionData[];  // Allow both single object or array
  score: number | string;  // Could be either number or string from DB
  completed_at: string;
  count: number | any[];  // Allow both number and array types for count
}

interface CurrentAnswerData {
  question_id: string;
  score: number;
  completed_at: string;
}

// Thêm flag để kiểm soát việc sử dụng SQL view
const USING_SQL_VIEW = true; // Set to false to use frontend analysis

const StudentProgress = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [recentTests, setRecentTests] = useState<Test[]>([]);
  const [progressData, setProgressData] = useState<ProgressDataPoint[]>([]);
  const [errorTypes, setErrorTypes] = useState<ErrorType[]>([]);
  const [averageScore, setAverageScore] = useState(0);
  const [rankData, setRankData] = useState({
    position: 0,
    total: 0,
    percentile: ''
  });
  const [progressViewMode, setProgressViewMode] = useState<'daily' | 'monthly'>('daily');
  const [rawProgressData, setRawProgressData] = useState<{date: Date, score: number}[]>([]);
  const [studentCategory, setStudentCategory] = useState<string>('');
  const [top5AverageScore, setTop5AverageScore] = useState<number>(0);
  const [classInfo, setClassInfo] = useState<ClassInfo>({id: '', name: ''});
  
  // Thêm state để quản lý danh sách lớp và lớp đang chọn
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Thêm trạng thái để theo dõi khi dropdown được click
  const [classDropdownOpen, setClassDropdownOpen] = useState<boolean>(false);

  // Thêm state cho hiệu ứng
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [badgeHover, setBadgeHover] = useState<boolean>(false);
  const [titleHovered, setTitleHovered] = useState<boolean>(false);

  // Thêm state cho hiệu ứng xếp hạng
  const [rankBadgeHover, setRankBadgeHover] = useState<boolean>(false);
  const [rankTitleHovered, setRankTitleHovered] = useState<boolean>(false);

  // Thêm state cho hiệu ứng điểm số
  const [scoreBadgeHover, setScoreBadgeHover] = useState<boolean>(false);
  const [scoreTitleHovered, setScoreTitleHovered] = useState<boolean>(false);

  // Thêm state mới cho hệ thống thành tích
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streakRecord, setStreakRecord] = useState<StreakRecord>({
    currentStreak: 0,
    bestStreak: 0,
    lastActivityDate: '',
    streakHistory: []
  });
  const [predictions, setPredictions] = useState<ProgressPrediction>({
    nextScore: 0,
    confidence: 0,
    trend: 'stable',
    factors: []
  });
  const [milestones, setMilestones] = useState<ProgressMilestone[]>([]);
  const [showAchievementAnimation, setShowAchievementAnimation] = useState(false);
  const [lastAchievement, setLastAchievement] = useState<Achievement | null>(null);
  const [previousAchievements, setPreviousAchievements] = useState<Achievement[]>([]);

  // Add in the component, after other state declarations
  const [testProgress, setTestProgress] = useState<TestProgressData>({
    highest: [],
    current: []
  });

  // Thêm state cho từ hay sai nhất
  const [commonMistakes, setCommonMistakes] = useState<{correctAnswer: string, studentAnswers: string[], count: number}[]>([]);

  // Hiệu ứng animation container
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  // Hiệu ứng animation cho các card
  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 100
      }
    }
  };

  // Thêm hiệu ứng animation cho dropdown
  const dropdownVariants = {
    hidden: { opacity: 0, y: -5 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3 }
    }
  };
  
  useEffect(() => {
    if (user?.id) {
      fetchStudentData();
    }
  }, [user]);
  
  useEffect(() => {
    if (rawProgressData.length === 0) {
      setProgressData([]);
      return;
    }
    
    const formattedData = formatProgressData(rawProgressData, progressViewMode);
    setProgressData(formattedData);
  }, [rawProgressData, progressViewMode]);
  
  const fetchStudentData = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) {
        throw new Error('User ID is required');
      }

      // Fetch student category
      const { data: categoryData, error: categoryError } = await supabase
        .from('student_categories')
        .select('category')
        .eq('student_id', user.id)
        .maybeSingle();
      
      if (categoryError) {
        console.error('Error fetching student category:', categoryError);
        toast.error('Error loading student category');
        setStudentCategory('poor');
      } else {
        setStudentCategory(categoryData?.category || 'poor');
      }
      
      // Fetch progress summary
      const { data: progressSummary, error: summaryError } = await supabase
        .from('student_progress_summary_view')
        .select('*')
        .eq('student_id', user.id)
        .maybeSingle();
      
      if (summaryError) {
        console.error('Error fetching progress summary:', summaryError);
        toast.error('Cannot load learning progress data');
        setDefaultValues();
      } else if (progressSummary) {
        updateProgressSummary(progressSummary);
      } else {
        setDefaultValues();
      }
      
      // Fetch student classes
      const { data: classesData, error: classesError } = await supabase
        .from('student_classes')
        .select(`
          class_id,
          classes:class_id (id, name)
        `)
        .eq('student_id', user.id);
        
      if (classesError) {
        console.error('Error fetching classes:', classesError);
        toast.error('Cannot load class data');
        setAllClasses([]);
      } else {
        const validClasses = (classesData || [])
          .filter((item: ClassData) => item.classes && (
            Array.isArray(item.classes) 
              ? item.classes[0]?.id && item.classes[0]?.name 
              : (item.classes as ClassInfo)?.id && (item.classes as ClassInfo)?.name
          ))
          .map((item: ClassData) => {
            const classObj = Array.isArray(item.classes) 
              ? item.classes[0] 
              : item.classes as ClassInfo;
            return {
              id: classObj.id,
              name: classObj.name
            };
          });
        
        setAllClasses(validClasses);
      }
      
      // Fetch additional data
      await Promise.all([
        fetchProgressData(user.id),
        fetchErrorAnalysis(user.id),
        // Chỉ gọi analyzeErrors nếu không sử dụng SQL view
        !USING_SQL_VIEW ? analyzeErrors(user.id) : Promise.resolve(),
        calculateAchievements(user.id)
      ]);

    } catch (error) {
      console.error('Error in fetchStudentData:', error);
      toast.error('An error occurred while loading data');
      setDefaultValues();
    } finally {
      setIsLoading(false);
    }
  };
  
  const setDefaultValues = () => {
    setTop5AverageScore(0);
    setRankData({
      position: 0,
      total: 0,
      percentile: '0%'
    });
    setAverageScore(0);
    setAllClasses([]);
  };
  
  const updateProgressSummary = (summary: any) => {
    const recentScore = Number(summary.recent_average_score);
    setTop5AverageScore(Number.isFinite(recentScore) ? recentScore : 0);
    
    const rank = Number(summary.rank);
    const total = Number(summary.total_students);
    const percentile = Number(summary.percentile_better);
    
    setRankData({
      position: Number.isFinite(rank) ? rank : 0,
      total: Number.isFinite(total) ? total : 0,
      percentile: Number.isFinite(percentile) ? `${percentile}%` : '0%'
    });
    
    const avgScore = Number(summary.top_accuracy_avg);
    setAverageScore(Number.isFinite(avgScore) ? avgScore : 0);
    
    if (summary.class_id && summary.class_name) {
      setClassInfo({
        id: summary.class_id,
        name: summary.class_name
      });
      setSelectedClassId(summary.class_id);
    }
  };
  
  // Lấy dữ liệu tiến độ (điểm theo thời gian)
  const fetchProgressData = async (studentId: string) => {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      // Fetch highest scores per test
      const { data: highestScores, error: highestError } = await supabase
        .from('student_answers')
        .select(`
          question_id,
          questions:question_id (
            id,
            title
          ),
          score,
          completed_at,
          count:question_id (*)
        `)
        .eq('student_id', studentId)
        .gte('completed_at', threeMonthsAgo.toISOString())
        .order('completed_at', { ascending: true })
        .limit(15);

      if (highestError) {
        console.error('Error fetching highest scores:', highestError);
        return;
      }

      // Process highest scores
      const processedHighest = (highestScores || []).reduce<Record<string, HighestScorePoint>>((acc, curr: any) => {
        const testId = curr.question_id;
        const score = Number(curr.score);
        const date = new Date(curr.completed_at);
        
        if (!acc[testId] || score > acc[testId].highestScore) {
          acc[testId] = {
            testId,
            testTitle: curr.questions?.title || 'Unknown Test',
            date,
            highestScore: score,
            attempts: Number(curr.count) || 1,
            improvement: 0
          };
        }
        
        return acc;
      }, {});

      // Get current scores for comparison
      const { data: currentScores, error: currentError } = await supabase
        .from('student_answers')
        .select(`
          question_id,
          score,
          completed_at
        `)
        .eq('student_id', studentId)
        .eq('is_completed', true)
        .order('completed_at', { ascending: true })
        .limit(15);

      if (currentError) {
        console.error('Error fetching current scores:', currentError);
        return;
      }

      // Process current scores and calculate improvement
      const processedCurrent = (currentScores || []).map((answer: CurrentAnswerData) => ({
        date: new Date(answer.completed_at),
        score: Number(answer.score),
        testId: answer.question_id
      }));

      // Calculate improvement potential
      Object.values(processedHighest).forEach(highest => {
        const current = processedCurrent.find(c => c.testId === highest.testId);
        if (current) {
          highest.improvement = Math.max(0, highest.highestScore - current.score);
        }
      });

      setTestProgress({
        highest: Object.values(processedHighest),
        current: processedCurrent
      });

    } catch (error) {
      console.error('Error in fetchProgressData:', error);
      toast.error('Failed to load progress data');
    }
  };
  
  // Định dạng dữ liệu tiến độ theo chế độ xem (ngày/tháng)
  const formatProgressData = (data: ProgressDataPoint[], view: 'daily' | 'monthly') => {
    if (!data || data.length === 0) return [];

    if (view === 'daily') {
      return data.map(point => ({
        date: point.date,
        fullDate: point.fullDate,
        score: point.score,
        scoreRange: {
          min: Math.max(0, point.score - 10),
          max: Math.min(100, point.score + 10)
        }
      }));
    }

    // Monthly view
    const monthlyData = data.reduce((acc: { [key: string]: ProgressDataPoint[] }, point) => {
      const monthKey = point.date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(point);
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, points]) => {
      const avgScore = Math.round(points.reduce((sum, p) => sum + p.score, 0) / points.length);
      const firstDateOfMonth = points[0].date;
      
      return {
        date: firstDateOfMonth,
        fullDate: month,
        score: avgScore,
        scoreRange: {
          min: Math.max(0, avgScore - 10),
          max: Math.min(100, avgScore + 10)
        }
      };
    });
  };
  
  // Helper để định dạng chuỗi ngày
  const formatDateString = (date: Date) => {
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };
  
  // Helper để định dạng chuỗi tháng
  const formatMonthString = (date: Date) => {
    const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    return monthNames[date.getMonth()];
  };
  
  // Cập nhật hàm fetchErrorAnalysis để truy vấn từ SQL view
  const fetchErrorAnalysis = async (studentId: string) => {
    try {
      if (!USING_SQL_VIEW) {
        console.log('[DEBUG] Using frontend analysis - SQL View is disabled');
        await analyzeErrors(studentId);
        return;
      }

      console.log('[DEBUG] Fetching error analysis from SQL view');
      // Truy vấn từ view mới thay vì bảng error_analysis trực tiếp
      const { data, error } = await supabase
        .from('student_error_analysis_view')
        .select('*')
        .eq('student_id', studentId)
        .single();
      
      if (error) {
        console.error('[ERROR] Error fetching error analysis from view:', error);
        console.log('[DEBUG] Falling back to frontend analysis');
        // Gọi phân tích frontend khi view SQL bị lỗi
        await analyzeErrors(studentId);
        return;
      }
      
      if (data) {
        console.log('[DEBUG] Successfully fetched data from student_error_analysis_view:', data);
        
        // Xử lý error_type_counts
        if (data.error_type_counts) {
          try {
            // Đảm bảo error_type_counts là một object hợp lệ
            const errorTypesObj = typeof data.error_type_counts === 'string'
              ? JSON.parse(data.error_type_counts)
              : data.error_type_counts;
            
            const errorTypes = Object.entries(errorTypesObj)
              .map(([type, count]) => ({ type, count: Number(count) }))
              .filter(item => item.count > 0)
              .sort((a, b) => b.count - a.count);
            
            if (errorTypes.length > 0) {
              console.log('[DEBUG] Setting error types from view:', errorTypes);
              setErrorTypes(errorTypes);
            } else {
              setErrorTypes([{ type: 'Chưa phát hiện lỗi', count: 1 }]);
            }
          } catch (parseError) {
            console.error('[ERROR] Error parsing error_type_counts:', parseError);
            setErrorTypes([{ type: 'Lỗi khi phân tích', count: 1 }]);
            await analyzeErrors(studentId);
          }
        } else {
          console.log('[DEBUG] No error_type_counts in data');
          setErrorTypes([{ type: 'Chưa có dữ liệu phân tích', count: 1 }]);
          await analyzeErrors(studentId);
        }
        
        // Xử lý common_mistakes
        if (data.common_mistakes && data.common_mistakes.length > 0) {
          try {
            // Đảm bảo common_mistakes là một array hợp lệ
            const mistakesArray = typeof data.common_mistakes === 'string'
              ? JSON.parse(data.common_mistakes)
              : data.common_mistakes;
            
            // Format để phù hợp với state
            const formattedMistakes = mistakesArray.map(mistake => ({
              correctAnswer: mistake.correctAnswer,
              studentAnswers: Array.isArray(mistake.studentAnswers) 
                ? mistake.studentAnswers.map(sa => 
                    typeof sa === 'string' ? sa : (sa.userAnswer || ''))
                : [],
              count: Number(mistake.count)
            }));
            
            console.log('[DEBUG] Setting common mistakes from view:', formattedMistakes);
            setCommonMistakes(formattedMistakes);
          } catch (parseError) {
            console.error('[ERROR] Error parsing common_mistakes:', parseError);
          }
        }
      } else {
        console.log('[DEBUG] No data returned from student_error_analysis_view');
        setErrorTypes([{ type: 'Chưa có dữ liệu phân tích', count: 1 }]);
        await analyzeErrors(studentId);
      }
    } catch (error) {
      console.error('[ERROR] Exception in fetchErrorAnalysis:', error);
      setErrorTypes([{ type: 'Lỗi khi phân tích', count: 1 }]);
      // Fallback to frontend analysis
      await analyzeErrors(studentId);
    }
  };

  // Cập nhật hàm analyzeErrors để kiểm tra USING_SQL_VIEW
  const analyzeErrors = async (studentId: string) => {
    // Nếu đang sử dụng SQL view và phân tích frontend đã được gọi (có dữ liệu errorTypes), không cần gọi lại
    if (USING_SQL_VIEW && errorTypes && errorTypes.length > 0 && 
        !(errorTypes.length === 1 && 
          (errorTypes[0].type.includes('Lỗi') || 
           errorTypes[0].type.includes('Chưa có')))) {
      return;
    }
    
    try {
      console.log(`[DEBUG] Starting frontend error analysis for student: ${studentId}`);
      
      // Trước tiên, gọi phương pháp cũ để đảm bảo có kết quả hiển thị 
      await analyzeErrorsLegacy(studentId);
      
      // Kiểm tra xem errorTypes có dữ liệu không, nếu không thì hiển thị thông báo có ý nghĩa
      if (!errorTypes || errorTypes.length === 0 || (errorTypes.length === 1 && errorTypes[0].type.includes('Chưa có'))) {
        setErrorTypes([
          { type: 'Đang phân tích dữ liệu...', count: 1 },
          { type: 'Không điền', count: 0 },  // Thêm một số loại lỗi mặc định
          { type: 'Sai chính tả', count: 0 },
          { type: 'Sai nghĩa', count: 0 }
        ]);
      }
      
      // Sau đó thử gọi backend để cập nhật nhưng không block UI
      setTimeout(async () => {
        try {
          console.log('[DEBUG] Initializing backend error analysis');
          await initializeErrorAnalysis(studentId);
        } catch (err) {
          console.error('[ERROR] Failed to initialize backend analysis:', err);
        }
      }, 500);
      
    } catch (error) {
      console.error('[ERROR] Error in analyzeErrors:', error);
      
      // Đảm bảo có kết quả hiển thị
      setErrorTypes([
        { type: 'Chưa có đủ dữ liệu để phân tích', count: 1 },
        { type: 'Không điền', count: 0 },
        { type: 'Sai chính tả', count: 0 },
        { type: 'Sai nghĩa', count: 0 }
      ]);
    }
  };

  // Phương pháp phân tích lỗi cũ (sửa để thử dùng dataLegacy nếu data rỗng)
  const analyzeErrorsLegacy = async (studentId: string) => {
    try {
      // Lấy các bài làm gần đây với thông tin chi tiết hơn
      const { data, error } = await supabase
        .from('student_answers')
        .select(`
          id,
          question_id,
          answers, 
          answers_text,
          wrong_answers,
          is_completed,
          metadata,
          questions (
            id, 
            title,
            correct_answers, 
            audio_url
          )
        `)
        .eq('student_id', studentId)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Error fetching answers for error analysis:', error);
        setErrorTypes([
          { type: 'Không thể tải dữ liệu', count: 1 }
        ]);
        return;
      }
      
      if (!data || data.length === 0) {
        console.log('[DEBUG] No student answers found');
        setErrorTypes([
          { type: 'Chưa có bài làm nào', count: 1 }
        ]);
        return;
      }
      
      // Khai báo các loại lỗi cần theo dõi
      const errorCounts: Record<string, number> = {
        'Sai chính tả': 0,
        'Thiếu từ': 0,
        'Sai ngữ pháp': 0,
        'Sai nghĩa': 0,
        'Không điền': 0,
        'Sai thì': 0
      };
      
      // Lưu lại các từ/cụm từ hay sai để phân tích sâu hơn
      const commonMistakes: Record<string, {correctAnswer: string, studentAnswers: string[], count: number}> = {};
      
      // Duyệt qua từng bài làm
      data.forEach(item => {
        // Xử lý metadata để lấy thông tin về lỗi (nếu có)
        let errorMetadata: any = null;
        if (item.metadata) {
          try {
            const metadata = typeof item.metadata === 'string' 
              ? JSON.parse(item.metadata) 
              : item.metadata;
            
            // Kiểm tra nếu metadata có thông tin về lỗi
            if (metadata && metadata.errors) {
              errorMetadata = metadata.errors;
            }
          } catch (err) {
            console.error('Error parsing metadata:', err);
          }
        }
        
        // Lấy đáp án của học sinh - bảo vệ khi null
        const studentAnswers = item.answers || [];
        const studentAnswersText = item.answers_text ? 
          (typeof item.answers_text === 'string' ? 
            (item.answers_text.startsWith('[') ? JSON.parse(item.answers_text) : []) : 
            item.answers_text) 
          : [];
        
        // Lấy các đáp án sai đã lưu trực tiếp (nếu có)
        const wrongAnswers = item.wrong_answers ? 
          (typeof item.wrong_answers === 'string' ? 
            (item.wrong_answers.startsWith('[') || item.wrong_answers.startsWith('{') ? 
              JSON.parse(item.wrong_answers) : 
              []) : 
            item.wrong_answers) 
          : [];
        
        // Chuyển đổi questions từ mảng thành đối tượng đơn lẻ (nếu cần)
        let question;
        if (item.questions) {
          if (Array.isArray(item.questions)) {
            question = item.questions.length > 0 ? item.questions[0] : null;
          } else {
            question = item.questions;
          }
        } else {
          question = null;
        }
        
        if (!question || !question.correct_answers) {
          // Không có đáp án đúng
          console.log('[DEBUG] No correct answers for question:', item.question_id);
          errorCounts['Không điền'] += 1;
          return;
        }
        
        // Bảo vệ correct_answers có thể null
        const correctAnswers = Array.isArray(question.correct_answers) 
          ? question.correct_answers 
          : (question.correct_answers ? [question.correct_answers] : []);
        
        if (correctAnswers.length === 0) {
          console.log('[DEBUG] Empty correct answers for question:', item.question_id);
          return;
        }
        
        // Hợp nhất tất cả đáp án của học sinh để phân tích
        const allStudentAnswers = [...studentAnswers, ...studentAnswersText];
        
        // So sánh từng đáp án học sinh với đáp án đúng
        for (let i = 0; i < correctAnswers.length; i++) {
          const correctAns = String(correctAnswers[i] || '').trim().toLowerCase();
          const studentAns = i < allStudentAnswers.length ? String(allStudentAnswers[i] || '').trim().toLowerCase() : '';
          
          // Nếu không có câu trả lời, là lỗi không điền
          if (!studentAns) {
            errorCounts['Không điền']++;
            continue;
          }
          
          // Nếu câu trả lời khác đáp án
          if (studentAns !== correctAns) {
            // Lưu lại cặp đáp án đúng/sai để phân tích
            if (!commonMistakes[correctAns]) {
              commonMistakes[correctAns] = {
                correctAnswer: correctAns,
                studentAnswers: [],
                count: 0
              };
            }
            commonMistakes[correctAns].studentAnswers.push(studentAns);
            commonMistakes[correctAns].count++;
            
            // Kiểm tra lỗi chính tả (sai 1-2 ký tự)
            if (levenshteinDistance(studentAns, correctAns) <= 2) {
              errorCounts['Sai chính tả']++;
            }
            // Kiểm tra lỗi ngữ pháp (sai ngữ pháp nhưng từ vựng đúng)
            else if (
              wordOverlap(studentAns, correctAns) > 0.7 || 
              (studentAns.includes(correctAns) || correctAns.includes(studentAns))
            ) {
              errorCounts['Sai ngữ pháp']++;
            }
            // Kiểm tra lỗi sai thì (dựa vào cấu trúc câu)
            else if (
              (studentAns.includes('will') && correctAns.includes('would')) ||
              (studentAns.includes('is') && correctAns.includes('was')) ||
              (studentAns.includes('has') && correctAns.includes('had')) ||
              (studentAns.includes('do') && correctAns.includes('did')) ||
              (studentAns.includes('are') && correctAns.includes('were'))
            ) {
              errorCounts['Sai thì']++;
            }
            // Lỗi thiếu từ (ngắn hơn đáng kể so với đáp án)
            else if (studentAns.split(' ').length < correctAns.split(' ').length - 1) {
              errorCounts['Thiếu từ']++;
            }
            // Lỗi khác (mặc định xếp vào lỗi sai nghĩa)
            else {
              errorCounts['Sai nghĩa']++;
            }
          }
        }
        
        // Nếu có thông tin về lỗi từ metadata, sử dụng thêm
        if (errorMetadata) {
          if (errorMetadata.spelling) errorCounts['Sai chính tả'] += errorMetadata.spelling;
          if (errorMetadata.grammar) errorCounts['Sai ngữ pháp'] += errorMetadata.grammar;
          if (errorMetadata.missing) errorCounts['Thiếu từ'] += errorMetadata.missing;
          if (errorMetadata.meaning) errorCounts['Sai nghĩa'] += errorMetadata.meaning;
          if (errorMetadata.blank) errorCounts['Không điền'] += errorMetadata.blank;
          if (errorMetadata.tense) errorCounts['Sai thì'] += errorMetadata.tense;
        }
        
        // Xử lý thông tin từ wrongAnswers trực tiếp nếu có
        if (wrongAnswers && wrongAnswers.length > 0) {
          wrongAnswers.forEach((wrong: any) => {
            if (wrong.type === 'spelling') errorCounts['Sai chính tả']++;
            else if (wrong.type === 'grammar') errorCounts['Sai ngữ pháp']++;
            else if (wrong.type === 'missing') errorCounts['Thiếu từ']++;
            else if (wrong.type === 'meaning') errorCounts['Sai nghĩa']++;
            else if (wrong.type === 'blank') errorCounts['Không điền']++;
            else if (wrong.type === 'tense') errorCounts['Sai thì']++;
          });
        }
      });
      
      // Chuyển đổi thành định dạng mảng và sắp xếp theo số lỗi
      const errors = Object.entries(errorCounts)
        .map(([type, count]) => ({ type, count }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);
      
      // Nếu không có lỗi nào, thêm một lỗi mặc định
      if (errors.length === 0) {
        errors.push({ type: 'Chưa phát hiện lỗi', count: 1 });
      }
      
      // Lưu các lỗi phổ biến vào state
      console.log('[DEBUG] Setting error types:', errors);
      setErrorTypes(errors);
      
      // Lưu các từ hay sai nhất vào supabase để sử dụng sau này (tùy chọn)
      const topMistakes = Object.values(commonMistakes)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      if (topMistakes.length > 0) {
        setCommonMistakes(topMistakes);
        
        const { error: saveError } = await supabase
          .from('student_common_mistakes')
          .upsert({
            student_id: studentId,
            mistakes: topMistakes,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'student_id'
          });
        
        if (saveError) {
          console.error('Error saving common mistakes:', saveError);
        }
      }
    } catch (error) {
      console.error('Error in analyzeErrorsLegacy:', error);
      
      // Đảm bảo có dữ liệu hiển thị
      setErrorTypes([
        { type: 'Đang xử lý dữ liệu...', count: 1 },
        { type: 'Không điền', count: 0 },
        { type: 'Sai chính tả', count: 0 },
        { type: 'Sai nghĩa', count: 0 }
      ]);
    }
  };

  // Hàm trợ giúp khởi tạo phân tích lỗi - cố gắng gọi nhưng không block UI
  const initializeErrorAnalysis = async (studentId: string) => {
    try {
      // Gọi analyze_student_errors cho các student_answers đã hoàn thành
      const { data: answers, error: fetchError } = await supabase
        .from('student_answers')
        .select('id, question_id')
        .eq('student_id', studentId)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(10);
      
      if (fetchError) {
        console.error('[ERROR] Error fetching completed answers:', fetchError);
        
        // Đảm bảo UI hiển thị thông tin hữu ích
        setTimeout(() => {
          const currentErrors = errorTypes || [];
          if (currentErrors.length === 0 || (currentErrors.length === 1 && currentErrors[0].type.includes('Đang'))) {
            setErrorTypes([
              { type: 'Phân tích trên frontend', count: 1 },
              { type: 'Không điền', count: 0 },
              { type: 'Sai chính tả', count: 0 },
              { type: 'Sai nghĩa', count: 0 }
            ]);
          }
        }, 500);
        
        return;
      }
        
      if (answers && answers.length > 0) {
        console.log(`[DEBUG] Found ${answers.length} completed answers to analyze`);
        
        // Xử lý từng answer trong background
        let successCount = 0;
        
        for (const answer of answers) {
          try {
            console.log(`[DEBUG] Analyzing answer: ${answer.id}`);
            // Gọi analyze_student_errors thông qua direct SQL insert - không dùng RPC
            const { data: insertData, error: insertError } = await supabase
              .from('error_analysis')
              .upsert({
                student_id: studentId,
                question_id: answer.question_id,
                error_types: JSON.stringify({
                  'Sai chính tả': 0,
                  'Thiếu từ': 0,
                  'Sai ngữ pháp': 0,
                  'Sai nghĩa': 0,
                  'Không điền': 0,
                  'Sai thì': 0
                }),
                error_details: '[]',
                created_at: new Date().toISOString()
              }, {
                onConflict: 'student_id,question_id'
              });
              
            if (insertError) {
              console.error(`[ERROR] Failed to insert error analysis for answer ${answer.id}:`, insertError);
            } else {
              successCount++;
              console.log(`[SUCCESS] Created error analysis placeholder for answer ${answer.id}`);
            }
          } catch (err) {
            console.error(`[ERROR] Exception analyzing answer ${answer.id}:`, err);
          }
        }
        
        if (successCount === 0 && answers.length > 0) {
          console.log('[DEBUG] No successful error analyses, falling back to frontend analysis');
          // Không thành công - đảm bảo UI hiển thị thông tin
          setTimeout(() => {
            const currentErrors = errorTypes || [];
            if (currentErrors.length === 0 || (currentErrors.length === 1 && currentErrors[0].type.includes('Đang'))) {
              setErrorTypes([
                { type: 'Phân tích trên frontend', count: 1 },
                { type: 'Không điền', count: 0 },
                { type: 'Sai chính tả', count: 0 },
                { type: 'Sai nghĩa', count: 0 }
              ]);
            }
          }, 500);
        }
        
        console.log('[DEBUG] Finished initializing error analysis');
      } else {
        console.log('[DEBUG] No completed answers found for analysis');
        
        // Không có bài hoàn thành - đảm bảo UI hiển thị thông tin
        setTimeout(() => {
          const currentErrors = errorTypes || [];
          if (currentErrors.length === 0 || (currentErrors.length === 1 && currentErrors[0].type.includes('Đang'))) {
            setErrorTypes([
              { type: 'Chưa có bài hoàn thành', count: 1 },
              { type: 'Cần hoàn thành bài tập', count: 0 }
            ]);
          }
        }, 500);
      }
    } catch (error) {
      console.error('[ERROR] Error in initializeErrorAnalysis:', error);
      
      // Đảm bảo UI hiển thị thông tin
      setTimeout(() => {
        const currentErrors = errorTypes || [];
        if (currentErrors.length === 0 || (currentErrors.length === 1 && currentErrors[0].type.includes('Đang'))) {
          setErrorTypes([
            { type: 'Lỗi khi phân tích', count: 1 },
            { type: 'Không điền', count: 0 },
            { type: 'Sai chính tả', count: 0 },
            { type: 'Sai nghĩa', count: 0 }
          ]);
        }
      }, 500);
    }
  };
  
  // Thêm hàm mới để tính overlap của từ vựng giữa hai chuỗi
  const wordOverlap = (a: string, b: string) => {
    const wordsA = new Set(a.split(' ').filter(w => w.length > 1));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 1));
    
    let overlap = 0;
    wordsA.forEach(word => {
      if (wordsB.has(word)) overlap++;
    });
    
    return wordsA.size > 0 ? overlap / wordsA.size : 0;
  };
  
  // Tính khoảng cách Levenshtein để kiểm tra lỗi chính tả
  const levenshteinDistance = (a: string, b: string) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  };
  
  // Function to get performance status
  const getPerformanceText = (score: number): string => {
    if (score >= 80) return 'Xuất sắc';
    if (score >= 70) return 'Tốt';
    if (score >= 50) return 'Đạt yêu cầu';
    return 'Chưa đạt yêu cầu';
  };
  
  // Function to get performance color
  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };
  
  // Calculate rank status
  const rankText = averageScore >= 80 ? 'Tốt' : averageScore >= 70 ? 'Trung bình' : 'Cần cải thiện';
  const rankColor = averageScore >= 80 ? 'bg-green-100 text-green-800' : 
                    averageScore >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800';

  // Handle class selection change
  const handleClassChange = (classId: string) => {
    console.log('Class selected:', classId);
    const selectedClass = allClasses.find(c => c.id === classId);
    console.log('Selected class details:', selectedClass);
    setSelectedClassId(classId);
    if (selectedClass) {
      setClassInfo(selectedClass);
      
      // Cập nhật thông tin xếp hạng của lớp được chọn
      if (user?.id) {
        fetchRankForClass(user.id, classId);
      }
    }
  };
  
  // Thêm hàm mới để lấy rank từ view khi chọn lớp mới
  const fetchRankForClass = async (studentId: string, classId: string) => {
    try {
      const { data, error } = await supabase
        .from('student_progress_summary_view')
        .select('rank, total_students, percentile_better')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .single();
        
      if (error) {
        console.error('Error fetching rank data for class:', error);
        return;
      }
      
      if (data) {
        console.log('Updated rank data:', data);
        setRankData({
          position: data.rank || 0,
          total: data.total_students || 0,
          percentile: `${data.percentile_better || 0}%`
        });
      }
    } catch (error) {
      console.error('Error in fetchRankForClass:', error);
    }
  };

  // Thêm lại function handleDropdownOpenChange
  const handleDropdownOpenChange = (open: boolean) => {
    setClassDropdownOpen(open);
  };

  // Thêm hàm mới để lấy màu sắc dựa trên điểm số
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return { 
      text: 'text-green-600',
      bg: 'bg-green-500',
      border: 'border-l-green-500',
      gradient: 'from-green-50'
    };
    if (score >= 70) return { 
      text: 'text-blue-600',
      bg: 'bg-blue-500',
      border: 'border-l-blue-500',
      gradient: 'from-blue-50'
    };
    if (score >= 50) return { 
      text: 'text-yellow-600',
      bg: 'bg-yellow-500',
      border: 'border-l-yellow-500',
      gradient: 'from-yellow-50'
    };
    return { 
      text: 'text-red-600',
      bg: 'bg-red-500',
      border: 'border-l-red-500',
      gradient: 'from-red-50'
    };
  };

  // Thêm hàm để lấy màu sắc dựa trên loại học sinh
  const getCategoryColors = (category: string) => {
    switch (category) {
      case 'good': 
        return { 
          text: 'text-green-600', 
          bg: 'bg-green-500',
          border: 'border-l-green-500',
          gradient: 'from-green-50',
          icon: 'text-green-500'
        };
      case 'average': 
        return { 
          text: 'text-yellow-600', 
          bg: 'bg-yellow-500',
          border: 'border-l-yellow-500',
          gradient: 'from-yellow-50',
          icon: 'text-yellow-500'
        };
      case 'poor': 
        return { 
          text: 'text-red-600', 
          bg: 'bg-red-500',
          border: 'border-l-red-500',
          gradient: 'from-red-50',
          icon: 'text-red-500'
        };
      default: 
        return { 
          text: 'text-gray-600', 
          bg: 'bg-gray-500',
          border: 'border-l-gray-400',
          gradient: 'from-gray-50',
          icon: 'text-gray-500'
        };
    }
  };

  // Thêm hàm để tính phần trăm thứ hạng và format hiển thị phù hợp
  const getPercentileDisplay = (position: number, total: number) => {
    if (position <= 0 || total <= 0) return { text: 'N/A', color: 'text-gray-600' };
    
    // Tính phần trăm thứ hạng (thấp là tốt, cao là thấp)
    // Ví dụ: Hạng 1/6 => (6-1)/6*100 = 83%
    const percentile = Math.round(((total - position) / total) * 100);
    
    let text = '';
    let color = '';
    
    if (position === 1) {
      text = `Đứng đầu lớp (tốt hơn ${percentile}% học sinh)`;
      color = 'text-green-600';
    } else if (position <= Math.ceil(total * 0.25)) {
      text = `Nhóm đầu (tốt hơn ${percentile}% học sinh)`;
      color = 'text-green-600';
    } else if (position <= Math.ceil(total * 0.5)) {
      text = `Trên trung bình (tốt hơn ${percentile}% học sinh)`;
      color = 'text-blue-600';
    } else if (position <= Math.ceil(total * 0.75)) {
      text = `Dưới trung bình (tốt hơn ${percentile}% học sinh)`;
      color = 'text-yellow-600';
    } else {
      text = `Nhóm cuối (tốt hơn ${percentile}% học sinh)`;
      color = 'text-red-600';
    }
    
    return { text, color };
  };

  // Thêm hàm để lấy màu sắc dựa trên thứ hạng
  const getRankColors = (position: number, total: number) => {
    if (position <= 0 || total <= 0) {
      return {
        text: 'text-gray-600',
        bg: 'bg-gray-500',
        border: 'border-l-gray-400',
        gradient: 'from-gray-50'
      };
    }
    
    if (position === 1) {
      return {
        text: 'text-green-600',
        bg: 'bg-green-500',
        border: 'border-l-green-500',
        gradient: 'from-green-50'
      };
    } else if (position <= Math.ceil(total * 0.25)) {
      return {
        text: 'text-blue-600',
        bg: 'bg-blue-500',
        border: 'border-l-blue-500',
        gradient: 'from-blue-50'
      };
    } else if (position <= Math.ceil(total * 0.5)) {
      return {
        text: 'text-yellow-600',
        bg: 'bg-yellow-500',
        border: 'border-l-yellow-500',
        gradient: 'from-yellow-50'
      };
    } else {
      return {
        text: 'text-red-600',
        bg: 'bg-red-500',
        border: 'border-l-red-500',
        gradient: 'from-red-50'
      };
    }
  };

  // Thêm hàm mới để lấy gợi ý cải thiện cho từng loại lỗi
  const getErrorImprovement = (errorType: string): string => {
    switch(errorType) {
      case 'Sai chính tả':
        return 'Tập trung luyện đánh vần và kiểm tra kỹ chính tả trước khi nộp bài.';
      case 'Thiếu từ':
        return 'Đọc kỹ câu hỏi và đảm bảo điền đầy đủ các từ cần thiết.';
      case 'Sai ngữ pháp':
        return 'Ôn lại các quy tắc ngữ pháp cơ bản và cấu trúc câu.';
      case 'Sai nghĩa':
        return 'Mở rộng vốn từ vựng và học các từ đồng nghĩa, trái nghĩa.';
      case 'Không điền':
        return 'Cố gắng trả lời tất cả các câu hỏi, không để trống.';
      case 'Sai thì':
        return 'Ôn lại các thì động từ và cách sử dụng thì phù hợp với ngữ cảnh.';
      default:
        return 'Tập trung làm bài cẩn thận và kiểm tra lại trước khi nộp.';
    }
  };

  // Thêm hàm lấy danh hiệu học sinh
  const getStudentTitle = (category: string, score: number, rank: number, total: number): StudentTitle => {
    // Danh hiệu cho học sinh giỏi
    if (category === 'good') {
      if (rank === 1) {
        return {
          title: "Nhà vô địch học tập",
          emoji: "🏆",
          description: "Dẫn đầu cả lớp với thành tích xuất sắc!",
          color: "text-green-600"
        };
      } else if (rank <= Math.ceil(total * 0.1)) {
        return {
          title: "Học sinh xuất sắc",
          emoji: "🌟",
          description: "Bạn thuộc top 10% học sinh xuất sắc nhất!",
          color: "text-green-600"
        };
      } else {
        return {
          title: "Thiên tài tương lai",
          emoji: "🧠",
          description: "Bạn có năng khiếu đặc biệt!",
          color: "text-green-600"
        };
      }
    }
    
    // Danh hiệu cho học sinh trung bình
    if (category === 'average') {
      if (score >= 60) {
        return {
          title: "Ngôi sao đang lên",
          emoji: "⭐",
          description: "Tiến bộ rõ rệt, tiếp tục phát huy!",
          color: "text-yellow-600"
        };
      } else {
        return {
          title: "Người học kiên trì",
          emoji: "🔍",
          description: "Chăm chỉ là chìa khóa thành công!",
          color: "text-yellow-600"
        };
      }
    }
    
    // Danh hiệu cho học sinh yếu - vẫn phải tích cực để động viên
    if (category === 'poor') {
      if (score >= 40) {
        return {
          title: "Người có tiềm năng",
          emoji: "💫",
          description: "Bạn có tiềm năng lớn, hãy phát huy!",
          color: "text-orange-600"
        };
      } else if (score >= 20) {
        return {
          title: "Chiến binh không ngại khó",
          emoji: "🔥",
          description: "Mỗi thử thách là cơ hội trưởng thành!",
          color: "text-orange-600"
        };
      } else {
        return {
          title: "Người khám phá tri thức",
          emoji: "🚀",
          description: "Hành trình học tập mới bắt đầu!",
          color: "text-orange-600"
        };
      }
    }
    
    // Danh hiệu mặc định
    return {
      title: "Học sinh năng động",
      emoji: "📚",
      description: "Học hỏi không ngừng!",
      color: "text-blue-600"
    };
  };

  // Thêm hàm lấy danh hiệu xếp hạng
  const getRankTitle = (position: number, total: number): RankTitle => {
    if (position <= 0 || total <= 0) {
      return {
        title: "Chưa có dữ liệu",
        emoji: "📊",
        description: "Hoàn thành bài kiểm tra để xem thứ hạng",
        color: "text-gray-600",
        bgColor: "bg-gray-100"
      };
    }

    if (position === 1) {
      return {
        title: "Quán quân",
        emoji: "👑",
        description: "Bạn là người giỏi nhất lớp!",
        color: "text-yellow-700",
        bgColor: "bg-yellow-100"
      };
    }

    if (position <= Math.ceil(total * 0.1)) {
      return {
        title: "Top 10%",
        emoji: "🏆",
        description: "Xuất sắc! Tiếp tục phát huy nhé!",
        color: "text-green-700",
        bgColor: "bg-green-100"
      };
    }

    if (position <= Math.ceil(total * 0.25)) {
      return {
        title: "Top 25%",
        emoji: "🌟",
        description: "Bạn đang làm rất tốt!",
        color: "text-blue-700",
        bgColor: "bg-blue-100"
      };
    }

    if (position <= Math.ceil(total * 0.5)) {
      return {
        title: "Top 50%",
        emoji: "⭐",
        description: "Cố gắng thêm nữa nhé!",
        color: "text-purple-700",
        bgColor: "bg-purple-100"
      };
    }

    return {
      title: "Khởi đầu",
      emoji: "🎯",
      description: "Mỗi ngày một tiến bộ!",
      color: "text-orange-700",
      bgColor: "bg-orange-100"
    };
  };

  // Thêm hàm lấy danh hiệu điểm số
  const getScoreTitle = (score: number): ScoreTitle => {
    if (score >= 90) {
      return {
        title: "Xuất sắc",
        emoji: "🌟",
        description: "Thành tích học tập tuyệt vời!",
        color: "text-green-700",
        bgColor: "bg-green-100"
      };
    }
    if (score >= 80) {
      return {
        title: "Giỏi",
        emoji: "✨",
        description: "Tiếp tục phát huy phong độ!",
        color: "text-blue-700",
        bgColor: "bg-blue-100"
      };
    }
    if (score >= 65) {
      return {
        title: "Khá",
        emoji: "⭐",
        description: "Đang tiến bộ tốt!",
        color: "text-yellow-700",
        bgColor: "bg-yellow-100"
      };
    }
    if (score >= 50) {
      return {
        title: "Trung bình",
        emoji: "💫",
        description: "Cần cố gắng nhiều hơn!",
        color: "text-orange-700",
        bgColor: "bg-orange-100"
      };
    }
    return {
      title: "Cần cải thiện",
      emoji: "🎯",
      description: "Hãy nỗ lực học tập!",
      color: "text-red-700",
      bgColor: "bg-red-100"
    };
  };

  // Trong useEffect, thêm hiệu ứng confetti khi điểm cao
  useEffect(() => {
    if (top5AverageScore >= 80) {
      setShowConfetti(true);
      // Tắt hiệu ứng sau 5 giây
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [top5AverageScore]);

  // Thêm hàm tính toán thành tích
  const calculateAchievements = async (studentId: string) => {
    try {
      // Lấy lịch sử điểm số
      const { data: scoreHistory, error: scoreError } = await supabase
        .from('student_answers')
        .select('score, completed_at')
        .eq('student_id', studentId)
        .eq('is_completed', true)
        .order('completed_at', { ascending: true });

      if (scoreError) throw scoreError;

      // Tính toán các thành tích
      const achievements: Achievement[] = [];
      
      // Thành tích điểm số
      if (top5AverageScore >= 90) {
        achievements.push({
          id: 'score-90',
          title: 'Xuất Sắc',
          description: 'Đạt điểm trung bình trên 9.0',
          icon: '🏆',
          type: 'score',
          condition: 90,
          achieved: true,
          achievedDate: new Date().toISOString(),
          progress: 100
        });
      }

      // Thành tích xếp hạng
      if (rankData.position === 1) {
        achievements.push({
          id: 'rank-1',
          title: 'Quán Quân',
          description: 'Đứng đầu lớp',
          icon: '👑',
          type: 'rank',
          condition: 1,
          achieved: true,
          achievedDate: new Date().toISOString(),
          progress: 100
        });
      }

      // Tính chuỗi thành tích
      let currentStreak = 0;
      let bestStreak = 0;
      let lastDate: Date | null = null;
      const streakHistory: { date: string; maintained: boolean }[] = [];

      scoreHistory?.forEach((record) => {
        const recordDate = new Date(record.completed_at);
        
        if (!lastDate) {
          currentStreak = 1;
          streakHistory.push({
            date: record.completed_at,
            maintained: true
          });
        } else {
          const daysDiff = Math.floor((recordDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= 1) {
            currentStreak++;
            streakHistory.push({
              date: record.completed_at,
              maintained: true
            });
          } else {
            if (currentStreak > bestStreak) {
              bestStreak = currentStreak;
            }
            currentStreak = 1;
            streakHistory.push({
              date: record.completed_at,
              maintained: false
            });
          }
        }
        
        lastDate = recordDate;
      });

      // Cập nhật streak record
      setStreakRecord({
        currentStreak,
        bestStreak: Math.max(bestStreak, currentStreak),
        lastActivityDate: lastDate?.toISOString() || '',
        streakHistory
      });

      // Thêm thành tích streak
      if (currentStreak >= 7) {
        achievements.push({
          id: 'streak-7',
          title: 'Siêng Năng',
          description: '7 ngày liên tiếp học tập',
          icon: '🔥',
          type: 'streak',
          condition: 7,
          achieved: true,
          achievedDate: new Date().toISOString(),
          progress: 100
        });
      }

      // Tính toán dự đoán
      const recentScores = scoreHistory?.slice(-5).map(record => record.score) || [];
      const averageScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const trend = recentScores[recentScores.length - 1] > averageScore ? 'up' : 
                   recentScores[recentScores.length - 1] < averageScore ? 'down' : 'stable';

      setPredictions({
        nextScore: Math.min(100, averageScore + (trend === 'up' ? 5 : trend === 'down' ? -2 : 0)),
        confidence: 0.7,
        trend,
        factors: [
          { factor: 'Điểm gần đây', impact: 0.6 },
          { factor: 'Tần suất học tập', impact: 0.4 }
        ]
      });

      // Cập nhật state
      setAchievements(achievements);

      // Kiểm tra thành tích mới
      const lastAchieved = achievements.find(a => 
        !previousAchievements?.some(pa => pa.id === a.id)
      );
      
      if (lastAchieved) {
        setLastAchievement(lastAchieved);
        setShowAchievementAnimation(true);
        setTimeout(() => setShowAchievementAnimation(false), 5000);
      }

    } catch (error) {
      console.error('Error calculating achievements:', error);
    }
  };

  // Thêm useEffect để theo dõi thành tích
  useEffect(() => {
    if (user?.id) {
      calculateAchievements(user.id);
    }
  }, [top5AverageScore, rankData.position]);

  // Thay đổi cách render UI với animation và icons
  if (isLoading) {
    return (
      <StudentLayout>
        <div className="container mx-auto p-6">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </StudentLayout>
    );
  }

  const generateSafePath = (data: ProgressDataPoint[]): string => {
    if (!data || data.length === 0) return '';
    
    return data
      .map((d, i) => {
        if (!d || typeof d.score !== 'number') return '';
        const x = Number.isFinite(i / (data.length - 1)) ? (i / (data.length - 1)) * 100 : 0;
        const y = Number.isFinite(d.score) ? 100 - d.score : 0;
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .filter(Boolean)
      .join(' ');
  };

  // Thay đổi Card hiển thị xếp loại học sinh
  return (
    <StudentLayout>
      <motion.div 
        className="container mx-auto p-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">Kết quả học tập</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div variants={cardVariants}>
              <Card className={`overflow-hidden border-l-4 ${getScoreColorClass(top5AverageScore).border} shadow-md hover:shadow-lg transition-shadow h-full relative`}>
                {top5AverageScore >= 80 && (
                  <motion.div 
                    className="absolute -top-10 left-0 right-0 flex justify-center"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="text-4xl">✨🌟⭐</div>
                  </motion.div>
                )}

                <CardHeader className={`pb-2 bg-gradient-to-r ${getScoreColorClass(top5AverageScore).gradient} to-transparent`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Star className={`h-5 w-5 mr-2 ${getScoreColorClass(top5AverageScore).text}`} />
                        Điểm trung bình
                      </CardTitle>
                      <CardDescription>Điểm trung bình 5 bài gần nhất</CardDescription>
                    </div>
                    <motion.div 
                      whileHover={{ rotate: 360, scale: 1.2 }} 
                      transition={{ duration: 0.8 }}
                      className={`rounded-full p-2 text-white ${getScoreColorClass(top5AverageScore).bg}`}
                    >
                      <TrendingUp className="h-5 w-5" />
                    </motion.div>
                  </div>
            </CardHeader>

                <CardContent className="pt-4">
                  <div className="flex flex-col items-center justify-center">
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                      className={`text-4xl font-bold ${getScoreColorClass(top5AverageScore).text}`}
                    >
                      {(top5AverageScore/10).toFixed(1)}
                    </motion.div>
                    
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      onMouseEnter={() => setScoreBadgeHover(true)}
                      onMouseLeave={() => setScoreBadgeHover(false)}
                      className="mt-3"
                    >
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400 }}
                        className={`rounded-full px-4 py-1.5 ${getScoreTitle(top5AverageScore).bgColor} ${getScoreTitle(top5AverageScore).color} flex items-center justify-center space-x-2`}
                      >
                        <motion.span
                          animate={{ rotate: scoreBadgeHover ? [0, 15, -15, 15, 0] : 0 }}
                          transition={{ duration: 0.5 }}
                          className="text-lg"
                        >
                          {getScoreTitle(top5AverageScore).emoji}
                        </motion.span>
                        <span className="font-semibold text-sm">
                          {getScoreTitle(top5AverageScore).title}
                        </span>
                      </motion.div>
                    </motion.div>
                    
                    <div className="w-full mt-3 mb-1">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-xs text-red-500 font-semibold">Yếu</div>
                        <div className="text-xs text-yellow-500 font-semibold">Trung bình</div>
                        <div className="text-xs text-blue-500 font-semibold">Khá</div>
                        <div className="text-xs text-green-500 font-semibold">Giỏi</div>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full relative">
                        <div className="absolute top-0 left-1/4 h-full w-0.5 bg-gray-300"></div>
                        <div className="absolute top-0 left-1/2 h-full w-0.5 bg-gray-300"></div>
                        <div className="absolute top-0 left-3/4 h-full w-0.5 bg-gray-300"></div>
                      <motion.div 
                        initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, top5AverageScore)}%` }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className={`h-full rounded-full ${getScoreColorClass(top5AverageScore).bg}`}
                      />
                        <motion.div
                          className="absolute top-0 -mt-1"
                          style={{ left: `${Math.min(100, top5AverageScore)}%` }}
                          animate={{ y: [0, -3, 0, -3, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 border-white shadow-md ${getScoreColorClass(top5AverageScore).bg} flex items-center justify-center`}>
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                        </motion.div>
                      </div>
              </div>
                    
                    <div 
                      className={`text-sm mt-2 font-medium ${getScoreColorClass(top5AverageScore).text}`}
                      onMouseEnter={() => setScoreTitleHovered(true)}
                      onMouseLeave={() => setScoreTitleHovered(false)}
                    >
                      <motion.div 
                        className="flex items-center"
                        animate={{ scale: scoreTitleHovered ? 1.05 : 1 }}
                        transition={{ duration: 0.3 }}
                      >
                      <Sparkles className="h-4 w-4 mr-1" />
                        <span>
                          {getScoreTitle(top5AverageScore).description}
                        </span>
                      </motion.div>
                    </div>
                    
                    {top5AverageScore < 50 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-3 text-xs bg-gradient-to-r from-orange-50 to-red-50 py-1.5 px-3 rounded-full font-medium flex items-center"
                      >
                        <motion.span
                          animate={{ scale: [1, 1.2, 1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="mr-1 text-orange-500"
                        >
                          💪
                        </motion.span>
                        <span className="text-orange-600">Cần cải thiện ngay lập tức!</span>
                      </motion.div>
                    )}
                  </div>
            </CardContent>
          </Card>
            </motion.div>
            
            <motion.div variants={cardVariants}>
              <Card className={`overflow-hidden border-l-4 ${getCategoryColors(studentCategory).border} shadow-md hover:shadow-lg transition-shadow h-full relative`}>
                {showConfetti && studentCategory === 'good' && (
                  <motion.div 
                    className="absolute -top-10 left-0 right-0 flex justify-center"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="text-4xl">🎉🎊✨</div>
                  </motion.div>
                )}
                
                <CardHeader className={`pb-2 bg-gradient-to-r ${getCategoryColors(studentCategory).gradient} to-transparent`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Medal className={`h-5 w-5 mr-2 ${getCategoryColors(studentCategory).icon}`} />
                        Xếp loại
                      </CardTitle>
                      <CardDescription>Loại học sinh hiện tại</CardDescription>
                    </div>
                    <motion.div 
                      whileHover={{ rotate: 360, scale: 1.2 }} 
                      transition={{ duration: 0.8 }}
                      className={`rounded-full p-2 text-white ${getCategoryColors(studentCategory).bg}`}
                    >
                      <Award className="h-5 w-5" />
                    </motion.div>
                  </div>
            </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col items-center justify-center">
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }} 
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                      className={`text-3xl font-bold ${getCategoryColors(studentCategory).text}`}
                    >
                      {studentCategory === 'poor' ? 'Yếu' : 
                       studentCategory === 'average' ? 'Trung bình' : 
                       studentCategory === 'good' ? 'Giỏi' : 'Chưa xác định'}
                    </motion.div>
                    
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      onMouseEnter={() => setBadgeHover(true)}
                      onMouseLeave={() => setBadgeHover(false)}
                      className="mt-3"
                    >
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400 }}
                        className={`rounded-full px-4 py-1.5 ${
                          studentCategory === 'good' ? 'bg-green-100 text-green-800' :
                          studentCategory === 'average' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        } flex items-center justify-center space-x-2`}
                      >
                        <motion.span
                          animate={{ rotate: badgeHover ? [0, 15, -15, 15, 0] : 0 }}
                          transition={{ duration: 0.5 }}
                          className="text-lg"
                        >
                          {getStudentTitle(studentCategory, top5AverageScore, rankData.position, rankData.total).emoji}
                        </motion.span>
                        <span className="font-semibold text-sm">
                          {getStudentTitle(studentCategory, top5AverageScore, rankData.position, rankData.total).title}
                        </span>
                      </motion.div>
                    </motion.div>
                    
                    <div className="w-full mt-3 mb-1">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-xs text-red-500 font-semibold">Yếu</div>
                        <div className="text-xs text-yellow-500 font-semibold">Trung bình</div>
                        <div className="text-xs text-green-500 font-semibold">Giỏi</div>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full relative">
                        <div className="absolute top-0 left-1/3 h-full w-0.5 bg-gray-300"></div>
                        <div className="absolute top-0 left-2/3 h-full w-0.5 bg-gray-300"></div>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ 
                            width: studentCategory === 'poor' ? '30%' : 
                                   studentCategory === 'average' ? '65%' : 
                                   studentCategory === 'good' ? '95%' : '0%'
                          }}
                          transition={{ duration: 0.8, delay: 0.3 }}
                          className={`h-full rounded-full ${getCategoryColors(studentCategory).bg}`}
                        />
                        <motion.div
                          className="absolute top-0 -mt-1"
                          style={{ 
                            left: `${studentCategory === 'poor' ? 30 : 
                                  studentCategory === 'average' ? 65 : 
                                  studentCategory === 'good' ? 95 : 0}%`
                          }}
                          animate={{ y: [0, -3, 0, -3, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 border-white shadow-md ${getCategoryColors(studentCategory).bg} flex items-center justify-center`}>
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                    
                    <div 
                      className={`text-sm mt-2 font-medium ${getCategoryColors(studentCategory).text}`}
                      onMouseEnter={() => setTitleHovered(true)}
                      onMouseLeave={() => setTitleHovered(false)}
                    >
                      <motion.div 
                        className="flex items-center"
                        animate={{ scale: titleHovered ? 1.05 : 1 }}
                        transition={{ duration: 0.3 }}
                      >
                      <BookOpen className="h-4 w-4 mr-1" />
                        <span>
                          {getStudentTitle(studentCategory, top5AverageScore, rankData.position, rankData.total).description}
                        </span>
                      </motion.div>
                    </div>
                    
                    {studentCategory === 'poor' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-3 text-xs bg-gradient-to-r from-orange-50 to-red-50 py-1.5 px-3 rounded-full font-medium flex items-center"
                      >
                        <motion.span
                          animate={{ scale: [1, 1.2, 1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="mr-1 text-orange-500"
                        >
                          💪
                        </motion.span>
                        <span className="text-orange-600">Nỗ lực mỗi ngày sẽ mang lại thành công!</span>
                      </motion.div>
                    )}
                  </div>
            </CardContent>
          </Card>
            </motion.div>
            
            <motion.div variants={cardVariants}>
              <Card className={`overflow-hidden border-l-4 ${getRankColors(rankData.position, rankData.total).border} shadow-md hover:shadow-lg transition-shadow h-full relative`}>
                {rankData.position === 1 && (
                  <motion.div 
                    className="absolute -top-10 left-0 right-0 flex justify-center"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="text-4xl">👑✨🎉</div>
                  </motion.div>
                )}

                <CardHeader className={`pb-2 bg-gradient-to-r ${getRankColors(rankData.position, rankData.total).gradient} to-transparent`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Trophy className={`h-5 w-5 mr-2 ${getRankColors(rankData.position, rankData.total).text}`} />
                        Xếp hạng lớp
                      </CardTitle>
                      <div className="text-sm text-muted-foreground">
                        <span className="block mb-2">Thứ hạng trong lớp {classInfo.name}</span>
                        
                        <motion.div
                          initial={false}
                          animate={classDropdownOpen ? "visible" : "hidden"}
                          variants={{
                            visible: { scale: 1.03 },
                            hidden: { scale: 1 }
                          }}
                          className="relative"
                        >
                          <Select 
                            value={selectedClassId} 
                            onValueChange={handleClassChange}
                            onOpenChange={handleDropdownOpenChange}
                          >
                            <SelectTrigger className="w-full h-8 border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors flex items-center justify-between">
                              <div className="flex items-center truncate">
                                <Users className="h-4 w-4 mr-2 text-amber-500" />
                                <SelectValue placeholder="Chọn lớp để xem xếp hạng" />
                              </div>
                              <motion.div
                                animate={classDropdownOpen ? { rotate: 180 } : { rotate: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="h-4 w-4 text-amber-500" />
                              </motion.div>
                            </SelectTrigger>
                            <SelectContent className="border-amber-200 bg-white z-50">
                              {allClasses.map((cls) => (
                                <SelectItem 
                                  key={cls.id} 
                                  value={cls.id}
                                  className="hover:bg-amber-50 focus:bg-amber-50 cursor-pointer"
                                >
                                  <div className="flex items-center">
                                    {cls.id === selectedClassId && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 300 }}
                                      >
                                        <Star className="h-4 w-4 mr-2 text-amber-500" />
                                      </motion.div>
                                    )}
                                    {cls.id !== selectedClassId && <div className="w-6" />}
                                    {cls.name}
                                  </div>
                                </SelectItem>
                              ))}
                              {allClasses.length === 0 && (
                                <SelectItem value="no-class" disabled>
                                  Không có lớp nào
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </motion.div>
                      </div>
                    </div>
                            <motion.div
                      whileHover={{ rotate: 360, scale: 1.2 }} 
                      transition={{ duration: 0.8 }}
                      className={`rounded-full p-2 text-white ${getRankColors(rankData.position, rankData.total).bg}`}
                    >
                      <Trophy className="h-5 w-5" />
                            </motion.div>
                  </div>
            </CardHeader>

                <CardContent className="pt-4">
                  <div className="flex flex-col items-center justify-center">
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }} 
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                      className={`text-4xl font-bold ${getRankColors(rankData.position, rankData.total).text}`}
                    >
                      {rankData.position > 0 ? 
                        `${rankData.position}/${rankData.total}` : 
                        'Chưa có dữ liệu'}
                    </motion.div>

                    {rankData.position > 0 && rankData.total > 0 && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        onMouseEnter={() => setRankBadgeHover(true)}
                        onMouseLeave={() => setRankBadgeHover(false)}
                        className="mt-3"
                      >
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400 }}
                          className={`rounded-full px-4 py-1.5 ${getRankTitle(rankData.position, rankData.total).bgColor} ${getRankTitle(rankData.position, rankData.total).color} flex items-center justify-center space-x-2`}
                        >
                          <motion.span
                            animate={{ rotate: rankBadgeHover ? [0, 15, -15, 15, 0] : 0 }}
                            transition={{ duration: 0.5 }}
                            className="text-lg"
                          >
                            {getRankTitle(rankData.position, rankData.total).emoji}
                          </motion.span>
                          <span className="font-semibold text-sm">
                            {getRankTitle(rankData.position, rankData.total).title}
                          </span>
                        </motion.div>
                      </motion.div>
                    )}
                    
                    {rankData.position > 0 && rankData.total > 0 && (
                      <div className="w-full mt-3 mb-1">
                        <div className="flex justify-between items-center mb-1">
                          <div className="text-xs text-green-500 font-semibold">Top 1</div>
                          <div className="text-xs text-blue-500 font-semibold">Top 25%</div>
                          <div className="text-xs text-yellow-500 font-semibold">Top 50%</div>
                          <div className="text-xs text-red-500 font-semibold">Cuối</div>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full relative">
                          <div className="absolute top-0 left-1/4 h-full w-0.5 bg-gray-300"></div>
                          <div className="absolute top-0 left-1/2 h-full w-0.5 bg-gray-300"></div>
                          <div className="absolute top-0 left-3/4 h-full w-0.5 bg-gray-300"></div>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(1 - (rankData.position - 1) / rankData.total) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className={`h-full rounded-full ${getRankColors(rankData.position, rankData.total).bg}`}
                          />
                          <motion.div
                            className="absolute top-0 -mt-1"
                            style={{ 
                              left: `${(1 - (rankData.position - 1) / rankData.total) * 100}%`
                            }}
                            animate={{ y: [0, -3, 0, -3, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-md ${getRankColors(rankData.position, rankData.total).bg} flex items-center justify-center`}>
                              <div className="w-1 h-1 bg-white rounded-full"></div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    )}
                    
                    <div 
                      className={`text-sm mt-2 font-medium ${getRankColors(rankData.position, rankData.total).text}`}
                      onMouseEnter={() => setRankTitleHovered(true)}
                      onMouseLeave={() => setRankTitleHovered(false)}
                    >
                      <motion.div 
                        className="flex items-center"
                        animate={{ scale: rankTitleHovered ? 1.05 : 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Trophy className="h-4 w-4 mr-1" />
                        <span>
                          {getRankTitle(rankData.position, rankData.total).description}
                        </span>
                      </motion.div>
                      </div>
                    
                    {rankData.position > Math.ceil(rankData.total * 0.75) && rankData.position > 0 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-3 text-xs bg-gradient-to-r from-orange-50 to-red-50 py-1.5 px-3 rounded-full font-medium flex items-center"
                      >
                        <motion.span
                          animate={{ scale: [1, 1.2, 1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="mr-1 text-orange-500"
                        >
                          💪
                        </motion.span>
                        <span className="text-orange-600">Cố gắng lên! Bạn có thể làm được!</span>
                      </motion.div>
                    )}
                  </div>
            </CardContent>
          </Card>
            </motion.div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thêm card thành tích */}
          <motion.div variants={cardVariants}>
            <Card className="shadow-md hover:shadow-lg transition-shadow overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Medal className="h-5 w-5 text-purple-500" />
                    <div>
                      <CardTitle>Thành tích</CardTitle>
                      <CardDescription>Các thành tích đã đạt được</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-purple-50">
                      <Trophy className="h-4 w-4 mr-1 text-purple-500" />
                      {achievements.length} thành tích
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {showAchievementAnimation && lastAchievement && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="mb-4 bg-gradient-to-r from-purple-50 to-transparent p-4 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-3xl">{lastAchievement.icon}</div>
                      <div>
                        <div className="font-semibold text-purple-700">
                          Thành tích mới!
                        </div>
                        <div className="text-sm text-purple-600">
                          {lastAchievement.title} - {lastAchievement.description}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4">
                  {achievements.map((achievement, index) => (
                    <motion.div
                      key={achievement.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-transparent hover:from-purple-100 transition-colors"
                    >
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="text-2xl"
                      >
                        {achievement.icon}
                      </motion.div>
                      <div className="flex-1">
                        <div className="font-semibold text-purple-700">
                          {achievement.title}
                        </div>
                        <div className="text-sm text-purple-600">
                          {achievement.description}
                        </div>
                      </div>
                      <div className="text-xs text-purple-500">
                        {new Date(achievement.achievedDate!).toLocaleDateString('vi-VN')}
                      </div>
                    </motion.div>
                  ))}

                  {achievements.length === 0 && (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-purple-200 mx-auto mb-2" />
                      <p className="text-purple-600">Chưa có thành tích nào</p>
                      <p className="text-sm text-purple-500 mt-1">
                        Hãy tiếp tục cố gắng để đạt được các thành tích!
                      </p>
                    </div>
                  )}
                </div>

                {streakRecord.currentStreak > 0 && (
                  <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-amber-50 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          🔥
                        </motion.div>
                        <div>
                          <div className="font-semibold text-amber-700">
                            Chuỗi học tập: {streakRecord.currentStreak} ngày
                          </div>
                          <div className="text-xs text-amber-600">
                            Kỷ lục: {streakRecord.bestStreak} ngày
                          </div>
                        </div>
                      </div>
                      <div className="text-amber-500 text-sm">
                        Tiếp tục phát huy!
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Thêm card dự đoán */}
          <motion.div variants={cardVariants}>
            <Card className="shadow-md hover:shadow-lg transition-shadow overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-cyan-500" />
                    <div>
                      <CardTitle>Dự đoán & Phân tích</CardTitle>
                      <CardDescription>Xu hướng học tập của bạn</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-6">
                  {/* Dự đoán điểm số */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-50 to-transparent">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-cyan-700">Dự đoán điểm số tiếp theo</div>
                      <Badge variant="outline" className={`
                        ${predictions.trend === 'up' ? 'text-green-600 bg-green-50' :
                          predictions.trend === 'down' ? 'text-red-600 bg-red-50' :
                          'text-blue-600 bg-blue-50'}
                      `}>
                        <motion.div
                          animate={{
                            rotate: predictions.trend === 'up' ? 45 :
                                   predictions.trend === 'down' ? -45 : 0
                          }}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                        </motion.div>
                        {predictions.trend === 'up' ? 'Đang tăng' :
                         predictions.trend === 'down' ? 'Đang giảm' : 'Ổn định'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl font-bold text-cyan-600">
                        {(predictions.nextScore/10).toFixed(1)}
                      </div>
                      <div className="text-sm text-cyan-600">
                        Độ tin cậy: {(predictions.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-medium text-cyan-700 mb-2">
                        Các yếu tố ảnh hưởng:
                      </div>
                      <div className="space-y-2">
                        {predictions.factors.map((factor, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="text-sm text-cyan-600">{factor.factor}</div>
                            <div className="w-32 h-2 bg-cyan-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${factor.impact * 100}%` }}
                                transition={{ duration: 1, delay: index * 0.2 }}
                                className="h-full bg-cyan-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Biểu đồ xu hướng */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-50 to-transparent">
                    <div className="font-semibold text-cyan-700 mb-4">Xu hướng điểm số</div>
                    <div className="h-32 relative">
                      {progressData.length > 0 && (
                        <>
                          <motion.svg
                            className="w-full h-full"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 2 }}
                          >
                            <defs>
                              <linearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#06b6d4" />
                                <stop offset="100%" stopColor="#0891b2" />
                              </linearGradient>
                            </defs>
                            <path
                              d={generateSafePath(progressData)}
                              fill="none"
                              stroke="url(#trendGradient)"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </motion.svg>
                          
                          {/* Điểm dữ liệu */}
                          {progressData.map((data, index) => (
                            <motion.div
                              key={index}
                              className="absolute w-3 h-3"
                              style={{
                                left: `${(index / (progressData.length - 1)) * 100}%`,
                                top: `${100 - data.score}%`,
                                transform: 'translate(-50%, -50%)'
                              }}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <div className="w-full h-full bg-white rounded-full border-2 border-cyan-500" />
                            </motion.div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Existing grid continues */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={cardVariants}>
              <Card className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-indigo-50 to-transparent">
                  <div className="flex items-center space-x-2">
                    <LineChartIcon className="h-5 w-5 text-indigo-500" />
              <div>
                <CardTitle>Tiến độ theo thời gian</CardTitle>
                <CardDescription>Điểm số của bạn theo thời gian</CardDescription>
                    </div>
              </div>
              <Tabs value={progressViewMode} onValueChange={(value) => setProgressViewMode(value as 'daily' | 'monthly')}>
                    <TabsList className="bg-indigo-100">
                      <TabsTrigger value="daily" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        Theo ngày
                      </TabsTrigger>
                      <TabsTrigger value="monthly" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                        Theo tháng
                      </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
                <CardContent className="h-64 pt-4">
              {testProgress.highest.length > 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="relative"
                    >
                      <div className="absolute -top-2 left-0 right-0 flex justify-between px-6 text-xs text-gray-500">
                        <div>Thấp nhất: {Math.min(...testProgress.highest.map(d => d.highestScore))}</div>
                        <div>Cao nhất: {Math.max(...testProgress.highest.map(d => d.highestScore))}</div>
                      </div>
                      <div className="w-full h-[220px] relative">
                        {/* Grid lines */}
                        {[0, 25, 50, 75, 100].map((score) => (
                          <div 
                            key={score} 
                            className="absolute w-full h-[1px] bg-gray-100"
                            style={{ bottom: `${(score / 100) * 200}px` }}
                          >
                            <span className="absolute -left-6 -top-2 text-xs text-gray-400">{score}</span>
                          </div>
                        ))}
                        
                        {/* Highest scores line */}
                        <motion.svg 
                          className="w-full h-full absolute top-0 left-0" 
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1, ease: "easeInOut" }}
                          preserveAspectRatio="none"
                          viewBox={`0 0 100 100`}
                        >
                          <defs>
                            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#3b82f6" />
                            </linearGradient>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="2" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                          </defs>
                          <path 
                            d={generateSafePath(testProgress.highest.map(h => ({
                              date: h.date,
                              score: h.highestScore
                            })))}
                            fill="none" 
                            stroke="url(#lineGradient)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#glow)"
                            vectorEffect="non-scaling-stroke"
                          />
                        </motion.svg>
                        
                        {/* Data points with tooltips */}
                        {testProgress.highest.map((data, index) => {
                          const x = `${(index / (testProgress.highest.length - 1)) * 100}%`;
                          const y = `${(100 - data.highestScore) / 100 * 200}px`;
                          
                          return (
                            <motion.div
                              key={data.testId} 
                              className="absolute w-4 h-4 -ml-2 -mt-2 cursor-pointer"
                              style={{
                                left: x,
                                top: y
                              }}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              whileHover={{ scale: 1.5 }}
                            >
                              <div className="w-full h-full bg-white rounded-full border-2 border-indigo-500 relative group flex items-center justify-center">
                                <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                <div className="absolute top-[-80px] left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-indigo-600 text-white text-xs py-2 px-3 rounded whitespace-nowrap shadow-md z-10">
                                  <div className="font-medium mb-1">{data.testTitle}</div>
                                  <div className="flex items-center gap-2">
                                    <span>Điểm cao nhất: {data.highestScore}</span>
                                    <span>•</span>
                                    <span>Số lần làm: {data.attempts}</span>
                                  </div>
                                  {data.improvement > 0 && (
                                    <div className="text-indigo-200 mt-1">
                                      Có thể cải thiện thêm {data.improvement} điểm
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                        
                        {/* Area gradient */}
                        <motion.svg 
                          className="w-full h-full absolute top-0 left-0 z-0" 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.7 }}
                          transition={{ duration: 1.5 }}
                          preserveAspectRatio="none"
                          viewBox={`0 0 100 100`}
                        >
                          <defs>
                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
                              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path 
                            d={`${generateSafePath(testProgress.highest.map(h => ({
                              date: h.date,
                              score: h.highestScore
                            })))} L 100 100 L 0 100 Z`}
                            fill="url(#areaGradient)" 
                            stroke="none"
                          />
                        </motion.svg>
                      </div>
                      
                      {/* Time labels */}
                      <div className="flex justify-between mt-2 px-2 text-xs text-gray-500">
                        {testProgress.highest.map((data, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="transform -rotate-45 origin-top-left"
                          >
                            {data.date.toLocaleDateString('vi-VN')}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                      <Calendar className="h-12 w-12 text-gray-300 mb-2" />
                  <p className="text-gray-500 mb-2">Chưa có dữ liệu tiến độ</p>
                  <p className="text-sm text-gray-400">Hoàn thành các bài kiểm tra để xem tiến độ của bạn</p>
                </div>
              )}
            </CardContent>
          </Card>
            </motion.div>
            
            <motion.div variants={cardVariants}>
              <Card className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-r from-teal-50 to-transparent">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-teal-500" />
                    <div>
              <CardTitle>Phân tích lỗi</CardTitle>
              <CardDescription>Các loại lỗi thường gặp</CardDescription>
                    </div>
                  </div>
            </CardHeader>
                <CardContent className="h-64 pt-4">
              {errorTypes.length > 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="h-full overflow-y-auto"
                    >
                      <Tabs defaultValue="types">
                        <TabsList className="mb-4">
                          <TabsTrigger value="types">Loại lỗi</TabsTrigger>
                          <TabsTrigger value="words">Từ hay sai</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="types" className="h-[200px]">
                          <div className="relative h-full">
                            <div className="absolute inset-0">
                              <Bar
                                data={{
                                  labels: errorTypes.map(e => e.type),
                                  datasets: [
                                    {
                                      label: 'Số lỗi',
                                      data: errorTypes.map(e => e.count),
                                      backgroundColor: [
                                        'rgba(75, 192, 192, 0.6)',
                                        'rgba(255, 159, 64, 0.6)',
                                        'rgba(255, 99, 132, 0.6)',
                                        'rgba(153, 102, 255, 0.6)',
                                        'rgba(54, 162, 235, 0.6)',
                                        'rgba(255, 206, 86, 0.6)',
                                      ],
                                      borderColor: [
                                        'rgba(75, 192, 192, 1)',
                                        'rgba(255, 159, 64, 1)',
                                        'rgba(255, 99, 132, 1)',
                                        'rgba(153, 102, 255, 1)',
                                        'rgba(54, 162, 235, 1)',
                                        'rgba(255, 206, 86, 1)',
                                      ],
                                      borderWidth: 1,
                                    },
                                  ],
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  scales: {
                                    y: {
                                      beginAtZero: true,
                                    },
                                  },
                                }}
                              />
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="words" className="h-[200px] overflow-y-auto">
                          {commonMistakes.length > 0 ? (
                            <div className="space-y-3">
                              {commonMistakes.map((mistake, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="bg-gray-50 rounded-lg p-3"
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <div className="font-medium text-green-600">
                                      Đúng: <span className="text-blue-600">{mistake.correctAnswer}</span>
                                    </div>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-600">
                                      {mistake.count} lần sai
                                    </Badge>
                                  </div>
                                  
                                  <div className="text-sm">
                                    <span className="text-gray-500">Sai thành: </span>
                                    {mistake.studentAnswers.slice(0, 3).map((answer, i) => (
                                      <Badge key={i} variant="secondary" className="mr-1 mb-1">
                                        {answer || '(để trống)'}
                                      </Badge>
                                    ))}
                                    {mistake.studentAnswers.length > 3 && (
                                      <Badge variant="outline">
                                        +{mistake.studentAnswers.length - 3} nữa
                                      </Badge>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                              <FileText className="h-12 w-12 text-gray-300 mb-2" />
                              <p className="text-gray-500">Chưa có dữ liệu về từ hay sai</p>
                              <p className="text-sm text-gray-400">Hoàn thành các bài kiểm tra để xem từ nào thường xuyên sai</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                      
                      <div className="mt-2">
                        <p className="text-sm font-medium text-teal-600 mb-2">Gợi ý cải thiện:</p>
                        <div className="space-y-1">
                          {errorTypes.slice(0, 3).map((error, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.7 + index * 0.2 }}
                              className="flex items-start space-x-2"
                            >
                              <div className="w-2 h-2 rounded-full bg-teal-400 mt-1.5" />
                              <div className="text-xs text-gray-600 flex-1">
                                <span className="font-medium text-teal-600">{error.type}:</span>{' '}
                                {getErrorImprovement(error.type)}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                      <BarChart3 className="h-12 w-12 text-gray-300 mb-2" />
                  <p className="text-gray-500 mb-2">Chưa có dữ liệu phân tích lỗi</p>
                  <p className="text-sm text-gray-400">Hoàn thành các bài kiểm tra để xem phân tích lỗi của bạn</p>
                </div>
              )}
            </CardContent>
          </Card>
            </motion.div>
        </div>
        
          <motion.div variants={cardVariants}>
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="bg-gradient-to-r from-rose-50 to-transparent">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-rose-500" />
                  <div>
            <CardTitle>Kết quả gần đây</CardTitle>
            <CardDescription>Kết quả của các bài kiểm tra gần đây</CardDescription>
                  </div>
                </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {recentTests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bài kiểm tra</TableHead>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Điểm số</TableHead>
                      <TableHead>Độ chính xác</TableHead>
                      <TableHead>Thời gian làm</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                        {recentTests.map((test, index) => (
                          <motion.tr
                            key={test.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          className={`${!test.isCompleted ? "opacity-75" : ""} hover:bg-gray-50 transition-colors`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              <BookOpen className="h-4 w-4 text-rose-400" />
                              <span>{test.title}</span>
                            </div>
                            </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2 bg-gray-50 px-2 py-1 rounded-full text-sm">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span>{test.date}</span>
                              </div>
                        </TableCell>
                          <TableCell>
                            <motion.div 
                              className={`flex items-center space-x-1 ${getPerformanceColor(test.score)} px-3 py-1 rounded-full font-medium`}
                              whileHover={{ scale: 1.05 }}
                            >
                              <Star className="h-4 w-4" />
                              <span>{(test.score / 10).toFixed(1)}</span>
                            </motion.div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                <motion.div 
                                  className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-2.5 rounded-full relative"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${test.accuracy}%` }}
                                  transition={{ duration: 0.5, delay: index * 0.1 }}
                                >
                                  <motion.div
                                    className="absolute top-0 left-0 w-full h-full bg-white opacity-20"
                                    animate={{
                                      x: ['-100%', '100%']
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "linear"
                                    }}
                                  />
                                </motion.div>
                            </div>
                              <span className="text-sm font-medium min-w-[3rem] text-right">{test.accuracy}%</span>
                          </div>
                        </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2 bg-gray-50 px-2 py-1 rounded-full text-sm">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span>{test.timeTaken}</span>
                            </div>
                            </TableCell>
                        <TableCell>
                          {test.isCompleted ? (
                              <Badge className="bg-green-100 text-green-800 flex items-center space-x-1 px-3">
                                <motion.span 
                                  className="w-2 h-2 rounded-full bg-green-500"
                                  animate={{
                                    scale: [1, 1.2, 1]
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity
                                  }}
                                />
                                <span>Đã hoàn thành</span>
                                </Badge>
                          ) : (
                              <Badge className="bg-yellow-100 text-yellow-800 flex items-center space-x-1 px-3">
                                <motion.span 
                                  className="w-2 h-2 rounded-full bg-yellow-500"
                                  animate={{
                                    opacity: [1, 0.5, 1]
                                  }}
                                  transition={{
                                    duration: 1.5,
                                    repeat: Infinity
                                  }}
                                />
                                <span>Chưa hoàn thành</span>
                                </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link to={`/student/result/${test.id}`}>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex items-center space-x-1 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              >
                                <ChevronDown className="h-4 w-4" />
                                <span>Chi tiết</span>
                                </Button>
                          </Link>
                        </TableCell>
                          </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                      <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p>Bạn chưa được giao bài kiểm tra nào</p>
                  <p className="mt-2 text-sm">Vui lòng liên hệ giáo viên để được giao bài</p>
                  <Link to="/student/dashboard" className="mt-4 inline-block">
                    <Button className="mt-2">Đi đến trang chủ</Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </motion.div>
            </div>
      </motion.div>
    </StudentLayout>
  );
};

export default StudentProgress;


