import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, BarChart, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    icon: <GraduationCap className="w-5 h-5" />,
    href: '/student/classes',
  },
];

interface StudentSidebarProps {
  onStateChange?: (isOpen: boolean) => void;
}

const StudentSidebar: React.FC<StudentSidebarProps> = ({ onStateChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [hoverDisabled, setHoverDisabled] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Notify parent component when sidebar state changes
  useEffect(() => {
    onStateChange?.(open);
  }, [open, onStateChange]);

  // Toggle sidebar state
  const toggleSidebar = () => {
    setHoverDisabled(true);
    setOpen(prev => !prev);
    
    // Re-enable hover after 1 second
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverDisabled(false);
    }, 1000);
  };
  
  // Custom set open function that also notifies parent
  const handleSetOpen = (value: boolean) => {
    if (!hoverDisabled) {
      setOpen(value);
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full">
      <DesktopSidebar 
        open={open} 
        setOpen={handleSetOpen} 
        toggleSidebar={toggleSidebar}
        hoverDisabled={hoverDisabled}
      >
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            {open ? <Logo key="full-logo" /> : <LogoIcon key="icon-logo" />}
          </AnimatePresence>
          
          <div className="mt-6 flex flex-col gap-2">
            {navItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: idx * 0.05,
                  ease: "easeOut"
                }}
              >
                <SidebarLink 
                  link={{
                    label: item.title,
                    href: item.href,
                    icon: item.icon,
                    isActive: isActive(item.href)
                  }} 
                  onClick={() => navigate(item.href)}
                  isOpen={open}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </DesktopSidebar>

      <MobileSidebar open={open} setOpen={handleSetOpen}>
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <Logo />
          
          <div className="mt-6 flex flex-col gap-2">
            {navItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: idx * 0.05,
                  ease: "easeOut"
                }}
              >
                <SidebarLink 
                  link={{
                    label: item.title,
                    href: item.href,
                    icon: item.icon,
                    isActive: isActive(item.href)
                  }} 
                  onClick={() => navigate(item.href)}
                  mobile
                  isOpen={true}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </MobileSidebar>
    </div>
  );
};

// Desktop sidebar component
const DesktopSidebar = ({ 
  children, 
  open, 
  setOpen,
  toggleSidebar,
  hoverDisabled
}: { 
  children: React.ReactNode;
  open: boolean;
  setOpen: (value: boolean) => void;
  toggleSidebar: () => void;
  hoverDisabled: boolean;
}) => {
  return (
    <motion.div
      className="h-full px-4 py-4 hidden md:flex md:flex-col bg-white dark:bg-neutral-800 flex-shrink-0 border-r border-gray-100"
      animate={{
        width: open ? "300px" : "80px",
      }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => !hoverDisabled && setOpen(true)}
      onMouseLeave={() => !hoverDisabled && setOpen(false)}
    >
      <div className="flex justify-end mb-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          <motion.div
            animate={{ rotate: open ? 0 : 180 }}
            transition={{ duration: 0.3 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </motion.div>
        </button>
      </div>
      {children}
    </motion.div>
  );
};

// Mobile sidebar component
const MobileSidebar = ({ 
  children, 
  open, 
  setOpen 
}: { 
  children: React.ReactNode;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <>
      <div
        className="h-16 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-white dark:bg-neutral-800 w-full fixed top-0 left-0 z-50 border-b border-gray-100"
        style={{ 
          backdropFilter: 'blur(10px)', 
          backgroundColor: 'rgba(255, 255, 255, 0.8)' 
        }}
      >
        <Logo />
        <div className="flex justify-end z-20">
          <button
            onClick={() => setOpen(!open)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      {open && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 bg-white dark:bg-neutral-900 p-6 z-[100] md:hidden"
          style={{ 
            backdropFilter: 'blur(10px)', 
            backgroundColor: 'rgba(255, 255, 255, 0.95)' 
          }}
        >
          <div className="flex justify-end">
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          {children}
        </motion.div>
      )}
    </>
  );
};

// Logo component when sidebar is expanded
const Logo = () => {
  return (
    <Link
      to="/student/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-lightBlue-400 flex items-center justify-center">
        <span className="text-white text-base font-bold">D</span>
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-lg bg-gradient-to-r from-blue-700 to-lightBlue-500 bg-clip-text text-transparent whitespace-pre"
      >
        Dictation
      </motion.span>
    </Link>
  );
};

// Logo icon when sidebar is collapsed
const LogoIcon = () => {
  return (
    <Link
      to="/student/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-lightBlue-400 flex items-center justify-center">
        <span className="text-white text-base font-bold">D</span>
      </div>
    </Link>
  );
};

// Sidebar link component
const SidebarLink = ({ 
  link, 
  mobile = false,
  onClick,
  isOpen = true
}: { 
  link: { 
    label: string; 
    href: string; 
    icon: React.ReactNode;
    isActive: boolean;
  };
  mobile?: boolean;
  onClick: () => void;
  isOpen?: boolean;
}) => {
  return (
          <Link
      to={link.href}
      className={`flex items-center justify-start gap-3 group py-3 px-3 rounded-lg transition-all ${
        link.isActive
                ? 'bg-primary text-white font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
      onClick={onClick}
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.2 }}
      >
        {link.icon}
      </motion.div>
      <AnimatePresence mode="wait">
        {(isOpen || mobile) && (
          <motion.span
            key={link.label}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm group-hover:translate-x-1 transition duration-150 whitespace-pre overflow-hidden"
          >
            {link.label}
          </motion.span>
        )}
      </AnimatePresence>
          </Link>
  );
};

export default StudentSidebar;
