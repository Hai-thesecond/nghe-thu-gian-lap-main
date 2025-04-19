import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertCircle, Clock, ArrowLeft, List, CheckCircle, XCircle, BookCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import StudentLayout from '@/layouts/StudentLayout';

interface QuestionDetails {
  id: string;
  title: string;
  script: string;
  audio_url: string;
  difficulty: string;
  time_limit: number;
  created_by: string;
  blanks_count: number;
  correct_answers: string[];
  differentiate_levels: boolean;
  profiles?: {
    full_name: string;
  };
}

interface StudentAnswer {
  id: string;
  student_id: string;
  question_id: string;
  answers?: string[];
  answers_text?: string;
  started_at: string;
  completed_at: string;
  is_completed: boolean;
  attempt_count: number;
  cheating_attempts: number;
  score?: number;
  student_level?: string;
}

interface ImprovementSuggestion {
  strengths: string[];
  weaknesses: string[];
  suggestedExercises: {
    title: string;
    description: string;
  }[];
}

const ResultPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [adjustedScore, setAdjustedScore] = useState<number | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [scriptWithBlanks, setScriptWithBlanks] = useState<{word: string, isBlank: boolean, studentAnswer: string, index: number}[]>([]);
  const [errorTypes, setErrorTypes] = useState<{type: string, count: number}[]>([]);
  const [monthlyScores, setMonthlyScores] = useState<{month: number, score: number}[]>([]);
  const [classRank, setClassRank] = useState<{position: number, total: number, percentile: string}>({position: 0, total: 0, percentile: ''});
  const [improvementSuggestions, setImprovementSuggestions] = useState<ImprovementSuggestion>({
    strengths: [],
    weaknesses: [],
    suggestedExercises: []
  });

  // Fetch question data and student answer
  const { data, isLoading } = useQuery({
    queryKey: ['result', id, user?.id],
    queryFn: async () => {
      if (!user?.id || !id) {
        throw new Error('Không tìm thấy thông tin người dùng hoặc bài làm');
      }

      try {
        console.log('Đang tìm kiếm bài làm với ID:', id);
        console.log('User ID:', user.id);

        // 1. Tìm bài làm của học sinh trước
        const { data: studentAnswerData, error: answerError } = await supabase
          .from('student_answers')
          .select('*')
          .eq('student_id', user.id)
          .eq('question_id', id)
          .limit(1)
          .maybeSingle();

        console.log('Student answer query result:', studentAnswerData, answerError);

        // Kiểm tra lỗi truy vấn
        if (answerError) {
          console.error('Error fetching student answer:', answerError);
          throw new Error('Lỗi truy vấn dữ liệu bài làm: ' + answerError.message);
        }

        // Nếu không tìm thấy bài làm, thử tìm kiếm bài làm với id là id của bài làm
        if (!studentAnswerData) {
          console.log('Không tìm thấy bài làm trong student_answers, thử tìm bằng ID của bài làm');
          
          const { data: directAnswerData, error: directAnswerError } = await supabase
            .from('student_answers')
            .select('*')
            .eq('id', id)
            .limit(1)
            .maybeSingle();
            
          console.log('Direct student answer query result:', directAnswerData, directAnswerError);
            
          if (directAnswerError) {
            console.error('Error fetching student answer by ID:', directAnswerError);
            throw new Error('Lỗi truy vấn dữ liệu: ' + directAnswerError.message);
          }
          
          if (!directAnswerData) {
            throw new Error('Không tìm thấy thông tin bài làm với ID: ' + id);
          }
          
          // Sử dụng dữ liệu tìm được và cập nhật ID câu hỏi
          const questionId = directAnswerData.question_id;
          if (!questionId) {
            throw new Error('Bài làm không có thông tin câu hỏi liên kết');
          }
          
          // 2. Sau đó tìm thông tin câu hỏi
          const { data: questionData, error: questionError } = await supabase
            .from('questions')
            .select(`
              *,
              profiles:created_by (
                full_name
              )
            `)
            .eq('id', questionId)
            .single();
            
            console.log('Question query result:', questionData, questionError);

          if (questionError) {
            console.error('Error fetching question:', questionError);
            throw new Error('Không tìm thấy thông tin bài kiểm tra');
          }
          
          // Sử dụng kết quả tìm kiếm trực tiếp
          return processResultData(questionData, directAnswerData);
        } else {
          // Tìm thấy bài làm, tiếp tục tìm thông tin câu hỏi
          const questionId = studentAnswerData.question_id;
          
          // 2. Sau đó tìm thông tin câu hỏi
          const { data: questionData, error: questionError } = await supabase
            .from('questions')
            .select(`
              *,
              profiles:created_by (
                full_name
              )
            `)
            .eq('id', questionId)
            .single();
            
            console.log('Question query result:', questionData, questionError);

          if (questionError) {
            console.error('Error fetching question:', questionError);
            throw new Error('Không tìm thấy thông tin bài kiểm tra');
          }
          
          return processResultData(questionData, studentAnswerData);
        }
      } catch (error) {
        console.error('Error in data fetch:', error);
        setError(error instanceof Error ? error.message : 'Lỗi không xác định');
        toast.error(error instanceof Error ? error.message : 'Không tìm thấy thông tin bài làm');
        // Không ném lỗi để tránh màn hình trắng, cho phép hiển thị giao diện lỗi
        return null;
      }
    }
  });
  
  // Hàm xử lý dữ liệu kết quả bài làm
  const processResultData = async (question, studentAnswer) => {
    // Convert answers_text to array if needed
    let answers: string[] = [];
    
    // Ưu tiên sử dụng trường answers nếu có sẵn và là array
    if (studentAnswer.answers && Array.isArray(studentAnswer.answers) && studentAnswer.answers.length > 0) {
      answers = studentAnswer.answers;
    } 
    // Nếu không, thử parse answers_text
    else if (studentAnswer.answers_text) {
      try {
        answers = JSON.parse(studentAnswer.answers_text);
        if (!Array.isArray(answers)) {
          answers = [];
        }
      } catch (e) {
        console.error('Error parsing answers_text:', e);
        answers = [];
      }
    }
    
    console.log('Parsed student answers:', answers);

    // Update attempt count
    setAttempt(studentAnswer.attempt_count || 1);

    // Sử dụng correct_answers từ database nếu có, nếu không tạo mặc định
    let questionCorrectAnswers: string[] = [];
    
    if (question.correct_answers && Array.isArray(question.correct_answers)) {
      // Đã có đáp án trong database
      questionCorrectAnswers = question.correct_answers;
    } else {
      // Không có đáp án - tạo mặc định từ script
      const words = question.script?.split(/\s+/) || [];
      const blanksCount = question.blanks_count || 10;
      
      // Tìm những từ dài hơn 2 ký tự cho mẫu
      const longWords = words.filter(word => word.length > 2);
      
      if (longWords.length > 0) {
        // Lấy những từ có độ dài thích hợp
        for (let i = 0; i < blanksCount; i++) {
          const randomIndex = Math.floor(Math.random() * longWords.length);
          questionCorrectAnswers.push(longWords[randomIndex]);
        }
      }
    }
    
    console.log('Correct answers:', questionCorrectAnswers);
    setCorrectAnswers(questionCorrectAnswers);
    
    // Tính toán điểm dựa trên số lượng đáp án đúng
    let correctCount = 0;
    
    for (let i = 0; i < answers.length && i < questionCorrectAnswers.length; i++) {
      const studentAnswer = answers[i] || '';
      const correctAnswer = questionCorrectAnswers[i] || '';
      
      // So sánh không phân biệt hoa thường
      if (studentAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        correctCount++;
      }
    }
    
    // Tính điểm phần trăm
    const totalAnswers = Math.max(questionCorrectAnswers.length, 1); // Tránh chia cho 0
    const calculatedScore = Math.round((correctCount / totalAnswers) * 100);
    
    // Tính điểm dựa vào cấp độ học sinh
    let levelMultiplier = 10; // Mặc định cho học sinh giỏi
    if (studentAnswer.student_level === 'weak') {
      levelMultiplier = 7;
    } else if (studentAnswer.student_level === 'average') {
      levelMultiplier = 8;
    }
    
    const levelAdjustedScore = Math.round((correctCount / totalAnswers) * levelMultiplier * 10);
    
    // Sử dụng điểm số có sẵn từ cơ sở dữ liệu nếu có, nếu không tính toán
    const finalScore = studentAnswer.score !== undefined ? studentAnswer.score : calculatedScore;
    setScore(finalScore);

    // Set the adjusted score using the existing state setter
    setAdjustedScore(levelAdjustedScore);

    // Phân tích lỗi từ câu trả lời của học sinh
    const errorTypesAnalysis = analyzeErrors(answers, questionCorrectAnswers);
    setErrorTypes(errorTypesAnalysis);
    
    // Tạo dữ liệu biểu đồ tiến độ theo thời gian
    await fetchMonthlyScores(studentAnswer.student_id || user.id);
    
    // Tính toán thứ hạng trong lớp
    await calculateClassRanking(studentAnswer.student_id || user.id, finalScore, studentAnswer.student_level || 'good');
    
    // Tạo script với các từ cần điền được đánh dấu
    const scriptWithBlanksArray = createScriptWithBlanks(question.script || '', questionCorrectAnswers, answers);
    setScriptWithBlanks(scriptWithBlanksArray);

    return {
      question,
      studentAnswer: {
        ...studentAnswer,
        answers
      }
    };
  }

  // Phân tích lỗi của học sinh
  const analyzeErrors = (studentAnswers: string[], correctAnswers: string[]) => {
    const errors = [];
    let spellingErrors = 0;
    let grammarErrors = 0;
    let missingWordErrors = 0;
    let extraWordErrors = 0;
    let punctuationErrors = 0;
    
    // Theo dõi các loại lỗi cụ thể để phân tích sau
    const specificErrors = {
      numbers: 0,               // Lỗi với số
      dates: 0,                 // Lỗi với ngày tháng
      specialTerms: 0,          // Lỗi với thuật ngữ chuyên ngành
      conjunctions: 0,          // Lỗi với từ nối
      prepositions: 0,          // Lỗi với giới từ
      completeMissing: 0,       // Không điền gì cả
      similarSounding: 0,       // Từ nghe có âm tương tự
      properNouns: 0,           // Tên riêng, địa điểm, tổ chức
      contextMisunderstanding: 0 // Hiểu sai ngữ cảnh
    };
    
    // Chi tiết các từ sai để phân tích sâu hơn
    const errorDetails = {
      misspelledWords: [] as string[],
      missedKeywords: [] as string[],
      confusedPairs: [] as {correct: string, student: string}[]
    };
    
    // Danh sách từ nối và giới từ thường gặp
    const conjunctions = ['and', 'but', 'or', 'so', 'because', 'if', 'when', 'that', 'while', 'although', 'however', 'though', 'therefore', 'since', 'unless', 'until', 'whereas', 'wherever', 'và', 'nhưng', 'hoặc', 'vì', 'nếu', 'khi', 'rằng', 'mặc dù', 'tuy nhiên', 'do đó', 'cho đến khi'];
    
    const prepositions = ['in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'of', 'about', 'between', 'among', 'through', 'throughout', 'during', 'until', 'against', 'into', 'towards', 'upon', 'within', 'without', 'despite', 'besides', 'except', 'trong', 'trên', 'tại', 'cho', 'với', 'bởi', 'từ', 'của', 'về', 'giữa', 'qua', 'suốt', 'cho đến', 'vào'];
    
    // Các từ thường bị nghe nhầm (từng cặp)
    const commonlyConfusedWords = [
      {word1: 'their', word2: 'there'},
      {word1: 'than', word2: 'then'},
      {word1: 'effect', word2: 'affect'},
      {word1: 'accept', word2: 'except'},
      {word1: 'weather', word2: 'whether'},
      {word1: 'quiet', word2: 'quite'},
      {word1: 'lose', word2: 'loose'},
      {word1: 'principle', word2: 'principal'},
      {word1: 'advice', word2: 'advise'},
      {word1: 'ensure', word2: 'insure'}
    ];
    
    // Regex kiểm tra số, ngày tháng và tên riêng
    const numberRegex = /\d+/;
    const dateRegex = /\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{1,2}-\d{1,2}(-\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}|\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i;
    const properNounRegex = /^[A-Z][a-z]+/; // Bắt đầu bằng chữ hoa
    
    // Tính tổng số câu hỏi đã hoàn thành
    let completedAnswerCount = 0;
    
    for (let i = 0; i < correctAnswers.length; i++) {
      const correctAns = correctAnswers[i] || '';
      const studentAns = studentAnswers[i] || '';
      
      if (!studentAns) {
        missingWordErrors++;
        specificErrors.completeMissing++;
        continue;
      }
      
      completedAnswerCount++;
      
      if (studentAns.toLowerCase() !== correctAns.toLowerCase()) {
        // Kiểm tra tên riêng, địa điểm
        if (properNounRegex.test(correctAns)) {
          specificErrors.properNouns++;
          errorDetails.missedKeywords.push(correctAns);
        }
        
        // Kiểm tra từ nghe có âm tương tự
        const isSimilarSounding = commonlyConfusedWords.some(pair => 
          (studentAns.toLowerCase() === pair.word1.toLowerCase() && correctAns.toLowerCase() === pair.word2.toLowerCase()) ||
          (studentAns.toLowerCase() === pair.word2.toLowerCase() && correctAns.toLowerCase() === pair.word1.toLowerCase())
        );
        
        if (isSimilarSounding) {
          specificErrors.similarSounding++;
          errorDetails.confusedPairs.push({correct: correctAns, student: studentAns});
        }
        
        // Kiểm tra lỗi chính tả (sai 1-2 ký tự)
        if (levenshteinDistance(studentAns.toLowerCase(), correctAns.toLowerCase()) <= 2) {
          spellingErrors++;
          errorDetails.misspelledWords.push(correctAns);
          
          // Kiểm tra lỗi số
          if (numberRegex.test(correctAns)) {
            specificErrors.numbers++;
          }
          
          // Kiểm tra lỗi ngày tháng
          if (dateRegex.test(correctAns)) {
            specificErrors.dates++;
          }
        }
        // Kiểm tra lỗi ngữ pháp (sai ngữ pháp nhưng nghĩa đúng)
        else if (studentAns.toLowerCase().includes(correctAns.toLowerCase()) || 
                correctAns.toLowerCase().includes(studentAns.toLowerCase())) {
          grammarErrors++;
          
          // Kiểm tra nếu là từ nối
          if (conjunctions.some(conj => correctAns.toLowerCase().includes(conj.toLowerCase()))) {
            specificErrors.conjunctions++;
          }
          
          // Kiểm tra nếu là giới từ
          if (prepositions.some(prep => correctAns.toLowerCase().includes(prep.toLowerCase()))) {
            specificErrors.prepositions++;
          }
        }
        // Kiểm tra lỗi dấu câu
        else if (studentAns.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") === 
                correctAns.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")) {
          punctuationErrors++;
        }
        // Thêm từ (câu trả lời dài hơn đáng kể so với đáp án)
        else if (studentAns.split(' ').length > correctAns.split(' ').length + 1) {
          extraWordErrors++;
        }
        // Lỗi khác
        else {
          missingWordErrors++; // Mặc định xếp vào lỗi thiếu từ
          
          // Kiểm tra nếu có thể là thuật ngữ chuyên ngành
          if (correctAns.length > 5 && 
              !conjunctions.some(conj => correctAns.toLowerCase().includes(conj.toLowerCase())) &&
              !prepositions.some(prep => correctAns.toLowerCase().includes(prep.toLowerCase()))) {
            specificErrors.specialTerms++;
            errorDetails.missedKeywords.push(correctAns);
          } else {
            specificErrors.contextMisunderstanding++;
          }
        }
      }
    }
    
    // Loại bỏ trùng lặp trong danh sách từ sai
    errorDetails.misspelledWords = [...new Set(errorDetails.misspelledWords)];
    errorDetails.missedKeywords = [...new Set(errorDetails.missedKeywords)];
    
    if (spellingErrors > 0) errors.push({ type: 'Sai chính tả', count: spellingErrors });
    if (grammarErrors > 0) errors.push({ type: 'Sai ngữ pháp', count: grammarErrors });
    if (missingWordErrors > 0) errors.push({ type: 'Thiếu từ', count: missingWordErrors });
    if (extraWordErrors > 0) errors.push({ type: 'Thêm từ', count: extraWordErrors });
    if (punctuationErrors > 0) errors.push({ type: 'Thừa từ', count: punctuationErrors });
    
    // Nếu không có lỗi nào được phát hiện, vẫn đảm bảo tạo một đối tượng lỗi mặc định
    if (errors.length === 0) {
      errors.push({ type: 'Tổng quan', count: 0 });
    }
    
    // Tạo gợi ý cải thiện dựa trên phân tích lỗi
    generateImprovementSuggestions(errors, specificErrors, correctAnswers.length, errorDetails, completedAnswerCount);
    
    return errors;
  };
  
  // Tính khoảng cách Levenshtein để kiểm tra lỗi chính tả
  const levenshteinDistance = (a: string, b: string) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  };
  
  // Tạo script với các khoảng trống được đánh dấu
  const createScriptWithBlanks = (script: string, correctAnswers: string[], studentAnswers: string[]) => {
    const scriptWords = script.split(/\s+/);
    const result = [];
    
    // Tạo một bản sao của correctAnswers để đánh dấu khi đã sử dụng
    const usedCorrectAnswers = new Set();
    
    for (let i = 0; i < scriptWords.length; i++) {
      const word = scriptWords[i];
      const correctIndex = correctAnswers.findIndex((ans, idx) => 
        !usedCorrectAnswers.has(idx) && ans.toLowerCase() === word.toLowerCase()
      );
      
      if (correctIndex !== -1) {
        usedCorrectAnswers.add(correctIndex);
        result.push({
          word,
          isBlank: true,
          studentAnswer: studentAnswers[correctIndex] || '',
          index: correctIndex
        });
      } else {
        result.push({
          word,
          isBlank: false,
          studentAnswer: '',
          index: -1
        });
      }
    }
    
    return result;
  };
  
  // Lấy dữ liệu điểm theo tháng
  const fetchMonthlyScores = async (studentId: string) => {
    try {
      // Lấy tất cả bài làm đã hoàn thành của học sinh 6 tháng gần nhất
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data, error } = await supabase
        .from('student_answers')
        .select('completed_at, score')
        .eq('student_id', studentId)
        .eq('is_completed', true)
        .gte('completed_at', sixMonthsAgo.toISOString())
        .order('completed_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching monthly scores:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        // Không tạo dữ liệu mẫu nếu không có dữ liệu thực
        setMonthlyScores([]);
        return;
      }
      
      // Tính điểm trung bình cho mỗi tháng
      const scoresByMonth = {};
      data.forEach(item => {
        if (!item.completed_at) return;
        
        const date = new Date(item.completed_at);
        const month = date.getMonth() + 1; // Chuyển từ 0-11 thành 1-12
        const year = date.getFullYear();
        const monthKey = `${year}-${month}`;
        
        if (!scoresByMonth[monthKey]) {
          scoresByMonth[monthKey] = { total: 0, count: 0, month };
        }
        
        if (item.score !== null && item.score !== undefined) {
          scoresByMonth[monthKey].total += item.score;
          scoresByMonth[monthKey].count += 1;
        }
      });
      
      // Tính trung bình và định dạng kết quả
      const monthlyScoresData = Object.values(scoresByMonth).map((item: any) => ({
        month: item.month,
        score: item.count > 0 ? Math.round(item.total / item.count) : 0
      }));
      
      setMonthlyScores(monthlyScoresData);
    } catch (error) {
      console.error('Error in fetchMonthlyScores:', error);
      setMonthlyScores([]);
    }
  };
  
  // Tính toán thứ hạng trong lớp
  const calculateClassRanking = async (studentId: string, currentScore: number, studentLevel: string = 'good') => {
    try {
      // Lấy tất cả điểm số và cấp độ của học sinh cùng lớp
      const { data, error } = await supabase
        .from('student_answers')
        .select('student_id, score, student_level')
        .eq('question_id', id)
        .eq('is_completed', true)
        .order('score', { ascending: false });
      
      if (error) {
        console.error('Error fetching class scores:', error);
        setClassRank({ position: 1, total: 1, percentile: '100%' });
        return;
      }
      
      if (!data || data.length === 0) {
        // Không tạo dữ liệu mẫu, mặc định là vị trí đầu tiên nếu không có dữ liệu
        setClassRank({ position: 1, total: 1, percentile: '100%' });
        return;
      }
      
      // Lọc ra điểm số cao nhất của mỗi học sinh và tính điểm theo cấp độ
      const highestScoreByStudent = {};
      data.forEach(item => {
        if (item.score !== null && item.score !== undefined) {
          const studentIdKey = item.student_id;
          const level = item.student_level || 'good';
          let levelMultiplier = 10; // Mặc định cho học sinh giỏi
          
          if (level === 'weak') {
            levelMultiplier = 7;
          } else if (level === 'average') {
            levelMultiplier = 8;
          }
          
          // Tính điểm dựa trên cấp độ
          const adjustedScore = Math.round((item.score / 100) * levelMultiplier * 10);
          
          if (!highestScoreByStudent[studentIdKey] || adjustedScore > highestScoreByStudent[studentIdKey]) {
            highestScoreByStudent[studentIdKey] = adjustedScore;
          }
        }
      });
      
      // Tính điểm hiện tại dựa trên cấp độ
      let levelMultiplier = 10; // Mặc định cho học sinh giỏi
      if (studentLevel === 'weak') {
        levelMultiplier = 7;
      } else if (studentLevel === 'average') {
        levelMultiplier = 8;
      }
      
      const adjustedCurrentScore = Math.round((currentScore / 100) * levelMultiplier * 10);
      
      // Sắp xếp điểm từ cao đến thấp
      const sortedScores = Object.values(highestScoreByStudent).sort((a: any, b: any) => b - a);
      
      // Tìm vị trí của học sinh hiện tại
      const position = sortedScores.findIndex((score: any) => score === adjustedCurrentScore) + 1;
      const total = sortedScores.length;
      
      // Tính phần trăm
      const percentile = Math.round((position / total) * 100);
      const percentileText = `Top ${percentile}%`;
      
      setClassRank({ position, total, percentile: percentileText });
    } catch (error) {
      console.error('Error in calculateClassRanking:', error);
      // Giá trị mặc định an toàn thay vì dữ liệu mẫu
      setClassRank({ position: 1, total: 1, percentile: '100%' });
    }
  };

  // Tạo gợi ý cải thiện dựa trên phân tích lỗi
  const generateImprovementSuggestions = (
    errors: {type: string, count: number}[], 
    specificErrors: {
      numbers: number,
      dates: number,
      specialTerms: number,
      conjunctions: number,
      prepositions: number,
      completeMissing: number,
      similarSounding: number,
      properNouns: number,
      contextMisunderstanding: number
    },
    totalQuestions: number,
    errorDetails: {
      misspelledWords: string[],
      missedKeywords: string[],
      confusedPairs: {correct: string, student: string}[]
    },
    completedAnswerCount: number
  ) => {
    // Tính tỷ lệ đúng tổng thể
    const correctRatio = (totalQuestions - errors.reduce((sum, err) => sum + err.count, 0)) / totalQuestions;
    const completionRatio = completedAnswerCount / totalQuestions;
    
    // Mảng lưu điểm mạnh
    const strengths: string[] = [];
    
    // Mảng lưu điểm yếu
    const weaknesses: string[] = [];
    
    // Mảng lưu bài tập đề xuất
    const suggestedExercises: {title: string, description: string}[] = [];
    
    // ----- Phân tích điểm mạnh dựa trên dữ liệu thực tế -----
    
    // Điểm mạnh 1: Nếu tỷ lệ đúng cao
    if (correctRatio >= 0.7) {
      strengths.push(`Khả năng nghe và phân biệt các từ phổ biến rất tốt (đạt ${Math.round(correctRatio * 100)}% độ chính xác)`);
    }
    
    // Điểm mạnh 2: Nếu ít lỗi với số và ngày tháng
    if (specificErrors.numbers === 0 && specificErrors.dates === 0 && completedAnswerCount > 0) {
      strengths.push('Có thể nhận diện chính xác các số và ngày tháng trong bài nghe');
    }
    
    // Điểm mạnh 3: Nếu ít lỗi với từ nối và giới từ
    if (specificErrors.conjunctions === 0 && specificErrors.prepositions === 0 && completedAnswerCount > 0) {
      strengths.push('Nắm vững cách sử dụng từ nối và giới từ trong ngữ cảnh');
    }
    
    // Điểm mạnh 4: Nếu hoàn thành tất cả các câu
    if (specificErrors.completeMissing === 0 && completionRatio > 0.9) {
      strengths.push(`Tốc độ xử lý thông tin tốt, hoàn thành ${Math.round(completionRatio * 100)}% số câu hỏi`);
    }
    
    // Điểm mạnh 5: Nếu ít lỗi với tên riêng, địa điểm
    if (specificErrors.properNouns === 0 && completedAnswerCount > 0) {
      strengths.push('Nhận diện tốt tên riêng, địa điểm và tổ chức trong bài nghe');
    }
    
    // Điểm mạnh 6: Nếu ít từ bị nhầm lẫn âm tương tự
    if (specificErrors.similarSounding === 0 && completedAnswerCount > 0) {
      strengths.push('Phân biệt tốt các từ có âm tương tự nhau');
    }
    
    // Nếu không có đủ điểm mạnh và có làm bài, thêm điểm mạnh dựa trên tỷ lệ đúng
    if (strengths.length === 0 && completedAnswerCount > 0) {
      strengths.push(`Đã có nỗ lực hoàn thành bài tập với ${Math.round(completionRatio * 100)}% số câu hỏi`);
    }
    
    // Chỉ lấy tối đa 3 điểm mạnh đầu tiên
    while (strengths.length > 3) {
      strengths.pop();
    }
    
    // ----- Phân tích điểm yếu dựa trên dữ liệu thực tế -----
    
    // Lấy loại lỗi phổ biến nhất
    const sortedErrors = [...errors].sort((a, b) => b.count - a.count);
    
    // Điểm yếu 1: Lỗi về thuật ngữ chuyên ngành
    if (specificErrors.specialTerms > 0) {
      const exampleTerms = errorDetails.missedKeywords.slice(0, 2).join(', ');
      weaknesses.push(`Còn gặp khó khăn với các từ chuyên ngành (ví dụ: ${exampleTerms}${errorDetails.missedKeywords.length > 2 ? ',...' : ''})`);
    }
    
    // Điểm yếu 2: Lỗi với từ nối và giới từ
    if (specificErrors.conjunctions > 0 || specificErrors.prepositions > 0) {
      weaknesses.push(`Đôi khi bỏ sót hoặc nghe nhầm các từ nối và giới từ (${specificErrors.conjunctions + specificErrors.prepositions} lỗi)`);
    }
    
    // Điểm yếu 3: Lỗi bỏ trống nhiều câu
    if (specificErrors.completeMissing > 0 && specificErrors.completeMissing > totalQuestions * 0.2) {
      weaknesses.push(`Cần cải thiện khả năng nghe và ghi chú đồng thời (bỏ trống ${specificErrors.completeMissing}/${totalQuestions} câu)`);
    }
    
    // Điểm yếu 4: Lỗi với số và ngày tháng
    if (specificErrors.numbers > 0 || specificErrors.dates > 0) {
      weaknesses.push(`Gặp khó khăn khi nghe các thông tin số liệu và ngày tháng (${specificErrors.numbers + specificErrors.dates} lỗi)`);
    }
    
    // Điểm yếu 5: Lỗi với tên riêng và địa điểm
    if (specificErrors.properNouns > 0) {
      weaknesses.push('Cần cải thiện khả năng nhận diện tên riêng, địa điểm và tổ chức');
    }
    
    // Điểm yếu 6: Lỗi với từ có âm tương tự
    if (specificErrors.similarSounding > 0) {
      const examplePair = errorDetails.confusedPairs[0];
      let exampleText = '';
      if (examplePair) {
        exampleText = ` (ví dụ: nhầm "${examplePair.student}" thành "${examplePair.correct}")`;
      }
      weaknesses.push(`Hay nhầm lẫn giữa các từ có âm tương tự${exampleText}`);
    }
    
    // Điểm yếu 7: Lỗi chính tả
    const spellingError = errors.find(err => err.type === 'Sai chính tả');
    if (spellingError && spellingError.count > 0) {
      weaknesses.push(`Cần cẩn thận hơn với lỗi chính tả khi nghe (${spellingError.count} lỗi)`);
    }
    
    // Điểm yếu 8: Hiểu sai ngữ cảnh
    if (specificErrors.contextMisunderstanding > 0) {
      weaknesses.push('Đôi khi hiểu sai ngữ cảnh hoặc không nắm được ý chính của đoạn nghe');
    }
    
    // Nếu không có đủ điểm yếu và có làm bài, thêm điểm yếu dựa trên loại lỗi phổ biến nhất
    if (weaknesses.length === 0 && sortedErrors.length > 0 && sortedErrors[0].count > 0) {
      weaknesses.push(`Cần cải thiện lỗi ${sortedErrors[0].type.toLowerCase()} (${sortedErrors[0].count} lỗi)`);
    }
    
    // Chỉ lấy tối đa 3 điểm yếu đầu tiên
    while (weaknesses.length > 3) {
      weaknesses.pop();
    }
    
    // ----- Tạo bài tập đề xuất dựa trên phân tích cụ thể -----
    
    // Bài tập 1: Luyện tập từ vựng chuyên ngành nếu có nhiều lỗi về từ chuyên ngành
    if (specificErrors.specialTerms > 0) {
      suggestedExercises.push({
        title: 'Luyện tập từ vựng chuyên ngành',
        description: `Tập trung vào ${Math.min(10, specificErrors.specialTerms * 2)} bài tập với từ vựng chuyên ngành thường gặp`
      });
    }
    
    // Bài tập 2: Luyện tập từ nối và giới từ nếu có nhiều lỗi về từ nối và giới từ
    if (specificErrors.conjunctions > 0 || specificErrors.prepositions > 0) {
      suggestedExercises.push({
        title: 'Tập trung vào giới từ và từ nối',
        description: `${Math.min(8, specificErrors.conjunctions + specificErrors.prepositions + 3)} bài tập nhấn mạnh việc sử dụng từ nối và giới từ trong ngữ cảnh`
      });
    }
    
    // Bài tập 3: Luyện tập nghe nhanh nếu có nhiều lỗi bỏ trống
    if (specificErrors.completeMissing > totalQuestions * 0.2) {
      suggestedExercises.push({
        title: 'Luyện tập nghe nhanh và ghi chú',
        description: `${Math.min(10, specificErrors.completeMissing + 3)} bài tập giúp cải thiện tốc độ nghe và ghi chú đồng thời`
      });
    }
    
    // Bài tập 4: Luyện tập số và ngày tháng nếu có lỗi về số và ngày tháng
    if (specificErrors.numbers > 0 || specificErrors.dates > 0) {
      suggestedExercises.push({
        title: 'Luyện tập với số và ngày tháng',
        description: `${Math.min(8, specificErrors.numbers + specificErrors.dates + 2)} bài tập tập trung vào nghe và nhận diện các số và ngày tháng`
      });
    }
    
    // Bài tập 5: Luyện tập tên riêng và địa điểm
    if (specificErrors.properNouns > 0) {
      suggestedExercises.push({
        title: 'Luyện tập nhận diện tên riêng và địa điểm',
        description: `${Math.min(6, specificErrors.properNouns + 3)} bài tập với tên người, địa điểm và tổ chức`
      });
    }
    
    // Bài tập 6: Luyện tập phân biệt từ có âm tương tự
    if (specificErrors.similarSounding > 0) {
      suggestedExercises.push({
        title: 'Phân biệt từ có âm tương tự',
        description: `${Math.min(8, specificErrors.similarSounding + 4)} bài tập giúp phân biệt các từ thường bị nhầm lẫn khi nghe`
      });
    }
    
    // Bài tập 7: Luyện tập ngữ cảnh
    if (specificErrors.contextMisunderstanding > 0) {
      suggestedExercises.push({
        title: 'Hiểu ngữ cảnh và ý chính',
        description: '5 bài tập giúp nắm bắt ý chính và hiểu ngữ cảnh đoạn hội thoại'
      });
    }
    
    // Nếu không có đủ bài tập đề xuất, thêm một bài tập chung
    if (suggestedExercises.length === 0) {
      suggestedExercises.push({
        title: 'Luyện tập nghe tổng hợp',
        description: '10 bài tập nghe đa dạng giúp cải thiện kỹ năng nghe tổng quát'
      });
    }
    
    // Chỉ lấy tối đa 2 bài tập đề xuất phù hợp nhất
    if (suggestedExercises.length > 2) {
      // Sắp xếp theo mức độ ưu tiên dựa trên số lỗi
      const priorityMap = {
        'Luyện tập từ vựng chuyên ngành': specificErrors.specialTerms * 2,
        'Tập trung vào giới từ và từ nối': (specificErrors.conjunctions + specificErrors.prepositions) * 1.5,
        'Luyện tập nghe nhanh và ghi chú': specificErrors.completeMissing * 1.8,
        'Luyện tập với số và ngày tháng': (specificErrors.numbers + specificErrors.dates) * 1.2,
        'Luyện tập nhận diện tên riêng và địa điểm': specificErrors.properNouns * 1.3,
        'Phân biệt từ có âm tương tự': specificErrors.similarSounding * 1.7,
        'Hiểu ngữ cảnh và ý chính': specificErrors.contextMisunderstanding * 1.4
      };
      
      suggestedExercises.sort((a, b) => {
        const priorityA = priorityMap[a.title] || 0;
        const priorityB = priorityMap[b.title] || 0;
        return priorityB - priorityA;
      });
      
      suggestedExercises.splice(2); // Giữ lại 2 bài tập đầu tiên
    }
    
    // Cập nhật state với các gợi ý
    setImprovementSuggestions({
      strengths,
      weaknesses,
      suggestedExercises
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  // Xác định xếp loại dựa trên điểm số
  const getScoreRating = (score: number) => {
    if (score >= 90) return 'Xuất sắc';
    if (score >= 80) return 'Tốt';
    if (score >= 70) return 'Khá';
    if (score >= 60) return 'Trung bình';
    if (score >= 50) return 'Yếu';
    return 'Kém';
  };
  
  // Xác định thông điệp dựa trên xếp loại
  const getRatingMessage = (score: number) => {
    if (score >= 80) return 'Tiếp tục phát huy';
    if (score >= 70) return 'Tiếp tục duy trì';
    if (score >= 60) return 'Cần cải thiện thêm';
    return 'Cần nỗ lực nhiều hơn';
  };

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Có lỗi xảy ra</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex flex-col space-y-2">
              <Button onClick={() => navigate('/student/dashboard')} variant="default">
                Quay lại danh sách bài tập
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Tải lại trang
              </Button>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (!data || !data.question || !data.studentAnswer) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy thông tin bài làm</h2>
            <p className="text-gray-600 mb-6">
              Không thể hiển thị kết quả bài làm. ID: {id}.<br/>
              Có thể bài làm chưa được hoàn thành hoặc đã bị xóa.
            </p>
            <div className="flex flex-col space-y-2">
              <Button onClick={() => navigate('/student/dashboard')} variant="default">
                Quay lại danh sách bài tập
              </Button>
              <Button onClick={() => navigate(`/student/question/${id}`)} variant="outline">
                Làm lại bài này
              </Button>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  const { question, studentAnswer } = data;

  return (
    <StudentLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center mb-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigate('/student/progress')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-xl">{question.title}</CardTitle>
                <CardDescription>
                  Giáo viên: {question.profiles?.full_name}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-800">
                Lần làm: {attempt}
              </Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-800">
                <Clock className="h-3 w-3 mr-1" />
                {question.time_limit} phút
              </Badge>
              <Badge variant="outline" className="bg-gray-50 text-gray-800">
                Độ khó: {question.difficulty}
              </Badge>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                Hoàn thành: {formatDate(studentAnswer.completed_at)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Hiển thị tổng quan và thứ hạng */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-500 mb-1">Điểm số của bạn</div>
                <div className="text-4xl font-bold mb-2 tracking-tight">
                  <span className={getScoreColor(score || 0)}>{score || 0}</span>
                </div>
                <p className="text-gray-600">{score ? getScoreRating(score) : 'Chưa có điểm'}</p>
              </div>
              
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-500 mb-1">Xếp loại hiện tại của bạn</div>
                <div className="text-2xl font-bold mb-2 tracking-tight">
                  <span className={getScoreColor(score || 0)}>{score ? getScoreRating(score) : 'Chưa xếp loại'}</span>
                </div>
                <p className="text-gray-600">{score ? getRatingMessage(score) : 'Hãy hoàn thành bài tập'}</p>
              </div>
              
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-500 mb-1">Vị trí của bạn trong lớp</div>
                <div className="text-2xl font-bold mb-2 tracking-tight">
                  <span className="text-blue-600">{classRank.position} / {classRank.total}</span>
                </div>
                <p className="text-gray-600">{classRank.percentile}</p>
              </div>
            </div>

            {/* Student answers table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 p-3 font-medium">
                <div className="flex items-center">
                  <List className="h-4 w-4 mr-2" />
                  Kết quả chi tiết
                </div>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Từ cần điền</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đáp án của bạn</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {correctAnswers.map((correctAns, index) => {
                    const studentAns = studentAnswer.answers[index] || '';
                    const isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase();
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{index + 1}</td>
                        <td className="py-3 px-4 text-sm font-medium">{correctAns}</td>
                        <td className="py-3 px-4 text-sm">
                          {studentAns || <span className="text-gray-400 italic">Không có đáp án</span>}
                        </td>
                        <td className="py-3 px-4">
                          {isCorrect ? (
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              <span>Đúng</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-red-600">
                              <XCircle className="h-4 w-4 mr-1" />
                              <span>Sai</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Full script with highlighted blanks */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 p-3 font-medium">
                <div className="flex items-center">
                  <List className="h-4 w-4 mr-2" />
                  Bài làm đầy đủ
                </div>
              </div>
              <div className="p-4">
                <p className="text-gray-800 leading-relaxed">
                  {scriptWithBlanks.map((item, idx) => (
                    <Fragment key={idx}>
                      {item.isBlank ? (
                        <span className={`px-1 py-0.5 mx-1 rounded ${
                          item.studentAnswer.toLowerCase() === item.word.toLowerCase() 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {item.studentAnswer || '___'}
                        </span>
                      ) : (
                        <span className="mx-1">{item.word}</span>
                      )}
                      {(idx + 1) % 15 === 0 && <br />}
                    </Fragment>
                  ))}
                </p>
              </div>
            </div>

            {/* Gợi ý cải thiện */}
            <div className="mt-8 border rounded-lg overflow-hidden">
              <div className="bg-gray-100 p-3 font-medium">
                <div className="flex items-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13 10V3L4 14h7v7l9-11h-7z" 
                    />
                  </svg>
                  Gợi ý cải thiện
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2">Những điểm cần cải thiện để nâng cao kết quả</h3>
                
                <div className="mb-5">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    Điểm mạnh
                  </h4>
                  <ul className="list-disc pl-5 space-y-2">
                    {improvementSuggestions.strengths.map((strength, idx) => (
                      <li key={idx} className="text-gray-700">{strength}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="mb-5">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                    Điểm yếu
                  </h4>
                  <ul className="list-disc pl-5 space-y-2">
                    {improvementSuggestions.weaknesses.map((weakness, idx) => (
                      <li key={idx} className="text-gray-700">{weakness}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                    Bài tập đề xuất
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {improvementSuggestions.suggestedExercises.map((exercise, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 border rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer shadow-sm"
                      >
                        <h5 className="font-medium text-blue-800">{exercise.title}</h5>
                        <p className="text-sm text-gray-600 mt-2">{exercise.description}</p>
                        <div className="mt-3 text-right">
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            Đề xuất ưu tiên #{idx + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="rounded-lg border border-dashed border-gray-300 p-3 bg-gray-50">
                  <p className="text-sm text-gray-600 italic">
                    Gợi ý được tạo dựa trên phân tích {data?.studentAnswer?.answers?.length || 0} câu trả lời của bạn. 
                    Việc luyện tập thường xuyên với các bài tập đề xuất sẽ giúp cải thiện kết quả.
                  </p>
                </div>
              </div>
            </div>

            {/* Ôn tập từ vựng sau bài làm */}
            <Card className="my-6">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <BookCheck className="h-5 w-5 mr-2" />
                    Ôn tập từ vựng
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  Ôn tập các từ vựng khó trong bài kiểm tra sẽ giúp bạn nhớ lâu hơn.
                </p>
              </CardContent>
            </Card>

            {/* Bảng xếp hạng theo cấp độ */}
            <div className="mt-6 border rounded-lg overflow-hidden">
              <div className="bg-gray-100 p-3 font-medium">
                <div className="flex items-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                    />
                  </svg>
                  Bảng xếp hạng theo cấp độ
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm mb-4">
                  Xếp hạng của bạn được tính dựa trên cấp độ:
                  <ul className="list-disc pl-5 mt-2">
                    <li>Học sinh giỏi: 10 × % đúng</li>
                    <li>Học sinh trung bình: 8 × % đúng</li>
                    <li>Học sinh yếu: 7 × % đúng</li>
                  </ul>
                </p>
                <div className="p-3 border border-blue-200 rounded-md bg-blue-50 mb-4">
                  <p className="text-xs text-gray-600">
                    <span className="text-blue-700 font-semibold">Công thức tính điểm</span>: Điểm gốc (tỷ lệ % đúng) × Hệ số cấp độ.<br/>
                    Điểm theo cấp độ giúp so sánh công bằng giữa các học sinh có trình độ khác nhau. Học sinh yếu sẽ có hệ số thấp hơn để khuyến khích cải thiện kết quả.
                  </p>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Cấp độ của bạn</div>
                    <div className="text-lg font-semibold mb-2">
                      {studentAnswer.student_level === 'weak' ? 'Học sinh yếu' : 
                       studentAnswer.student_level === 'average' ? 'Học sinh trung bình' : 'Học sinh giỏi'}
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Điểm gốc:</span>
                      <span className="text-sm font-semibold">{score || 0}%</span>
                    </div>
                    <div className="flex justify-between mb-4">
                      <span className="text-sm text-gray-600">Điểm theo cấp độ:</span>
                      <span className="text-sm font-semibold text-blue-600">{adjustedScore || 0}</span>
                    </div>
                    <div className="flex justify-center items-center mt-2">
                      <div className="bg-gray-200 h-2 w-full max-w-xs rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full" 
                          style={{ 
                            width: `${Math.min(100, classRank.position / Math.max(1, classRank.total) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      Vị trí {classRank.position} trong {classRank.total} học sinh ({classRank.percentile})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div>
              <Button variant="outline" onClick={() => navigate('/student/progress')} className="mr-2">
                Quay lại kết quả
              </Button>
              <Button variant="secondary" onClick={() => navigate('/student/dashboard')}>
                Về trang chủ
              </Button>
            </div>
            <Button onClick={() => navigate(`/student/question/${id}`)}>
              Làm lại bài này
            </Button>
          </CardFooter>
        </Card>
      </div>
    </StudentLayout>
  );
};

export default ResultPage; 