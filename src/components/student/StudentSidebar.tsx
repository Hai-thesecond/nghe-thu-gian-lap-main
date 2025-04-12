import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, BarChart, Users } from 'lucide-react';

const navItems = [
  {
    title: 'Bài tập',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/student/dashboard',
  },
  {
    title: 'Kết quả',
    icon: <BarChart className="w-5 h-5" />,
    href: '/student/progress',
  },
  {
    title: 'Lớp học',
    icon: <Users className="w-5 h-5" />,
    href: '/student/classes',
  },
];

const StudentSidebar = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen w-64 bg-white border-r border-gray-100 fixed left-0 top-0 pt-20 pb-6 px-4 overflow-y-auto glass-morphism">
      <nav className="space-y-1 mt-10">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center py-3 px-4 rounded-lg transition-colors ${
              isActive(item.href)
                ? 'bg-primary text-white font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default StudentSidebar;
