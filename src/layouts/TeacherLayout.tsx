import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import TeacherSidebar from '@/components/teacher/TeacherSidebar';
import Header from '@/components/Header';
import { toast } from 'sonner';

const TeacherLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const lastVisibleTime = useRef<number>(Date.now());
  
  const handleSidebarStateChange = (isOpen: boolean) => {
    setSidebarOpen(isOpen);
  };

  // Định nghĩa checkAuthState trước khi sử dụng trong handleVisibilityChange
  const checkAuthState = useCallback(async (isInitial = false) => {
    // Don't check if redirecting
    if (redirecting) return;

    console.log("TeacherLayout - checking auth state:", {
      user: user?.id,
      role: user?.role,
      loading,
      retryCount,
      isInitial
    });

    // On initial load, wait longer to let auth state settle
    if (isInitial) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsInitialLoad(false);
      return;
    }

    // Don't proceed if still loading
    if (loading) return;

    // Try to refresh the session if we don't have a user or if returning to the tab
    if (!user && retryCount < 3) {
      setRetryCount(prev => prev + 1);
      await refreshSession();
      return;
    }

    // Check role after confirming we have a valid user
    if (user && user.role !== 'teacher') {
      console.log("User is not a teacher, redirecting");
      setRedirecting(true);
      toast.error("Bạn không có quyền truy cập khu vực giáo viên");
      navigate('/student/dashboard');
      return;
    }

    // Redirect if no valid session after retries
    if (!user && retryCount >= 3) {
      console.log("No valid session after retries, redirecting to login");
      setRedirecting(true);
      
      toast("Vui lòng đăng nhập lại để tiếp tục", {
        description: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ."
      });
      
      navigate('/login-teacher');
    }
  }, [user, loading, navigate, redirecting, retryCount, refreshSession]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    const currentTime = Date.now();
    const timeAway = currentTime - lastVisibleTime.current;
    
    if (document.visibilityState === 'visible') {
      console.log(`TeacherLayout - Tab became visible after ${timeAway / 1000}s away`);
      lastVisibleTime.current = currentTime;
      
      // Only refresh session and dispatch global event if away for at least 5 minutes
      const MIN_TIME_AWAY = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      // Always get last global refresh time from localStorage
      const lastGlobalRefresh = parseInt(localStorage.getItem('last_global_refresh') || '0', 10);
      const timeSinceLastGlobalRefresh = currentTime - lastGlobalRefresh;
      
      if (timeAway >= MIN_TIME_AWAY && timeSinceLastGlobalRefresh >= MIN_TIME_AWAY) {
        // Update the last refresh time in localStorage
        localStorage.setItem('last_global_refresh', currentTime.toString());
        
        // Only refresh auth state, skip global refresh event in most cases
        if (user) {
          checkAuthState(false);
        }
        
        // Only dispatch global refresh in special cases (very long time away)
        if (timeAway >= 15 * 60 * 1000) { // 15 minutes
          // Dispatch global refresh event with added delay to prevent race conditions
          setTimeout(() => {
            window.dispatchEvent(new Event('supabase.data.refresh'));
          }, 300);
          
          console.log(`TeacherLayout - Dispatched global refresh (after ${timeSinceLastGlobalRefresh / 1000}s)`);
        } else {
          console.log(`TeacherLayout - Skipped global refresh (not away long enough: ${timeAway / 1000}s)`);
        }
      } else {
        console.log(`TeacherLayout - Skipped global refresh (only ${timeSinceLastGlobalRefresh / 1000}s since last refresh)`);
      }
    } else {
      lastVisibleTime.current = currentTime;
    }
  }, [user, checkAuthState]);

  // Initial setup
  useEffect(() => {
    checkAuthState(isInitialLoad);
  }, [checkAuthState, isInitialLoad, user]);

  // Set up visibility change listener
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Show loading state
  if (loading || isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="ml-4 text-gray-600">Đang xác thực...</p>
      </div>
    );
  }

  // Show recovery attempt message
  if (!user && retryCount > 0 && retryCount < 3) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Đang khôi phục phiên đăng nhập...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Lần thử {retryCount}/3</p>
        </div>
      </div>
    );
  }

  // Show redirect message
  if (!user || user.role !== 'teacher') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Đang điều hướng đến trang đăng nhập...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="fixed left-0 top-0 z-30 h-full">
        <TeacherSidebar onStateChange={handleSidebarStateChange} />
      </div>
      
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        isSidebarOpen ? 'ml-[300px]' : 'ml-[80px]'
      }`}>
        <div className="sticky top-0 z-40">
          <Header />
        </div>
        
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default TeacherLayout;
