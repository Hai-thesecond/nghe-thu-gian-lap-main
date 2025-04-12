import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Users, BarChart, Plus, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

const navItems = [
  {
    title: 'Câu hỏi',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/teacher/dashboard',
  },
  {
    title: 'Lớp học',
    icon: <GraduationCap className="w-5 h-5" />,
    href: '/teacher/classes',
  },
  {
    title: 'Học sinh',
    icon: <Users className="w-5 h-5" />,
    href: '/teacher/students',
  },
  {
    title: 'Kết quả gần đây',
    icon: <BarChart className="w-5 h-5" />,
    href: '/teacher/dashboard?view=results',
    needsParams: false,
  },
];

const TeacherSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isActive = (path: string) => {
    if (path.includes('?')) {
      const basePath = path.split('?')[0];
      const currentBasePath = location.pathname;
      const queryParams = new URLSearchParams(path.split('?')[1]);
      const currentQueryParams = new URLSearchParams(location.search);
      
      if (basePath === '/teacher/dashboard' && queryParams.get('view') === 'results') {
        return currentBasePath === basePath && currentQueryParams.get('view') === 'results';
      }
      return currentBasePath === basePath;
    }
    
    if (path === '/teacher/dashboard') {
      return location.pathname === path && !location.search.includes('view=results');
    }
    
    return location.pathname === path;
  };

  const handleNavigation = (item: any) => {
    if (item.needsParams) {
      toast.info('Vui lòng chọn lớp học và bài tập để xem kết quả', {
        description: 'Bạn có thể chọn lớp học và bài tập từ trang chủ'
      });
      navigate(item.href);
      return;
    }
    
    navigate(item.href);
  };

  return (
    <div className="h-full w-64 bg-white border-r border-gray-100 py-4 flex flex-col">
      {/* Logo and branding area - same height as header */}
      <div className="px-4 h-16 flex items-center border-b border-gray-100 mb-4">
        <Link to="/teacher/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-lightBlue-400 flex items-center justify-center">
            <span className="text-white text-base font-bold">D</span>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-700 to-lightBlue-500 bg-clip-text text-transparent">
            Dictation
          </span>
        </Link>
      </div>

      {/* Sidebar content */}
      <div className="flex-1 px-4 overflow-y-auto">
        <div className="space-y-8">
          <div className="space-y-2">
            <Link
              to="/teacher/create-question"
              className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-blue-500 to-lightBlue-500 text-white rounded-lg hover:from-blue-600 hover:to-lightBlue-600 transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              <span>Tạo câu hỏi</span>
            </Link>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item)}
                className={`w-full flex items-center py-3 px-4 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                <span>{item.title}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default TeacherSidebar;
