import React from 'react';
import { Toaster } from 'sonner';
import StudentSidebar from '@/components/student/StudentSidebar';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';

interface StudentLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

const StudentLayout: React.FC<StudentLayoutProps> = ({ children, hideSidebar = false }) => {
  return (
    <ProtectedRoute allowedRole="student">
      <div className="flex h-screen bg-background">
        <Toaster richColors position="top-right" />
        
        {!hideSidebar && (
          <div className="fixed left-0 top-0 z-30 h-full">
            <StudentSidebar />
          </div>
        )}
        
        <div className={`flex-1 flex flex-col ${!hideSidebar ? 'ml-64' : 'ml-0'} min-h-screen transition-all duration-300`}>
          <div className="sticky top-0 z-40">
            <Header />
          </div>
          
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudentLayout;
