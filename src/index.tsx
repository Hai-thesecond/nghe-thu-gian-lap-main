import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { supabase } from './lib/supabase';

// Hàm kiểm tra kết nối và xác thực Supabase khi ứng dụng khởi động
const checkSupabaseConnection = async () => {
  console.log('===== KIỂM TRA KẾT NỐI SUPABASE KHI KHỞI ĐỘNG =====');
  console.log('URL: https://tscigqtvowftzriqvzit.supabase.co');
  
  // Không truy cập trực tiếp vào supabaseKey vì nó là protected
  console.log('Đang sử dụng API key (được bảo vệ)');
  
  try {
    // Thử lấy kết nối cơ bản
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Lỗi kết nối cơ sở dữ liệu:', error);
    } else {
      console.log('✅ Kết nối cơ sở dữ liệu thành công');
    }
    
    // Kiểm tra xác thực
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Lỗi kiểm tra phiên:', sessionError);
    } else {
      console.log('✅ Kiểm tra phiên thành công:', sessionData);
      
      if (!sessionData.session) {
        // Thử tự động đăng nhập
        console.log('Không có phiên, thử đăng nhập...');
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'student@gmail.com',
          password: 'student'
        });
        
        if (signInError) {
          console.error('❌ Lỗi đăng nhập tự động:', signInError);
        } else {
          console.log('✅ Đăng nhập tự động thành công!', signInData);
        }
      }
    }
    
    // Thử kiểm tra buckets
    console.log('Đang kiểm tra storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Lỗi lấy danh sách buckets:', bucketsError);
    } else {
      console.log('✅ Danh sách buckets:', buckets);
    }
  } catch (err) {
    console.error('❌ Lỗi không xác định:', err);
  }
  
  console.log('===== KẾT THÚC KIỂM TRA =====');
};

// Chạy kiểm tra kết nối
checkSupabaseConnection();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 