import { supabase } from "./supabase";

// API Key (sử dụng cùng API key như trong Supabase config)
export const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2lncXR2b3dmdHpyaXF2eml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mjk2NTAsImV4cCI6MjA1ODAwNTY1MH0.wOUqO1V261MA_NGTnmf_1TkwYB-yhgtRCd0rtqxpbyM';
export const SUPABASE_URL = 'https://tscigqtvowftzriqvzit.supabase.co';

// Interface cho dữ liệu bài làm của học sinh
interface StudentAnswerData {
  recordId: string;
  answers: string[];
  completedAt: Date | string;
  cheatingAttempts: number;
}

type SubmitAnswersParams = {
  recordId: string;
  answers: string[];
  completedAt: Date;
  cheatingAttempts?: number;
  correctAnswers?: string[];
  metadata?: object;
};

let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

/**
 * Handle Supabase API requests with automatic session refresh when needed
 * @param requestFn The function that makes the Supabase API request
 * @param retryCount Number of retries attempted so far
 * @returns The result of the API request
 */
export async function handleApiRequest<T>(
  requestFn: () => Promise<{ data: T | null; error: any | null }>,
  retryCount = 0
): Promise<{ data: T | null; error: any | null }> {
  try {
    // Execute the request
    const response = await requestFn();
    
    // If successful or not an auth error, return the response
    if (!response.error || !isAuthError(response.error)) {
      return response;
    }
    
    // If we've retried too many times, give up
    if (retryCount >= 2) {
      console.error('API request failed after retries:', response.error);
      return response;
    }
    
    // Try to refresh the session
    await refreshSession();
    
    // Retry the request
    return handleApiRequest(requestFn, retryCount + 1);
  } catch (error) {
    console.error('API request error:', error);
    return { data: null, error };
  }
}

/**
 * Check if an error is an authentication error
 */
function isAuthError(error: any): boolean {
  if (!error) return false;
  
  // Check for specific error codes
  if (typeof error.code === 'string') {
    return [
      '401', 
      'PGRST116', 
      'PGRST301',
      'UNAUTHENTICATED'
    ].includes(error.code);
  }
  
  // Check error message
  if (typeof error.message === 'string') {
    const authErrorMessages = [
      'JWT expired',
      'invalid token',
      'not authenticated',
      'invalid claim',
      'authentication required'
    ];
    
    return authErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }
  
  return false;
}

/**
 * Refresh the Supabase session
 */
async function refreshSession(): Promise<void> {
  // If already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return;
  }
  
  try {
    isRefreshing = true;
    refreshPromise = (async () => {
      console.log('Refreshing Supabase session');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        // Try getting current session one more time
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          // Session is truly invalid, clear local storage to force re-login
          window.dispatchEvent(new Event('supabase.auth.signout'));
          window.dispatchEvent(new Event('supabase.connection.lost'));
          console.warn('Session is invalid, user needs to log in again');
        }
      } else {
        console.log('Session refreshed successfully');
        // Thông báo cho toàn bộ ứng dụng biết session đã được làm mới
        window.dispatchEvent(new Event('supabase.data.refresh'));
        window.dispatchEvent(new Event('supabase.connection.restored'));
      }
    })();
    
    await refreshPromise;
  } catch (error) {
    console.error('Session refresh failed:', error);
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

/**
 * Submit student answers using multiple approaches
 * @returns success status and message
 */
export const submitStudentAnswers = async (params: SubmitAnswersParams): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('Submitting answers with API helper...');
  
  try {
    const { data, error } = await supabase
      .from('student_answers')
      .update({
        answers: params.answers,
        answers_text: JSON.stringify(params.answers),
        completed_at: params.completedAt.toISOString(),
        is_completed: true,
        cheating_attempts: params.cheatingAttempts || 0,
        updated_at: new Date().toISOString(),
        correct_answers_text: params.correctAnswers ? JSON.stringify(params.correctAnswers) : undefined
        // Tạm thời comment metadata đến khi thêm cột vào DB
        // metadata: params.metadata ? JSON.stringify(params.metadata) : undefined
      })
      .eq('id', params.recordId)
      .select();

    if (error) throw error;
    return { success: true, message: 'Nộp bài thành công', data };
  } catch (error) {
    console.error('Error submitting answers:', error);
    return { success: false, message: 'Error submitting answers' };
  }
};

