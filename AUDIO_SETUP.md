# Hướng dẫn thiết lập audio cho Supabase

## 1. Cấu trúc thư mục

File audio cần được tải lên theo cấu trúc sau:

```
dictation/
  └── audio/
      └── [question_id]/
          └── [file_name.mp3]
```

Trong đó:
- `question_id` là UUID của câu hỏi trong bảng `questions`
- `file_name.mp3` là tên file audio

## 2. Cách tải file audio lên Supabase Storage

### Từ giao diện Supabase Dashboard

1. Đăng nhập vào Supabase Dashboard
2. Chọn dự án của bạn
3. Chọn "Storage" từ menu bên trái
4. Chọn bucket "dictation" (hoặc tạo nếu chưa có)
5. Tạo thư mục "audio"
6. Trong thư mục "audio", tạo thư mục với tên là UUID của câu hỏi
7. Tải file âm thanh vào thư mục này

### Từ code (sử dụng Supabase JS Client)

```javascript
const uploadAudio = async (questionId, file) => {
  const filePath = `audio/${questionId}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('dictation')
    .upload(filePath, file);
    
  if (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
  
  // Lưu đường dẫn vào bảng questions
  const { data: updateData, error: updateError } = await supabase
    .from('questions')
    .update({ audio_url: filePath })
    .eq('id', questionId);
    
  if (updateError) {
    console.error('Error updating question:', updateError);
    throw updateError;
  }
  
  return data;
};
```

## 3. Kiểm tra quyền truy cập public

Để đảm bảo file audio có thể truy cập public, cần thiết lập policy cho bucket:

1. Vào Supabase Dashboard > Storage
2. Chọn bucket "dictation"
3. Chọn "Policies"
4. Tạo policy mới:
   - Name: "Allow public read access"
   - Policy: `bucket_id = 'dictation'`
   - Operations: SELECT

## 4. Xác minh file audio

Sau khi tải lên, bạn có thể xác minh file audio bằng cách:

1. Lấy Public URL: 
   `https://[your-project-ref].supabase.co/storage/v1/object/public/dictation/audio/[question_id]/[file_name.mp3]`

2. Thử mở URL trong trình duyệt để xác nhận file có thể truy cập

## 5. Gỡ lỗi

Nếu gặp vấn đề:

1. Kiểm tra cấu trúc đường dẫn trong bảng `questions.audio_url`
2. Đảm bảo policy cho phép truy cập public đã được thiết lập
3. Xác minh file tồn tại trong Supabase Storage
4. Kiểm tra định dạng file audio (nên là MP3) 