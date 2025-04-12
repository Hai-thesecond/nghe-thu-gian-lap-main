# NGHETHUGIANLAB - HỆ THỐNG HỌC TRỰC TUYẾN

## 1. Tổng quan

Nghethugianlab là ứng dụng web quản lý học tập trực tuyến, tập trung vào việc dạy và học tiếng Anh thông qua các bài tập nghe, từ vựng và kiểm tra. Ứng dụng phân chia người dùng thành hai vai trò chính: Giáo viên và Học sinh, với các quyền hạn và chức năng riêng biệt.

Hệ thống được thiết kế để hỗ trợ toàn diện quá trình dạy và học tiếng Anh, đặc biệt là kỹ năng nghe hiểu và mở rộng vốn từ vựng. Ứng dụng giúp giáo viên tạo, quản lý và đánh giá các bài tập, đồng thời cung cấp môi trường học tập cá nhân hóa và tương tác cho học sinh.

### Mục tiêu chính
- Cải thiện kỹ năng nghe tiếng Anh thông qua bài tập nghe chuyên biệt
- Mở rộng vốn từ vựng với hệ thống học từ thông minh (spaced repetition)
- Cung cấp công cụ quản lý lớp học và theo dõi tiến độ hiệu quả cho giáo viên
- Tạo môi trường học tập cá nhân hóa và tương tác cho học sinh
- Đảm bảo tính chính xác trong đánh giá với công cụ chống gian lận

### Đối tượng người dùng
- **Giáo viên**: Tạo và quản lý bài tập, lớp học, theo dõi tiến độ học sinh
- **Học sinh**: Thực hiện bài tập, học và ôn tập từ vựng, xem kết quả và tiến độ cá nhân

### Công nghệ chính
- **Frontend**: React/TypeScript, Shadcn UI
- **Backend**: Supabase (PostgreSQL, Authentication, Storage, Functions)
- **Xử lý âm thanh**: AssemblyAI (Transcription API), Azure Speech (Text-to-Speech)
- **Dịch thuật và NLP**: Hugging Face API integration
- **Bảo mật**: Row Level Security (RLS), Authentication với JWT
- **Hosting**: Supabase Cloud (Backend), Vercel (Frontend)

### Tính năng nổi bật
1. Hệ thống xác thực và phân quyền chi tiết
2. Quản lý lớp học và học sinh toàn diện
3. Tạo bài tập nghe với transcription tự động
4. Hệ thống từ vựng với timeline audio chính xác
5. Công cụ chống gian lận hiệu quả
6. Phân tích kết quả và tiến độ học tập
7. Giao diện người dùng thân thiện, responsive

## 2. Kiến trúc hệ thống

### 2.1 Frontend

- **Framework**: React/TypeScript
- **UI Components**: Shadcn UI, custom components
- **Quản lý state**: React Context API, custom hooks
- **Routing**: React Router
- **Forms**: React Hook Form
- **Styling**: Tailwind CSS với theming
- **Audio Processing**: Web Audio API, custom components
- **Data Fetching**: Supabase Client, custom API helpers
- **Validation**: Zod schema validation
- **Error Handling**: Error Boundary components, centralized error logging
- **Testing**: Jest, React Testing Library
- **Bundling**: Vite

Kiến trúc frontend được thiết kế theo mô hình component-based với sự phân tách rõ ràng giữa UI và business logic. Các custom hooks được sử dụng rộng rãi để tách logic xử lý dữ liệu, authentication và API calls khỏi UI components, giúp code dễ bảo trì và mở rộng.

### 2.2 Backend (Supabase)

- **Database**: PostgreSQL với PostGIS extension
- **Authentication**: Supabase Auth (JWT-based)
- **Storage**: Supabase Storage (lưu trữ audio files và images)
- **Serverless Functions**: PostgreSQL Functions (RPC) với pgSQL
- **Bảo mật**: Row Level Security (RLS) với policies chi tiết
- **API**: RESTful API tự động sinh qua Supabase
- **Realtime**: Supabase Realtime cho cập nhật dữ liệu
- **Edge Functions**: Serverless functions cho xử lý phức tạp
- **Webhooks**: Tích hợp thông báo tự động
- **Database Migrations**: Quản lý schema với version control

Supabase cung cấp giải pháp backend-as-a-service với PostgreSQL làm core, cho phép phát triển nhanh chóng API và database mà không cần quản lý infrastructure phức tạp. RLS policies đảm bảo bảo mật dữ liệu ở tầng database.

