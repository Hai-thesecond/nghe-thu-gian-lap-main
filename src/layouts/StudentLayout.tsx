import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import StudentSidebar from '@/components/student/StudentSidebar';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

interface StudentLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

const StudentLayout: React.FC<StudentLayoutProps> = ({ children, hideSidebar = false }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { refreshSession, user } = useAuth();
  const lastVisibleTime = useRef<number>(Date.now());

  const handleSidebarStateChange = (isOpen: boolean) => {
    setSidebarOpen(isOpen);
  };

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    const currentTime = Date.now();
    const timeAway = currentTime - lastVisibleTime.current;
    
    if (document.visibilityState === 'visible') {
      console.log(`StudentLayout - Tab became visible after ${timeAway / 1000}s away`);
      lastVisibleTime.current = currentTime;
      
      // Only refresh session and dispatch global event if away for at least 5 minutes
      const MIN_TIME_AWAY = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      // Always get last global refresh time from localStorage
      const lastGlobalRefresh = parseInt(localStorage.getItem('last_global_refresh') || '0', 10);
      const timeSinceLastGlobalRefresh = currentTime - lastGlobalRefresh;
      
      if (timeAway >= MIN_TIME_AWAY && timeSinceLastGlobalRefresh >= MIN_TIME_AWAY) {
        // Update the last refresh time in localStorage
        localStorage.setItem('last_global_refresh', currentTime.toString());
        
        // Only refresh session, skip global refresh event in most cases
        if (user) {
          refreshSession();
        }
        
        // Only dispatch global refresh in special cases (very long time away)
        if (timeAway >= 15 * 60 * 1000) { // 15 minutes
          // Dispatch global refresh event with added delay to prevent race conditions
          setTimeout(() => {
            window.dispatchEvent(new Event('supabase.data.refresh'));
          }, 300);
          
          console.log(`StudentLayout - Dispatched global refresh (after ${timeSinceLastGlobalRefresh / 1000}s)`);
        } else {
          console.log(`StudentLayout - Skipped global refresh (not away long enough: ${timeAway / 1000}s)`);
        }
      } else {
        console.log(`StudentLayout - Skipped global refresh (only ${timeSinceLastGlobalRefresh / 1000}s since last refresh)`);
      }
    } else {
      lastVisibleTime.current = currentTime;
    }
  }, [refreshSession, user]);

  // Set up visibility change listener
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return (
    <ProtectedRoute allowedRole="student">
      <div className="flex h-screen bg-background">
        <Toaster richColors position="top-right" />
        
        {!hideSidebar && (
          <div className="fixed left-0 top-0 z-30 h-full">
            <StudentSidebar onStateChange={handleSidebarStateChange} />
          </div>
        )}
        
        <div 
          className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
            !hideSidebar ? (isSidebarOpen ? 'ml-[300px]' : 'ml-[80px]') : 'ml-0'
          }`}
        >
          <div className="sticky top-0 z-40">
            <Header />
          </div>
          
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudentLayout;
