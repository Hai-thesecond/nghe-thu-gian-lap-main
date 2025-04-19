import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sparkles, BookOpen, BookX, Users, UserRound, RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import TeacherLayout from '@/layouts/TeacherLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import React from 'react';

type StudentCategory = 'good' | 'average' | 'poor' | 'unknown';

interface Student {
  id: string;
  email: string;
  full_name: string;
  category?: StudentCategory;
  avg_score?: number;
  class_name?: string;
  class_id?: string;
}

interface StudentStats {
  goodCount: number;
  averageCount: number;
  poorCount: number;
  unknownCount: number;
  totalCount: number;
}

interface ClassInfo {
  id: string;
  name: string;
  class_code: string;
  student_count: number;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [stats, setStats] = useState<StudentStats>({
    goodCount: 0,
    averageCount: 0,
    poorCount: 0,
    unknownCount: 0,
    totalCount: 0,
  });

  // Lấy danh sách lớp học của giáo viên
  const { 
    data: classes,
    isLoading: isClassesLoading,
    refetch: refetchClasses
  } = useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      try {
        // Lấy danh sách lớp và số lượng học sinh
        const { data, error } = await supabase
          .from('classes')
          .select('id, name, class_code')
          .eq('teacher_id', user.id);
          
        if (error) throw error;
        if (!data || data.length === 0) return [];
        
        // Đếm học sinh cho từng lớp (đơn giản hóa để tránh lỗi)
        const classesWithCounts = await Promise.all(
          data.map(async (cls) => {
            const { count, error: countError } = await supabase
              .from('student_classes')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id)
              .eq('is_active', true);
            
            return {
              ...cls,
              student_count: count || 0
            };
          })
        );
        
