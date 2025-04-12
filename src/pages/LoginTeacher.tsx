import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/layouts/MainLayout';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

const LoginTeacher = () => {
  const [activeTab, setActiveTab] = useState<string>('login');
  const { signIn, signUp } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    setLoginLoading(true);
    console.log("Teacher login attempt with:", values);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
      
      if (error) {
        console.error("Teacher login error:", error);
        setLoginError(error.message);
      } else {
        console.log("Teacher login successful:", data);
        navigate('/teacher/dashboard');
      }
    } catch (err) {
      console.error("Unexpected error during teacher login:", err);
      setLoginError('Đã xảy ra lỗi khi đăng nhập');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (values: z.infer<typeof registerSchema>) => {
    setRegisterError(null);
    setRegisterLoading(true);
    try {
      await signUp(values.email, values.password, values.fullName, 'teacher');
    } catch (error: any) {
      setRegisterError(error.message || 'Đăng ký thất bại. Vui lòng thử lại sau.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const clearSession = async () => {
    try {
      setLoginLoading(true);
      setLoginError(null);
      console.log("Manually clearing session");
      await supabase.auth.signOut();
      toast("Đã xóa phiên đăng nhập cũ");
      setLoginLoading(false);
    } catch (error) {
      console.error("Error clearing session:", error);
      setLoginError("Không thể xóa phiên đăng nhập cũ");
      setLoginLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoginLoading(true);
      setLoginError(null);
      
      // Test 1: Basic connection
      console.log("Testing basic Supabase connection...");
      const startTime = Date.now();
      
      try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        
        if (error) {
          console.error("⚠️ Database connection test failed:", error);
          setLoginError(`Database connection error: ${error.message}`);
          return;
        }
        
        console.log(`✅ Database connection successful (${Date.now() - startTime}ms)`);
      } catch (err: any) {
        console.error("❌ Exception during connection test:", err);
        setLoginError(`Connection exception: ${err.message}`);
        return;
      }
      
      // Test 2: Auth service
      console.log("Testing auth service...");
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("⚠️ Auth service test failed:", error);
          setLoginError(`Auth service error: ${error.message}`);
          return;
        }
        
        console.log("✅ Auth service working:", data.session ? "Session exists" : "No active session");
      } catch (err: any) {
        console.error("❌ Exception during auth test:", err);
        setLoginError(`Auth service exception: ${err.message}`);
        return;
      }
      
      setLoginError("Connection tests passed successfully! Try logging in now.");
      toast("Kết nối thành công đến máy chủ");
    } finally {
      setLoginLoading(false);
    }
  };

  const forceResetAll = () => {
    try {
      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Force sign out from Supabase
      supabase.auth.signOut();
      
      // Show notification
      toast("Đã xóa toàn bộ dữ liệu đăng nhập");
      
      // Reload the page after a brief delay
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Error during force reset:", error);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-md mx-auto my-12 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Khu vực Giáo viên</h1>
          <p className="text-gray-600 mt-2">Đăng nhập hoặc đăng ký để quản lý các bài tập và học sinh của bạn</p>
        </div>

        <div className="glass-morphism">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
              <TabsTrigger value="register">Đăng ký</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-6 p-6">
              {loginError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mật khẩu</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="******" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full btn-gradient" 
                    disabled={loginLoading}
                  >
                    {loginLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang xử lý...
                      </span>
                    ) : 'Đăng nhập'}
                  </Button>
                </form>
              </Form>
              
              <div className="text-center mt-4 flex flex-col items-center gap-2">
                <Link to="/login-student" className="text-primary hover:underline text-sm">
                  Bạn là học sinh? Đăng nhập tại đây
                </Link>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    clearSession();
                  }}
                  disabled={loginLoading}
                  className="text-gray-500 text-xs flex items-center gap-1 mt-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Xóa phiên đăng nhập cũ
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    testConnection();
                  }}
                  disabled={loginLoading}
                  className="text-blue-500 text-xs flex items-center gap-1 mt-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Kiểm tra kết nối
                </Button>

                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      forceResetAll();
                    }}
                    className="text-red-500 text-xs flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Xóa toàn bộ dữ liệu đăng nhập
                  </Button>

                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open('/supabase-test.html', '_blank');
                    }}
                    className="text-green-500 text-xs flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Mở trang kiểm tra riêng
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="register" className="space-y-6 p-6">
              {registerError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{registerError}</AlertDescription>
                </Alert>
              )}
              
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Họ và tên</FormLabel>
                        <FormControl>
                          <Input placeholder="Nguyễn Văn A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mật khẩu</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="******" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Xác nhận mật khẩu</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="******" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full btn-gradient" 
                    disabled={registerLoading}
                  >
                    {registerLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang xử lý...
                      </span>
                    ) : 'Đăng ký'}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default LoginTeacher;
