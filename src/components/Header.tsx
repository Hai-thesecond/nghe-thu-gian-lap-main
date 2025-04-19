import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Menu, Bell, CheckCircle, Clock, AlertCircle, X, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Cập nhật interface cho notification
interface Notification {
  id: string;
  type: 'new_submission' | 'not_completed' | 'low_score' | 'cheating_detected' | 'summary' | 'deadline_passed' | 'approaching_deadline';
  title: string;
  message: string;
  studentName?: string;
  studentId?: string;
  score?: number;
  questionTitle?: string;
  questionId?: string;
  classId?: string;
  className?: string;
  question_title?: string;
  class_id?: string;
  created_at: string;
  is_read: boolean;
  deadline?: string;
  details?: {
    totalStudents?: number;
    completedCount?: number;
    notCompletedCount?: number;
    lowScoreCount?: number;
    cheatingCount?: number;
    studentsList?: Array<{id: string, name: string, status?: 'not_completed' | 'low_score' | 'cheating_detected'}>;
    deadlinePassed?: boolean;
  };
}

// Thêm interface cho cấu trúc dữ liệu từ Supabase
interface StudentClass {
  student_id: string;
  class_id: string;
  profiles?: {
    id: string;
    full_name: string;
  }[];
  classes?: {
    id: string;
    name: string;
    class_code: string;
  }[];
}

interface CompletedAssignment {
  student_id: string;
  question_id: string;
  score: number;
  created_at: string;
  answer_data?: {
    totalTime?: number;
    [key: string]: any;
  };
}

// Cấu trúc Student để sử dụng trong ứng dụng
interface Student {
  id: string;
  name: string;
  status?: 'not_completed' | 'low_score' | 'cheating_detected';
}

// Thêm interface cho assignment
interface Assignment {
  id: string;
  question_id: string;
  class_id: string;
  deadline: string;
  created_at: string;
}

