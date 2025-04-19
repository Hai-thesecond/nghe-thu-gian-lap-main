// Kiểm tra kết nối Supabase
import { supabase, verifyAuthentication, getBucketName, createAudioBucket } from '../../lib/supabase';

// Thử nghiệm kết nối
const testConnection = async () => {
  console.log('===== KIỂM TRA KẾT NỐI SUPABASE =====');
  
  // 1. Kiểm tra kết nối cơ bản
  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Lỗi kết nối Supabase:', error);
    } else {
      console.log('✅ Kết nối Supabase thành công');
    }
  } catch (err) {
    console.error('❌ Lỗi ngoại lệ khi kết nối Supabase:', err);
  }
  
  // 2. Kiểm tra xác thực người dùng
  try {
    const { authenticated, user, error } = await verifyAuthentication();
    
    if (authenticated) {
      console.log('✅ Người dùng đã đăng nhập:', user?.email);
    } else {
      console.warn('⚠️ Người dùng chưa đăng nhập:', error);
    }
  } catch (err) {
    console.error('❌ Lỗi kiểm tra xác thực:', err);
  }
  
  // 3. Kiểm tra Storage buckets
  try {
    console.log('Danh sách buckets:');
    const buckets = await getBucketName();
    
    if (buckets.length > 0) {
      console.log('✅ Buckets hiện có:', buckets);
    } else {
      console.warn('⚠️ Không tìm thấy bucket nào');
    }
    
    // Kiểm tra và tạo bucket audio nếu cần
    const audioBucketCreated = await createAudioBucket();
    console.log('Tạo bucket audio:', audioBucketCreated ? '✅ Thành công' : '❌ Thất bại');
    
    // Kiểm tra tệp trong bucket audio
    try {
      const { data: files, error } = await supabase.storage.from('audio').list();
      
      if (error) {
        console.error('❌ Lỗi liệt kê tệp trong bucket audio:', error);
      } else {
        console.log('✅ Tệp trong bucket audio:', files);
      }
    } catch (err) {
      console.error('❌ Lỗi ngoại lệ khi liệt kê tệp:', err);
    }
  } catch (err) {
    console.error('❌ Lỗi kiểm tra Storage:', err);
  }
  
  console.log('===== KẾT THÚC KIỂM TRA =====');
};

// Chạy kiểm tra khi trang được tải
window.addEventListener('load', testConnection);

export default testConnection; 