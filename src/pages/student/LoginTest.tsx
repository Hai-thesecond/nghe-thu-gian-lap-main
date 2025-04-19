import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Hàm này sẽ chạy ngay khi file được import
const testAuthenticationOnLoad = async () => {
  console.log('===== KIỂM TRA ĐĂNG NHẬP SUPABASE =====');
  
  try {
    // Thử lấy session hiện tại
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Lỗi kiểm tra session:', sessionError);
    } else {
      console.log('✅ Kiểm tra session thành công:', sessionData);
      
      // Nếu không có session, thử đăng nhập
      if (!sessionData.session) {
        console.log('Không có session, thử đăng nhập...');
        
        // Thử đăng nhập với tài khoản mặc định
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'student@gmail.com',
          password: 'student'
        });
        
        if (signInError) {
          console.error('❌ Lỗi đăng nhập:', signInError);
        } else {
          console.log('✅ Đăng nhập thành công:', signInData);
        }
      } else {
        console.log('Đã có session, người dùng đã đăng nhập');
      }
    }
  } catch (err) {
    console.error('❌ Lỗi không xác định:', err);
  }
  
  console.log('===== KẾT THÚC KIỂM TRA =====');
};

// Chạy kiểm tra ngay khi file được import
testAuthenticationOnLoad();

const LoginTest = () => {
  const [email, setEmail] = useState('student@gmail.com');
  const [password, setPassword] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    // Kiểm tra session khi component mount
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        setError(`Lỗi kiểm tra phiên: ${error.message}`);
        return;
      }
      
      console.log('Session data:', data);
      setSessionInfo(data);
      
      if (data.session) {
        setSuccessMessage('Đã đăng nhập thành công!');
      } else {
        setSuccessMessage('Chưa đăng nhập');
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(`Lỗi không mong muốn: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    console.log('DEBUG-AUTH: Starting login with:', { email, password });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('DEBUG-AUTH: Login error:', error);
        setError(`Lỗi đăng nhập: ${error.message}`);
        setLoading(false);
        return;
      }
      
      console.log('DEBUG-AUTH: Login successful:', data.user?.id);
      
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single();
        
      if (profileError) {
        console.error('DEBUG-AUTH: Profile fetch error:', profileError);
        setError('Could not fetch user profile');
        setLoading(false);
        return;
      }
      
      console.log('DEBUG-AUTH: Profile fetched:', profile);
      
      // Test storage access
      console.log('DEBUG-AUTH: Testing storage access...');
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
          console.error('DEBUG-AUTH: Storage bucket list error:', bucketsError);
        } else {
          console.log('DEBUG-AUTH: Available storage buckets:', buckets);
        }
      } catch (storageError) {
        console.error('DEBUG-AUTH: Storage access exception:', storageError);
      }
      
      setSessionInfo(data);
      setSuccessMessage('Đăng nhập thành công!');
      setLoading(false);
    } catch (err: any) {
      console.error('DEBUG-AUTH: Login exception:', err);
      setError(`Lỗi không mong muốn: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSignIn = handleLogin; // Để tránh lỗi với các tham chiếu cũ

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        setError(`Lỗi đăng xuất: ${error.message}`);
        return;
      }
      
      console.log('Signout successful');
      setSuccessMessage('Đã đăng xuất thành công!');
      setSessionInfo(null);
    } catch (err: any) {
      console.error('Unexpected error during sign out:', err);
      setError(`Lỗi không mong muốn: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Kiểm tra đăng nhập</CardTitle>
          <CardDescription>
            Công cụ kiểm tra đăng nhập Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form đăng nhập */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
              />
            </div>

            <div className="flex items-center justify-between">
              <Button 
                type="submit" 
                disabled={loading}
                className="w-1/2"
              >
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </Button>
              
              <Button 
                type="button"
                variant="outline"
                onClick={handleSignOut}
                disabled={loading}
                className="w-1/3"
              >
                Đăng xuất
              </Button>
            </div>
          </form>

          <Button 
            type="button"
            variant="secondary"
            onClick={checkSession}
            disabled={loading}
            className="w-full"
          >
            Kiểm tra phiên
          </Button>

          {/* Các nút điều hướng */}
          <div className="flex gap-4 mt-4">
            <Button 
              asChild 
              variant="outline" 
              className="w-1/2"
            >
              <Link to="/login-student">Trang đăng nhập</Link>
            </Button>
            
            <Button 
              asChild 
              variant="outline" 
              className="w-1/2"
            >
              <Link to="/student/dashboard">Dashboard</Link>
            </Button>
          </div>

          {/* Kết quả */}
          {error && (
            <div className="p-4 border border-red-300 bg-red-50 rounded text-red-800 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 border border-green-300 bg-green-50 rounded text-green-800">
              {successMessage}
            </div>
          )}

          {sessionInfo && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Thông tin phiên:</h3>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(sessionInfo, null, 2)}
              </pre>
            </div>
          )}

          <div className="text-xs text-gray-500 border-t pt-4">
            <p className="font-semibold">Thông tin Supabase:</p>
            <p><strong>URL:</strong> https://tscigqtvowftzriqvzit.supabase.co</p>
            <p><strong>Có API Key:</strong> Có</p>
            <p><strong>Key được cập nhật:</strong> {new Date().toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginTest; 