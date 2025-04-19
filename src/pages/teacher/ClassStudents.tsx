import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { User, UserPlus, ChevronLeft, Search, Mail, XCircle, AlertCircle, UserX } from 'lucide-react';
import TeacherLayout from '@/layouts/TeacherLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ClassDetails {
  id: string;
  name: string;
  description: string | null;
  class_code: string;
  teacher_id: string;
  created_at: string;
}

interface StudentProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  joined_at?: string;
}

const emailSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ' }),
});

const ClassStudents = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<StudentProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Form setup
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  // Fetch class details
  const { data: classDetails, isLoading: isLoadingClass, error: classError } = useQuery({
    queryKey: ['class-details', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return data as ClassDetails;
    },
    enabled: !!id,
  });

  // Fetch students in class
  const { 
    data: students, 
    isLoading: isLoadingStudents, 
    error: studentsError,
    refetch: refetchStudents
  } = useQuery({
    queryKey: ['class-students', id],
    queryFn: async () => {
      if (!id) return [];
      
      console.log('Fetching students for class', id);
      
      try {
        // Get students in this class
        const { data: studentClasses, error: studentClassesError } = await supabase
          .from('student_classes')
          .select(`
            id,
            joined_at,
            student_id
          `)
          .eq('class_id', id)
          .eq('is_active', true);
          
        if (studentClassesError) {
          console.error('Error fetching student classes:', studentClassesError);
          throw studentClassesError;
        }
        
        console.log('Student classes data:', studentClasses);
        
        if (!studentClasses || studentClasses.length === 0) {
          return [];
        }
        
        // Lấy danh sách student_id
        const studentIds = studentClasses.map(item => item.student_id);
        
        // Truy vấn riêng thông tin chi tiết của học sinh
        const { data: studentProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, avatar_url')
          .in('id', studentIds)
          .eq('role', 'student');
          
        if (profilesError) {
          console.error('Error fetching student profiles:', profilesError);
          throw profilesError;
        }
        
        console.log('Student profiles data:', studentProfiles);
        
        // Kết hợp dữ liệu
        const studentsWithDetails = studentClasses.map(classEntry => {
          const profile = studentProfiles?.find(p => p.id === classEntry.student_id);
          return {
            id: classEntry.student_id,
            email: profile?.email || '',
            full_name: profile?.full_name || '',
            role: profile?.role || '',
            avatar_url: profile?.avatar_url,
            joined_at: classEntry.joined_at,
          };
        });
        
        return studentsWithDetails as StudentProfile[];
      } catch (error) {
        console.error('Error in fetching students:', error);
        throw error;
      }
    },
    enabled: !!id,
  });

  // Search for students by email
  const searchStudents = async () => {
    if (!searchEmail.trim()) {
      setSearchError('Vui lòng nhập email học sinh');
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      // First check if the student is already in the class
      const existingStudent = students?.find(s => s.email.toLowerCase() === searchEmail.toLowerCase());
      
      if (existingStudent) {
        setSearchError('Học sinh này đã được thêm vào lớp');
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      // Search for the student in profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url')
        .ilike('email', `%${searchEmail.trim()}%`)
        .eq('role', 'student')
        .limit(5);
        
      if (error) throw error;
      
      console.log('Search results:', data);
      
      if (data && data.length > 0) {
        setSearchResults(data as StudentProfile[]);
      } else {
        setSearchError('Không tìm thấy học sinh với email này');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching students:', error);
      setSearchError('Đã xảy ra lỗi khi tìm kiếm');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add student from email form
  const onSubmitEmail = (values: z.infer<typeof emailSchema>) => {
    setSearchEmail(values.email);
    searchStudentByExactEmail(values.email);
  };

  // Search for student by exact email and add if found
  const searchStudentByExactEmail = async (email: string) => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      // Check if already in class
      const existingStudent = students?.find(s => s.email.toLowerCase() === email.toLowerCase());
      
      if (existingStudent) {
        setSearchError('Học sinh này đã được thêm vào lớp');
        setIsSearching(false);
        return;
      }
      
      // Find student by exact email
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url')
        .eq('email', email.trim())
        .eq('role', 'student')
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          setSearchError('Không tìm thấy học sinh với email này');
        } else {
          throw error;
        }
        setIsSearching(false);
        return;
      }
      
      // Add student directly
      addStudentMutation.mutate(data.id);
    } catch (error) {
      console.error('Error searching student by email:', error);
      setSearchError('Đã xảy ra lỗi khi tìm kiếm');
    } finally {
      setIsSearching(false);
    }
  };

  // Add student to class
  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!id || !studentId) {
        throw new Error('Missing class ID or student ID');
      }
      
      console.log('Adding student to class', studentId, id);
      
      try {
        // Check if student is already in the class but inactive
        const { data: existingEntry, error: checkError } = await supabase
          .from('student_classes')
          .select('*')
          .eq('class_id', id)
          .eq('student_id', studentId);
          
        if (checkError) {
          console.error('Error checking existing student:', checkError);
          throw checkError;
        }
        
        console.log('Existing entry check:', existingEntry);
        
        if (existingEntry && existingEntry.length > 0) {
          // Update existing entry to active
          const { data, error } = await supabase
            .from('student_classes')
            .update({ is_active: true })
            .eq('class_id', id)
            .eq('student_id', studentId)
            .select();
            
          if (error) {
            console.error('Error updating student class:', error);
            throw error;
          }
          
          console.log('Updated student class:', data);
          return data;
        } else {
          // Create new entry
          const { data, error } = await supabase
            .from('student_classes')
            .insert([{
              class_id: id,
              student_id: studentId,
              is_active: true
            }])
            .select();
            
          if (error) {
            console.error('Error inserting student class:', error);
            throw error;
          }
          
          console.log('Inserted student class:', data);
          return data;
        }
      } catch (error) {
        console.error('Error in addStudentMutation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Đã thêm học sinh vào lớp học');
      setIsAddModalOpen(false);
      setSearchEmail('');
      setSearchResults([]);
      setSearchError(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['class-students', id] });
    },
    onError: (error: any) => {
      console.error('Error adding student:', error);
      toast.error(error.message || 'Không thể thêm học sinh vào lớp học');
    },
  });

  // Remove student from class
  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!id || !studentId) {
        throw new Error('Missing class ID or student ID');
      }
      
      console.log('Removing student from class', studentId, id);
      
      try {
        // Soft delete - mark as inactive
        const { data, error } = await supabase
          .from('student_classes')
          .update({ is_active: false })
          .eq('class_id', id)
          .eq('student_id', studentId)
          .select();
          
        if (error) {
          console.error('Error removing student from class:', error);
          throw error;
        }
        
        console.log('Removed student from class:', data);
        return data;
      } catch (error) {
        console.error('Error in removeStudentMutation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Đã xóa học sinh khỏi lớp học');
      setIsRemoveModalOpen(false);
      setSelectedStudent(null);
      queryClient.invalidateQueries({ queryKey: ['class-students', id] });
    },
    onError: (error: any) => {
      console.error('Error removing student:', error);
      toast.error(error.message || 'Không thể xóa học sinh khỏi lớp học');
    },
  });

  // Filter students based on search term
  const filteredStudents = students?.filter(student => 
    (student.full_name && student.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  // Handle going back
  const handleGoBack = () => {
    navigate(`/teacher/classes`);
  };

  // Loading and error states
  const isLoading = isLoadingClass || isLoadingStudents;
  const error = classError || studentsError;

  return (
    <TeacherLayout>
      <div className="container mx-auto p-6">
        <div className="flex flex-col space-y-6">
          {/* Header and actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="mr-2" 
                onClick={handleGoBack}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Quay lại
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isLoadingClass ? 'Đang tải...' : classDetails?.name}
                </h1>
                <p className="text-gray-500">Quản lý học sinh trong lớp</p>
              </div>
            </div>
            
            <div className="flex mt-4 md:mt-0 gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Tìm kiếm học sinh..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Thêm học sinh
              </Button>
            </div>
          </div>
          
          {/* Class information */}
          {!isLoadingClass && classDetails && (
            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Mã lớp</p>
                    <p className="text-lg font-bold">{classDetails.class_code}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Ngày tạo</p>
                    <p className="text-lg">{formatDate(classDetails.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Số học sinh</p>
                    <p className="text-lg">{students?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Students list */}
          <Card>
            <CardHeader>
              <CardTitle>Danh sách học sinh</CardTitle>
              <CardDescription>
                {filteredStudents?.length 
                  ? `${filteredStudents.length} học sinh trong lớp học này` 
                  : 'Chưa có học sinh nào trong lớp học này'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center my-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="text-center py-12 border-2 border-dashed rounded-md">
                  <AlertCircle className="h-12 w-12 mx-auto text-red-400" />
                  <p className="mt-4 text-gray-500">Đã xảy ra lỗi khi tải danh sách học sinh</p>
                  <Button 
                    className="mt-4" 
                    size="sm"
                    variant="outline"
                    onClick={() => refetchStudents()}
                  >
                    Thử lại
                  </Button>
                </div>
              ) : filteredStudents?.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-md">
                  <UserPlus className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="mt-4 text-gray-500">
                    {searchTerm 
                      ? 'Không tìm thấy học sinh phù hợp với từ khóa tìm kiếm' 
                      : 'Chưa có học sinh nào trong lớp học này'}
                  </p>
                  {!searchTerm && (
                    <Button 
                      className="mt-4" 
                      size="sm"
                      onClick={() => setIsAddModalOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Thêm học sinh
                    </Button>
                  )}
                </div>
              ) : (
                <Table className="border rounded-md">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Học sinh</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ngày tham gia</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents?.map((student, index) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage 
                                src={student.avatar_url || undefined} 
                                alt={student.full_name} 
                              />
                              <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{student.full_name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{formatDate(student.joined_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsRemoveModalOpen(true);
                            }}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Xóa
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Add Student Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm học sinh vào lớp</DialogTitle>
            <DialogDescription>
              Nhập email của học sinh để thêm vào lớp học
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitEmail)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email học sinh</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-2">
                          <Input
                            placeholder="Email của học sinh"
                            {...field}
                          />
                          <Button type="submit" variant="secondary" disabled={isSearching}>
                            {isSearching ? (
                              <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full" />
                            ) : "Thêm"}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Học sinh cần đã đăng ký tài khoản trước
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Hoặc tìm kiếm học sinh:</p>
              <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                  <Input
                    type="email"
                    placeholder="Tìm theo email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                  />
                  {searchError && (
                    <p className="text-sm text-red-500">{searchError}</p>
                  )}
                </div>
                <Button 
                  type="button" 
                  variant="secondary"
                  disabled={isSearching}
                  onClick={searchStudents}
                >
                  {isSearching ? (
                    <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-60 overflow-auto">
                {searchResults.map(student => (
                  <div 
                    key={student.id} 
                    className="p-3 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                    onClick={() => addStudentMutation.mutate(student.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage 
                          src={student.avatar_url || undefined} 
                          alt={student.full_name} 
                        />
                        <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{student.full_name}</p>
                        <p className="text-sm text-gray-500">{student.email}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="ml-auto"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Thêm
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                setSearchEmail('');
                setSearchResults([]);
                setSearchError(null);
                form.reset();
              }}
            >
              Đóng
            </Button>
            <div className="flex items-center text-sm text-gray-500">
              <Mail className="h-4 w-4 mr-2 text-gray-400" />
              Học sinh phải có tài khoản trước
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Remove Student Confirmation */}
      <Dialog open={isRemoveModalOpen} onOpenChange={setIsRemoveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa học sinh</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa học sinh này khỏi lớp học?
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-3 border rounded-md bg-gray-50">
                <Avatar>
                  <AvatarImage 
                    src={selectedStudent.avatar_url || undefined} 
                    alt={selectedStudent.full_name} 
                  />
                  <AvatarFallback>{getInitials(selectedStudent.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedStudent.full_name}</p>
                  <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRemoveModalOpen(false);
                setSelectedStudent(null);
              }}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => selectedStudent && removeStudentMutation.mutate(selectedStudent.id)}
              disabled={removeStudentMutation.isPending}
            >
              {removeStudentMutation.isPending ? 'Đang xóa...' : 'Xóa học sinh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
};

export default ClassStudents; 