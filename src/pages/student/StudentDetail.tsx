import React from 'react';
import { useParams, Link } from 'react-router-dom';
import StudentLayout from '@/layouts/StudentLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const StudentDetail = () => {
  const { studentId } = useParams();
  const { user } = useAuth();

  // Hiển thị phần trình độ trong component
  return (
    <StudentLayout>
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Thông tin học sinh</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarFallback>HS</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h2 className="text-xl font-bold">{user?.full_name}</h2>
                  <p className="text-gray-500">{user?.email}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-red-100 text-red-800">
                    Yếu
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-gray-100"
                    title="Đang sử dụng tính toán tự động"
                    disabled
                  >
                    <RefreshCw className="h-3 w-3 text-gray-400" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentDetail; 