// Đơn giản hóa hàm submitAnswersText để chỉ sử dụng RPC mới
export const submitAnswersText = async (
  recordId: string,
  answersJson: string
): Promise<{ success: boolean; message: string; data?: any }> => {
  console.log('Submitting answers_text with API helper...');
  
  try {
    const completedAt = new Date();
    const cheatingAttempts = 0; // Default to 0 if not specified
    
    // PHƯƠNG PHÁP 1: Dùng RPC
    console.log('API Helper: Trying submit_student_answer_text RPC...');
    try {
      const { data, error } = await supabase.rpc('submit_student_answer_text', {
        p_record_id: recordId,
        p_answers_text: answersJson,
        p_completed_at: completedAt.toISOString(),
        p_cheating_attempts: cheatingAttempts
      });
      
      if (error) {
        console.error('API Helper: submit_student_answer_text failed:', error);
      } else {
        console.log('API Helper: submit_student_answer_text success!', data);
        
        // Kiểm tra kết quả sau khi cập nhật
        await verifySubmission(recordId);
        
        return {
          success: true,
          message: 'Nộp bài thành công',
          data
        };
      }
    } catch (rpcError) {
      console.error('API Helper: Exception with submit_student_answer_text RPC:', rpcError);
    }
    
    // PHƯƠNG PHÁP 2: Update SQL trực tiếp với cột answers_text
    console.log('API Helper: Trying direct REST API update with answers_text...');
    try {
      const apiUrl = `${SUPABASE_URL}/rest/v1/student_answers?id=eq.${recordId}`;
      
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
          'Authorization': `Bearer ${API_KEY}`,
          'Prefer': 'return=representation',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          answers_text: answersJson,
          completed_at: completedAt.toISOString(),
          is_completed: true,
          cheating_attempts: cheatingAttempts,
          updated_at: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Helper: REST API update for answers_text failed:', response.status, errorText);
        throw new Error(`REST API failed: ${response.status} ${errorText}`);
      }
      
      const data = await response.text();
      console.log('API Helper: REST API update for answers_text successful!', data);
      
      // Kiểm tra kết quả sau khi cập nhật
      await verifySubmission(recordId);
      
      return {
        success: true,
        message: 'Nộp bài thành công với cột answers_text',
        data: JSON.parse(data || '{}')
      };
    } catch (restError) {
      console.error('API Helper: Exception with REST API for answers_text:', restError);
      throw restError;
    }
  } catch (error) {
    console.error('API Helper: General error in submitAnswersText:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi không xác định'
    };
  }
};

// Hàm kiểm tra xem dữ liệu đã được cập nhật thành công chưa
async function verifySubmission(recordId: string): Promise<void> {
  try {
    console.log('Verifying submission data after update...');
    
    // Kiểm tra qua direct API để tránh lỗi 406
    const apiUrl = `${SUPABASE_URL}/rest/v1/student_answers?id=eq.${recordId}&select=id,student_id,question_id,completed_at,answers,answers_text,is_completed,updated_at`;
    
    console.log('Checking via direct API:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Error verifying submission:', response.status, await response.text());
      return;
    }
    
    const records = await response.json();
    const data = records && records.length > 0 ? records[0] : null;
    
    console.log('Verification result:', data);
    
    // Log chi tiết từng trường kiểm tra
    if (data) {
      console.log('Submission verification details:');
      console.log('- id:', data.id);
      console.log('- student_id:', data.student_id);
      console.log('- question_id:', data.question_id);
      console.log('- completed_at:', data.completed_at ? 'SET' : 'NOT SET');
      console.log('- is_completed:', data.is_completed ? 'TRUE' : 'FALSE');
      console.log('- answers:', data.answers ? `Array with ${Array.isArray(data.answers) ? data.answers.length : 'unknown'} items` : 'NULL');
      console.log('- answers_text:', data.answers_text ? 'HAS VALUE' : 'NULL');
      console.log('- updated_at:', data.updated_at || 'NOT SET');
      
      if (data.completed_at) {
        console.log('✅ Submission verified - completed_at is set');
      } else {
        console.warn('⚠️ Submission may not be complete - completed_at is not set');
      }
      
      if (!data.answers || (Array.isArray(data.answers) && data.answers.length === 0)) {
        console.warn('⚠️ Answers array is empty or null - this might cause issues with completed status detection');
      }
    } else {
      console.warn('⚠️ No data returned for verification - record may not exist');
    }
  } catch (verifyError) {
    console.error('Exception during verification:', verifyError);
  }
}

