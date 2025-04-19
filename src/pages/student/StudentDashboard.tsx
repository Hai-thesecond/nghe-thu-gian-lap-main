import React, { useState, useEffect, useCallback, useTransition } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Clock, Play, BookText, CheckCircle, BookOpen, Check, RefreshCcw, Loader2, Star, Trophy, Crown, AlertTriangle, Sparkles, Award, ChevronRight, Activity, Book, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import StudentLayout from '@/layouts/StudentLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import QuestionCard from '@/components/QuestionCard';
import { debugRLS } from '@/lib/api';
import useVisibilityRefresh from '@/hooks/useVisibilityRefresh';

interface Assignment {
  id: string;
  student_id: string;
  question_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  score?: number;
  started_at?: string;
  completed_at?: string;
}

interface Question {
  id: string;
  title: string;
  difficulty: string;
  deadline?: string;
  teacher_id: string;
  teacher_name?: string;
  is_published: boolean;
  created_at: string;
}

interface EnhancedQuestion extends Question {
  assignment?: Assignment;
  profiles?: {
    full_name: string;
  };
  time_limit?: number;
}

// Thêm một số style mới cho animation và UI
const Dashboard_CSS = `
  @keyframes slideUp {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }
  
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }
  
  @keyframes sparkle {
    0%, 100% { 
      opacity: 0.8; 
      transform: scale(0.8) rotate(0deg);
    }
    50% { 
      opacity: 1; 
      transform: scale(1.2) rotate(180deg);
    }
  }
  
  @keyframes glitter {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  @keyframes shake {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }
  
  .dashboard-card {
    transition: all 0.3s ease;
    overflow: hidden;
    animation: slideUp 0.5s ease-out forwards;
  }
  
  .dashboard-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 8px 10px -6px rgba(59, 130, 246, 0.1);
  }
  
  .animate-slide-up {
    animation: slideUp 0.6s ease-out forwards;
  }
  
  .animate-fade-in {
    animation: fadeIn 0.8s ease-out forwards;
  }
  
  .animate-pulse-custom {
    animation: pulse 2s infinite ease-in-out;
  }
  
  .animate-shimmer {
    background: linear-gradient(90deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0));
    background-size: 200% 100%;
    animation: shimmer 3s infinite linear;
  }
  
  .animate-bounce-custom {
    animation: bounce 2s infinite ease-in-out;
  }
  
  .animate-sparkle {
    animation: sparkle 2s infinite ease-in-out;
  }
  
  .animate-float {
    animation: float 3s infinite ease-in-out;
  }
  
  .animate-shake {
    animation: shake 1s infinite ease-in-out;
  }
  
  .glitter-bg {
    background: linear-gradient(270deg, #ffd700, #fff5b5, #ffd700);
    background-size: 600% 600%;
    animation: glitter 3s ease infinite;
  }
  
  .rainbow-text {
    background-image: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    background-size: 200% auto;
    animation: glitter 3s linear infinite;
  }
  
  .prize-badge {
    position: relative;
    z-index: 1;
    overflow: visible;
  }
  
  .prize-badge::before, 
  .prize-badge::after {
    content: '';
    position: absolute;
    top: -5px;
    left: -5px;
    right: -5px;
    bottom: -5px;
    border-radius: inherit;
    z-index: -1;
  }
  
  .prize-badge::before {
    background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
    background-size: 400%;
    filter: blur(5px);
    opacity: 0;
    transition: opacity 0.3s;
    animation: glitter 20s linear infinite;
  }
  
  .prize-badge:hover::before {
    opacity: 1;
  }
  
  .prize-badge.gold::before {
    background: linear-gradient(45deg, #ffd700, #ffec80, #ffd700, #ffec80, #ffd700);
    background-size: 400%;
    filter: blur(5px);
    opacity: 0.8;
    animation: glitter 20s linear infinite;
  }
  
  .prize-badge.silver::before {
    background: linear-gradient(45deg, #C0C0C0, #E8E8E8, #C0C0C0, #E8E8E8, #C0C0C0);
    background-size: 400%;
    filter: blur(5px);
    opacity: 0.6;
    animation: glitter 20s linear infinite;
  }
  
  .prize-badge.bronze::before {
    background: linear-gradient(45deg, #CD7F32, #E8C9B9, #CD7F32, #E8C9B9, #CD7F32);
    background-size: 400%;
    filter: blur(5px);
    opacity: 0.4;
    animation: glitter 20s linear infinite;
  }
  
  .table-row-animated {
    transition: all 0.2s ease;
  }
  
  .table-row-animated:hover {
    background-color: rgba(59, 130, 246, 0.05);
    transform: scale(1.01);
  }
  
  .card-gradient {
    background: linear-gradient(135deg, #f0f9ff 0%, #e6f2ff 100%);
  }
  
  .stat-card {
    border-radius: 16px;
    padding: 20px;
    transition: all 0.3s ease;
  }
  
  .stat-card:hover {
    transform: translateY(-5px);
  }
  
  .stat-card-1 {
    background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
    border: 1px solid #7dd3fc;
  }
  
  .stat-card-2 {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    border: 1px solid #93c5fd;
  }
  
  .stat-card-3 {
    background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
    border: 1px solid #a5b4fc;
  }
  
  .stat-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e40af;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .stat-label {
    font-size: 1rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }
  
  .info-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    margin-right: 10px;
  }
  
  .info-blue {
    background-color: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
  
  .info-purple {
    background-color: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
  }
  
  .info-indigo {
    background-color: rgba(99, 102, 241, 0.1);
    color: #6366f1;
  }
  
  .score-badge {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-weight: bold;
    transition: all 0.3s ease;
  }
  
  .score-badge.perfect {
    background: linear-gradient(45deg, #ffd700, #fff5b5, #ffd700);
    background-size: 400% 400%;
    color: #a16207;
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
    animation: glitter 3s ease infinite;
  }
  
  .score-badge.excellent {
    background: linear-gradient(45deg, #60a5fa, #a5b4fc, #60a5fa);
    background-size: 400% 400%;
    color: #1e40af;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
    animation: glitter 3s ease infinite;
  }
  
  .score-badge.good {
    background-image: linear-gradient(to right, #22c55e, #16a34a);
    color: white;
  }
  
  .score-badge.average {
    background-image: linear-gradient(to right, #eab308, #ca8a04);
    color: white;
  }
  
  .score-badge.poor {
    background-image: linear-gradient(to right, #ef4444, #dc2626);
    color: white;
  }
  
  .rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-weight: bold;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .rank-badge::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    transform: translateX(-100%);
  }
  
  .rank-badge:hover::before {
    transform: translateX(100%);
    transition: transform 0.6s ease;
  }
  
  .rank-badge.top1 {
    background: linear-gradient(45deg, #ffd700, #fff5b5, #ffd700);
    background-size: 400% 400%;
    color: #a16207;
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
    animation: glitter 3s ease infinite;
  }
  
  .rank-badge.top3 {
    background: linear-gradient(45deg, #C0C0C0, #E8E8E8, #C0C0C0);
    background-size: 400% 400%;
    color: #374151;
    box-shadow: 0 0 10px rgba(192, 192, 192, 0.5);
    animation: glitter 3s ease infinite;
  }
  
  .rank-badge.top10 {
    background: linear-gradient(45deg, #CD7F32, #E8C9B9, #CD7F32);
    background-size: 400% 400%;
    color: #78350f;
    box-shadow: 0 0 10px rgba(205, 127, 50, 0.5);
    animation: glitter 3s ease infinite;
  }

  .rank-badge.top20 {
    background: linear-gradient(45deg, #9c59ff, #d4bfff, #9c59ff);
    background-size: 400% 400%;
    color: #4c1d95;
    box-shadow: 0 0 10px rgba(156, 89, 255, 0.5);
    animation: glitter 3s ease infinite;
  }
  
  .rank-badge.top30 {
    background: linear-gradient(45deg, #2dd4bf, #99f6e4, #2dd4bf);
    background-size: 400% 400%;
    color: #115e59;
    box-shadow: 0 0 10px rgba(45, 212, 191, 0.5);
    animation: glitter 3s ease infinite;
  }
  
  .rank-badge.top50 {
    background: linear-gradient(45deg, #f87171, #fecaca, #f87171);
    background-size: 400% 400%;
    color: #991b1b;
    box-shadow: 0 0 10px rgba(248, 113, 113, 0.5);
    animation: glitter 3s ease infinite;
  }

  .rank-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: 4px;
    animation: dropIn 0.5s ease-out forwards;
  }

  .top1-label {
    background: linear-gradient(45deg, #ffd700, #fff5b5, #ffd700);
    color: #a16207;
    border: 1px solid #fbbf24;
  }

  .top3-label {
    background: linear-gradient(45deg, #C0C0C0, #E8E8E8, #C0C0C0);
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .top10-label {
    background: linear-gradient(45deg, #CD7F32, #E8C9B9, #CD7F32);
    color: #78350f;
    border: 1px solid #d97706;
  }

  .top20-label {
    background: linear-gradient(45deg, #9c59ff, #d4bfff, #9c59ff);
    color: #4c1d95;
    border: 1px solid #8b5cf6;
  }

  .top30-label {
    background: linear-gradient(45deg, #2dd4bf, #99f6e4, #2dd4bf);
    color: #115e59;
    border: 1px solid #14b8a6;
  }

  .top50-label {
    background: linear-gradient(45deg, #f87171, #fecaca, #f87171);
    color: #991b1b;
    border: 1px solid #ef4444;
  }

  @keyframes dropIn {
    0% { transform: translateY(-20px); opacity: 0; }
    50% { transform: translateY(5px); opacity: 0.9; }
    100% { transform: translateY(0); opacity: 1; }
  }
  
  .sparkle-icon {
    position: absolute;
    pointer-events: none;
    animation: sparkle 1.5s infinite ease-in-out;
  }
  
  .rank-glow {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    z-index: -1;
    opacity: 0.6;
    filter: blur(8px);
  }
`;

const StudentDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('assigned');
  const [completedQuestionIds, setCompletedQuestionIds] = useState<Set<string>>(new Set());
  const [studentAnswersMap, setStudentAnswersMap] = useState<Record<string, any>>({});
  const [studentRankings, setStudentRankings] = useState<Record<string, {rank: number, total: number, adjusted_score: number}>>({});
  const [questionDueDates, setQuestionDueDates] = useState({});
  const [questionDeadlines, setQuestionDeadlines] = useState<Record<string, string | null>>({});
  const [isInClass, setIsInClass] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [needsRecovery, setNeedsRecovery] = useState<boolean>(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState<number>(0);
  const [studentCategory, setStudentCategory] = useState<string>('poor');
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [requestingQuestionIds, setRequestingQuestionIds] = useState<string[]>([]);
  
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();

  const forceFullRefresh = useCallback(() => {
    queryClient.clear();
    window.location.reload();
  }, [queryClient]);

  const checkAndRefreshSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || (session.expires_at && new Date(session.expires_at * 1000) < new Date(Date.now() + 5 * 60 * 1000))) {
        console.log('Session expired or about to expire, refreshing...');
        
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('Error refreshing session:', error);
          if (session) {
            console.log('Using existing session despite expiration warning');
            return true;
          }
          
          setNeedsRecovery(true);
          toast.error('Phiên làm việc đã hết hạn', {
            description: 'Vui lòng nhấn nút "Khôi phục phiên" hoặc tải lại trang',
            action: {
              label: 'Tải lại trang',
              onClick: () => forceFullRefresh()
            }
          });
          return false;
      } else {
          console.log('Session refreshed successfully');
          toast.success('Phiên làm việc đã được làm mới', {
            description: 'Dữ liệu sẽ được cập nhật trong giây lát'
          });
          
          await queryClient.resetQueries();
        }
      }
      
      setNeedsRecovery(false);
      return true;
    } catch (error) {
      console.error('Error checking/refreshing session:', error);
      
      setNeedsRecovery(true);
      toast.error('Không thể làm mới phiên làm việc', {
        description: 'Vui lòng thử tải lại trang',
        action: {
          label: 'Tải lại trang',
          onClick: () => forceFullRefresh()
        }
      });
      
      return false;
    }
  }, [queryClient, forceFullRefresh]);

  const fetchCompletedAssignments = useCallback(async () => {
    if (!user?.id) return;
    
    console.log('Fetching completed assignments directly from student_answers table...');
      
    try {
      const { data: completedAssignments, error } = await supabase
        .from('student_answers')
        .select('question_id, is_completed, completed_at, score, metadata')
        .eq('student_id', user.id)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false });
        
      if (error) {
        if (error.code === 'PGRST301' || error.code === '401' || error.code === 'PGRST116') {
          console.log('Authentication error detected, refreshing session...');
          const sessionOk = await checkAndRefreshSession();
          if (sessionOk) {
            return fetchCompletedAssignments();
      } else {
            setNeedsRecovery(true);
            return;
          }
        }
        
        if (error.message && error.message.includes('does not exist')) {
          console.log('Schema error detected, trying simplified query');
          
          const { data: simpleData, error: simpleError } = await supabase
        .from('student_answers')
            .select('question_id')
        .eq('student_id', user.id)
        .eq('is_completed', true);
        
          if (simpleError) {
            throw simpleError;
          }
          
          if (simpleData && simpleData.length > 0) {
            // Lọc ra những bản ghi hợp lệ (có điểm số hoặc metadata) trước khi thiết lập completedQuestionIds
            const validCompletedIds = simpleData
              .filter(item => !!item.question_id) // Đảm bảo question_id tồn tại
              .map(item => item.question_id);
              
            console.log(`Đã tìm thấy ${validCompletedIds.length} bài đã hoàn thành`);
            setCompletedQuestionIds(new Set(validCompletedIds));
            return;
          }
        }
        
        throw error;
      }
      
      if (completedAssignments && completedAssignments.length > 0) {
        // Lọc ra những bản ghi hợp lệ trước khi thiết lập completedQuestionIds
        const validCompletedIds = completedAssignments
          .filter(item => {
            // Kiểm tra xem bản ghi có hợp lệ không (có question_id, có completed_at và có score hoặc metadata)
            const isValid = 
              !!item.question_id && 
              !!item.completed_at &&  // Kiểm tra completed_at phải tồn tại
              (
                (item.score !== null && item.score !== undefined) || 
                (item.metadata && Object.keys(item.metadata).length > 0)
              );
            
            if (!isValid) {
              console.log(`Bỏ qua bản ghi không hợp lệ: ${item.question_id}`, item);
            }
            
            return isValid;
          })
          .map(item => item.question_id);
          
        console.log(`Đã tìm thấy ${validCompletedIds.length}/${completedAssignments.length} bài đã hoàn thành hợp lệ`);
        setCompletedQuestionIds(new Set(validCompletedIds));
        
        queryClient.setQueryData(['completed-assignments', user.id], completedAssignments.filter(item => 
          validCompletedIds.includes(item.question_id)
        ));
      } else {
        console.log('Không tìm thấy bài đã hoàn thành');
        setCompletedQuestionIds(new Set());
      }
    } catch (err) {
      console.error('Error fetching completed assignments:', err);
      
      setRecoveryAttempts(prev => prev + 1);
      
      if (recoveryAttempts >= 2) {
        setNeedsRecovery(true);
      }
      
      toast.error('Không thể tải danh sách bài tập đã hoàn thành', {
        description: 'Vui lòng thử lại sau hoặc tải lại trang',
        action: {
          label: 'Tải lại trang',
          onClick: () => forceFullRefresh()
        }
      });
    }
  }, [user?.id, queryClient, checkAndRefreshSession, recoveryAttempts, forceFullRefresh]);

  // Add back the refreshData function with more selective query invalidation
  const refreshData = useCallback(() => {
    startTransition(() => {
      setNeedsRecovery(false);
      setRecoveryAttempts(0);
      
      checkAndRefreshSession().then(sessionOk => {
        if (sessionOk) {
          // Use selective invalidation instead of invalidating everything
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              // Only invalidate queries related to student dashboard
              const queryKey = query.queryKey[0];
              return (
                queryKey === 'student-questions' || 
                queryKey === 'student-answers' ||
                queryKey === 'student-assignments' ||
                queryKey === 'student-classes' ||
                queryKey === 'completed-assignments'
              );
            }
          });
          
          fetchCompletedAssignments();
        } else {
          setNeedsRecovery(true);
          toast.error('Không thể kết nối với máy chủ', {
            description: 'Vui lòng kiểm tra kết nối internet và thử lại',
            action: {
              label: 'Thử lại',
              onClick: () => refreshData()
            }
          });
        }
      });
    });
  }, [user?.id, queryClient, checkAndRefreshSession, fetchCompletedAssignments]);

  // Function to selectively refresh dashboard data on visibility change
  const refreshDashboardData = useCallback(() => {
    console.log('Selectively refreshing dashboard data...');
    
    // Only check session, don't aggressively invalidate queries
    checkAndRefreshSession().then(sessionOk => {
      if (sessionOk) {
        // Reset recovery state since session is ok
        setNeedsRecovery(false);
        setRecoveryAttempts(0);
        
        // Instead of invalidating all queries, only refetch data if it's stale
        // This prevents unnecessary data fetching when switching tabs quickly
        
        // Check if the data is stale (older than 5 minutes)
        const STALE_TIME = 5 * 60 * 1000; // 5 minutes
        const lastRefreshTime = parseInt(localStorage.getItem('dashboard_last_refresh') || '0', 10);
        const currentTime = Date.now();
        const timeSinceLastRefresh = currentTime - lastRefreshTime;
        
        if (timeSinceLastRefresh > STALE_TIME) {
          console.log(`Dashboard data is stale (${Math.round(timeSinceLastRefresh/1000)}s old). Refreshing...`);
          
          // Update the last refresh time
          localStorage.setItem('dashboard_last_refresh', currentTime.toString());
          
          // Only refetch the data that we actually need
          queryClient.refetchQueries({ 
            queryKey: ['student-questions'],
            exact: false,
            type: 'active', // Only refetch queries that are actually being used
          });
          
          // Don't automatically refetch student-answers, as it could be heavy
          // Instead, let the user manually refresh if needed
          
          // Still fetch completed assignments as it's lightweight
          fetchCompletedAssignments();
        } else {
          console.log(`Dashboard data is fresh (${Math.round(timeSinceLastRefresh/1000)}s old). Skipping refresh.`);
        }
      } else {
        setNeedsRecovery(true);
      }
    }).catch(error => {
      console.error('Failed to refresh session on visibility change:', error);
      setNeedsRecovery(true);
    });
  }, [user?.id, queryClient, checkAndRefreshSession, fetchCompletedAssignments]);

  // Replace the visibility change handler with useVisibilityRefresh
  useVisibilityRefresh(
    refreshDashboardData,  // Only refresh dashboard-specific data
    180000,  // Only refresh if away for at least 3 minutes (increased from 1 minute)
    [user?.id, queryClient, checkAndRefreshSession, fetchCompletedAssignments],
    process.env.NODE_ENV === 'development'  // Enable debug mode in development
  );

  // Use a separate interval for session refresh
  useEffect(() => {
    let intervalId: number | null = null;
    
    if (document.visibilityState === 'visible' && user?.id) {
      intervalId = window.setInterval(() => {
        checkAndRefreshSession();
      }, 5 * 60 * 1000); // 5 minutes
    }
    
    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [user?.id, checkAndRefreshSession]);

  const renderRecoveryUI = () => {
    if (!needsRecovery) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
          <h2 className="text-lg font-semibold mb-4">Có lỗi khi tải dữ liệu</h2>
          <p className="text-gray-700 mb-4">
            Không thể kết nối với máy chủ hoặc phiên làm việc đã hết hạn. Vui lòng thử khôi phục kết nối hoặc tải lại trang.
          </p>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => refreshData()}
              className="flex-1"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Khôi phục kết nối
            </Button>
            <Button 
              onClick={() => forceFullRefresh()}
              className="flex-1"
            >
              Tải lại trang
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const isRefreshing = isPending || isFetching > 0;

  // Xóa useEffect cho fetchAllStudentAnswers và fetchRankings, thay bằng useEffect mới lấy từ class_rankings
  useEffect(() => {
    const fetchRankingsFromClassRankings = async () => {
      if (!user?.id) return;
      
      try {
        console.log('Fetching rankings from class_rankings table...');
        
        // Lấy dữ liệu xếp hạng từ bảng class_rankings
        const { data: rankingsData, error } = await supabase
          .from('class_rankings')
          .select('*')
          .eq('student_id', user.id);
          
        if (error) throw error;
        
        if (rankingsData && rankingsData.length > 0) {
          console.log('Rankings data from class_rankings:', rankingsData);
          
          // Lấy tổng số học sinh cho mỗi question nếu không có trong bản ghi
          const questionIds = rankingsData.map(r => r.question_id).filter(Boolean);
          
          // Đếm số học sinh trong mỗi bài tập
          const totalStudentsMap: Record<string, number> = {};
          
          for (const questionId of questionIds) {
            if (!questionId) continue;
            
            const { data: countData, error: countError } = await supabase
              .from('class_rankings')
              .select('student_id', { count: 'exact', head: false })
              .eq('question_id', questionId);
              
            if (!countError && countData) {
              totalStudentsMap[questionId] = countData.length;
            }
          }
          
          console.log('Total students map:', totalStudentsMap);
          
          // Gọi MCP để kiểm tra dữ liệu
          const { data: mcpResult, error: mcpError } = await supabase.rpc(
            'mcp_validate_rankings',
            { student_id: user.id }
          );
          
          if (mcpError) {
            console.error('Error calling MCP validation:', mcpError);
          } else {
            console.log('MCP validation result:', mcpResult);
          }
          
          // Tạo map lưu trữ xếp hạng và điểm
          const rankingsMap: Record<string, {rank: number, total: number, adjusted_score: number}> = {};
          
          rankingsData.forEach(ranking => {
            if (ranking.question_id && ranking.rank) {
              const totalStudents = ranking.total_students || totalStudentsMap[ranking.question_id] || 0;
              
              rankingsMap[ranking.question_id] = {
                rank: ranking.rank,
                total: totalStudents,
                adjusted_score: parseFloat(ranking.adjusted_score) || 0
              };
            }
          });
          
          console.log('Rankings map from class_rankings:', rankingsMap);
          setStudentRankings(rankingsMap);
          
          // Cập nhật studentAnswersMap với điểm từ bảng class_rankings
          const answersMap: Record<string, any> = {};
          rankingsData.forEach(ranking => {
            if (ranking.question_id) {
              answersMap[ranking.question_id] = {
                score: ranking.score || 0,
                adjusted_score: ranking.adjusted_score || 0,
                is_completed: true, // Nếu có xếp hạng, coi như đã hoàn thành
                attempt_count: ranking.attempt_count || 1
              };
            }
          });
          
          console.log('Student answers map from rankings:', answersMap);
          setStudentAnswersMap(answersMap);
        }
      } catch (err) {
        console.error('Error fetching rankings from class_rankings:', err);
      }
    };
    
    fetchRankingsFromClassRankings();
  }, [user?.id]);

  // Đảm bảo khi lấy dữ liệu class assignments, lưu lại due_date
  const fetchClassAssignmentsDueDates = async () => {
    if (!user?.id) return;
    
    try {
      // Lấy các lớp học của học sinh
      const { data: studentClasses } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('student_id', user.id);
        
      if (!studentClasses || studentClasses.length === 0) return;
      
      const classIds = studentClasses.map(c => c.class_id);
      
      // Lấy thông tin từ class_assignments
      const { data: assignments } = await supabase
        .from('class_assignments')
        .select('question_id, due_date')
        .in('class_id', classIds);
        
      if (!assignments) return;
      
      // Tạo map với key là question_id, value là due_date
      const dueDatesMap = {};
      assignments.forEach(a => {
        dueDatesMap[a.question_id] = a.due_date;
      });
      
      setQuestionDueDates(dueDatesMap);
      console.log('Due dates map:', dueDatesMap);
    } catch (err) {
      console.error('Error fetching due dates:', err);
    }
  };

  // Thêm useEffect để lấy dữ liệu deadline từ class_assignments
  useEffect(() => {
    const fetchDeadlineData = async () => {
      if (!user?.id) return;
      
      try {
        // Lấy thông tin các lớp học của học sinh
        const { data: studentClasses, error: classError } = await supabase
          .from('student_classes')
          .select('class_id')
          .eq('student_id', user.id);
          
        if (classError) throw classError;
        
        if (studentClasses && studentClasses.length > 0) {
          const classIds = studentClasses.map(c => c.class_id);
          
          // Lấy thông tin deadline từ class_assignments
          const { data: assignmentData, error: assignmentError } = await supabase
            .from('class_assignments')
            .select('question_id, due_date')
            .in('class_id', classIds)
            .eq('is_active', true);
            
          if (assignmentError) throw assignmentError;
          
          if (assignmentData && assignmentData.length > 0) {
            // Tạo map với key là question_id và value là due_date
            const deadlinesMap: Record<string, string | null> = {};
            assignmentData.forEach(item => {
              deadlinesMap[item.question_id] = item.due_date;
            });
            
            console.log('Deadlines map:', deadlinesMap);
            setQuestionDeadlines(deadlinesMap);
          }
        }
      } catch (error) {
        console.error('Error fetching deadline data:', error);
      }
    };
    
    fetchDeadlineData();
  }, [user?.id]);

  // Thêm useEffect để lấy dữ liệu lớp học
  useEffect(() => {
    const fetchClassInfo = async () => {
      if (!user?.id) return;
      
      try {
        // Lấy các lớp học của học sinh
        const { data: studentClasses, error: studentClassesError } = await supabase
          .from('student_classes')
          .select('class_id')
          .eq('student_id', user.id)
          .eq('is_active', true);
          
        if (studentClassesError) {
          console.error('Error fetching student classes:', studentClassesError);
          return;
        }
        
        if (!studentClasses || studentClasses.length === 0) {
          console.log('Student not in any class');
          return;
        }
        
        const classIds = studentClasses.map(c => c.class_id);
        console.log('Student class IDs:', classIds);
        
        // Lấy thông tin lớp học
        const { data: classes, error: classError } = await supabase
          .from('classes')
          .select('id, name')
          .in('id', classIds);
          
        if (classError) {
          console.error('Error fetching classes:', classError);
          return;
        }
        
        console.log('Student classes:', classes);
        
        // Lấy bài tập trong lớp học
        const { data: classAssignments, error: assignmentsError } = await supabase
          .from('class_assignments')
          .select('question_id, class_id')
          .in('class_id', classIds)
          .eq('is_active', true);
          
        if (assignmentsError) {
          console.error('Error fetching class assignments:', assignmentsError);
          return;
        }
        
        console.log('Class assignments:', classAssignments);
        
        if (classes && classes.length > 0 && classAssignments && classAssignments.length > 0) {
          // Tạo map lưu tên lớp học cho mỗi class_id
          const classMap: Record<string, string> = {};
          classes.forEach(c => {
            if (c.id && c.name) {
              classMap[c.id] = c.name;
            }
          });
          
          // Tạo map lưu tên lớp học cho mỗi question_id
          const classNamesMap: Record<string, string> = {};
          classAssignments.forEach(a => {
            if (a.question_id && a.class_id && classMap[a.class_id]) {
              classNamesMap[a.question_id] = classMap[a.class_id];
            }
          });
          
          console.log('Class names map:', classNamesMap);
          setClassNames(classNamesMap);
        }
      } catch (error) {
        console.error('Error in fetchClassInfo:', error);
      }
    };
    
    fetchClassInfo();
  }, [user?.id]);

  // Fetch questions data
  const { data: questions = [], isLoading, error } = useQuery({
    queryKey: ['student-questions', user?.id],
    queryFn: async () => {
      try {
        if (!user?.id) return [];

        // Lấy tất cả câu hỏi đã được xuất bản
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*, profiles(full_name)')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (questionsError) {
          console.error('Error fetching questions:', questionsError);
          toast.error('Không thể tải danh sách câu hỏi', {
            description: questionsError.message
          });
          return [];
        }

        // Lấy bài tập được giao trực tiếp cho học sinh
        const { data: directAssignmentsData, error: directAssignmentsError } = await supabase
          .from('student_assignments')
          .select('*')
          .eq('student_id', user.id);

        if (directAssignmentsError) {
          console.error('Error fetching direct assignments:', directAssignmentsError);
          toast.error('Không thể tải trạng thái bài tập', {
            description: directAssignmentsError.message
          });
          return [];
        }

        // Lấy thông tin các lớp học sinh đang tham gia
        const { data: studentClasses, error: studentClassesError } = await supabase
          .from('student_classes')
          .select('class_id')
          .eq('student_id', user.id);

        if (studentClassesError) {
          console.error('Error fetching student classes:', studentClassesError);
          toast.error('Không thể tải danh sách lớp học', {
            description: studentClassesError.message
          });
          return [];
        }

        const classIds = studentClasses?.map(c => c.class_id) || [];
        let classAssignmentsData: any[] = [];

        // Nếu học sinh có tham gia lớp nào, lấy bài tập được giao cho các lớp đó
        if (classIds.length > 0) {
          // Lấy thông tin bài tập của các lớp học sinh tham gia
          const { data: classAssignments, error: classAssignmentsError } = await supabase
            .from('class_assignments')
            .select(`
              id,
              class_id,
              question_id,
              assigned_at,
              due_date,
              is_active
            `)
            .in('class_id', classIds)
            .eq('is_active', true);

          if (classAssignmentsError) {
            console.error('Error fetching class assignments:', classAssignmentsError);
          } else {
            console.log('Class assignments data:', classAssignments);
            classAssignmentsData = classAssignments || [];
          }
        }

        // Lấy danh sách tất cả các question_id từ bài tập lớp
        const questionIdsFromClassAssignments = new Set<string>();
        classAssignmentsData.forEach(assignment => {
          if (assignment.question_id) {
            questionIdsFromClassAssignments.add(assignment.question_id);
          }
        });

        console.log('Question IDs from class assignments:', Array.from(questionIdsFromClassAssignments));

        // Lấy thông tin chi tiết của các câu hỏi từ bài tập lớp học
        let additionalQuestionsData: any[] = [];
        if (questionIdsFromClassAssignments.size > 0) {
          const { data: additionalQuestions, error: additionalQuestionsError } = await supabase
            .from('questions')
            .select('*, profiles(full_name)')
            .in('id', Array.from(questionIdsFromClassAssignments));

          if (additionalQuestionsError) {
            console.error('Error fetching additional questions:', additionalQuestionsError);
          } else {
            console.log('Additional questions data:', additionalQuestions);
            additionalQuestionsData = additionalQuestions || [];
          }
        }

        // Kết hợp tất cả câu hỏi từ các nguồn khác nhau và loại bỏ trùng lặp
        const allQuestionsMap = new Map();
        
        [...questionsData || [], ...additionalQuestionsData].forEach(question => {
          if (!allQuestionsMap.has(question.id)) {
            allQuestionsMap.set(question.id, question);
          }
        });

        const allQuestions = Array.from(allQuestionsMap.values());
        console.log('Combined questions:', allQuestions);

        // Tạo danh sách câu hỏi cuối cùng kèm thông tin bài tập
        const enhancedQuestions: EnhancedQuestion[] = allQuestions.map(question => {
          const directAssignment = directAssignmentsData?.find(a => a.question_id === question.id);
          
          return {
            id: question.id,
            title: question.title,
            difficulty: question.difficulty,
            deadline: question.deadline,
            teacher_id: question.teacher_id,
            teacher_name: question.profiles?.full_name || '',
            is_published: question.is_published,
            created_at: question.created_at,
            assignment: directAssignment || {
              id: '',
              student_id: user.id,
              question_id: question.id,
              status: 'not_started'
            },
            profiles: question.profiles,
            time_limit: question.time_limit
          };
        });

        console.log('Questions data:', questionsData?.length); // Debug log
        console.log('Direct assignments data:', directAssignmentsData?.length); // Debug log
        console.log('Class assignments with questions:', questionIdsFromClassAssignments.size); // Debug log
        console.log('Enhanced questions total:', enhancedQuestions.length); // Debug log

        return enhancedQuestions;
      } catch (error) {
        console.error('Error in query:', error);
        toast.error('Không thể tải danh sách câu hỏi', {
          description: 'Vui lòng thử lại sau'
        });
        return [];
      }
    },
    enabled: !!user?.id,
    initialData: []
  });

  // Thêm các hàm hỗ trợ để xử lý deadline
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
  
  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return <span className="text-xs mt-1 text-green-600">Dễ</span>;
      case 'medium':
        return <span className="text-xs mt-1 text-yellow-600">Trung bình</span>;
      case 'hard':
        return <span className="text-xs mt-1 text-red-600">Khó</span>;
      default:
        return null;
    }
  };
  
  const ASSIGNMENT_STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    NOT_PASSED: 'not_passed'
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case ASSIGNMENT_STATUS.NOT_STARTED:
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 flex items-center">
          <BookOpen className="h-4 w-4 mr-1" />
          Chưa làm
        </Badge>;
      case ASSIGNMENT_STATUS.IN_PROGRESS:
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          Đã làm
        </Badge>;
      case ASSIGNMENT_STATUS.NOT_PASSED:
        return <Badge variant="outline" className="bg-red-100 text-red-800 flex items-center">
          <AlertTriangle className="h-4 w-4 mr-1" />
          Chưa đạt
        </Badge>;
      case ASSIGNMENT_STATUS.COMPLETED:
        return <Badge variant="outline" className="bg-green-100 text-green-800 flex items-center">
          <CheckCircle className="h-4 w-4 mr-1" />
          Đã hoàn thành
        </Badge>;
      default:
        return <Badge variant="outline" className="flex items-center bg-gray-100 text-gray-800">
          <AlertCircle className="h-4 w-4 mr-1" />
          Chưa rõ
        </Badge>;
    }
  };
  
  const completedQuestions = questions.filter(q => q.assignment?.status === 'completed');
  const assignedQuestions = questions.filter(q => q.assignment?.status !== 'completed');
  
  const getAssignmentStatus = (question, isCompleted) => {
    // Kiểm tra xem question.id có trong danh sách completedQuestionIds không
    const isActuallyCompleted = completedQuestionIds.has(question.id);
    
    // Kiểm tra thực tế trong database
    const { data: answer } = useQuery({
      queryKey: ['student-answer', question.id, user?.id],
      queryFn: async () => {
        const { data } = await supabase
          .from('student_answers')
          .select('*')
          .eq('student_id', user?.id)
          .eq('question_id', question.id)
          .single();
        return data;
      },
      enabled: !!user?.id && !!question.id,
    });
    
    // Chỉ đánh dấu hoàn thành nếu thực sự có bản ghi trong database và is_completed = true
    if (isActuallyCompleted && answer?.is_completed) {
      return {
        label: 'Đã hoàn thành',
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="h-4 w-4 mr-1" />,
        code: ASSIGNMENT_STATUS.COMPLETED
      };
    }
    
    // Kiểm tra xem đã bắt đầu làm nhưng chưa hoàn thành
    if (answer?.started_at && !answer?.is_completed) {
      return {
        label: 'Đã làm',
        color: 'bg-yellow-100 text-yellow-800',
        icon: <Clock className="h-4 w-4 mr-1" />,
        code: ASSIGNMENT_STATUS.IN_PROGRESS
      };
    }
    
    return {
      label: 'Chưa làm',
      color: 'bg-blue-100 text-blue-800',
      icon: <BookOpen className="h-4 w-4 mr-1" />,
      code: ASSIGNMENT_STATUS.NOT_STARTED
    };
  };

  const fetchStudentAnswers = useCallback(async (questionId) => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('student_answers')
        .select('*')
        .eq('student_id', user.id)
        .eq('question_id', questionId)
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching student answer:', error);
      return null;
    }
  }, [user]);

  // Gọi function trong useEffect sau khi lấy thông tin học sinh
  useEffect(() => {
    if (user?.id) {
      fetchClassAssignmentsDueDates();
    }
  }, [user?.id]);
  
  // Add the saveStatusToSupabase function
  const saveStatusToSupabase = useCallback(async (questionId: string, status: string) => {
    if (!user?.id) return;
    
    try {
      // First check if a student_answers record exists
      const { data: existingAnswer, error: fetchError } = await supabase
        .from('student_answers')
        .select('id, is_completed, started_at, score')
        .eq('student_id', user.id)
        .eq('question_id', questionId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        // Only throw if it's not the "no rows returned" error
        throw fetchError;
      }
      
      // Map status code to the appropriate database fields
      let updateData = {};
      
      switch(status) {
        case ASSIGNMENT_STATUS.IN_PROGRESS:
          updateData = {
            started_at: existingAnswer?.started_at || new Date().toISOString(),
            is_completed: false
          };
          break;
        case ASSIGNMENT_STATUS.COMPLETED:
          updateData = {
            started_at: existingAnswer?.started_at || new Date().toISOString(),
            is_completed: true,
            completed_at: new Date().toISOString()
          };
          break;
        case ASSIGNMENT_STATUS.NOT_PASSED:
          updateData = {
            started_at: existingAnswer?.started_at || new Date().toISOString(),
            is_completed: true,
            completed_at: new Date().toISOString(),
            // We mark it as completed but with a flag indicating it needs to be retaken
            needs_retake: true
          };
          break;
        case ASSIGNMENT_STATUS.NOT_STARTED:
          // Usually we don't reset to not started, but if needed:
          updateData = {
            is_completed: false
          };
          break;
      }
      
      if (existingAnswer) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('student_answers')
          .update(updateData)
          .eq('id', existingAnswer.id);
          
        if (updateError) throw updateError;
      } else if (status !== ASSIGNMENT_STATUS.NOT_STARTED) {
        // Only create a new record if not in NOT_STARTED state
        const { error: insertError } = await supabase
          .from('student_answers')
          .insert({
            student_id: user.id,
            question_id: questionId,
            ...updateData
          });
          
        if (insertError) throw insertError;
      }
      
      // Also update student_assignments table if it exists
      const { error: assignmentUpdateError } = await supabase
        .from('student_assignments')
        .upsert({
          student_id: user.id,
          question_id: questionId,
          status: status,
          ...(status === ASSIGNMENT_STATUS.COMPLETED ? { completed_at: new Date().toISOString() } : {}),
          ...(status === ASSIGNMENT_STATUS.IN_PROGRESS ? { started_at: new Date().toISOString() } : {})
        });
        
      if (assignmentUpdateError) {
        console.error('Error updating student_assignments:', assignmentUpdateError);
      }
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['student-answers', user.id] });
      queryClient.invalidateQueries({ queryKey: ['student-questions', user.id, activeTab] });
      
      toast.success('Trạng thái bài tập đã được cập nhật', {
        description: status === ASSIGNMENT_STATUS.COMPLETED 
          ? 'Bài tập đã được đánh dấu là hoàn thành' 
          : 'Trạng thái bài tập đã được cập nhật'
      });
      
      // Refresh data
      fetchCompletedAssignments();
      
    } catch (error) {
      console.error('Error saving assignment status:', error);
      toast.error('Không thể cập nhật trạng thái bài tập', {
        description: 'Vui lòng thử lại sau'
      });
    }
  }, [user?.id, queryClient, activeTab, fetchCompletedAssignments]);

  // Thêm hàm useEffect mới để lấy thông tin về trình độ học sinh từ bảng student_categories
  useEffect(() => {
    const fetchStudentCategory = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('student_categories')
          .select('category')
          .eq('student_id', user.id)
          .single();
          
        if (error) {
          console.error('Error fetching student category:', error);
          // Default to 'poor' if there's an error or no record
          setStudentCategory('poor');
          return;
        }
        
        if (data) {
          console.log('Student category fetched:', data.category);
          // Lưu trình độ học sinh vào state để sử dụng khi hiển thị điểm
          setStudentCategory(data.category || 'poor');
        } else {
          // Default to 'poor' if no record is found
          console.log('No student category found, defaulting to poor');
          setStudentCategory('poor');
          
          // Create a default student_category record
          try {
            const { error: insertError } = await supabase
              .from('student_categories')
              .insert([{
                student_id: user.id,
                category: 'poor',
                category_display: 'Yếu',
                average_score: 0,
                last_updated: new Date().toISOString()
              }]);
              
            if (insertError) {
              console.error('Error creating default student category:', insertError);
            } else {
              console.log('Created default student category as poor');
            }
          } catch (insertErr) {
            console.error('Exception creating default student category:', insertErr);
          }
        }
      } catch (err) {
        console.error('Error fetching student category:', err);
        // Default to 'poor' if there's an exception
        setStudentCategory('poor');
      }
    };
    
    fetchStudentCategory();
  }, [user?.id]);

  // Thêm một hàm debug để in ra giá trị điểm số
  const debugScore = (questionId, answerDetails) => {
    console.log(`DEBUG SCORE for question ${questionId}:`, {
      original_score: answerDetails?.score,
      metadata: answerDetails?.metadata,
      has_metadata: !!answerDetails?.metadata,
      metadata_type: answerDetails?.metadata ? typeof answerDetails.metadata : 'none'
    });
    
    try {
      if (answerDetails?.metadata) {
        const meta = typeof answerDetails.metadata === 'string' 
          ? JSON.parse(answerDetails.metadata) 
          : answerDetails.metadata;
        console.log('Parsed metadata:', meta);
        console.log('Has adjusted_score:', meta.adjusted_score !== undefined);
        console.log('Adjusted score value:', meta.adjusted_score);
      }
    } catch (err) {
      console.error('Error parsing metadata:', err);
    }
  };

  // Thêm hàm để chắc chắn lấy được trình độ học sinh từ database
  const fetchStudentCategoryForce = async () => {
    if (!user?.id) return 'poor';
    
    try {
      console.log('Fetching student category directly before displaying scores...');
      const { data, error } = await supabase
        .from('student_categories')
        .select('category')
        .eq('student_id', user.id)
        .single();
        
      if (error) {
        console.error('Error fetching student category:', error);
        return 'poor';
      }
      
      if (data) {
        console.log('DIRECT DB LOOKUP - Student category:', data.category);
        return data.category || 'poor';
      }
      
      return 'poor';
    } catch (err) {
      console.error('Error in fetchStudentCategoryForce:', err);
      return 'poor';
    }
  };
  
  // Add the missed useEffect for fetching student completion data
  useEffect(() => {
    if (user?.id) {
      // Debug RLS policies
      debugRLS('student_answers', user.id);
      
      // Use direct database approach
      fetchCompletedAssignments();
      
      // Set up interval to auto-refresh data every 10 seconds
      const refreshInterval = setInterval(() => {
        fetchCompletedAssignments();
      }, 10000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [user, fetchCompletedAssignments]);

  // Thêm useEffect mới để lấy số lần làm từ student_answers
  useEffect(() => {
    const fetchAttemptCounts = async () => {
      if (!user?.id) return;
      
      try {
        console.log('Fetching attempt counts from student_answers table...');
        
        const { data, error } = await supabase
          .rpc('get_student_attempt_counts', { student_id_param: user.id });
        
        if (error) {
          console.error('Error fetching attempt counts:', error);
          
          // Fallback khi không có RPC function
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('student_answers')
            .select('question_id, count')
            .eq('student_id', user.id)
            .select('question_id, count(*)');
            
          if (fallbackError) {
            console.error('Error in fallback query:', fallbackError);
            return;
          }
          
          if (fallbackData) {
            const counts: Record<string, number> = {};
            fallbackData.forEach((item: any) => {
              if (item.question_id) {
                counts[item.question_id] = parseInt(item.count, 10);
              }
            });
            
            console.log('Attempt counts from fallback query:', counts);
            setAttemptCounts(counts);
          }
          
          return;
        }
        
        if (data) {
          const counts: Record<string, number> = {};
          data.forEach((item: any) => {
            if (item.question_id) {
              counts[item.question_id] = item.attempt_count;
            }
          });
          
          console.log('Attempt counts from RPC:', counts);
          setAttemptCounts(counts);
        }
      } catch (err) {
        console.error('Exception fetching attempt counts:', err);
      }
    };
    
    fetchAttemptCounts();
  }, [user?.id]);

  // Thêm hàm fetchStudentResultsData trước hàm refreshDataWithAnimation
  const fetchStudentResultsData = async () => {
    if (!user?.id) return;
    
    setIsRefreshingData(true);
    
    try {
      // Truy vấn view student_results_view
      const { data, error } = await supabase
        .from('student_results_view')
        .select('*')
        .eq('student_id', user.id);
      
      // Truy vấn thêm view student_attempt_count_view để lấy số lần làm chính xác
      const { data: attemptData, error: attemptError } = await supabase
        .from('student_attempt_count_view')
        .select('student_id, question_id, actual_attempt_count')
        .eq('student_id', user.id);
      
      if (error) throw error;
      if (attemptError) throw attemptError;
      
      if (data) {
        console.log('Dữ liệu hiển thị kết quả:', data);
        
        // Cập nhật state với dữ liệu từ view
        const updatedAttemptCounts = {};
        const updatedScores = {};
        const updatedRankings = {};
        
        // Tạo map cho attempt count từ view chuyên biệt
        const accurateAttemptCounts = {};
        if (attemptData) {
          attemptData.forEach(item => {
            if (item.question_id) {
              accurateAttemptCounts[item.question_id] = item.actual_attempt_count || 0;
            }
          });
          console.log('Số lần làm chính xác:', accurateAttemptCounts);
        }
        
        data.forEach(item => {
          if (item.question_id) {
            // Cập nhật số lần làm - ưu tiên lấy từ view attempt_count nếu có
            updatedAttemptCounts[item.question_id] = 
              accurateAttemptCounts[item.question_id] !== undefined
                ? accurateAttemptCounts[item.question_id]
                : (item.attempt_count || 0);
            
            // Cập nhật điểm số
            updatedScores[item.question_id] = {
              score: item.original_score,
              adjusted_score: item.display_score,
              is_completed: item.completion_status === 'Đã hoàn thành'
            };
            
            // Cập nhật xếp hạng
            if (item.rank_position > 0) {
              updatedRankings[item.question_id] = {
                rank: item.rank_position,
                total: item.total_students,
                adjusted_score: item.display_score || 0
              };
            }
          }
        });
        
        // Cập nhật state
        setAttemptCounts(updatedAttemptCounts);
        setStudentAnswersMap(updatedScores);
        setStudentRankings(updatedRankings);
      }
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu kết quả:', err);
      toast.error('Không thể tải thông tin kết quả');
    } finally {
      setIsRefreshingData(false);
    }
  };

  // Thêm useEffect để gọi fetchStudentResultsData
  useEffect(() => {
    if (user?.id) {
      fetchStudentResultsData();
    }
  }, [user?.id]);

  // Thêm vào hàm refreshDataWithAnimation
  const refreshDataWithAnimation = () => {
    setIsRefreshingData(true);
    
    startTransition(() => {
      refreshData();
      fetchStudentResultsData(); // Thêm dòng này
      
      // Để tránh lỗi linting, xóa hàm fetchCounts và sử dụng timeout để tắt trạng thái loading
      setTimeout(() => {
        setIsRefreshingData(false);
      }, 800);
    });
  };
  
  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      {renderRecoveryUI()}
      
      {/* Add the styles for animations and UI */}
      <style dangerouslySetInnerHTML={{ __html: Dashboard_CSS }} />
      
      <div className="container mx-auto p-6">
        <Tabs defaultValue="assigned" onValueChange={(value) => setActiveTab(value)}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="animate-fade-in">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                Bài tập
              </h1>
              <p className="text-gray-600 mt-1">Các bài tập dictation được giao cho bạn</p>
            </div>
            
            <div className="flex gap-4">
              <Button 
                onClick={refreshDataWithAnimation} 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={isRefreshingData}
              >
                <RefreshCcw className={`h-4 w-4 ${isRefreshingData ? 'animate-spin' : ''}`} />
                {isRefreshingData ? 'Đang làm mới...' : 'Làm mới'}
              </Button>
              
              <TabsList className="bg-blue-50 p-1 shadow-md">
                <TabsTrigger value="assigned" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <BookText className="w-4 h-4 mr-2" />
                Đã giao
              </TabsTrigger>
                <TabsTrigger value="completed" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <CheckCircle className="w-4 h-4 mr-2" />
                Hoàn thành
              </TabsTrigger>
            </TabsList>
            </div>
          </div>
        </Tabs>
        
      <div className="space-y-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="stat-card stat-card-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center">
                <div className="info-icon info-blue">
                  <Book className="h-5 w-5" />
                </div>
        <div>
                  <div className="stat-label">Bài tập đã giao</div>
                  <div className="stat-number">{questions.length}</div>
                </div>
              </div>
        </div>
        
            <div className="stat-card stat-card-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center">
                <div className="info-icon info-purple">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="stat-label">Bài tập đã hoàn thành</div>
                  <div className="stat-number">{completedQuestionIds.size}</div>
                </div>
              </div>
            </div>
            
            <div className="stat-card stat-card-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center">
                <div className="info-icon info-indigo">
                  <BarChart2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="stat-label">Cần hoàn thành</div>
                  <div className="stat-number">{questions.length - completedQuestionIds.size}</div>
                </div>
              </div>
            </div>
        </div>
        
          <Card className="dashboard-card overflow-hidden border-0 shadow-lg">
          <CardContent className="pt-6">
              {activeTab === 'completed' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-blue-500 animate-pulse-custom" />
                      <p className="text-blue-700 font-medium">
                      Bạn có thể làm lại bất kỳ bài tập nào đã hoàn thành để cải thiện kết quả. 
                      Hệ thống sẽ lưu lại tất cả các lần làm của bạn.
                    </p>
                    </div>
              </div>
                  
                  <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                      <TableHeader className="bg-gradient-to-r from-gray-50 to-blue-50">
                        <TableRow>
                          <TableHead>Tiêu đề</TableHead>
                          <TableHead>Giáo viên</TableHead>
                          <TableHead>Lớp học</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Số lần làm</TableHead>
                          <TableHead>Điểm</TableHead>
                          <TableHead>Xếp hạng</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                    {questions.filter(q => completedQuestionIds.has(q.id)).length > 0 ? (
                      questions
                        .filter(q => completedQuestionIds.has(q.id))
                            .map((question, index) => {
                              const deadline = questionDeadlines[question.id];
                              const answerDetails = studentAnswersMap[question.id];
                              const isCompleted = answerDetails?.is_completed || false;
                              const score = answerDetails?.score;
                              const ranking = studentRankings[question.id];
                              const hasStarted = answerDetails?.started_at != null;
                              // Sử dụng attempt_count từ attemptCounts
                              const attemptCount = attemptCounts[question.id] || answerDetails?.attempt_count || 0;
                              
                              let status;
                              if (isCompleted) {
                                // Check if the score meets the passing threshold (70%)
                                const isPassed = score !== null && score !== undefined && score >= 70;
                                if (isPassed) {
                                status = {
                                  label: 'Đã hoàn thành',
                                  color: 'bg-green-100 text-green-800',
                                  icon: <CheckCircle className="h-4 w-4 mr-1" />,
                                  code: ASSIGNMENT_STATUS.COMPLETED
                                };
                                } else {
                                  status = {
                                    label: 'Chưa đạt',
                                    color: 'bg-red-100 text-red-800',
                                    icon: <AlertTriangle className="h-4 w-4 mr-1" />,
                                    code: ASSIGNMENT_STATUS.NOT_PASSED
                                  };
                                }
                              } else if (answerDetails?.started_at) {
                                status = {
                                  label: 'Đã làm',
                                  color: 'bg-yellow-100 text-yellow-800',
                                  icon: <Clock className="h-4 w-4 mr-1" />,
                                  code: ASSIGNMENT_STATUS.IN_PROGRESS
                                };
                              } else {
                                status = {
                                  label: 'Chưa làm',
                                  color: 'bg-blue-100 text-blue-800',
                                  icon: <BookOpen className="h-4 w-4 mr-1" />,
                                  code: ASSIGNMENT_STATUS.NOT_STARTED
                                };
                              }
                              
                              const isExpired = question.deadline && new Date(question.deadline) < new Date();
                              
                              return (
                                <TableRow key={question.id} className="table-row-animated" style={{ animationDelay: `${index * 0.05}s` }}>
                                  <TableCell className="font-medium">{question.title}</TableCell>
                                  <TableCell>{question.profiles?.full_name || ''}</TableCell>
                                  <TableCell>
                                    {classNames[question.id] ? (
                                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                                        {classNames[question.id]}
                                      </Badge>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className={getDeadlineColorClass(deadline)}>
                                        {formatDate(deadline)}
                                      </span>
                                      {isPastDeadline(deadline) && !isCompleted && (
                                        <span className="text-red-500 text-xs mt-1 flex items-center">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          Đã quá hạn
                                        </span>
                                      )}
                                      {isDeadlineApproaching(deadline) && !isCompleted && (
                                        <span className="text-orange-500 text-xs mt-1 flex items-center">
                                          <Clock className="h-3 w-3 mr-1" />
                                          Sắp hết hạn
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="bg-blue-50">
                                      {attemptCount}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {isCompleted ? (
                                      <div className="flex flex-col">
                                        {(() => {
                                          // Lấy điểm đã điều chỉnh từ bảng rankings nếu có
                                          const rankingData = studentRankings[question.id];
                                          let displayScore = 0;
                                          
                                          if (rankingData && rankingData.adjusted_score !== undefined) {
                                            // Sử dụng adjusted_score từ class_rankings
                                            displayScore = rankingData.adjusted_score;
                                          } else if (answerDetails?.score !== undefined && answerDetails.score !== null) {
                                            // Fallback nếu không có trong rankings
                                            displayScore = answerDetails.score === 100 ? 10 : Math.round(answerDetails.score / 10) / 10;
                                          }
                                          
                                          // Xác định loại badge dựa trên điểm số
                                          let badgeClass = 'score-badge ';
                                          let iconElement = null;
                                          
                                          if (displayScore >= 9) {
                                            badgeClass += 'perfect';
                                            iconElement = <Trophy className="h-5 w-5 mr-2 text-yellow-600 animate-shake" />;
                                          } else if (displayScore >= 8) {
                                            badgeClass += 'excellent';
                                            iconElement = <Award className="h-5 w-5 mr-2 text-blue-600 animate-pulse-custom" />;
                                          } else if (displayScore >= 7) {
                                            badgeClass += 'good';
                                            iconElement = <Star className="h-5 w-5 mr-2 text-green-500" />;
                                          } else if (displayScore >= 5) {
                                            badgeClass += 'average';
                                            iconElement = <Star className="h-5 w-5 mr-2 text-yellow-500" />;
                                                } else {
                                            badgeClass += 'poor';
                                            iconElement = <AlertTriangle className="h-5 w-5 mr-2 text-red-200" />;
                                          }
                                          
                                          return (
                                            <div className={badgeClass}>
                                              {iconElement}
                                              <div className="relative">
                                                <span className="font-bold text-lg relative z-10">{displayScore.toFixed(1)}</span>
                                                {displayScore >= 9 && (
                                                  <div className="absolute -top-1 -right-1 -bottom-1 -left-1 bg-yellow-200 rounded-full opacity-20 animate-pulse-custom"></div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {studentRankings[question.id] ? (
                                      <div className="flex flex-col gap-1">
                                        {(() => {
                                          const rank = studentRankings[question.id].rank;
                                          const total = studentRankings[question.id].total;
                                          
                                          // Xác định loại badge dựa trên thứ hạng
                                          let badgeClass = 'rank-badge ';
                                          let iconElement = null;
                                          let effectElement = null;
                                          
                                          if (rank === 1) {
                                            badgeClass += 'top1';
                                            iconElement = <Crown className="h-5 w-5 mr-2 text-yellow-600 animate-shake" />;
                                            effectElement = (
                                              <div className="absolute top-0 right-0 left-0 bottom-0">
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                                                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                                              </div>
                                            );
                                          } else if (rank <= 3) {
                                            badgeClass += 'top3';
                                            iconElement = <Trophy className="h-5 w-5 mr-2 text-gray-600 animate-pulse-custom" />;
                                            effectElement = (
                                              <div className="absolute top-0 right-0 left-0 bottom-0">
                                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                                              </div>
                                            );
                                          } else if (rank <= 10) {
                                            badgeClass += 'top10';
                                            iconElement = <Award className="h-5 w-5 mr-2 text-orange-600" />;
                                            effectElement = (
                                              <div className="absolute top-0 right-0 left-0 bottom-0">
                                                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-orange-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                                              </div>
                                            );
                                          } else if (rank <= 20) {
                                            badgeClass += 'top20';
                                            iconElement = <Award className="h-5 w-5 mr-2 text-purple-600" />;
                                            effectElement = (
                                              <div className="absolute top-0 right-0 left-0 bottom-0">
                                                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                                              </div>
                                            );
                                          } else if (rank <= 30) {
                                            badgeClass += 'top30';
                                            iconElement = <Star className="h-5 w-5 mr-2 text-teal-600" />;
                                            effectElement = (
                                              <div className="absolute top-0 right-0 left-0 bottom-0">
                                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-teal-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                                              </div>
                                            );
                                          } else if (rank <= 50) {
                                            badgeClass += 'top50';
                                            iconElement = <Star className="h-5 w-5 mr-2 text-red-600" />;
                                            effectElement = (
                                              <div className="absolute top-0 right-0 left-0 bottom-0">
                                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                                              </div>
                                            );
                                          }
                                          
                                          return (
                                            <div className="relative">
                                              <div className={badgeClass}>
                                                {iconElement}
                                                <span className="font-bold">#{rank}/{total}</span>
                                                {effectElement}
                                              </div>
                                              
                                              {rank === 1 && (
                                                <div className="mt-1 py-1 px-2 rounded-full bg-yellow-100 border border-yellow-300 flex items-center justify-center animate-float">
                                                  <Crown className="h-3 w-3 text-yellow-500 mr-1 animate-sparkle" />
                                                  <span className="text-xs font-semibold text-yellow-700 rainbow-text">Đứng đầu</span>
                                                </div>
                                              )}
                                              {rank > 1 && rank <= 3 && (
                                                <div className="mt-1 py-1 px-2 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center animate-float">
                                                  <Trophy className="h-3 w-3 text-gray-500 mr-1" />
                                                  <span className="text-xs font-semibold text-gray-700">Top 3</span>
                                                </div>
                                              )}
                                              {rank > 3 && rank <= 10 && (
                                                <div className="mt-1 py-1 px-2 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center">
                                                  <Award className="h-3 w-3 text-orange-500 mr-1" />
                                                  <span className="text-xs font-semibold text-orange-700">Top 10</span>
                                                </div>
                                              )}
                                              {rank > 10 && rank <= 20 && (
                                                <div className="mt-1 py-1 px-2 rounded-full bg-purple-100 border border-purple-300 flex items-center justify-center">
                                                  <Award className="h-3 w-3 text-purple-500 mr-1" />
                                                  <span className="text-xs font-semibold text-purple-700">Top 20</span>
                                                </div>
                                              )}
                                              {rank > 20 && rank <= 30 && (
                                                <div className="mt-1 py-1 px-2 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center">
                                                  <Star className="h-3 w-3 text-teal-500 mr-1" />
                                                  <span className="text-xs font-semibold text-teal-700">Top 30</span>
                                                </div>
                                              )}
                                              {rank > 30 && rank <= 50 && (
                                                <div className="mt-1 py-1 px-2 rounded-full bg-red-100 border border-red-300 flex items-center justify-center">
                                                  <Star className="h-3 w-3 text-red-500 mr-1" />
                                                  <span className="text-xs font-semibold text-red-700">Top 50</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
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
                                    <Link to={`/student/question/${question.id}`}>
                                      <Button size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white transition-all duration-300 hover:shadow-md">
                                        {isCompleted ? 'Làm lại' : (answerDetails?.started_at ? 'Tiếp tục' : 'Bắt đầu')}
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                      </Button>
                                    </Link>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                              <div className="flex flex-col items-center justify-center">
                                <div className="bg-blue-50 rounded-full p-3 mb-3">
                                  <Activity className="h-8 w-8 text-blue-400" />
                                </div>
                                <p className="font-medium">Bạn chưa hoàn thành bài tập nào</p>
                                <p className="text-sm text-gray-500 mt-1">Hãy bắt đầu làm bài tập để hiển thị kết quả tại đây.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
              </div>
                </div>
              )}

              {activeTab === 'assigned' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse-custom" />
                      <p className="text-indigo-700 font-medium">
                      Danh sách tất cả bài tập được giao cho bạn. Bài tập đã hoàn thành sẽ được đánh dấu và bạn có thể làm lại.
                    </p>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                      <TableHeader className="bg-gradient-to-r from-gray-50 to-indigo-50">
                        <TableRow>
                          <TableHead>Tiêu đề</TableHead>
                          <TableHead>Giáo viên</TableHead>
                          <TableHead>Lớp học</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Số lần làm</TableHead>
                          <TableHead>Điểm</TableHead>
                          <TableHead>Xếp hạng</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                    {questions.length > 0 ? (
                          questions.map((question, index) => {
                            const deadline = questionDeadlines[question.id];
                            const answerDetails = studentAnswersMap[question.id];
                            const isCompleted = answerDetails?.is_completed || false;
                            const score = answerDetails?.score;
                            const hasStarted = answerDetails?.started_at != null;
                            // Sử dụng attempt_count từ attemptCounts
                            const attemptCount = attemptCounts[question.id] || answerDetails?.attempt_count || 0;
                            
                            let status;
                            if (isCompleted) {
                              // Check if the score meets the passing threshold (70%)
                              const isPassed = score !== null && score !== undefined && score >= 70;
                              if (isPassed) {
                              status = {
                                label: 'Đã hoàn thành',
                                color: 'bg-green-100 text-green-800',
                                icon: <CheckCircle className="h-4 w-4 mr-1" />,
                                code: ASSIGNMENT_STATUS.COMPLETED
                              };
                              } else {
                                status = {
                                  label: 'Chưa đạt',
                                  color: 'bg-red-100 text-red-800',
                                  icon: <AlertTriangle className="h-4 w-4 mr-1" />,
                                  code: ASSIGNMENT_STATUS.NOT_PASSED
                                };
                              }
                            } else if (answerDetails?.started_at) {
                              status = {
                                label: 'Đã làm',
                                color: 'bg-yellow-100 text-yellow-800',
                                icon: <Clock className="h-4 w-4 mr-1" />,
                                code: ASSIGNMENT_STATUS.IN_PROGRESS
                              };
                            } else {
                              status = {
                                label: 'Chưa làm',
                                color: 'bg-blue-100 text-blue-800',
                                icon: <BookOpen className="h-4 w-4 mr-1" />,
                                code: ASSIGNMENT_STATUS.NOT_STARTED
                              };
                            }
                            
                            return (
                              <TableRow key={question.id} className="table-row-animated" style={{ animationDelay: `${index * 0.05}s` }}>
                                <TableCell className="font-medium">
                                  <div className="flex flex-col">
                                    <span>{question.title}</span>
                                    {getDifficultyText(question.difficulty)}
                                  </div>
                                </TableCell>
                                <TableCell>{question.profiles?.full_name || ''}</TableCell>
                                <TableCell>
                                  {classNames[question.id] ? (
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                                      {classNames[question.id]}
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className={getDeadlineColorClass(deadline)}>
                                      {formatDate(deadline)}
                                    </span>
                                    {isPastDeadline(deadline) && !isCompleted && (
                                      <span className="text-red-500 text-xs mt-1 flex items-center">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Đã quá hạn
                                      </span>
                                    )}
                                    {isDeadlineApproaching(deadline) && !isCompleted && (
                                      <span className="text-orange-500 text-xs mt-1 flex items-center">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Sắp hết hạn
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-blue-50">
                                    {attemptCount}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {isCompleted ? (
                                    <div className="flex flex-col">
                                      {(() => {
                                        // Lấy điểm đã điều chỉnh từ bảng rankings nếu có
                                        const rankingData = studentRankings[question.id];
                                        let displayScore = 0;
                                        
                                        if (rankingData && rankingData.adjusted_score !== undefined) {
                                          // Sử dụng adjusted_score từ class_rankings
                                          displayScore = rankingData.adjusted_score;
                                        } else if (answerDetails?.score !== undefined && answerDetails.score !== null) {
                                          // Fallback nếu không có trong rankings
                                          displayScore = answerDetails.score === 100 ? 10 : Math.round(answerDetails.score / 10) / 10;
                                        }
                                        
                                        // Xác định loại badge dựa trên điểm số
                                        let badgeClass = 'score-badge ';
                                        let iconElement = null;
                                        
                                        if (displayScore >= 9) {
                                          badgeClass += 'perfect';
                                          iconElement = <Trophy className="h-5 w-5 mr-2 text-yellow-600 animate-shake" />;
                                        } else if (displayScore >= 8) {
                                          badgeClass += 'excellent';
                                          iconElement = <Award className="h-5 w-5 mr-2 text-blue-600 animate-pulse-custom" />;
                                        } else if (displayScore >= 7) {
                                          badgeClass += 'good';
                                          iconElement = <Star className="h-5 w-5 mr-2 text-green-500" />;
                                        } else if (displayScore >= 5) {
                                          badgeClass += 'average';
                                          iconElement = <Star className="h-5 w-5 mr-2 text-yellow-500" />;
                                              } else {
                                          badgeClass += 'poor';
                                          iconElement = <AlertTriangle className="h-5 w-5 mr-2 text-red-200" />;
                                        }
                                        
                                        return (
                                          <div className={badgeClass}>
                                            {iconElement}
                                            <div className="relative">
                                              <span className="font-bold text-lg relative z-10">{displayScore.toFixed(1)}</span>
                                              {displayScore >= 9 && (
                                                <div className="absolute -top-1 -right-1 -bottom-1 -left-1 bg-yellow-200 rounded-full opacity-20 animate-pulse-custom"></div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {studentRankings[question.id] ? (
                                    <div className="flex flex-col gap-1">
                                      {(() => {
                                        const rank = studentRankings[question.id].rank;
                                        const total = studentRankings[question.id].total;
                                        
                                        // Xác định loại badge dựa trên thứ hạng
                                        let badgeClass = 'rank-badge ';
                                        let iconElement = null;
                                        let effectElement = null;
                                        
                                        if (rank === 1) {
                                          badgeClass += 'top1';
                                          iconElement = <Crown className="h-5 w-5 mr-2 text-yellow-600 animate-shake" />;
                                          effectElement = (
                                            <div className="absolute top-0 right-0 left-0 bottom-0">
                                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                                              <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                                            </div>
                                          );
                                        } else if (rank <= 3) {
                                          badgeClass += 'top3';
                                          iconElement = <Trophy className="h-5 w-5 mr-2 text-gray-600 animate-pulse-custom" />;
                                          effectElement = (
                                            <div className="absolute top-0 right-0 left-0 bottom-0">
                                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                                            </div>
                                          );
                                        } else if (rank <= 10) {
                                          badgeClass += 'top10';
                                          iconElement = <Award className="h-5 w-5 mr-2 text-orange-600" />;
                                          effectElement = (
                                            <div className="absolute top-0 right-0 left-0 bottom-0">
                                              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-orange-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                                            </div>
                                          );
                                        } else if (rank <= 20) {
                                          badgeClass += 'top20';
                                          iconElement = <Award className="h-5 w-5 mr-2 text-purple-600" />;
                                          effectElement = (
                                            <div className="absolute top-0 right-0 left-0 bottom-0">
                                              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                                            </div>
                                          );
                                        } else if (rank <= 30) {
                                          badgeClass += 'top30';
                                          iconElement = <Star className="h-5 w-5 mr-2 text-teal-600" />;
                                          effectElement = (
                                            <div className="absolute top-0 right-0 left-0 bottom-0">
                                              <div className="absolute -top-1 -left-1 w-2 h-2 bg-teal-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                                            </div>
                                          );
                                        } else if (rank <= 50) {
                                          badgeClass += 'top50';
                                          iconElement = <Star className="h-5 w-5 mr-2 text-red-600" />;
                                          effectElement = (
                                            <div className="absolute top-0 right-0 left-0 bottom-0">
                                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                                            </div>
                                          );
                                        }
                                        
                                        return (
                                          <div className="relative">
                                            <div className={badgeClass}>
                                              {iconElement}
                                              <span className="font-bold">#{rank}/{total}</span>
                                              {effectElement}
                                            </div>
                                            
                                            {rank === 1 && (
                                              <div className="mt-1 py-1 px-2 rounded-full bg-yellow-100 border border-yellow-300 flex items-center justify-center animate-float">
                                                <Crown className="h-3 w-3 text-yellow-500 mr-1 animate-sparkle" />
                                                <span className="text-xs font-semibold text-yellow-700 rainbow-text">Đứng đầu</span>
                                              </div>
                                            )}
                                            {rank > 1 && rank <= 3 && (
                                              <div className="mt-1 py-1 px-2 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center animate-float">
                                                <Trophy className="h-3 w-3 text-gray-500 mr-1" />
                                                <span className="text-xs font-semibold text-gray-700">Top 3</span>
                                              </div>
                                            )}
                                            {rank > 3 && rank <= 10 && (
                                              <div className="mt-1 py-1 px-2 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center">
                                                <Award className="h-3 w-3 text-orange-500 mr-1" />
                                                <span className="text-xs font-semibold text-orange-700">Top 10</span>
                                              </div>
                                            )}
                                            {rank > 10 && rank <= 20 && (
                                              <div className="mt-1 py-1 px-2 rounded-full bg-purple-100 border border-purple-300 flex items-center justify-center">
                                                <Award className="h-3 w-3 text-purple-500 mr-1" />
                                                <span className="text-xs font-semibold text-purple-700">Top 20</span>
                                              </div>
                                            )}
                                            {rank > 20 && rank <= 30 && (
                                              <div className="mt-1 py-1 px-2 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center">
                                                <Star className="h-3 w-3 text-teal-500 mr-1" />
                                                <span className="text-xs font-semibold text-teal-700">Top 30</span>
                                              </div>
                                            )}
                                            {rank > 30 && rank <= 50 && (
                                              <div className="mt-1 py-1 px-2 rounded-full bg-red-100 border border-red-300 flex items-center justify-center">
                                                <Star className="h-3 w-3 text-red-500 mr-1" />
                                                <span className="text-xs font-semibold text-red-700">Top 50</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
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
                                  <Link to={`/student/question/${question.id}`}>
                                    <Button size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white transition-all duration-300 hover:shadow-md">
                                      {isCompleted ? 'Làm lại' : (answerDetails?.started_at ? 'Tiếp tục' : 'Bắt đầu')}
                                      <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                  </Link>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                              <div className="flex flex-col items-center justify-center">
                                <div className="bg-blue-50 rounded-full p-3 mb-3">
                                  <Book className="h-8 w-8 text-blue-400" />
                                </div>
                                <p className="font-medium">Không có bài tập nào được giao</p>
                                <p className="text-sm text-gray-500 mt-1">Bạn sẽ thấy danh sách bài tập ở đây khi giáo viên giao bài.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentDashboard;
