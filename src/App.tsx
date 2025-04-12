import React, { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initializeStorage } from './lib/supabase';

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginTeacher from "./pages/LoginTeacher";
import LoginStudent from "./pages/LoginStudent";
import LoginTest from "./pages/student/LoginTest";

// Teacher pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateQuestion from "./pages/teacher/CreateQuestion";
import EditQuestion from "./pages/teacher/EditQuestion";
import StudentsList from "./pages/teacher/StudentsList";
import StudentDetail from "./pages/teacher/StudentDetail";
import TestResults from "./pages/teacher/TestResults";
import TeacherProfile from "./pages/teacher/TeacherProfile";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import ClassStudents from "./pages/teacher/ClassStudents";
import { default as TeacherClassAssignments } from "./pages/teacher/ClassAssignments";
import SimpleUploadForm from './pages/teacher/SimpleUploadForm';
import StudentResultDetail from './pages/teacher/StudentResultDetail';

// Student pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentProgress from "./pages/student/StudentProgress";
import StudentProfile from "./pages/student/StudentProfile";
import QuestionDetail from "./pages/student/QuestionDetail";
import ResultPage from "./pages/student/ResultPage";
import ClassesJoin from "./pages/student/ClassesJoin";
import { default as StudentClassAssignments } from "./pages/student/ClassAssignments";
import VocabularyFlashcards from "./pages/student/VocabularyFlashcards";
import VocabularyPractice from "./pages/student/VocabularyPractice";
import DictationExercise from "./pages/student/DictationExercise";
import DictationResult from "./pages/student/DictationResult";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Khởi tạo storage khi app khởi động
    try {
      initializeStorage();
    } catch (error) {
      console.error('Lỗi khi khởi tạo storage:', error);
      // Không throw lỗi - tiếp tục khởi động app
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login-teacher" element={<LoginTeacher />} />
            <Route path="/login-student" element={<LoginStudent />} />
            <Route path="/connection-test" element={<LoginTest />} />
            
            {/* Teacher routes */}
            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/create-question" element={<CreateQuestion />} />
            <Route path="/teacher/edit-question/:id" element={<EditQuestion />} />
            <Route path="/teacher/students" element={<StudentsList />} />
            <Route path="/teacher/student/:id" element={<StudentDetail />} />
            <Route path="/teacher/results" element={<TestResults />} />
            <Route path="/teacher/profile" element={<TeacherProfile />} />
            <Route path="/teacher/classes" element={<TeacherClasses />} />
            <Route path="/teacher/classes/:id/students" element={<ClassStudents />} />
            <Route path="/teacher/classes/:id/assignments" element={<TeacherClassAssignments />} />
            <Route path="/teacher/simple-upload" element={<SimpleUploadForm />} />
            <Route path="/teacher/student-result/:id" element={<StudentResultDetail />} />

            {/* Student routes */}
            <Route path="/student" element={<Navigate to="/student/dashboard" />} />
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/progress" element={<StudentProgress />} />
            <Route path="/student/question/:id" element={<QuestionDetail />} />
            <Route path="/student/result/:id" element={<ResultPage />} />
            <Route path="/student/classes" element={<ClassesJoin />} />
            <Route path="/student/classes/:id/assignments" element={<StudentClassAssignments />} />
            
            {/* Vocabulary Learning routes */}
            <Route path="/student/vocabulary-flashcards/:questionId" element={<VocabularyFlashcards />} />
            <Route path="/student/vocabulary-practice/:questionId" element={<VocabularyPractice />} />
            <Route path="/student/dictation/:questionId" element={<DictationExercise />} />
            <Route path="/student/dictation-result/:questionId" element={<DictationResult />} />

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