const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, []);

  // If on a path that uses a layout with its own sidebar and logo, use simpler header
  const isTeacherArea = location.pathname.startsWith('/teacher');
  const isStudentArea = location.pathname.startsWith('/student');
  const useSimpleHeader = isTeacherArea || isStudentArea;

  // Fetch notifications for teacher - memoize the fetch function
  const fetchNotifications = useCallback(async () => {
    if (user && user.role === 'teacher') {
      try {
        console.log("Đang lấy thông báo cho user:", user.id);
        
        // 1. Lấy các lớp học của giáo viên
        const { data: classes, error: classesError } = await supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user.id);
        
        if (classesError) {
          console.error('Lỗi khi lấy danh sách lớp học:', classesError);
          return;
        }
        
        if (!classes || classes.length === 0) {
          console.log('Giáo viên chưa có lớp học nào');
          return;
        }
        
        // 2. Lấy danh sách tất cả bài tập đã giao cho các lớp
        const classIds = classes.map(c => c.id);
        const { data: assignments, error: assignmentsError } = await supabase
          .from('class_assignments')
          .select(`
            id, 
            class_id, 
            question_id,
            assigned_at,
            due_date,
            is_active,
            questions:question_id(id, title)
          `)
          .in('class_id', classIds)
          .eq('is_active', true)
          .order('due_date', { ascending: false });
        
        if (assignmentsError) {
          console.error('Lỗi khi lấy danh sách bài tập:', assignmentsError);
          return;
        }
        
        if (!assignments || assignments.length === 0) {
          console.log('Không có bài tập nào được giao');
          return;
        }
        
        // 3. Lấy danh sách học sinh trong các lớp
        const { data: studentClasses, error: studentClassesError } = await supabase
          .from('student_classes')
          .select(`
            student_id,
            class_id,
            profiles:student_id(id, full_name)
          `)
          .in('class_id', classIds);
        
        if (studentClassesError) {
          console.error('Lỗi khi lấy danh sách học sinh:', studentClassesError);
          return;
        }
        
        // 4. Xử lý từng bài tập để tạo thông báo
        let newNotifications = [];
        const now = new Date();
        
        for (const assignment of assignments) {
          // Lấy thông tin lớp học từ danh sách lớp đã truy vấn
          const classInfo = classes.find(c => c.id === assignment.class_id);
          if (!classInfo) continue;
          
          // Lấy tên bài tập từ thông tin câu hỏi
          let questionTitle = 'Bài tập không rõ tên';
          if (assignment.questions && typeof assignment.questions === 'object') {
            // Kiểm tra nếu questions là array thì lấy phần tử đầu tiên
            if (Array.isArray(assignment.questions) && assignment.questions.length > 0) {
              questionTitle = assignment.questions[0].title || questionTitle;
            } else {
              // Nếu là object thì lấy trực tiếp
              questionTitle = (assignment.questions as any).title || questionTitle;
            }
          }
          
          // Tính thời gian còn lại hoặc đã quá hạn
          const isDueDatePassed = assignment.due_date && new Date(assignment.due_date) < now;
          
          // Lấy danh sách học sinh trong lớp này
          const studentsInClass = studentClasses?.filter(sc => sc.class_id === assignment.class_id) || [];
          const totalStudents = studentsInClass.length;
          
          if (totalStudents === 0) continue; // Bỏ qua lớp không có học sinh
          
          // Lấy danh sách học sinh đã làm bài
          const { data: completedAnswers, error: answersError } = await supabase
            .from('student_answers')
            .select('student_id, score')
            .eq('question_id', assignment.question_id)
            .in('student_id', studentsInClass.map(sc => sc.student_id));
          
          if (answersError) {
            console.error('Lỗi khi lấy bài làm của học sinh:', answersError);
            continue;
          }
          
          // Thống kê học sinh
          const completedStudentIds = (completedAnswers || []).map(a => a.student_id);
          const completedCount = completedStudentIds.length;
          
          // Học sinh chưa làm bài
          const notCompletedStudents = studentsInClass.filter(sc => 
            !completedStudentIds.includes(sc.student_id)
          );
          const notCompletedCount = notCompletedStudents.length;
          
          // Học sinh làm bài không đạt (dưới 80 điểm)
          const lowScoreAnswers = (completedAnswers || []).filter(a => a.score < 80);
          const lowScoreCount = lowScoreAnswers.length;
          
          // Chỉ tạo thông báo khi có học sinh chưa làm hoặc làm không đạt
          const needsNotification = notCompletedCount > 0 || lowScoreCount > 0;
          
          // Nếu bài tập đã quá hạn hoặc sắp đến hạn (trong vòng 24h) và cần thông báo
          if ((isDueDatePassed || (assignment.due_date && new Date(assignment.due_date).getTime() - now.getTime() < 24 * 60 * 60 * 1000)) && needsNotification) {
            // Format danh sách học sinh cần liên hệ
            const studentsList = [];
            
            // Thêm học sinh chưa làm bài
            for (const sc of notCompletedStudents) {
              const studentName = sc.profiles?.[0]?.full_name || 'Học sinh không rõ tên';
              studentsList.push({
                id: sc.student_id,
                name: studentName,
                status: 'not_completed'
              });
            }
            
            // Thêm học sinh làm bài không đạt
            for (const answer of lowScoreAnswers) {
              const student = studentsInClass.find(sc => sc.student_id === answer.student_id);
              if (student) {
                const studentName = student.profiles?.[0]?.full_name || 'Học sinh không rõ tên';
                studentsList.push({
                  id: student.student_id,
                  name: studentName,
                  status: 'low_score'
                });
              }
            }
            
            // Tạo notification object
            const notificationType = isDueDatePassed ? 'deadline_passed' : 'approaching_deadline';
            const notificationTitle = isDueDatePassed ? 'Đã hết hạn làm bài' : 'Sắp hết hạn làm bài';
            
            const notificationDetails = {
              totalStudents,
              completedCount,
              notCompletedCount,
              lowScoreCount,
              deadlinePassed: isDueDatePassed,
              studentsList: studentsList.slice(0, 10) // Giới hạn hiển thị 10 học sinh
            };
            
            // Kiểm tra xem đã có thông báo tương tự chưa
            const { data: existingNotification, error: checkError } = await supabase
              .from('notifications')
              .select('id, created_at')
              .eq('user_id', user.id)
              .eq('type', notificationType)
              .eq('question_id', assignment.question_id)
              .eq('class_id', assignment.class_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
              
            // Nếu chưa có thông báo hoặc thông báo gần nhất đã quá 12h, tạo thông báo mới
            const shouldCreateNewNotification = 
              !existingNotification || 
              (checkError && checkError.code === 'PGRST116') || // Không tìm thấy
              (existingNotification && (now.getTime() - new Date(existingNotification.created_at).getTime() > 12 * 60 * 60 * 1000));
              
            if (shouldCreateNewNotification) {
              const formattedDueDate = assignment.due_date 
                ? new Date(assignment.due_date).toLocaleString('vi-VN', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })
                : '';
                
              const notification = {
                user_id: user.id,
                type: notificationType,
                title: notificationTitle,
                message: `Lớp ${classInfo.name} có học sinh chưa hoàn thành bài tập`,
                question_title: questionTitle,
                question_id: assignment.question_id,
                class_name: classInfo.name,
                class_id: assignment.class_id,
                created_at: now.toISOString(),
                deadline: assignment.due_date,
                is_read: false,
                details: notificationDetails
              };
              
              const { error: insertError } = await supabase
                .from('notifications')
                .insert(notification);
                
              if (insertError) {
                console.error('Lỗi khi tạo thông báo:', insertError);
              } else {
                console.log('Đã tạo thông báo mới');
              }
            }
          }
        }
        
        // 5. Lấy tất cả thông báo đã có
        const { data: notificationData, error: notificationError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (notificationError) {
          console.error('Lỗi khi lấy thông báo:', notificationError);
          return;
        }

        console.log("Thông báo từ DB (raw):", notificationData);
        
        // Chuẩn hóa dữ liệu thông báo
        if (notificationData) {
          const formattedNotifications = notificationData.map(notification => {
            // Đảm bảo sử dụng đúng tên trường
            return {
              ...notification,
              // Thêm các trường chuẩn hóa cho trường hợp DB có class_id/question_id
              classId: notification.classId || notification.class_id,
              questionId: notification.questionId || notification.question_id,
              // Đảm bảo details là object nếu là string
              details: typeof notification.details === 'string' 
                ? JSON.parse(notification.details) 
                : notification.details
            };
          });
          
          console.log("Thông báo đã chuẩn hóa:", formattedNotifications);
          setNotifications(formattedNotifications);
          setUnreadCount(formattedNotifications.filter(n => !n.is_read).length);
        }
      } catch (error) {
        console.error('Lỗi chi tiết trong fetchNotifications:', error);
      }
    }
  }, [user]);

  // Setup notification polling in a separate useEffect
  useEffect(() => {
    // Only fetch if user exists
    if (user) {
      fetchNotifications();
      
      // Thiết lập polling để cập nhật thông báo mỗi 5 phút
      const pollingInterval = setInterval(fetchNotifications, 5 * 60 * 1000);
      
      return () => clearInterval(pollingInterval);
    }
  }, [user, fetchNotifications]);

  // Wrap handlers in useCallback to prevent unnecessary re-renders
  const handleDropdownOpen = useCallback((open: boolean) => {
    setIsNotificationsOpen(open);
  }, []);

  // Format thời gian - memoized
  const formatNotificationTime = useCallback((dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM HH:mm', { locale: vi });
    } catch (error) {
      return dateString;
    }
  }, []);

  // Đánh dấu thông báo đã đọc - memoized
  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) {
        console.error('Lỗi khi đánh dấu đã đọc:', error);
        return;
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      console.error('Lỗi:', error);
    }
  }, []);

  // Đánh dấu tất cả đã đọc
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, is_read: true }))
    );
    setUnreadCount(0);
  };

  // Xử lý dữ liệu học sinh
  const extractStudentFromClass = (sc: StudentClass): Student | null => {
    if (!sc.profiles || sc.profiles.length === 0) return null;
    const profile = sc.profiles[0];
    return profile ? { id: sc.student_id, name: profile.full_name } : null;
  };

  // Cập nhật hiển thị deadline trong thông báo
  const formatDeadline = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      const dueDate = new Date(dateString);
      const now = new Date();
      const isPast = dueDate < now;
      
      const formattedDate = dueDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return isPast 
        ? `Đã hết hạn ${formattedDate}` 
        : `Hạn nộp ${formattedDate}`;
    } catch (error) {
      return dateString;
    }
  };

  // Thêm hàm xóa thông báo
  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Lỗi khi xóa thông báo:', error);
        return false;
      }
      
      // Cập nhật state
      setNotifications(prev => prev.filter(n => n.id !== id));
      return true;
    } catch (error) {
      console.error('Lỗi chi tiết khi xóa thông báo:', error);
      return false;
    }
  };

  return (
    <header className="w-full bg-white border-b border-gray-100 h-16 flex items-center">
      <div className="container mx-auto px-4 flex items-center justify-between">
        {!useSimpleHeader && (
          <Link to={user?.role === 'teacher' ? '/teacher/dashboard' : user?.role === 'student' ? '/student/dashboard' : '/'} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-lightBlue-400 flex items-center justify-center">
              <span className="text-white text-lg font-bold">D</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-700 to-lightBlue-500 bg-clip-text text-transparent">
              Dictation
            </span>
          </Link>
        )}

        {useSimpleHeader && (
          <div className="flex-1">
            <h1 className="text-xl font-semibold">
              {isTeacherArea ? 'Khu vực Giáo viên' : 'Khu vực Học sinh'}
            </h1>
          </div>
        )}

        {user ? (
          <div className="flex items-center space-x-2">
            {user.role === 'teacher' && (
              <Popover open={isNotificationsOpen} onOpenChange={handleDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5 text-gray-600" />
                    {unreadCount > 0 && (
                      <Badge 
                        className="absolute -top-1 -right-1 h-5 px-1.5 bg-red-500 text-white"
                        variant="destructive"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between px-4 py-2 border-b">
                    <h3 className="font-medium">Thông báo</h3>
                    {unreadCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Đánh dấu tất cả đã đọc
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-80">
                    {notifications.length > 0 ? (
                      notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className={`border-b px-4 py-3 hover:bg-gray-50 transition-colors ${!notification.is_read ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div>
                              {notification.type === 'deadline_passed' && (
                                <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                  <Clock className="h-5 w-5" />
                                </div>
                              )}
                              {notification.type === 'approaching_deadline' && (
                                <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                  <Clock className="h-5 w-5" />
                                </div>
                              )}
                              {notification.type === 'summary' && (
                                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                  <BarChart3 className="h-5 w-5" />
                                </div>
                              )}
                              {notification.type === 'new_submission' && (
                                <div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                  <CheckCircle className="h-5 w-5" />
                                </div>
                              )}
                              {notification.type === 'low_score' && (
                                <div className="h-10 w-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                                  <AlertCircle className="h-5 w-5" />
                                </div>
                              )}
                              {notification.type === 'cheating_detected' && (
                                <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                  <AlertCircle className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <p className="font-medium text-sm text-gray-900 truncate mb-1">
                                  {notification.title}
                                </p>
                                <div className="text-xs text-gray-500">
                                  {formatNotificationTime(notification.created_at)}
                                </div>
                              </div>
                              
                              {notification.type === 'deadline_passed' || notification.type === 'approaching_deadline' ? (
                                <div className="space-y-1 mb-2">
                                  <div className={`text-xs font-medium ${notification.type === 'deadline_passed' ? 'text-red-600' : 'text-orange-600'}`}>
                                    {formatDeadline(notification.deadline)}
                                  </div>
                                  
                                  <div className="flex items-center text-xs space-x-2">
                                    <div className="flex items-center">
                                      <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                                      <span>Đã làm: <b>{notification.details?.completedCount || 0}/{notification.details?.totalStudents || 0}</b></span>
                                    </div>
                                    <div className="flex items-center">
                                      <span className="h-2 w-2 rounded-full bg-yellow-500 mr-1"></span>
                                      <span>Chưa đạt: <b>{notification.details?.lowScoreCount || 0}/{notification.details?.completedCount || 0}</b></span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs text-gray-600">
                                    Lớp: <b>{notification.className || notification.class_name || 'Không xác định'}</b>
                                  </div>
                                  
                                  <div className="text-xs text-gray-600">
                                    Bài tập: <b>{notification.questionTitle || notification.question_title}</b>
                                  </div>
                                </div>
                              ) : notification.type === 'summary' ? (
                                <div className="space-y-1 mb-2">
                                  <div className="flex items-center text-xs space-x-2">
                                    <div className="flex items-center">
                                      <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                                      <span>Đã làm: <b>{notification.details?.completedCount || 0}/{notification.details?.totalStudents || 0}</b></span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs text-gray-600">
                                    Lớp: <b>{notification.className || notification.class_name || 'Không xác định'}</b>
                                  </div>
                                  
                                  <div className="text-xs text-gray-600">
                                    Bài tập: <b>{notification.questionTitle || notification.question_title}</b>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1 mb-2">
                                  <p className="text-xs text-gray-600 truncate">
                                    {notification.studentName && (
                                      <span>{notification.studentName} • {notification.score !== undefined && <span className={`font-medium ${notification.score >= 80 ? 'text-green-600' : 'text-red-600'}`}>{notification.score.toFixed(0)}/100</span>}</span>
                                    )}
                                  </p>
                                  
                                  <div className="text-xs text-gray-600">
                                    Bài tập: <b>{notification.questionTitle || notification.question_title}</b>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center pt-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Bạn có chắc chắn muốn xóa thông báo này?')) {
                                      deleteNotification(notification.id);
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3 mr-1" /> Xóa
                                </Button>
                                
                                {(notification.type === 'deadline_passed' || notification.type === 'approaching_deadline' || notification.type === 'summary') && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log("Chi tiết thông báo:", notification);
                                      
                                      const classId = notification.classId || notification.class_id;
                                      const questionId = notification.questionId || notification.question_id;
                                      
                                      if (classId && questionId) {
                                        markAsRead(notification.id);
                                        
                                        // Chuyển hướng trực tiếp đến trang chi tiết
                                        navigate(`/teacher/results?class=${classId}&question=${questionId}`);
                                        handleDropdownOpen(false);
                                      } else {
                                        console.error("Không tìm thấy classId hoặc questionId cho thông báo", notification);
                                        alert("Không thể hiển thị chi tiết do thiếu thông tin tham chiếu");
                                      }
                                    }}
                                  >
                                    Xem chi tiết
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500">
                        <Bell className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        Không có thông báo mới
                      </div>
                    )}
                  </ScrollArea>
                  <div className="p-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-sm"
                      onClick={() => {
                        navigate('/teacher/assignments');
                        handleDropdownOpen(false);
                      }}
                    >
                      Xem tất cả bài tập
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full h-10 w-10 p-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-primary text-white">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-medium">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={user.role === 'teacher' ? '/teacher/profile' : '/student/profile'} className="cursor-pointer flex w-full items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Hồ sơ</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-500 focus:text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <Link to="/login-teacher">
              <Button variant="outline" className="font-medium">Giáo viên</Button>
            </Link>
            <Link to="/login-student">
              <Button className="font-medium btn-gradient">Học sinh</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