// Hàm đơn giản để cập nhật trạng thái nộp bài
export const markAssignmentAsCompleted = async (recordId: string): Promise<boolean> => {
  try {
    console.log('Marking assignment as completed using direct API call');
    
    // Đầu tiên kiểm tra bản ghi hiện tại để xem có answers hay chưa
    const apiCheckUrl = `${SUPABASE_URL}/rest/v1/student_answers?id=eq.${recordId}&select=answers,answers_text`;
    const checkResponse = await fetch(apiCheckUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });
      
    if (!checkResponse.ok) {
      console.error('Error checking assignment:', checkResponse.status, await checkResponse.text());
      return false;
    }
    
    const records = await checkResponse.json();
    const data = records && records.length > 0 ? records[0] : null;
    
    // Chuẩn bị payload cho việc cập nhật
    const updatePayload: any = {
      is_completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Nếu chưa có answers, thêm một mảng trống vào
    if (!data?.answers || data.answers.length === 0) {
      updatePayload.answers = [''];
    }
    
    // Nếu chưa có answers_text, thêm vào
    if (!data?.answers_text) {
      updatePayload.answers_text = JSON.stringify(['']);
    }
    
    const apiUrl = `${SUPABASE_URL}/rest/v1/student_answers?id=eq.${recordId}`;
    
    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Prefer': 'return=minimal',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error marking assignment as completed:', response.status, errorText);
      return false;
    }
    
    console.log('Successfully marked assignment as completed with payload:', updatePayload);
    return true;
  } catch (error) {
    console.error('Exception marking assignment as completed:', error);
    return false;
  }
};

// Tìm hàm debugRLS và sửa như sau
export const debugRLS = async (tableName: string, userId: string) => {
  try {
    console.log(`Checking RLS policies for table '${tableName}' with user ID: ${userId}`);

    // Kiểm tra xem function có tồn tại không trước khi gọi
    const { data: functionExists, error: checkError } = await supabase
      .rpc('check_function_exists', { function_name: 'get_policies_for_table' });
      
    if (checkError || !functionExists) {
      // Nếu function không tồn tại, sử dụng phương pháp truy cập trực tiếp
      console.log('Attempting direct table access...');
      
      // Thử truy cập bảng trực tiếp để xem có quyền không
      const { data: directAccessData, error: directAccessError } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);
        
      if (directAccessError) {
        console.error(`Error accessing table directly: ${directAccessError.message}`);
      } else {
        console.log(`Successfully accessed table '${tableName}'. Sample data:`, directAccessData);
      }
      
      return;
    }
    
    // Nếu function tồn tại, sử dụng nó
    const { data: policies, error } = await supabase
      .rpc('get_policies_for_table', { p_table_name: tableName });
      
    if (error) {
      console.log(`Error fetching policies: ${error}`);
      return;
    }
    
    console.log(`Policies for table '${tableName}':`, policies);
  } catch (error) {
    console.error(`Exception in debugRLS: ${error}`);
  }
}; 