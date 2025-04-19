import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRole 
}) => {
  const { user, loading, refreshSession } = useAuth();
  const location = useLocation();
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    
    const checkAccess = async () => {
      try {
        // If component just mounted but we have no user data,
        // try to refresh the session once
        if (!user && !loading) {
          await refreshSession();
        }
        
        if (isMounted) {
          setIsCheckingRole(false);
        }
      } catch (error) {
        console.error('Error in ProtectedRoute:', error);
        if (isMounted) {
          setIsCheckingRole(false);
        }
      }
    };
    
    checkAccess();
    
    return () => {
      isMounted = false;
    };
  }, [user, loading, refreshSession]);
  
  // Still loading auth state or checking role, show loading
  if (loading || isCheckingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="ml-4 text-gray-600">Đang xác thực...</p>
      </div>
    );
  }
  
  // Not authenticated
  if (!user) {
    // Redirect to appropriate login page based on requested role
    const redirectPath = allowedRole 
      ? `/login-${allowedRole}` 
      : '/login-student';
      
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }
  
  // Check role if specified
  if (allowedRole && user.role !== allowedRole) {
    // Redirect to appropriate dashboard based on user's actual role
    const redirectPath = user.role === 'teacher' 
      ? '/teacher/dashboard' 
      : '/student/dashboard';
      
    return <Navigate to={redirectPath} replace />;
  }
  
  // User is authenticated with correct role
  return <>{children}</>;
};

export default ProtectedRoute;
