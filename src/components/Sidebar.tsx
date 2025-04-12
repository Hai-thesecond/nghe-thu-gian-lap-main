import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Home, 
  BookOpen, 
  Users, 
  User, 
  Settings, 
  FileText,
  Headphones,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSupabaseUser } from '@/lib/auth';

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

const SidebarItem = ({ href, icon, label }: SidebarItemProps) => {
  const router = useRouter();
  const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`);

  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-slate-100",
        isActive ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500 hover:text-slate-900"
      )}>
        {icon}
        {label}
      </div>
    </Link>
  );
};

export function Sidebar() {
  const { user } = useSupabaseUser();
  const isTeacher = user?.role === 'teacher';

  return (
    <div className="hidden border-r bg-white lg:block lg:w-60">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium">
            <SidebarItem 
              href="/dashboard" 
              icon={<Home className="h-4 w-4" />} 
              label="Trang chủ"
            />

            {isTeacher ? (
              <>
                <SidebarItem 
                  href="/teacher/questions" 
                  icon={<FileText className="h-4 w-4" />} 
                  label="Bài tập"
                />
                <SidebarItem 
                  href="/teacher/create-question" 
                  icon={<Headphones className="h-4 w-4" />} 
                  label="Tạo bài tập mới"
                />
                <SidebarItem 
                  href="/teacher/students" 
                  icon={<Users className="h-4 w-4" />} 
                  label="Học viên"
                />
                <SidebarItem 
                  href="/teacher/analytics" 
                  icon={<BarChart3 className="h-4 w-4" />} 
                  label="Phân tích dữ liệu"
                />
              </>
            ) : (
              <>
                <SidebarItem 
                  href="/student/assignments" 
                  icon={<BookOpen className="h-4 w-4" />} 
                  label="Bài tập"
                />
                <SidebarItem 
                  href="/student/results" 
                  icon={<BarChart3 className="h-4 w-4" />} 
                  label="Kết quả học tập"
                />
              </>
            )}

            <SidebarItem 
              href="/profile" 
              icon={<User className="h-4 w-4" />} 
              label="Tài khoản"
            />
            <SidebarItem 
              href="/settings" 
              icon={<Settings className="h-4 w-4" />} 
              label="Cài đặt"
            />
          </nav>
        </div>
      </div>
    </div>
  );
} 