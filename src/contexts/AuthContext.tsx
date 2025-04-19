import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, UserProfile, UserRole } from '@/lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string, role: UserRole) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const authSubscription = useRef<{ unsubscribe: () => void } | null>(null);
  const lastVisibleTime = useRef<number>(Date.now());
  const isInitialized = useRef<boolean>(false);
  const isRefreshing = useRef<boolean>(false);

  // Fetch user profile function
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        return null;
      }
      
      return profile;
    } catch (error) {
      console.error('Fetch profile error:', error);
      return null;
    }
  }, []);

  // Initialize auth session
  const initSession = useCallback(async () => {
    if (isInitialized.current || isRefreshing.current) return;
    
    try {
      isRefreshing.current = true;
      console.log('Initializing auth session');
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setUser(null);
        return;
      }

      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        if (profile) {
          console.log('User profile loaded:', profile.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      // Set up auth state change listener if not already set
      if (!authSubscription.current) {
        const { data: { subscription } } = await supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
              const profile = await fetchUserProfile(session.user.id);
              if (profile) {
                setUser(profile);
              }
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
            }
          }
        );

        authSubscription.current = subscription;
      }
      
      isInitialized.current = true;
    } catch (error) {
      console.error('Init session error:', error);
      setUser(null);
    } finally {
      isRefreshing.current = false;
      setLoading(false);
    }
  }, [fetchUserProfile]);

  // Refresh session function
  const refreshSession = useCallback(async () => {
    if (isRefreshing.current) return;
    
    try {
      isRefreshing.current = true;
      console.log('Refreshing auth session');
      
      // Try to refresh current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        return;
      }
      
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        if (profile) {
          console.log('User profile refreshed');
          setUser(profile);
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, [fetchUserProfile]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    const currentTime = Date.now();
    const timeAway = currentTime - lastVisibleTime.current;
    
    if (document.visibilityState === 'visible') {
      console.log(`AuthContext - Tab became visible after ${timeAway / 1000}s away`);
      lastVisibleTime.current = currentTime;
      
      // Use a minimum time threshold before refreshing sessions and triggering events
      const MIN_TIME_AWAY = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      // Check the global refresh time from localStorage
      const lastGlobalRefresh = parseInt(localStorage.getItem('last_global_refresh') || '0', 10);
      const timeSinceLastGlobalRefresh = currentTime - lastGlobalRefresh;
      const lastAuthRefresh = parseInt(localStorage.getItem('last_auth_refresh') || '0', 10);
      const timeSinceLastAuthRefresh = currentTime - lastAuthRefresh;
      
      // Only refresh if away for at least MIN_TIME_AWAY or if the auth session hasn't been
      // refreshed for at least 60 minutes (to prevent session expiration)
      if (timeAway >= MIN_TIME_AWAY || timeSinceLastAuthRefresh >= 60 * 60 * 1000) {
        // Record refresh attempt in localStorage
        localStorage.setItem('last_auth_refresh', currentTime.toString());
        
        // Only refresh the session
        refreshSession();
        
        console.log(`AuthContext - Session refreshed (after ${Math.min(timeAway, timeSinceLastAuthRefresh) / 1000}s)`);
      } else {
        console.log(`AuthContext - Skipped refresh (only ${timeAway / 1000}s away, ${timeSinceLastAuthRefresh / 1000}s since last auth refresh)`);
      }
    } else {
      lastVisibleTime.current = currentTime;
    }
  }, [refreshSession]);

  // Initialize on component mount
  useEffect(() => {
    initSession();
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (authSubscription.current) {
        authSubscription.current.unsubscribe();
        authSubscription.current = null;
      }
    };
  }, [initSession, handleVisibilityChange]);

  const signIn = async (email: string, password: string, role: UserRole) => {
    try {
      setLoading(true);
      console.log('Starting sign in:', email, role);
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        toast.error('Đăng nhập thất bại', {
          description: 'Email hoặc mật khẩu không đúng'
        });
        return false;
      }

      if (!data.user) {
        toast.error('Đăng nhập thất bại', {
          description: 'Không tìm thấy thông tin người dùng'
        });
        return false;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        toast.error('Đăng nhập thất bại', {
          description: 'Không tìm thấy thông tin người dùng'
        });
        return false;
      }

      if (profile.role !== role) {
        toast.error('Đăng nhập thất bại', {
          description: `Bạn không có quyền truy cập với vai trò ${role === 'teacher' ? 'giáo viên' : 'học sinh'}`
        });
        await supabase.auth.signOut();
        return false;
      }

      setUser(profile);
      toast.success('Đăng nhập thành công', {
        description: 'Chào mừng bạn trở lại!'
      });

      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
      return true;
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Đăng nhập thất bại', {
        description: 'Vui lòng thử lại sau'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    try {
      setLoading(true);

      // Kiểm tra xem email đã tồn tại chưa
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        toast.error('Đăng ký thất bại', {
          description: 'Email đã được sử dụng'
        });
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!data.user) {
        throw new Error('No user data returned');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            email,
            full_name: fullName,
            role,
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) throw profileError;

      // If this is a student account, set category to 'poor' by default
      if (role === 'student') {
        const { error: categoryError } = await supabase
          .from('student_categories')
          .insert([
            {
              student_id: data.user.id,
              category: 'poor',
              category_display: 'Yếu',
              average_score: 0,
              last_updated: new Date().toISOString(),
            },
          ]);

        if (categoryError) {
          console.error('Error setting default student category:', categoryError);
        }
      }

      toast.success('Đăng ký thành công', {
        description: 'Vui lòng đăng nhập để tiếp tục'
      });

      navigate('/login-' + role);
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      let message = 'Đăng ký thất bại';
      if (error.message?.includes('already registered')) {
        message = 'Email đã được đăng ký';
      }

      toast.error(message, {
        description: 'Vui lòng thử lại'
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      navigate('/');
      toast.success('Đã đăng xuất');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Đăng xuất thất bại', {
        description: 'Vui lòng thử lại'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshSession }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
