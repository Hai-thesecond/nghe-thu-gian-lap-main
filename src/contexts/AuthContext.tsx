import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, UserProfile, UserRole } from '@/lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string, role: UserRole) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Khởi tạo session khi component mount
  useEffect(() => {
    const initSession = async () => {
      try {
        // Lấy session hiện tại
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setUser(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('Profile error:', profileError);
            setUser(null);
          } else {
            setUser(profile);
          }
        }

        // Lắng nghe thay đổi auth state
        const { data: { subscription } } = await supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event, session);
            
            if (event === 'SIGNED_IN' && session?.user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
                
              setUser(profile);
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Init session error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
