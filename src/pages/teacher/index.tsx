import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseUser } from '@/lib/auth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileText, Headphones, Users } from 'lucide-react';

export default function TeacherDashboard() {
  const { user } = useSupabaseUser();
  const [stats, setStats] = useState({
    questionsCount: 0,
    studentsCount: 0,
    attemptsCount: 0
  });

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      // Fetch questions count
      const { count: questionsCount } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id);

      // Fetch students count
      const { count: studentsCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student');

      // Fetch attempts count
      const { count: attemptsCount } = await supabase
        .from('attempts')
        .select('id', { count: 'exact', head: true });

      setStats({
        questionsCount: questionsCount || 0,
        studentsCount: studentsCount || 0,
        attemptsCount: attemptsCount || 0
      });
    }

    fetchStats();
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Xin chào, {user?.username || 'Giáo viên'}</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-500" />
                {stats.questionsCount} Bài tập
              </CardTitle>
              <CardDescription>
                Tổng số bài tập đã tạo
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/teacher/questions" passHref>
                <Button variant="outline" className="w-full">
                  Quản lý bài tập <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="h-6 w-6 text-green-500" />
                {stats.studentsCount} Học viên
              </CardTitle>
              <CardDescription>
                Tổng số học viên trong hệ thống
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/teacher/students" passHref>
                <Button variant="outline" className="w-full">
                  Xem danh sách học viên <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-orange-500" />
                {stats.attemptsCount} Lượt làm bài
              </CardTitle>
              <CardDescription>
                Tổng số lượt làm bài tập
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/teacher/analytics" passHref>
                <Button variant="outline" className="w-full">
                  Xem thống kê <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>

        <h2 className="text-2xl font-semibold mt-8">Hoạt động gần đây</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bài tập mới nhất</CardTitle>
              <CardDescription>
                Danh sách bài tập mới nhất đã tạo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-4 text-muted-foreground">Chưa có bài tập nào</p>
            </CardContent>
            <CardFooter>
              <Link href="/teacher/create-question" passHref>
                <Button className="w-full">
                  <Headphones className="h-4 w-4 mr-2" /> Tạo bài tập mới
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Phân loại học viên</CardTitle>
              <CardDescription>
                Phân loại dựa trên điểm thi lần đầu trong 5 bài thi gần nhất
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Học viên giỏi (≥90%)</span>
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Học viên trung bình (80-90%)</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Học viên yếu (70-80%)</span>
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">0</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/teacher/students" passHref>
                <Button variant="outline" className="w-full">
                  <Users className="h-4 w-4 mr-2" /> Xem chi tiết phân loại
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 