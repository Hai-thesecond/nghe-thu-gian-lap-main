import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Footer: React.FC = () => {
  const { user } = useAuth();

  return (
    <footer className="bg-white/70 backdrop-blur-md border-t border-gray-100 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link to={user?.role === 'teacher' ? '/teacher/dashboard' : user?.role === 'student' ? '/student/dashboard' : '/'} className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-lightBlue-400 flex items-center justify-center">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-700 to-lightBlue-500 bg-clip-text text-transparent">
                Dictation
              </span>
            </Link>
            <p className="text-gray-600 text-sm">
              Nền tảng luyện tập dictation tiếng Anh dành cho học sinh Việt Nam.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Liên kết</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link to="/login-teacher" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  Giáo viên
                </Link>
              </li>
              <li>
                <Link to="/login-student" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  Học sinh
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Chính sách</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/terms" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  Điều khoản sử dụng
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  Chính sách bảo mật
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Liên hệ</h3>
            <ul className="space-y-2">
              <li className="text-gray-600 text-sm">Email: support@dictation.vn</li>
              <li className="text-gray-600 text-sm">Điện thoại: (+84) 123 456 789</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-100 mt-8 pt-8 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Dictation. Tất cả các quyền được bảo lưu.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
