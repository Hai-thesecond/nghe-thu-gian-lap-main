import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, LockOpen, Lock, Info } from 'lucide-react';

interface CheatingManagementProps {
  questionId: string;
}

// Thêm interface cho student
interface LockedStudent {
  id: string;
  full_name: string;
  email: string;
  cheating_locked: boolean;
  total_cheating_count: number;
  cheating_attempts: number;
  last_attempt: string;
}

const CheatingManagement: React.FC<CheatingManagementProps> = ({ questionId }) => {
  const { user } = useAuth();
  const [lockedStudents, setLockedStudents] = useState<LockedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openUnlockDialog, setOpenUnlockDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<LockedStudent | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  useEffect(() => {
    fetchLockedStudents();
  }, [questionId, user?.id]);

  const fetchLockedStudents = async () => {
    try {
      setLoading(true);
      
      // Kiểm tra xem giáo viên có quyền với bài thi này không
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select('created_by')
        .eq('id', questionId)
        .single();
      
      if (questionError) {
        console.error('Lỗi khi kiểm tra quyền bài thi:', questionError);
        toast.error('Không thể xác minh quyền truy cập bài thi');
        setLoading(false);
        return;
      }
      
      // Nếu giáo viên không phải người tạo bài thi
      if (question.created_by !== user?.id) {
        toast.error('Bạn không có quyền quản lý vi phạm cho bài thi này');
        setLoading(false);
        return;
      }
      
      // Tìm học sinh đã bị khóa do vi phạm quy chế với bài thi này
      const { data, error } = await supabase
        .from('student_answers')
        .select(`
          id,
          student_id,
          cheating_attempts,
          is_completed,
          created_at,
          profiles:student_id(id, full_name, email, cheating_locked, total_cheating_count)
        `)
        .eq('question_id', questionId)
        .gt('cheating_attempts', 0)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Lọc và nhóm theo student_id để có danh sách học sinh duy nhất
      const uniqueStudents = [];
      const studentMap = new Map();
      
      data.forEach(record => {
        if (!studentMap.has(record.student_id)) {
          studentMap.set(record.student_id, {
            id: record.student_id,
            full_name: record.profiles?.full_name || 'Học sinh không xác định',
            email: record.profiles?.email || 'Email không xác định',
            cheating_locked: record.profiles?.cheating_locked || false,
            total_cheating_count: record.profiles?.total_cheating_count || 0,
            cheating_attempts: record.cheating_attempts,
            last_attempt: record.created_at
          });
        }
      });
      
      studentMap.forEach(student => uniqueStudents.push(student));
      setLockedStudents(uniqueStudents);
      
    } catch (error) {
      console.error('Lỗi khi tải danh sách học sinh vi phạm:', error);
      toast.error('Không thể tải danh sách học sinh vi phạm');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!selectedStudent || !unlockReason.trim()) {
      toast.error('Vui lòng nhập lý do mở khóa');
      return;
    }
    
    try {
      // Gọi function RPC để mở khóa học sinh
      const { data, error } = await supabase.rpc('unlock_student_cheating', {
        p_teacher_id: user.id,
        p_student_id: selectedStudent.id,
        p_question_id: questionId,
        p_reason: unlockReason
      });
      
      if (error) {
        console.error('Lỗi khi gọi hàm unlock_student_cheating:', error);
        toast.error('Không thể mở khóa cho học sinh: ' + error.message);
        return;
      }
      
      if (data && !data.success) {
        toast.error(data.message || 'Không thể mở khóa');
        return;
      }
      
      // Thêm bước cập nhật đặt lại tổng số vi phạm về 0
      const { error: resetError } = await supabase
        .from('profiles')
        .update({ 
          total_cheating_count: 0,
          cheating_locked: false  // Đảm bảo cả hai trường đều được cập nhật
        })
        .eq('id', selectedStudent.id);
        
      if (resetError) {
        console.error('Lỗi khi reset số lần vi phạm:', resetError);
        toast.error('Đã mở khóa nhưng không reset được số lần vi phạm');
        return;
      }
      
      toast.success('Đã mở khóa và reset số lần vi phạm cho học sinh ' + selectedStudent.full_name);
      setOpenUnlockDialog(false);
      setUnlockReason('');
      fetchLockedStudents(); // Cập nhật lại danh sách
      
    } catch (error) {
      console.error('Lỗi khi mở khóa học sinh:', error);
      toast.error('Đã xảy ra lỗi khi mở khóa');
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Quản lý vi phạm quy chế thi</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchLockedStudents}
          disabled={loading}
        >
          Làm mới
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : lockedStudents.length === 0 ? (
        <div className="p-8 text-center bg-muted/50 rounded-lg border border-muted">
          <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Không có học sinh nào vi phạm quy chế thi cho bài thi này
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Học sinh
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số lần vi phạm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lần cuối vi phạm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lockedStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      student.total_cheating_count >= 7 
                        ? 'bg-red-100 text-red-800' 
                        : student.total_cheating_count >= 5
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}>
                      {student.total_cheating_count || 0} lần
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(student.last_attempt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {student.cheating_locked ? (
                        <>
                          <Lock className="h-4 w-4 text-red-500 mr-2" />
                          <span className="text-red-500 font-medium">Đã bị khóa</span>
                        </>
                      ) : (
                        <>
                          <LockOpen className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-green-500 font-medium">Đang hoạt động</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedStudent(student);
                        setOpenUnlockDialog(true);
                      }}
                      disabled={!student.cheating_locked}
                      className={!student.cheating_locked ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <LockOpen className="h-4 w-4 mr-2" />
                      Mở khóa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog mở khóa */}
      <Dialog open={openUnlockDialog} onOpenChange={setOpenUnlockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              Mở khóa cho học sinh
            </DialogTitle>
            <DialogDescription>
              {selectedStudent && (
                <>
                  <p>Bạn đang mở khóa cho học sinh <span className="font-medium">{selectedStudent.full_name}</span></p>
                  <p className="mt-1">Học sinh này đã vi phạm quy chế <span className="font-medium text-red-500">{selectedStudent.total_cheating_count || 0}</span> lần.</p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Lý do mở khóa (bắt buộc)"
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              className="w-full"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Lý do mở khóa sẽ được ghi lại trong hệ thống.
            </p>
          </div>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button variant="outline" onClick={() => setOpenUnlockDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={handleUnlock}
              disabled={!unlockReason.trim()}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"
            >
              <LockOpen className="h-4 w-4 mr-2" />
              Xác nhận mở khóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheatingManagement; 