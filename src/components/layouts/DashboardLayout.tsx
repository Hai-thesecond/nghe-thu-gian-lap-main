import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto py-4 px-6">
          <h1 className="text-2xl font-bold">Nghe Thư Giãn</h1>
        </div>
      </header>
      <main className="container mx-auto py-6 px-6">{children}</main>
    </div>
  );
} 