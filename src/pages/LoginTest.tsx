import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const LoginTest = () => {
  const [status, setStatus] = useState<string>('Đang kiểm tra...');
  const [authStatus, setAuthStatus] = useState<string>('Chưa kiểm tra');
  const [storageStatus, setStorageStatus] = useState<string>('Chưa kiểm tra');
  const [dbStatus, setDbStatus] = useState<string>('Chưa kiểm tra');
  
  // Hàm test kết nối Supabase cơ bản
  const testConnection = async () => {
    try {
      console.log("===== BẮT ĐẦU KIỂM TRA =====");
      
      // Kiểm tra kết nối database
      console.log("Kiểm tra kết nối database...");
      const { data: dbData, error: dbError } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true });
        
      if (dbError) {
        console.error("❌ Lỗi kết nối database:", dbError);
        setDbStatus(`❌ Lỗi: ${dbError.message}`);
      } else {
        console.log("✅ Kết nối database thành công!");
        setDbStatus("✅ Kết nối thành công");
      }
      
      // Kiểm tra authentication
      console.log("Kiểm tra kết nối authentication...");
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error("❌ Lỗi auth:", authError);
        setAuthStatus(`❌ Lỗi: ${authError.message}`);
      } else {
        console.log("✅ Auth API hoạt động, session:", authData.session ? "Có" : "Không");
        setAuthStatus("✅ Kết nối thành công" + (authData.session ? " (Đã đăng nhập)" : " (Chưa đăng nhập)"));
      }
      
      // Kiểm tra storage
      console.log("Kiểm tra kết nối storage...");
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          console.error("❌ Lỗi storage:", bucketsError);
          setStorageStatus(`❌ Lỗi: ${bucketsError.message}`);
        } else {
          console.log("✅ Storage API hoạt động, buckets:", buckets);
          setStorageStatus(`✅ Kết nối thành công (${buckets?.length || 0} buckets)`);
        }
      } catch (storageError: any) {
        console.error("❌ Exception khi truy cập storage:", storageError);
        setStorageStatus(`❌ Exception: ${storageError.message}`);
      }
      
      // Kết luận
      console.log("===== KẾT THÚC KIỂM TRA =====");
      
    } catch (error: any) {
      console.error("Lỗi không xác định:", error);
      setStatus(`❌ Lỗi không xác định: ${error.message}`);
    }
  };
  
  // Kiểm tra thủ công với API key mới
  const testWithManualRequest = async () => {
    try {
      console.log("===== KIỂM TRA THỦ CÔNG =====");
      
      // API Key đã được cập nhật trong supabase.ts
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2lncXR2b3dmdHpyaXF2eml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mjk2NTAsImV4cCI6MjA1ODAwNTY1MH0.wOUqO1V261MA_NGTnmf_1TkwYB-yhgtRCd0rtqxpbyM';
      
      // Test kết nối storage bằng fetch API trực tiếp
      const storageResponse = await fetch('https://tscigqtvowftzriqvzit.supabase.co/storage/v1/bucket/dictation', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      console.log("Storage test response:", storageResponse.status, await storageResponse.text());
      
      // Test kết nối auth API trực tiếp
      const authResponse = await fetch('https://tscigqtvowftzriqvzit.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password'
        })
      });
      
      console.log("Auth test response:", authResponse.status, await authResponse.text());
      
      console.log("===== KẾT THÚC KIỂM TRA THỦ CÔNG =====");
      
    } catch (error: any) {
      console.error("Lỗi kiểm tra thủ công:", error);
    }
  };
  
  // Hàm tạo dữ liệu mẫu để kiểm tra
  const generateTestData = async () => {
    try {
      console.log("===== TẠO DỮ LIỆU MẪU =====");
      
      // Kiểm tra cấu trúc bảng questions
      console.log("Kiểm tra cấu trúc bảng questions...");
      const { data: questionsInfo, error: questionsError } = await supabase.rpc('get_table_info', { 
        table_name: 'questions' 
      });
      
      if (questionsError) {
        console.error("❌ Lỗi kiểm tra bảng questions:", questionsError);
      } else {
        console.log("✅ Cấu trúc bảng questions:", questionsInfo);
      }
      
      // Kiểm tra cấu trúc bảng student_answers
      console.log("Kiểm tra cấu trúc bảng student_answers...");
      const { data: answersInfo, error: answersError } = await supabase.rpc('get_table_info', { 
        table_name: 'student_answers' 
      });
      
      if (answersError) {
        console.error("❌ Lỗi kiểm tra bảng student_answers:", answersError);
      } else {
        console.log("✅ Cấu trúc bảng student_answers:", answersInfo);
      }
      
      // Tạo dữ liệu mẫu
      console.log("Tạo dữ liệu mẫu cho questions...");
      
      const testQuestion = {
        title: "Test Question " + new Date().toISOString(),
        script: "This is a sample script for testing purposes. It contains multiple words that can be used for blanks.",
        audio_url: "test_audio.mp3",
        difficulty: "easy",
        time_limit: 5,
        blanks_count: 3,
        created_by: "00000000-0000-0000-0000-000000000000", // Temporary UUID
        is_published: true
      };
      
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .insert(testQuestion)
        .select()
        .single();
        
      if (questionError) {
        console.error("❌ Lỗi tạo dữ liệu mẫu questions:", questionError);
      } else {
        console.log("✅ Đã tạo dữ liệu mẫu questions:", questionData);
      }
      
      console.log("===== KẾT THÚC TẠO DỮ LIỆU MẪU =====");
      
    } catch (error: any) {
      console.error("Lỗi tạo dữ liệu mẫu:", error);
    }
  };
  
  // Thực hiện kiểm tra SQL để xem cấu trúc bảng
  const executeSqlQueries = async () => {
    try {
      console.log("===== KIỂM TRA SQL =====");
      
      // Kiểm tra bảng student_answers
      console.log("Kiểm tra cấu trúc bảng student_answers...");
      
      const { data: recordsData, error: recordsError } = await supabase
        .from('student_answers')
        .select('*')
        .limit(1);
        
      if (recordsError) {
        console.error("❌ Lỗi truy vấn student_answers:", recordsError);
      } else {
        console.log("✅ Dữ liệu student_answers:", recordsData);
        
        // Kiểm tra kiểu dữ liệu của trường answers
        if (recordsData && recordsData.length > 0) {
          const record = recordsData[0];
          console.log("Kiểu dữ liệu của answers:", 
            Array.isArray(record.answers) ? "Array" : typeof record.answers,
            "Giá trị:", record.answers
          );
        }
      }
      
      console.log("===== KẾT THÚC KIỂM TRA SQL =====");
      
    } catch (error: any) {
      console.error("Lỗi thực hiện SQL:", error);
    }
  };

  useEffect(() => {
    // Bắt đầu kiểm tra ngay khi component được render
    testConnection();
    
    // Kiểm tra bổ sung với fetch API trực tiếp
    testWithManualRequest();
    
    // Kiểm tra SQL và cấu trúc bảng
    executeSqlQueries();
    
    // Không tự động tạo dữ liệu mẫu - chỉ khi cần
    // generateTestData();
  }, []);
  
  return (
    <div className="container mx-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">Kiểm tra kết nối Supabase</h1>
      
      <div className="grid gap-6">
        <div className="p-6 border rounded-lg bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Trạng thái kết nối</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Database:</span>
              <span 
                className={`px-3 py-1 rounded text-sm ${
                  dbStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {dbStatus}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Authentication:</span>
              <span 
                className={`px-3 py-1 rounded text-sm ${
                  authStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {authStatus}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">Storage:</span>
              <span 
                className={`px-3 py-1 rounded text-sm ${
                  storageStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {storageStatus}
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-6 border rounded-lg bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Thông tin cấu hình</h2>
          
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-3 p-2 border-b">
              <span className="font-medium">Supabase URL:</span>
              <span className="col-span-2">https://tscigqtvowftzriqvzit.supabase.co</span>
            </div>
            
            <div className="grid grid-cols-3 p-2 border-b">
              <span className="font-medium">API Key (prefix):</span>
              <span className="col-span-2">eyJhbGciOiJIUzI1NiIsInR5c...</span>
            </div>
            
            <div className="grid grid-cols-3 p-2 border-b">
              <span className="font-medium">KEY SHA256:</span>
              <span className="col-span-2 break-all">
                {/* SHA256 của API key để kiểm tra xem có đúng key đang được sử dụng */}
                {crypto && crypto.subtle ? "[Chạy trong browser để xem]" : "[Không thể tính toán]"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-6 border rounded-lg bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Debug Console</h2>
          <p className="text-sm text-gray-500 mb-2">Xem thêm log chi tiết trong Developer Console (F12)</p>
          
          <button
            onClick={testConnection}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Kiểm tra lại
          </button>
          
          <button
            onClick={generateTestData}
            className="px-4 py-2 ml-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Tạo dữ liệu mẫu
          </button>
          
          <button
            onClick={executeSqlQueries}
            className="px-4 py-2 ml-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
          >
            Kiểm tra SQL
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginTest; 