        return classesWithCounts;
      } catch (error) {
        console.error('Error fetching classes:', error);
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // Cache 10 phút
  });

  // Lấy danh sách học sinh từ tất cả các lớp của giáo viên
  const {
    data: students,
    isLoading,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ['teacher-students', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      try {
        // 1. Lấy tất cả lớp học của giáo viên
        const { data: classes, error: classError } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', user.id);
          
        if (classError) throw classError;
        if (!classes || classes.length === 0) return [];
        
        const classIds = classes.map(c => c.id);
        
        // 2. Lấy danh sách học sinh từ các lớp học
        const { data: studentData, error: studentError } = await supabase
          .from('student_classes')
          .select(`
            student_id,
            class_id,
            classes(id, name, class_code)
          `)
          .in('class_id', classIds)
          .eq('is_active', true);
        
        if (studentError) throw studentError;
        if (!studentData || studentData.length === 0) return [];
        
        // 3. Lấy thông tin profile của các học sinh
        const studentIds = [...new Set(studentData.map(s => s.student_id))];
        
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', studentIds);
          
        if (profileError) throw profileError;
        
        // 4. Lấy điểm số của các học sinh
        const { data: scores, error: scoreError } = await supabase
          .from('student_answers')
          .select('student_id, score, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false });
          
        if (scoreError) {
          console.error('Error fetching scores:', scoreError);
        }
        
        // 5. Xử lý và định dạng dữ liệu
        const formattedStudents: Student[] = [];
        const processedIds = new Set<string>();
        
        for (const studentClass of studentData) {
          // Tránh trùng lặp học sinh
          if (processedIds.has(studentClass.student_id)) continue;
          processedIds.add(studentClass.student_id);
          
          // Tìm thông tin profile
          const profile = profiles?.find(p => p.id === studentClass.student_id);
          if (!profile) continue;
          
          // Tính điểm trung bình
          const studentScores = scores
            ?.filter(s => s.student_id === studentClass.student_id)
            .slice(0, 5)
            .map(s => s.score || 0) || [];
            
          const avgScore = studentScores.length > 0
            ? studentScores.reduce((sum, score) => sum + score, 0) / studentScores.length
            : 0;
          
          // Thêm vào danh sách
          formattedStudents.push({
            id: studentClass.student_id,
            email: profile.email,
            full_name: profile.full_name,
            class_name: studentClass.classes ? studentClass.classes.name : 'Không xác định',
            class_id: studentClass.class_id,
            avg_score: avgScore,
            category: getCategoryFromScore(avgScore)
          });
        }
        
        return formattedStudents;
      } catch (error) {
        console.error('Error fetching student data:', error);
        toast.error('Không thể tải danh sách học sinh');
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache 5 phút
    retry: 1, // Giảm số lần retry để tránh quá nhiều request
    refetchOnWindowFocus: false, // Tránh refetch khi focus lại window
  });

  // Memoize filtered students để tránh tính toán lại không cần thiết
  const memoizedFilteredStudents = React.useMemo(() => {
    if (!students) return [];
    
    if (activeTab === 'all') {
      return students;
    } else {
      return students.filter(student => student.category === activeTab);
    }
  }, [activeTab, students]);

  // Memoize stats để tránh tính toán lại không cần thiết
  const memoizedStats = React.useMemo(() => {
    if (!students || students.length === 0) {
      return {
        goodCount: 0,
        averageCount: 0,
        poorCount: 0,
        unknownCount: 0,
        totalCount: 0,
      };
    }
    
    const goodCount = students.filter(s => s.category === 'good').length;
    const averageCount = students.filter(s => s.category === 'average').length;
    const poorCount = students.filter(s => s.category === 'poor').length;
    const unknownCount = students.filter(s => s.category === 'unknown' || !s.category).length;
    
    return {
      goodCount,
      averageCount,
      poorCount,
      unknownCount,
      totalCount: students.length,
    };
  }, [students]);

  // Cập nhật filteredStudents và stats khi students thay đổi
  useEffect(() => {
    if (!students) return;
    
    setFilteredStudents(
      activeTab === 'all' 
        ? students 
        : students.filter(student => student.category === activeTab)
    );
    
    setStats(memoizedStats);
  }, [activeTab, students, memoizedStats]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleRefresh = async () => {
    toast.info('Đang cập nhật danh sách học sinh...');
    await Promise.all([refetchClasses(), refetchStudents()]);
    toast.success('Cập nhật danh sách học sinh thành công');
  };

  const getCategoryIcon = (category?: StudentCategory) => {
    switch (category) {
      case 'good':
        return <Sparkles className="h-4 w-4 text-yellow-500" />;
      case 'average':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'poor':
        return <BookX className="h-4 w-4 text-gray-500" />;
      default:
        return <UserRound className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCategoryBadge = (category?: StudentCategory) => {
    switch (category) {
      case 'good':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Sparkles className="h-3 w-3 mr-1" /> Học viên giỏi
          </Badge>
        );
      case 'average':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <BookOpen className="h-3 w-3 mr-1" /> Học viên trung bình
          </Badge>
        );
      case 'poor':
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <BookX className="h-3 w-3 mr-1" /> Học viên yếu
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-500">
            <UserRound className="h-3 w-3 mr-1" /> Chưa phân loại
          </Badge>
        );
    }
  };

  // Hàm xác định category dựa trên điểm
  const getCategoryFromScore = (score: number): StudentCategory => {
    if (score >= 90) return 'good';
    if (score >= 80) return 'average';
    if (score > 0) return 'poor';
    return 'unknown';
  };

  return (
    <TeacherLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" /> Danh sách học sinh
          </h1>
          <Button onClick={handleRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Làm mới
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng số học sinh</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalCount}</div>
              <p className="text-xs text-muted-foreground">
                Tổng số học sinh trong các lớp
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Học sinh giỏi</CardTitle>
              <Sparkles className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.goodCount}</div>
              <p className="text-xs text-muted-foreground">
                Điểm trung bình ≥ 90%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Học sinh trung bình</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.averageCount}</div>
              <p className="text-xs text-muted-foreground">
                Điểm trung bình từ 80% đến 90%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Học sinh yếu</CardTitle>
              <BookX className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.poorCount}</div>
              <p className="text-xs text-muted-foreground">
                Điểm trung bình dưới 80%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Hiển thị danh sách lớp học */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Lớp học</CardTitle>
            <CardDescription>
              Các lớp học do bạn quản lý
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isClassesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : classes && classes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {classes.map((cls) => (
                  <Card key={cls.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md">{cls.name}</CardTitle>
                      <CardDescription>Mã lớp: {cls.class_code}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{cls.student_count} học sinh</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Chưa có lớp học nào</h3>
                <p className="text-gray-500 mb-4">
                  Bạn chưa tạo hoặc được phân công lớp học nào.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Danh sách học sinh theo phân loại</CardTitle>
            <CardDescription>
              Phân loại dựa trên điểm trung bình trong 5 bài làm gần nhất.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" onValueChange={handleTabChange}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> Tất cả ({stats.totalCount})
                </TabsTrigger>
                <TabsTrigger value="good" className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-yellow-500" /> Giỏi ({stats.goodCount})
                </TabsTrigger>
                <TabsTrigger value="average" className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4 text-blue-500" /> Trung bình ({stats.averageCount})
                </TabsTrigger>
                <TabsTrigger value="poor" className="flex items-center gap-1">
                  <BookX className="h-4 w-4 text-gray-500" /> Yếu ({stats.poorCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-4">
                <Table>
                  <TableCaption>Danh sách học sinh</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Tên học sinh</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Điểm trung bình</TableHead>
                      <TableHead>Phân loại</TableHead>
                      <TableHead>Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredStudents.length > 0 ? (
                      filteredStudents.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            {getCategoryIcon(student.category)}
                            {student.full_name || 'Học sinh'}
                          </TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{student.class_name || 'Không xác định'}</TableCell>
                          <TableCell>
                            {student.avg_score !== undefined 
                              ? `${student.avg_score.toFixed(1)}%` 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>{getCategoryBadge(student.category)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              asChild
                            >
                              <Link to={`/teacher/student/${student.id}`}>
                                Chi tiết
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          Không có học sinh nào
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
} 