### 2.3 Kết nối dịch vụ bên thứ ba
- **AssemblyAI**: API xử lý transcription cho bài tập nghe
- **Azure Cognitive Services**: Text-to-Speech cho phát âm từ vựng
- **Hugging Face**: API dịch thuật và NLP (Part-of-Speech tagging)
- **OpenGraph API**: Lấy metadata cho chia sẻ nội dung
- **SendGrid**: Email notifications (integration qua Supabase)
- **WebRTC**: Tích hợp speech recording cho chức năng speech recognition

### 2.4 Luồng dữ liệu

1. **Xác thực**: Người dùng đăng nhập → JWT token → Supabase Auth → RLS policies active
2. **Tạo bài tập**: Upload audio → AssemblyAI → Transcription → Database → Vocabulary extraction
3. **Làm bài tập**: Fetch bài tập → Audio player → Student answer → Submit → Score calculation
4. **Vocabulary System**: Extract từ vựng → POS tagging → Translation → Audio segment → Flashcards
5. **Chống gian lận**: Browser events → Cheat detection → Database → Teacher notification

### 2.5 Deployment
- **Frontend**: Vercel (CI/CD, Preview deployments)
- **Backend**: Supabase Cloud (Managed PostgreSQL)
- **CDN**: Vercel Edge Network, Supabase Storage CDN
- **Monitoring**: Supabase Logs, Custom analytics

## 3. Cấu trúc dự án

```
├── public/               # Tài nguyên tĩnh và SQL migrations
├── src/                  # Mã nguồn chính
│   ├── components/       # UI components
│   │   ├── ui/           # Common UI components (buttons, inputs, etc.)
│   │   ├── vocabulary/   # Components cho hệ thống từ vựng
│   │   ├── teacher/      # Components cho giao diện giáo viên
│   │   └── student/      # Components cho giao diện học sinh
│   ├── contexts/         # React contexts (AuthContext, etc.)
│   ├── layouts/          # Layout templates
│   ├── lib/              # Utilities, API wrappers, Supabase
│   │   ├── api.ts        # API helper functions
│   │   ├── auth.ts       # Authentication helpers
│   │   ├── supabase.ts   # Supabase client configuration
│   │   ├── assemblyai.ts # AssemblyAI integration
│   │   └── utils.ts      # Utility functions
│   ├── pages/            # Application pages
│   │   ├── auth/         # Authentication pages
│   │   ├── teacher/      # Teacher pages
│   │   └── student/      # Student pages
│   └── types/            # TypeScript type definitions
├── proxy-server/         # Translation proxy server (Express.js)
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

## 4. Cơ sở dữ liệu

### 4.1 Bảng chính

| Bảng | Mô tả |
|------|-------|
| **profiles** | Thông tin người dùng (teachers/students) với các trường như email, full_name, role, avatar_url |
| **questions** | Lưu thông tin bài tập, câu hỏi, transcript, cấu hình thời gian và độ khó |
| **student_answers** | Ghi nhận câu trả lời của học sinh, thời gian bắt đầu/hoàn thành, số lần gian lận |
| **vocabulary_items** | Từ vựng liên quan đến bài học, bao gồm từ, loại từ, nghĩa, thời điểm xuất hiện trong audio |
| **vocabulary_progress** | Tiến độ học từ vựng của học sinh, số lần luyện tập, mức độ thành thạo |
| **classes** | Thông tin lớp học, bao gồm tên, mã, giáo viên phụ trách |
| **student_classes** | Liên kết học sinh với lớp học (many-to-many relationship) |
| **class_assignments** | Bài tập được giao cho lớp học với deadline và trạng thái |
| **audio_files** | Lưu trữ tham chiếu đến file audio, thông tin về duration và format |
| **test_results** | Kết quả bài kiểm tra với điểm và phân tích lỗi |
| **notifications** | Thông báo hệ thống cho users với priority và read status |
| **student_categories** | Phân loại học sinh theo năng lực và tiến độ |
| **cheating_unlock_logs** | Ghi lại các trường hợp giáo viên mở khóa cho học sinh bị ghi nhận gian lận |
| **audio_timings** | Thông tin chi tiết về timeline của từng đoạn audio |
| **word_timings** | Thời gian bắt đầu và kết thúc của từng từ trong bài nghe |
| **vocabulary_images** | Hình ảnh minh họa cho từ vựng |
| **error_analysis** | Phân tích lỗi của học sinh để cải thiện việc học |
| **student_attempt_stats** | Thống kê về số lần làm bài của học sinh |
| **improvement_suggestions** | Đề xuất cải thiện dựa trên lỗi phổ biến |
| **improvement_tracking** | Theo dõi sự cải thiện theo thời gian |

### 4.2 Schema chính

```sql
-- Profiles Table (Users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student', 'admin')),
  avatar_url TEXT,
  school TEXT,
  grade TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Questions Table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT,
  transcript TEXT,
  created_by UUID REFERENCES public.profiles(id),
  difficulty_level INTEGER DEFAULT 1,
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,
  question_type TEXT DEFAULT 'dictation',
  time_limit INTEGER DEFAULT 600,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Student Answers
CREATE TABLE public.student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id),
  question_id UUID REFERENCES public.questions(id),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  answers TEXT[] DEFAULT ARRAY[]::TEXT[],
  answers_json TEXT,
  is_completed BOOLEAN DEFAULT false,
  score NUMERIC DEFAULT 0,
  adjusted_score NUMERIC DEFAULT 0,
  attempt_count INTEGER DEFAULT 1,
  cheating_attempts INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  locked_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Vocabulary Items
