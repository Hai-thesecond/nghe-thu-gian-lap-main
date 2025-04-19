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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  User,
  Mail,
  School,
  GraduationCap,
  Award,
  Clock,
  AlertCircle,
  BarChart,
  LineChart,
  RefreshCw,
  Edit
} from 'lucide-react';
import TeacherLayout from '@/layouts/TeacherLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem
} from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface StudentProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface StudentClass {
  class_id: string;
  joined_at: string;
  is_active: boolean;
  class: {
    id: string;
    name: string;
    class_code: string;
  };
}

interface StudentResult {
  id: string;
  question_id: string;
  score: number;
  created_at: string;
  question: {
    id: string;
    title: string;
  };
}

interface StudentCategory {
  id: string;
  student_id: string;
  category: string;
  average_score: number;
  last_updated: string;
  created_at: string;
}

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [openLevelDialog, setOpenLevelDialog] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [isUpdatingLevel, setIsUpdatingLevel] = useState(false);
  const [studentCategoryData, setStudentCategoryData] = useState<StudentCategory | null>(null);

  // Kiểm tra tham số
  useEffect(() => {
    if (!id) {
      toast.error('Thiếu thông tin học sinh');
      navigate('/teacher/students');
    }
  }, [id, navigate]);

  // Lấy thông tin học sinh
  const {
    data: student,
    isLoading: isLoadingStudent,
    error: studentError
  } = useQuery({
    queryKey: ['student-profile', id],
    queryFn: async () => {
      if (!id) return null;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .eq('role', 'student')
          .single();

        if (error) throw error;
        return data as StudentProfile;
      } catch (error) {
        console.error('Error fetching student profile:', error);
        toast.error('Không thể tải thông tin học sinh');
        throw error;
      }
    },
    enabled: !!id,
    retry: 1,
    staleTime: 30 * 60 * 1000, // Cache 30 phút
  });

  // Thực hiện truy vấn song song để tối ưu hiệu suất
  const {
    data: combinedData,
    isLoading: isLoadingData,
    error: dataError
  } = useQuery({
    queryKey: ['student-combined-data', id],
    queryFn: async () => {
      if (!id) return { classes: [], results: [] };

      try {
        // Thực hiện các truy vấn song song để giảm thời gian chờ
        const [classesResponse, resultsResponse] = await Promise.allSettled([
          // Truy vấn lớp học với JOIN để lấy thông tin lớp trong một truy vấn
          supabase
            .from('student_classes')
            .select(`
              class_id,
              joined_at,
              is_active,
              class:classes(id, name, class_code)
            `)
            .eq('student_id', id),
          
          // Truy vấn kết quả với JOIN và ORDER để lấy kết quả mới nhất trước
          supabase
            .from('student_answers')
            .select(`
              id,
              question_id,
              score,
              created_at,
              question:questions(id, title)
            `)
            .eq('student_id', id)
            .order('created_at', { ascending: false })
            .limit(50) // Giới hạn số lượng kết quả để tăng tốc
        ]);

        // Xử lý kết quả từ Promise.allSettled
        let classes = [];
        let results = [];

        if (classesResponse.status === 'fulfilled' && classesResponse.value.data) {
          classes = classesResponse.value.data;
        } else if (classesResponse.status === 'fulfilled' && classesResponse.value.error) {
          console.error('Error fetching classes:', classesResponse.value.error);
        } else {
          console.error('Class query failed:', classesResponse);
        }

        if (resultsResponse.status === 'fulfilled' && resultsResponse.value.data) {
          results = resultsResponse.value.data;
        } else if (resultsResponse.status === 'fulfilled' && resultsResponse.value.error) {
          console.error('Error fetching results:', resultsResponse.value.error);
        } else {
          console.error('Results query failed:', resultsResponse);
        }

        return {
          classes: classes as unknown as StudentClass[],
          results: results as unknown as StudentResult[],
        };
      } catch (error) {
        console.error('Error fetching student data:', error);
        // Vẫn trả về một đối tượng có cấu trúc đúng để tránh lỗi
        return { classes: [], results: [] };
      }
    },
    enabled: !!id,
    retry: 1,
    staleTime: 10 * 60 * 1000, // Cache 10 phút
    refetchOnWindowFocus: false, // Tránh refetch khi focus lại window
  });

  // Các biến truy vấn từ kết quả truy vấn song song
  const studentClasses = combinedData?.classes || [];
  const studentResults = combinedData?.results || [];
  const isLoadingClasses = isLoadingData;
  const isLoadingResults = isLoadingData;

  // Kiểm tra trạng thái loading
  const isLoading = isLoadingStudent || isLoadingData;

  // Kiểm tra lỗi
  useEffect(() => {
    if (studentError || dataError) {
      toast.error('Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.');
    }
  }, [studentError, dataError]);

  // Tính toán thống kê
  const statistics = {
    averageScore: studentResults?.length
      ? studentResults.reduce((acc, result) => acc + (result.score || 0), 0) / studentResults.length
      : 0,
    totalCompleted: studentResults?.length || 0,
    lastActivityDate: studentResults?.length
      ? new Date(studentResults[0].created_at)
      : null,
    activeClasses: studentClasses?.filter(c => c.is_active).length || 0,
  };

  // Lấy 5 bài làm gần đây
  const recentResults = studentResults?.slice(0, 5) || [];

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch (error) {
      return dateString;
    }
  };

  // Lấy chữ cái đầu của tên
  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Xử lý quay lại
  const handleGoBack = () => {
    navigate(-1);
  };

  // Xác định phân loại học sinh - cập nhật thành 3 cấp độ: Yếu, Trung bình, Tốt
  const getStudentCategory = (student: StudentProfile | null) => {
    // Nếu đã được điều chỉnh thủ công, sử dụng giá trị thủ công
    if (student && studentCategoryData && student.id === studentCategoryData.student_id) {
      return { 
        label: getCategoryDisplay(studentCategoryData.category), 
        value: studentCategoryData.category,
        color: getCategoryColor(studentCategoryData.category),
        isManual: true
      };
    }

    // Kiểm tra nếu không đủ 5 bài kiểm tra gần nhất, coi là "Yếu"
    if (!studentResults || studentResults.length < 5) {
      return { label: 'Yếu', value: 'poor', color: 'bg-red-100 text-red-800', isManual: false };
    }

    // Nếu đủ bài làm, tính toán dựa trên điểm trung bình
    const avgScore = statistics.averageScore;
    if (avgScore > 90) return { label: 'Tốt', value: 'good', color: 'bg-green-100 text-green-800', isManual: false };
    if (avgScore >= 80) return { label: 'Trung bình', value: 'average', color: 'bg-blue-100 text-blue-800', isManual: false };
    if (avgScore >= 70) return { label: 'Yếu', value: 'poor', color: 'bg-red-100 text-red-800', isManual: false };
    return { label: 'Yếu', value: 'poor', color: 'bg-red-100 text-red-800', isManual: false };
  };

  // Hàm lấy màu cho từng phân loại
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

  // Hàm lấy tên hiển thị cho từng phân loại
  const getCategoryDisplay = (category: string) => {
    switch (category) {
      case 'good':
        return 'Tốt';
      case 'average':
        return 'Trung bình';
      case 'poor':
        return 'Yếu';
      default:
        return 'Tự động';
    }
  };

  // Fetch phân loại thủ công của học sinh nếu có
  useEffect(() => {
    if (id) {
      const fetchStudentCategory = async () => {
        try {
          const { data, error } = await supabase
            .from('student_categories')
            .select('*')
            .eq('student_id', id)
            .single();
            
          if (!error && data) {
            setStudentCategoryData(data as StudentCategory);
            setSelectedLevel(data.category);
          } else {
            // Nếu chưa có dữ liệu, thiết lập giá trị mặc định dựa trên điểm trung bình
            const defaultCategory = getStudentCategory(student);
            setSelectedLevel(defaultCategory.value);
          }
        } catch (err) {
          console.error('Error fetching student category:', err);
        }
      };
      
      fetchStudentCategory();
    }
  }, [id, statistics.averageScore]);

  // Hàm cập nhật phân loại thủ công
  const updateStudentLevel = async () => {
    if (!id || !selectedLevel) return;
    
    setIsUpdatingLevel(true);
    
    try {
      // Kiểm tra xem đã có bản ghi chưa
      const { data: existingCategory } = await supabase
        .from('student_categories')
        .select('id')
        .eq('student_id', id)
        .single();
      
      let result;
      
      if (existingCategory) {
        // Cập nhật bản ghi hiện có
        result = await supabase
          .from('student_categories')
          .update({ 
            category: selectedLevel, 
            average_score: statistics.averageScore,
            last_updated: new Date().toISOString()
          })
          .eq('student_id', id);
      } else {
        // Tạo bản ghi mới
        result = await supabase
          .from('student_categories')
          .insert({
            student_id: id,
            category: selectedLevel,
            average_score: statistics.averageScore,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
      }
      
      if (result.error) {
        throw result.error;
      }
      
      // Cập nhật state
      setStudentCategoryData({
        id: existingCategory?.id || '',
        student_id: id,
        category: selectedLevel,
        average_score: statistics.averageScore,
        last_updated: new Date().toISOString(),
        created_at: existingCategory ? (studentCategoryData?.created_at || new Date().toISOString()) : new Date().toISOString()
      });
      
      setOpenLevelDialog(false);
      toast.success('Đã cập nhật trình độ học sinh');
    } catch (error) {
      console.error('Error updating student level:', error);
      toast.error('Không thể cập nhật trình độ học sinh');
    } finally {
      setIsUpdatingLevel(false);
    }
  };

  const studentCategory = getStudentCategory(student);

  return (
    <TeacherLayout>
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="p-0 h-9 w-9"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {isLoadingStudent ? (
                  <Skeleton className="h-8 w-48" />
                ) : (
                  student?.full_name || 'Thông tin học sinh'
                )}
              </h1>
              <p className="text-gray-500">
                {isLoadingStudent ? (
                  <Skeleton className="h-4 w-64 mt-1" />
                ) : (
                  `Chi tiết và tiến độ học tập`
                )}
              </p>
            </div>
          </div>

          {/* Thông tin chung */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Thông tin cá nhân */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle>Thông tin học sinh</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingStudent ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-20 rounded-full mx-auto" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={student?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-white text-xl">
                        {getInitials(student?.full_name || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <h3 className="font-bold text-lg">{student?.full_name}</h3>
                      <div className="flex items-center justify-center gap-2 text-gray-500 mt-1">
                        <Mail className="h-4 w-4" />
                        <span>{student?.email}</span>
                      </div>
                      <div className="mt-3 flex flex-col items-center">
                        <div className="grid gap-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${student ? getStudentCategory(student).color : "bg-gray-500"} px-3 py-1 text-sm font-medium`}
                            >
                              {student ? getStudentCategory(student).label : "Chưa xác định"}
                            </Badge>
                            {student && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 ml-1 border border-gray-300"
                                  onClick={() => setOpenLevelDialog(true)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Điều chỉnh</span>
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-full hover:bg-gray-100 border border-gray-200 flex items-center justify-center" 
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
                                      window.location.reload();
                                    } catch (error) {
                                      console.error('Error resetting student level:', error);
                                      toast.error('Không thể cập nhật trình độ học sinh');
                                    }
                                  }}
                                >
                                  <RefreshCw className={`h-3 w-3 ${!getStudentCategory(student).isManual ? "text-gray-400" : "text-blue-500"}`} />
                                </Button>
                                <p className="text-xs text-gray-500 ml-1">
                                  {getStudentCategory(student).isManual 
                                    ? "Đã điều chỉnh thủ công" 
                                    : "Tự động tính toán dựa trên kết quả học tập"}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Thống kê */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle>Tổng quan học tập</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Award className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-gray-500">Điểm trung bình</p>
                          <p className="text-xl font-bold">{statistics.averageScore.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <GraduationCap className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-sm text-gray-500">Bài đã hoàn thành</p>
                          <p className="text-xl font-bold">{statistics.totalCompleted}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Clock className="h-8 w-8 text-purple-500" />
                        <div>
                          <p className="text-sm text-gray-500">Hoạt động gần đây</p>
                          <p className="text-xl font-bold">
                            {statistics.lastActivityDate
                              ? formatDate(statistics.lastActivityDate.toISOString()).split(' ')[0]
                              : 'Chưa có'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <School className="h-8 w-8 text-orange-500" />
                        <div>
                          <p className="text-sm text-gray-500">Lớp đang tham gia</p>
                          <p className="text-xl font-bold">{statistics.activeClasses}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Nội dung chính */}
          <Tabs defaultValue="overview" onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="classes">Lớp học</TabsTrigger>
              <TabsTrigger value="results">Kết quả</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Các bài làm gần đây */}
              <Card>
                <CardHeader>
                  <CardTitle>Bài làm gần đây</CardTitle>
                  <CardDescription>5 bài làm gần đây nhất của học sinh</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingResults ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : recentResults.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tiêu đề</TableHead>
                          <TableHead>Điểm số</TableHead>
                          <TableHead>Ngày làm</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentResults.map((result) => (
                          <TableRow key={result.id}>
                            <TableCell className="font-medium">
                              {result.question?.title || 'Không có tiêu đề'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {result.score?.toFixed(1) || 0}%
                            </TableCell>
                            <TableCell>{formatDate(result.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-6">
                      <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p>Học sinh chưa làm bài nào</p>
                    </div>
                  )}
                </CardContent>
                {recentResults.length > 0 && (
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelectedTab('results')}
                    >
                      Xem tất cả kết quả
                    </Button>
                  </CardFooter>
                )}
              </Card>

              {/* Biểu đồ tiến độ */}
              <Card>
                <CardHeader>
                  <CardTitle>Tiến độ học tập</CardTitle>
                  <CardDescription>Biểu đồ so sánh điểm số qua các bài làm</CardDescription>
                </CardHeader>
                <CardContent className="h-64 flex items-center justify-center">
                  {isLoadingResults ? (
                    <Skeleton className="h-full w-full" />
                  ) : studentResults && studentResults.length > 0 ? (
                    <div className="w-full h-full flex justify-center items-center">
                      <BarChart className="h-20 w-20 text-gray-300" />
                      <p className="ml-4 text-gray-500">Biểu đồ đang được phát triển</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <LineChart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p>Không đủ dữ liệu để hiển thị biểu đồ</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="classes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lớp học đã tham gia</CardTitle>
                  <CardDescription>Danh sách các lớp học sinh đã tham gia</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingClasses ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : studentClasses && studentClasses.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên lớp</TableHead>
                          <TableHead>Mã lớp</TableHead>
                          <TableHead>Ngày tham gia</TableHead>
                          <TableHead>Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentClasses.map((item) => (
                          <TableRow key={item.class_id}>
                            <TableCell className="font-medium">
                              {item.class?.name || 'Không xác định'}
                            </TableCell>
                            <TableCell>{item.class?.class_code || '---'}</TableCell>
                            <TableCell>{formatDate(item.joined_at)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  item.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }
                              >
                                {item.is_active ? 'Đang tham gia' : 'Đã rời lớp'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-6">
                      <School className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p>Học sinh chưa tham gia lớp học nào</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Kết quả học tập</CardTitle>
                  <CardDescription>Tất cả bài làm của học sinh</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingResults ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : studentResults && studentResults.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tiêu đề</TableHead>
                          <TableHead>Điểm số</TableHead>
                          <TableHead>Ngày làm</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentResults.map((result) => (
                          <TableRow key={result.id}>
                            <TableCell className="font-medium">
                              {result.question?.title || 'Không có tiêu đề'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {result.score?.toFixed(1) || 0}%
                            </TableCell>
                            <TableCell>{formatDate(result.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-6">
                      <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p>Học sinh chưa làm bài nào</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Dialog open={openLevelDialog} onOpenChange={setOpenLevelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Điều chỉnh trình độ học sinh</DialogTitle>
            <DialogDescription>
              Chọn trình độ phù hợp nhất với học sinh này dựa trên đánh giá chủ quan của bạn.
            </DialogDescription>
          </DialogHeader>
          
          {student && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Trình độ hiện tại:</span>
                <Badge className={getStudentCategory(student).color}>
                  {getStudentCategory(student).label}
                </Badge>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Điểm trung bình:</span>
                  <span className="font-medium">{statistics.averageScore.toFixed(1) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Số bài đã làm:</span>
                  <span className="font-medium">{studentResults?.length || 0}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <div className="text-sm font-medium mb-1">Chọn trình độ mới:</div>
              <RadioGroup
                defaultValue={
                  student && getStudentCategory(student).value
                }
                onValueChange={(value) => {
                  setSelectedLevel(value);
                }}
                className="grid gap-3"
              >
                <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                  <RadioGroupItem value="poor" id="poor" />
                  <Label htmlFor="poor" className="flex items-center">
                    <span className="font-medium">Yếu</span>
                    <Badge variant="outline" className="ml-2 text-red-500 border-red-300 bg-red-50">70-80%</Badge>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                  <RadioGroupItem value="average" id="average" />
                  <Label htmlFor="average" className="flex items-center">
                    <span className="font-medium">Trung bình</span>
                    <Badge variant="outline" className="ml-2 text-amber-500 border-amber-300 bg-amber-50">80-90%</Badge>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                  <RadioGroupItem value="good" id="good" />
                  <Label htmlFor="good" className="flex items-center">
                    <span className="font-medium">Tốt</span>
                    <Badge variant="outline" className="ml-2 text-green-500 border-green-300 bg-green-50">Trên 90%</Badge>
                  </Label>
                </div>
              </RadioGroup>
              
              <div className="mt-4 text-sm text-gray-600">
                <p className="mb-2"><strong>Lưu ý:</strong> Cần ít nhất 5 bài kiểm tra để phân loại tự động chính xác.</p>
                <p className="text-xs">
                  <span className="font-medium">Tiêu chuẩn phân loại:</span><br />
                  - <strong>Yếu</strong>: Điểm trung bình 70-80%<br />
                  - <strong>Trung bình</strong>: Điểm trung bình 80-90%<br />
                  - <strong>Tốt</strong>: Điểm trung bình trên 90%
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isUpdatingLevel}
              onClick={updateStudentLevel}
            >
              {isUpdatingLevel ? 'Đang cập nhật...' : 'Cập nhật trình độ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
};

export default StudentDetail; 