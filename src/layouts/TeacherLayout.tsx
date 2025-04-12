import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import TeacherSidebar from '@/components/teacher/TeacherSidebar';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const TeacherLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const checkAuthState = async () => {
      console.log("TeacherLayout - checking auth state:", {
        user: user?.id,
        role: user?.role,
        loading,
        retryCount,
        isInitialLoad
      });

      // On initial load, wait longer to let auth state settle
      if (isInitialLoad) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsInitialLoad(false);
        return;
      }

      // Don't redirect if still loading or already redirecting
      if (loading || redirecting) {
        return;
      }

      // Check for any session tokens
      const hasLocalSession = localStorage.getItem('sb-tscigqtvowftzriqvzit-auth-token');
      const hasLegacySession = localStorage.getItem('supabase.auth.token');
      const hasSession = hasLocalSession || hasLegacySession;

      // If no user but we have a session, try to recover
      if (!user && hasSession && retryCount < 3) {
        console.log(`Attempting session recovery (${retryCount + 1}/3)`);
        setRetryCount(prev => prev + 1);
        
        try {
          // First try to get current session
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            console.log("Found existing session, refreshing...");
            const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
            
            if (error) {
              console.error("Error refreshing session:", error);
              throw error;
            }
            
            if (refreshedSession) {
              console.log("Session refreshed successfully");
              // Wait for auth state to update
              await new Promise(resolve => setTimeout(resolve, 1000));
              return;
            }
          }
        } catch (err) {
          console.error("Session recovery failed:", err);
        }
      }

      // Redirect if no valid session after retries
      if (!user && (!hasSession || retryCount >= 3)) {
        console.log("No valid session, redirecting to login");
        setRedirecting(true);
        
        // Clear any stale session data
        localStorage.removeItem('sb-tscigqtvowftzriqvzit-auth-token');
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('dictation-auth-storage');
        localStorage.removeItem('dictation-auth-storage-user');
        
        await supabase.auth.signOut();
        
        toast("Vui lòng đăng nhập lại để tiếp tục", {
          description: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ."
        });
        
        navigate('/login-teacher');
        return;
      }

      // Check role after confirming we have a valid user
      if (user && user.role !== 'teacher') {
        console.log("User is not a teacher, redirecting");
        setRedirecting(true);
        toast("Bạn không có quyền truy cập khu vực giáo viên");
        navigate('/student/dashboard');
        return;
      }
    };

    checkAuthState();
  }, [user, loading, navigate, redirecting, retryCount, isInitialLoad]);

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
        <TeacherSidebar />
      </div>
      
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
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