CREATE TABLE public.vocabulary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id),
  word TEXT NOT NULL,
  part_of_speech TEXT DEFAULT 'noun',
  meaning_vi TEXT NOT NULL,
  example_sentence TEXT,
  audio_start_time INTEGER DEFAULT 0,
  audio_end_time INTEGER DEFAULT 0,
  image_url TEXT,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Vocabulary Progress
CREATE TABLE public.vocabulary_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id),
  vocabulary_id UUID REFERENCES public.vocabulary_items(id),
  mastery_level INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_practiced TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
```

### 4.3 Database Relationships

```
profiles
  ↑ ↓
  | ↓ created_by
  | → questions
  |     ↓
  |     → vocabulary_items → vocabulary_images
  |           ↑
  |           |
  | → vocabulary_progress
  |
  | → classes
  |     ↓ 
  | → student_classes ← |
  |
  | → student_answers ← questions
  |     ↓
  |     → error_analysis → improvement_suggestions
  |
  | → test_results ← questions
  |
  | → notifications
  |
  → student_categories
```

### 4.4 Stored Functions (RPC)

| Function | Mô tả | Đầu vào | Đầu ra |
|----------|-------|---------|--------|
| `get_vocabulary_for_question` | Lấy từ vựng cho một câu hỏi | question_id | Danh sách từ vựng |
| `get_vocabulary_for_practice` | Lấy từ vựng cho luyện tập | student_id, limit | Danh sách từ vựng ưu tiên |
| `update_vocabulary_progress` | Cập nhật tiến độ học từ vựng | student_id, vocabulary_id, is_correct | Tiến độ mới |
| `check_vocabulary_completion` | Kiểm tra sự hoàn thành của từ vựng | student_id, question_id | Phần trăm hoàn thành |
| `extract_vocabulary_from_script` | Trích xuất từ vựng từ transcript | transcript_text | Danh sách từ vựng gợi ý |
| `update_student_answers` | Cập nhật câu trả lời | record_id, answers, completed_at | Kết quả cập nhật |
| `submit_student_answer` | Xử lý nộp bài | record_id, answers, completed_at, cheating_attempts | Kết quả kiểm tra và điểm |
| `get_teacher_students` | Lấy danh sách học sinh của giáo viên | teacher_id | Danh sách học sinh và thống kê |
| `unlock_student_cheating` | Mở khóa cho học sinh bị ghi nhận gian lận | student_id, question_id, reason | Trạng thái mở khóa |
| `calculate_score` | Tính điểm cho bài làm | student_answer_id | Điểm số và phân tích |
| `simple_update_score` | Cập nhật điểm đơn giản | student_answer_id, score | Kết quả cập nhật |
| `get_student_attempt_history` | Lấy lịch sử làm bài | student_id, question_id | Danh sách các lần làm bài |
| `update_adjusted_score` | Cập nhật điểm điều chỉnh | student_answer_id, adjusted_score | Kết quả cập nhật |
| `mark_all_as_read` | Đánh dấu tất cả thông báo đã đọc | user_id | Số thông báo đã cập nhật |
| `translate_to_vietnamese` | Dịch từ tiếng Anh sang tiếng Việt | english_text | Bản dịch tiếng Việt |
| `get_word_type` | Xác định loại từ | word | Loại từ (POS tag) |

#### Ví dụ RPC Function:

```sql
-- Function to calculate score based on answers
CREATE OR REPLACE FUNCTION public.calculate_score(student_answer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  student_answer RECORD;
  question RECORD;
  answer_text TEXT;
  correct_text TEXT;
  similarity NUMERIC;
  total_score NUMERIC := 0;
  answer_count INTEGER;
BEGIN
  -- Get student answer and question details
  SELECT * INTO student_answer FROM public.student_answers WHERE id = student_answer_id;
  SELECT * INTO question FROM public.questions WHERE id = student_answer.question_id;
  
  IF student_answer IS NULL OR question IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Parse answers from JSON if available
  IF student_answer.answers_json IS NOT NULL THEN
    answer_count := json_array_length(student_answer.answers_json::json);
    
    -- Calculate similarity for each answer
    FOR i IN 0..(answer_count-1) LOOP
      answer_text := json_array_element_text(student_answer.answers_json::json, i);
      correct_text := json_array_element_text(question.correct_answers::json, i);
      
      -- Calculate similarity (custom implementation)
      similarity := public.calculate_text_similarity(answer_text, correct_text);
      total_score := total_score + similarity;
    END LOOP;
    
    -- Calculate average score
    IF answer_count > 0 THEN
      total_score := (total_score / answer_count) * 100;
    END IF;
  ELSE
    -- Fallback to array-based scoring
    -- (implementation details)
  END IF;
  
  -- Adjust score based on cheating attempts
  IF student_answer.cheating_attempts > 0 THEN
    total_score := total_score * (1 - (student_answer.cheating_attempts * 0.1));
  END IF;
  
  -- Update student_answer with calculated score
  UPDATE public.student_answers SET 
    score = total_score,
    updated_at = now()
  WHERE id = student_answer_id;
  
  RETURN ROUND(total_score::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 5. Tính năng chính

### 5.1 Hệ thống xác thực
- **Đăng nhập/đăng ký**: 
  - Hỗ trợ đăng nhập riêng biệt cho giáo viên và học sinh
  - Đăng ký với xác minh email thông qua Supabase Auth
  - Tùy chọn đăng nhập bằng Google OAuth (nếu được cấu hình)
- **Phân quyền dựa trên vai trò**:
  - Teacher: Quyền quản lý toàn diện nội dung và học sinh
  - Student: Quyền hạn chế trong việc làm bài và theo dõi tiến độ
  - Admin: Quyền quản trị hệ thống (đang phát triển)
- **Bảo mật**:
  - JWT token-based authentication
  - Session management tự động với refresh token
  - Password hashing an toàn
  - CORS protection
- **User profile**:
  - Thông tin cá nhân và avatar
  - Trạng thái hoạt động
  - Cài đặt cá nhân hóa

### 5.2 Quản lý lớp học (Teachers)
- **Tạo và quản lý lớp học**:
  - Tạo lớp học với tên, mã lớp tự động
  - Chỉnh sửa thông tin lớp học
  - Quản lý trạng thái hoạt động
  - Tạo thông báo cho lớp học
- **Quản lý học sinh**:
  - Thêm học sinh vào lớp bằng email hoặc mã lớp
  - Xóa học sinh khỏi lớp
  - Xem danh sách học sinh và thông tin chi tiết
  - Tìm kiếm và lọc học sinh theo nhiều tiêu chí
  - Theo dõi tiến độ theo thời gian
- **Giao bài tập**:
  - Gán bài tập cho lớp học hoặc học sinh cụ thể
  - Thiết lập deadline và yêu cầu
  - Gửi thông báo tự động khi giao bài
  - Theo dõi trạng thái hoàn thành bài tập
- **Phân loại học sinh**:
  - Tự động phân loại theo năng lực
  - Phân loại thủ công với ghi chú
  - Xem biểu đồ phân bố năng lực học sinh
- **Báo cáo và phân tích**:
  - Xem báo cáo kết quả làm bài chi tiết
  - Biểu đồ tiến bộ của từng học sinh và lớp
  - Phân tích lỗi phổ biến để điều chỉnh giảng dạy
  - Xuất báo cáo dạng CSV/Excel
- **Tính năng mở rộng**:
  - Lịch sử hoạt động của lớp học
  - Thông báo tự động về hoạt động học sinh
  - Phản hồi và nhận xét cho bài làm

### 5.3 Tạo bài tập (Teachers)
- **Upload file âm thanh**:
  - Hỗ trợ định dạng MP3, WAV, OGG
  - Giới hạn kích thước file (50MB)
  - Xử lý và tối ưu hóa audio
  - Streaming audio với CDN
- **Transcription tự động**:
  - Sử dụng AssemblyAI API
  - Hỗ trợ nhiều ngôn ngữ và giọng nói
  - Chế độ chỉnh sửa transcript thủ công
  - Tạo timeline cho từng từ trong bài nghe
- **Tạo từ vựng**:
  - Trích xuất từ vựng tự động từ transcript
  - Xác định loại từ với Hugging Face API
  - Dịch thuật tự động sang tiếng Việt
  - Tùy chỉnh và thêm từ vựng thủ công
  - Tích hợp hình ảnh minh họa
- **Cấu hình bài tập**:
  - Thiết lập thời gian làm bài
  - Mức độ khó (dễ, trung bình, khó)
  - Gắn thẻ (tags) cho bài tập
  - Đặt chế độ hiển thị transcript (trước, sau, không hiển thị)
  - Tùy chỉnh cách tính điểm
- **Xuất bản/chỉnh sửa**:
  - Lưu bản nháp trước khi xuất bản
  - Kiểm tra trước khi xuất bản
  - Chỉnh sửa bài tập đã xuất bản
  - Thống kê lượt làm bài
  - Đóng/mở bài tập

### 5.4 Làm bài (Students)
- **Nghe và làm bài tập**:
  - Trình phát audio chuyên nghiệp
  - Chức năng điều chỉnh tốc độ (0.5x-2x)
  - Điều khiển việc tua và lặp lại audio
  - Đếm ngược thời gian làm bài
  - Chế độ làm bài toàn màn hình
- **Hỗ trợ khi làm bài**:
- Xem từ vựng trước khi làm bài
  - Hiển thị gợi ý khi cần thiết
  - Chức năng lưu bài tự động
  - Thông báo khi gần hết giờ
- **Nộp bài**:
  - Kiểm tra trước khi nộp
  - Phát hiện câu hỏi chưa trả lời
  - Hiển thị kết quả ngay lập tức
  - Phân tích đáp án đúng/sai
  - So sánh với transcript gốc
- **Xem kết quả**:
  - Điểm số chi tiết
  - Phân tích lỗi
  - Đề xuất cải thiện
  - Xem lịch sử các lần làm
  - So sánh với các lần trước
- **Theo dõi tiến độ**:
  - Biểu đồ phát triển
  - Thống kê các lỗi phổ biến
  - Đề xuất bài tập phù hợp
  - Nhận xét của giáo viên

### 5.5 Hệ thống từ vựng
- **Flashcards**:
  - Hệ thống thẻ ghi nhớ (flashcards) thông minh
  - Thuật toán spaced repetition (lặp lại theo khoảng thời gian)
  - Đánh dấu mức độ thành thạo (1-5)
  - Lọc từ vựng theo loại từ, bài học, mức độ
  - Chế độ tự động luyện tập
- **Nghe từ vựng**:
  - Phát audio cho từng từ từ bài nghe gốc
  - Text-to-speech cho từ vựng không có trong bài nghe
  - Chức năng điều chỉnh tốc độ phát
  - Lặp lại audio từ vựng
  - So sánh phát âm
- **Ôn tập và kiểm tra**:
  - Quiz từ vựng tự động
  - Chế độ trắc nghiệm
  - Chế độ điền từ
  - Chế độ sắp xếp câu
  - Ôn tập theo lịch trình được gợi ý
- **Theo dõi tiến độ học**:
  - Biểu đồ tiến độ theo từng từ
  - Thống kê số từ đã học, đã thành thạo
  - Dự đoán thời gian cần để hoàn thành
  - Gợi ý từ vựng cần ôn tập thêm
  - Đồng bộ tiến độ trên các thiết bị
- **Tính năng bổ sung**:
  - Phiên âm IPA cho từ vựng
  - Hình ảnh minh họa
  - Ví dụ sử dụng từ
  - Từ đồng nghĩa, trái nghĩa
  - Ghi chú cá nhân cho từ vựng

### 5.6 Chống gian lận
- **Giám sát màn hình**:
  - Theo dõi việc rời khỏi màn hình/tab
  - Ghi nhận thời gian không tập trung
  - Cảnh báo khi phát hiện hành vi đáng ngờ
  - Ghi lại số lần rời khỏi tab/cửa sổ
- **Chế độ toàn màn hình**:
  - Bắt buộc chế độ fullscreen khi làm bài
- Đếm số lần thoát fullscreen
  - Khóa bài làm khi vượt quá số lần cho phép
  - Cảnh báo visual khi thoát fullscreen
- **Chống sao chép**:
  - Vô hiệu hóa copy-paste
  - Chống chụp màn hình
  - Phát hiện việc kéo thả nội dung
  - Vô hiệu hóa các phím tắt nguy hiểm
- **Ghi nhận và xử lý gian lận**:
  - Lưu lại các hành vi gian lận
  - Tự động giảm điểm dựa trên mức độ gian lận
  - Thông báo cho giáo viên
  - Yêu cầu xác nhận của giáo viên để tiếp tục
- **Mở khóa cho trường hợp đặc biệt**:
  - Hệ thống mở khóa của giáo viên
  - Ghi nhận lý do mở khóa
  - Lưu lại lịch sử mở khóa
  - Giới hạn số lần mở khóa

### 5.7 Phân tích kết quả
- **Phân tích lỗi**:
  - Phân loại lỗi (chính tả, ngữ pháp, từ vựng)
  - Thống kê tần suất lỗi
  - So sánh với lỗi phổ biến của lớp
  - Gợi ý từ vựng cần học thêm dựa trên lỗi
- **Đề xuất cải thiện**:
  - Gợi ý bài tập phù hợp
  - Lộ trình học được cá nhân hóa
  - Tài liệu tham khảo liên quan
  - Bài tập luyện tập bổ sung
- **Theo dõi tiến bộ**:
  - Biểu đồ tiến bộ theo thời gian
  - So sánh với điểm trung bình lớp
  - Xếp hạng trong lớp (nếu được kích hoạt)
  - Đánh giá mức độ cải thiện
- **Báo cáo cho giáo viên**:
  - Báo cáo chi tiết về từng học sinh
  - Thống kê lớp học
  - Phát hiện học sinh gặp khó khăn
  - Đề xuất điều chỉnh giảng dạy
- **Báo cáo cho học sinh**:
  - Tóm tắt kết quả sau mỗi bài làm
  - Phân tích điểm mạnh/yếu
  - Gợi ý cải thiện
  - Thông báo tiến bộ đạt được

## 6. Hệ thống bảo mật (Row Level Security)

Dự án sử dụng Row Level Security (RLS) của Supabase để bảo vệ dữ liệu dựa trên vai trò người dùng. RLS là cơ chế bảo mật mạnh mẽ được áp dụng ở tầng database, đảm bảo dữ liệu được bảo vệ ngay cả khi frontend bị xâm nhập.

### 6.1 Profiles & Users
- **Chính sách xem thông tin người dùng**:
  ```sql
  CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);
  
  CREATE POLICY "Teachers can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    );
  ```
- **Chính sách cập nhật thông tin**:
  ```sql
  CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);
  ```
- **Ai có thể thêm hồ sơ**:
  - Mọi người dùng đã xác thực có thể tạo hồ sơ cho chính mình
  - Admin có quyền tạo hồ sơ cho bất kỳ ai

### 6.2 Questions (Câu hỏi/Bài tập)
- **Chính sách đọc bài tập**:
  ```sql
  CREATE POLICY "Students can only view published questions"
    ON public.questions
    FOR SELECT
    USING (
      (is_published = true) OR 
      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'))
    );
  
  CREATE POLICY "Teachers can read all questions"
    ON public.questions
    FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    );
  ```
- **Chính sách thêm/sửa/xóa bài tập**:
  - Teachers có thể tạo, đọc, cập nhật và xóa câu hỏi họ tạo ra
  - Teachers cấp cao có thể quản lý tất cả câu hỏi
- Students chỉ có thể xem questions đã được publish

### 6.3 Student_answers
- **Chính sách quản lý câu trả lời**:
  ```sql
  CREATE POLICY "Students can view their own answers"
    ON public.student_answers
    FOR SELECT
    USING (student_id = auth.uid());
    
  CREATE POLICY "Teachers can view all answers"
    ON public.student_answers
    FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    );
    
  CREATE POLICY "Students can update their own answers"
    ON public.student_answers
    FOR UPDATE
    USING (student_id = auth.uid());
  ```
- **Quy trình mở khóa câu trả lời**:
  - Khi bị ghi nhận gian lận nhiều lần, bài làm sẽ bị khóa
  - Chỉ giáo viên mới có quyền mở khóa
  - Mọi hoạt động mở khóa đều được ghi nhận chi tiết

### 6.4 Vocabulary System
- **Chính sách quản lý từ vựng**:
  ```sql
  CREATE POLICY "Anyone can view vocabulary items"
    ON public.vocabulary_items
    FOR SELECT
    USING (true);
    
  CREATE POLICY "Only teachers can modify vocabulary"
    ON public.vocabulary_items
    FOR INSERT UPDATE DELETE
    USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    );
  ```
- **Chính sách tiến độ học từ vựng**:
  ```sql
  CREATE POLICY "Students can manage their own progress"
    ON public.vocabulary_progress
    FOR ALL
    USING (student_id = auth.uid());
    
  CREATE POLICY "Teachers can view all vocabulary progress"
    ON public.vocabulary_progress
    FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
    );
  ```

### 6.5 Class Management
- **Chính sách quản lý lớp học**:
  ```sql
  CREATE POLICY "Teachers can manage their classes"
    ON public.classes
    FOR ALL
    USING (
      teacher_id = auth.uid()
    );
    
  CREATE POLICY "Students can see their own classes"
    ON public.student_classes
    FOR SELECT
    USING (
      student_id = auth.uid()
    );
    
  CREATE POLICY "Teachers can manage student classes"
    ON public.student_classes
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_id AND c.teacher_id = auth.uid()
      )
    );
  ```
- **Giao bài tập cho lớp**:
  ```sql
  CREATE POLICY "Allow teachers to manage assignments"
    ON public.class_assignments
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_id AND c.teacher_id = auth.uid()
      )
    );
  ```

### 6.6 Bảo mật API và Endpoints
- Sử dụng JWT token cho mọi API requests
- Mỗi endpoint được bảo vệ bởi middleware xác thực
- Rate limiting để chống DDoS attacks
- Validations nghiêm ngặt cho mọi input

## 7. Proxy Server

Dự án bao gồm một proxy server được viết bằng Express.js để xử lý các yêu cầu đến các API bên thứ ba. Server này giúp bảo vệ API keys và cung cấp một lớp cache để giảm số lượng API calls.

### 7.1 Kiến trúc và công nghệ
- **Node.js/Express**: Nền tảng phát triển server
- **Axios**: Thực hiện HTTP requests đến API bên thứ ba
- **Redis**: Cache kết quả API calls (tùy chọn)
- **Helmet**: Bảo mật HTTP headers
- **Cors**: Quản lý Cross-Origin Resource Sharing
- **Dotenv**: Quản lý biến môi trường
- **Morgan**: Logging HTTP requests

### 7.2 Các endpoint chính
- **/api/translate**: Dịch thuật từ tiếng Anh sang tiếng Việt
- **/api/pos-tagging**: Part-of-speech tagging (xác định loại từ)
- **/api/summarize**: Tóm tắt nội dung văn bản
- **/api/detect-language**: Phát hiện ngôn ngữ văn bản
- **/api/health**: Health check endpoint

### 7.3 Hugging Face API Integration
```javascript
router.post('/api/translate', async (req, res) => {
  try {
    const { text, source_lang = 'en', target_lang = 'vi' } = req.body;
    
    // Validate input
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required text parameter'
      });
    }
    
    // Check cache first
    const cacheKey = `translate:${source_lang}:${target_lang}:${text}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      console.log('Cache hit for translation');
      return res.json({
        success: true,
        translation: cachedResult,
        source: 'cache'
      });
    }
    
    // Call Hugging Face API
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-vi',
      { inputs: text },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const translation = response.data[0]?.translation_text || '';
    
    // Cache the result
    await cache.set(cacheKey, translation, 60 * 60 * 24); // 24 hours
    
    return res.json({
      success: true,
      translation,
      source: 'api'
    });
  } catch (error) {
    console.error('Translation error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error processing translation request',
      error: error.message
    });
  }
});
```

### 7.4 Caching Strategy
- **In-memory cache**: Lưu trữ cho các kết quả ngắn hạn
- **Redis cache**: Lưu trữ cho các kết quả dài hạn
- **Cache invalidation**: Tự động xóa cache sau một thời gian
- **Cache prioritization**: Ưu tiên các từ vựng thông dụng

### 7.5 Error Handling
- **Retry logic**: Tự động thử lại khi API bên thứ ba không phản hồi
- **Fallback mechanisms**: Chuyển đổi qua API thay thế khi cần
- **Rate limiting**: Giới hạn số lượng requests trong một khoảng thời gian
- **Logging**: Ghi lại tất cả lỗi để phân tích

## 8. Frontend Utilities

### 8.1 Audio Processing
```typescript
export async function processAudioFile(
  file: File, 
  userId?: string, 
  withTiming = true
): Promise<{ 
  audioUrl: string, 
  transcript: string, 
  timingData: WordTiming[] | null 
}> {
  try {
    // Upload to Supabase Storage
    const filename = `audio/${userId || 'anonymous'}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('dictation-audio')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });
      
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('dictation-audio')
      .getPublicUrl(filename);
      
    // Process with AssemblyAI
    const transcription = await transcribeAudio(publicUrl, withTiming);
    
    return {
      audioUrl: publicUrl,
      transcript: transcription.text,
      timingData: withTiming ? transcription.words : null
    };
  } catch (error) {
    console.error('Audio processing error:', error);
    throw error;
  }
}

// Processs audio with AssemblyAI
async function transcribeAudio(audioUrl: string, withTiming: boolean): Promise<any> {
  // Implementation details for AssemblyAI integration
  // ...
}
```

### 8.2 API Helpers
```typescript
export const submitStudentAnswers = async ({
  recordId,
  answers,
  completedAt,
  cheatingAttempts = 0
}: {
  recordId: string;
  answers: string[];
  completedAt: Date;
  cheatingAttempts?: number;
}): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { data, error } = await supabase
      .from('student_answers')
      .update({
        answers: answers,
        answers_json: JSON.stringify(answers),
        completed_at: completedAt.toISOString(),
        is_completed: true,
        cheating_attempts: cheatingAttempts,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select();

    if (error) throw error;
    return { 
      success: true, 
      message: 'Nộp bài thành công', 
      data 
    };
  } catch (error) {
    console.error('Error submitting answers:', error);
    return { 
      success: false, 
      message: 'Error submitting answers' 
    };
  }
};
```

### 8.3 Authentication
```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  
  useEffect(() => {
    // Setup auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
            
          setUserRole(data?.role as UserRole || null);
        } else {
          setUserRole(null);
        }
        setLoading(false);
      }
    );
    
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            setUserRole(data?.role as UserRole || null);
          });
      }
      setLoading(false);
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);
  
const signIn = async (email: string, password: string, role: UserRole) => {
  // Logic đăng nhập và phân quyền
  };

const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
  // Logic đăng ký
  };
  
  const signOut = async () => {
    await supabase.auth.signOut();
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        signIn,
        signUp,
        signOut,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
```

### 8.4 Audio Player Component
```typescript
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  onTimeUpdate,
  onPlay,
  onPause,
  highlightWords = [],
  allowPlaybackRate = true,
  autoHighlight = true
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Audio player implementation
  // ...
};
```

### 8.5 Custom Hooks
```typescript
// Custom hook for vocabulary practice
export function useVocabularyPractice(questionId: string, studentId: string) {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<VocabularyProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Implementation...
  
  return {
    vocabulary,
    progress,
    loading,
    error,
    markCorrect,
    markIncorrect,
    resetProgress
  };
}

// Custom hook for anti-cheating
export function useAntiCheating(recordId: string) {
  const [cheatingAttempts, setCheatingAttempts] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  
  // Implementation...
  
  return {
    cheatingAttempts,
    requestFullscreen,
    exitFullscreen,
    isFullscreen,
    warningCount,
    registerCheatAttempt
  };
}
```

## 9. Truy cập và quản lý backend

### 9.1 Thông tin project Supabase
- **Project URL**: https://tscigqtvowftzriqvzit.supabase.co
- **Project ID**: tscigqtvowftzriqvzit

### 9.2 Truy cập Dashboard
1. Đăng nhập tại https://app.supabase.com
2. Chọn project "nghethugianlab"
3. Sử dụng các tab để quản lý:
   - **Table Editor**: Quản lý dữ liệu
   - **Authentication**: Quản lý users
   - **Storage**: Quản lý files
   - **SQL Editor**: Chạy truy vấn và RPC
   - **API Docs**: Xem và test API

### 9.3 Xem backend bằng SQL Console
```sql
-- Xem tất cả tables và số lượng records
SELECT
  table_schema,
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema=t.table_schema AND table_name=t.table_name) as column_count,
  pg_size_pretty(pg_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name))) as size
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- Xem tất cả RPC functions
SELECT
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  p.prosrc as function_body
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- Xem tất cả RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 10. Kết luận

NgheThuGianLab là một hệ thống học tập toàn diện, được xây dựng với kiến trúc hiện đại và bảo mật cao. Hệ thống kết hợp giữa frontend React linh hoạt và backend Supabase mạnh mẽ, tạo nên một nền tảng học tập trực tuyến hiệu quả cho việc dạy và học tiếng Anh thông qua các bài tập nghe và từ vựng.

Ứng dụng này được thiết kế vừa đáp ứng nhu cầu của giáo viên trong việc quản lý lớp học, tạo bài tập và theo dõi tiến độ học sinh, vừa cung cấp cho học sinh một môi trường học tập tương tác và cá nhân hóa.
