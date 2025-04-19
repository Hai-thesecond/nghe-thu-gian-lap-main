import { createClient } from '@supabase/supabase-js';

// Export supabaseUrl for use elsewhere
export const supabaseUrl = 'https://tscigqtvowftzriqvzit.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2lncXR2b3dmdHpyaXF2eml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mjk2NTAsImV4cCI6MjA1ODAwNTY1MH0.wOUqO1V261MA_NGTnmf_1TkwYB-yhgtRCd0rtqxpbyM';

// Define a service role key if available (higher privileges)
// In production, this should be kept secure and only used server-side
// For educational purposes only - replace with your actual service key if available
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2lncXR2b3dmdHpyaXF2eml0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjQyOTY1MCwiZXhwIjoyMDU4MDA1NjUwfQ.6Xtwr2j8aiXHSqOP0s5VPOgfnFKv8EErKU7XioQHW-Q';

// Log the connection details (excluding the full key for security)
console.log("Supabase Configuration:", {
  url: supabaseUrl,
  keyProvided: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length || 0,
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 5) + '...' : 'missing',
  serviceKeyAvailable: !!supabaseServiceKey
});

// Create a Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'dictation-app',
      'Accept': 'application/json'
    },
    fetch: (...args: Parameters<typeof fetch>) => {
      // Log the request for debugging
      console.log("DEBUG-FETCH: Regular client request to:", args[0]);
      
      // Ensure Accept header is included in every request
      if (args[1] && typeof args[1] === 'object') {
        const options = args[1] as RequestInit;
        
        // Always ensure headers object exists
        if (!options.headers) {
          options.headers = { 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          };
        } else {
          // Handle different header formats
          if (options.headers instanceof Headers) {
            if (!options.headers.has('Accept')) {
              options.headers.append('Accept', 'application/json');
            }
            if (!options.headers.has('Content-Type') && options.method !== 'GET') {
              options.headers.append('Content-Type', 'application/json');
            }
          } else if (Array.isArray(options.headers)) {
            const hasAcceptHeader = options.headers.some(pair => 
              pair[0].toLowerCase() === 'accept'
            );
            if (!hasAcceptHeader) {
              options.headers.push(['Accept', 'application/json']);
            }
            
            const hasContentType = options.headers.some(pair => 
              pair[0].toLowerCase() === 'content-type'
            );
            if (!hasContentType && options.method !== 'GET') {
              options.headers.push(['Content-Type', 'application/json']);
            }
          } else if (typeof options.headers === 'object') {
            const headerObj = options.headers as Record<string, string>;
            const hasAcceptHeader = Object.keys(headerObj)
              .some(key => key.toLowerCase() === 'accept');
            if (!hasAcceptHeader) {
              headerObj['Accept'] = 'application/json';
            }
            
            const hasContentType = Object.keys(headerObj)
              .some(key => key.toLowerCase() === 'content-type');
            if (!hasContentType && options.method !== 'GET') {
              headerObj['Content-Type'] = 'application/json';
            }
          }
        }
      } else {
        // If no options object, create one with necessary headers
        args[1] = {
          headers: {
            'Accept': 'application/json'
          }
        };
      }
      
      return fetch(...args);
    }
  }
});

// Create a service role client with admin privileges
// This should only be used for operations that require bypassing RLS policies
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'X-Client-Info': 'dictation-app-admin',
          'Accept': 'application/json'
        },
        fetch: (...args: Parameters<typeof fetch>) => {
          // Log the request for debugging  
          console.log("DEBUG-FETCH: Admin client request to:", args[0]);
          
          // Ensure Accept header is included in every request for admin client too
          if (args[1] && typeof args[1] === 'object') {
            const options = args[1] as RequestInit;
            
            // Always ensure headers object exists
            if (!options.headers) {
              options.headers = { 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              };
            } else {
              // Handle different header formats
              if (options.headers instanceof Headers) {
                if (!options.headers.has('Accept')) {
                  options.headers.append('Accept', 'application/json');
                }
                if (!options.headers.has('Content-Type') && options.method !== 'GET') {
                  options.headers.append('Content-Type', 'application/json');
                }
              } else if (Array.isArray(options.headers)) {
                const hasAcceptHeader = options.headers.some(pair => 
                  pair[0].toLowerCase() === 'accept'
                );
                if (!hasAcceptHeader) {
                  options.headers.push(['Accept', 'application/json']);
                }
                
                const hasContentType = options.headers.some(pair => 
                  pair[0].toLowerCase() === 'content-type'
                );
                if (!hasContentType && options.method !== 'GET') {
                  options.headers.push(['Content-Type', 'application/json']);
                }
              } else if (typeof options.headers === 'object') {
                const headerObj = options.headers as Record<string, string>;
                const hasAcceptHeader = Object.keys(headerObj)
                  .some(key => key.toLowerCase() === 'accept');
                if (!hasAcceptHeader) {
                  headerObj['Accept'] = 'application/json';
                }
                
                const hasContentType = Object.keys(headerObj)
                  .some(key => key.toLowerCase() === 'content-type');
                if (!hasContentType && options.method !== 'GET') {
                  headerObj['Content-Type'] = 'application/json';
                }
              }
            }
          } else {
            // If no options object, create one with necessary headers
            args[1] = {
              headers: {
                'Accept': 'application/json'
              }
            };
          }
          
          return fetch(...args);
        }
      }
    })
  : supabase; // Fallback to regular client if no service key is available

// Helper function to check if user is authenticated
export const checkAuth = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Auth error:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
};

// Helper function to check if user is a teacher
export const isTeacher = async () => {
  try {
    const session = await checkAuth();
    if (!session?.user) return false;

    // Check if user exists in teachers table
    const { data, error } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      console.error('Error checking teacher role:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking teacher role:', error);
    return false;
  }
};

// Helper function to upload file to storage
export const uploadFile = async (
  filePath: string,
  file: File
) => {
  try {
    console.log('Starting file upload:', filePath);
    
    // First check if user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      console.error('Authentication error:', authError);
      throw new Error('User must be authenticated to upload files');
    }
    
    // Validate file type and size
    if (!file.type.startsWith('audio/')) {
      throw new Error('Invalid file type. Only audio files are allowed.');
    }
    
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit. Maximum size allowed is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    
    console.log('File validation passed, proceeding with upload');
    
    // Upload directly without checking bucket
    console.log('Uploading file to path:', filePath);
    console.log('File details:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type
    });
    
    const { data, error } = await supabase.storage
      .from('dictation')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
      
    if (error) {
      console.error('Upload error details:', error);
      // Enhanced error message based on error type
      let errorMessage = 'Failed to upload file';
      if (error.message.includes('storage quota')) {
        errorMessage = 'Storage quota exceeded';
      } else if (error.message.includes('not found')) {
        errorMessage = 'Storage bucket not found';
      }
      throw new Error(errorMessage);
    }
    
    console.log('Upload successful:', data);
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('dictation')
      .getPublicUrl(filePath);
    
    console.log('Generated public URL:', publicUrl);
    
    return {
      data,
      publicUrl,
      error: null
    };

  } catch (error: any) {
    console.error('Error in uploadFile (detailed):', error);
    // Return structured error with user-friendly message
    return {
      data: null,
      publicUrl: null,
      error: {
        message: error.message || 'An unexpected error occurred during file upload',
        code: error.code || 'UNKNOWN_ERROR',
        details: error
      }
    };
  }
};

// Test connection immediately
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.id);
});

// Test storage access
const testStorage = async () => {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Storage test failed:', error);
    } else {
      console.log('Available storage buckets:', buckets);
    }
  } catch (error) {
    console.error('Storage test error:', error);
  }
};

testStorage();

// Helper function for file uploads that bypasses RLS if needed
export const directUpload = async (
  bucket: string,
  path: string,
  file: File
): Promise<{ data: any | null; error: Error | null }> => {
  try {
    console.log('Attempting direct upload via fetch API...');
    
    // Get file size in MB for smarter upload strategy
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
    
    // For files under 5MB, upload directly without chunking
    if (fileSizeMB < 5) {
      console.log('Small file detected (<5MB), uploading directly...');
      
      // Create a URL for direct upload
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
      console.log('Direct upload URL:', uploadUrl);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload directly using fetch
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          // Use the anon key for public requests
          'Authorization': `Bearer ${supabaseAnonKey}`,
          // No Content-Type header - let the browser set it with the boundary
        },
        body: formData
      });
      
      // Check for success
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Direct upload failed:', errorData);
        return { 
          data: null, 
          error: new Error(`Direct upload failed: ${response.status} ${response.statusText}`) 
        };
      }
      
      // Get the response
      const data = await response.json();
      console.log('Direct upload successful:', data);
      
      return { data, error: null };
    } 
    // For larger files, use a max of 5 chunks instead of 60
    else {
      console.log('Larger file detected (>5MB), using chunked upload with 5 chunks max...');
      
      // Create a URL for direct upload
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
      
      // Create smaller chunks for upload - max 5 chunks regardless of size
      const CHUNK_COUNT = 5;
      const chunkSize = Math.ceil(file.size / CHUNK_COUNT);
      
      // Track overall progress
      let overallProgress = 0;
      
      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < CHUNK_COUNT; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        
        // Extract the chunk from the file
        const chunk = file.slice(start, end);
        
        // Create form data for this chunk
        const formData = new FormData();
        formData.append('file', chunk, file.name);
        
        // Add metadata about the chunk
        if (chunkIndex < CHUNK_COUNT - 1) {
          // This is not the last chunk
          formData.append('chunk_num', chunkIndex.toString());
          formData.append('chunk_count', CHUNK_COUNT.toString());
        }
        
        console.log(`Uploading chunk ${chunkIndex + 1}/${CHUNK_COUNT} (${((end-start)/1024/1024).toFixed(1)}MB)...`);
        
        // Upload this chunk
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Chunk ${chunkIndex + 1} upload failed:`, errorData);
          return { 
            data: null, 
            error: new Error(`Chunk upload failed: ${response.status} ${response.statusText}`) 
          };
        }
        
        // Update progress (20% per chunk)
        overallProgress = ((chunkIndex + 1) / CHUNK_COUNT) * 100;
        console.log(`Upload progress: ${overallProgress.toFixed(0)}%`);
      }
      
      console.log('Chunked upload completed successfully');
      return { 
        data: { path }, 
        error: null 
      };
    }
  } catch (err) {
    console.error('Direct upload exception:', err);
    return { data: null, error: err as Error };
  }
};

// Setup storage permissions programmatically
const configureStoragePermissions = async (bucketName: string) => {
  console.log('Configuring storage permissions');
  
  try {
    // Kiểm tra xem function setup_storage_policies có tồn tại không
    const { data: functionExists, error: checkError } = await supabaseAdmin
      .rpc('check_function_exists', { function_name: 'setup_storage_policies' });
      
    if (checkError || !functionExists) {
      console.log('Function setup_storage_policies không tồn tại, bỏ qua việc cài đặt storage policies');
      return { success: true, message: 'RPC function không tồn tại, đã bỏ qua' };
    }
    
    // Nếu function tồn tại, sử dụng nó
    const { data, error } = await supabaseAdmin
      .rpc('setup_storage_policies', {
        allowed_roles: ['authenticated', 'anon'],
        bucket_name: bucketName
      });
      
    if (error) {
      console.warn('Warning: Could not set bucket policies:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Storage permissions configured successfully');
    return { success: true, data };
  } catch (error) {
    console.error('Error configuring storage permissions:', error);
    return { success: false, error };
  }
};

// Connection test function - fix the variable name issue
export const testSupabaseConnection = async () => {
  console.log("Testing Supabase connection...");
  const startTime = Date.now(); // Move this outside the try block to fix scope
  
  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error("❌ Supabase connection test failed:", error);
      return { success: false, error, duration };
    }
    
    console.log(`✅ Supabase connection successful (${duration}ms)`);
    return { success: true, data, duration };
  } catch (err) {
    console.error("❌ Supabase connection test exception:", err);
    const endTime = Date.now();
    return { success: false, error: err, duration: endTime - startTime };
  }
};

// User types
export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

// Question types
export interface Question {
  id: string;
  created_by: string;
  title: string;
  audio_url: string;
  script: string;
  difficulty: 'easy' | 'medium' | 'hard';
  blanks_count: number;
  time_limit?: number;
  created_at: string;
  is_published?: boolean;
  teacher_id?: string;
  profiles?: {
    full_name: string;
  };
}

// Test connection and clear any stale data
const initializeConnection = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Session error:', error);
      // Try to refresh the session
      await supabase.auth.refreshSession();
    } else {
      console.log('Session loaded:', !!session);
    }
  } catch (err) {
    console.error('Connection test failed:', err);
  }
};

// Run connection test immediately
initializeConnection();

// Run a connection test immediately when this module is loaded
testSupabaseConnection()
  .then(result => {
    if (!result.success) {
      console.error("Initial Supabase connection test failed. Authentication may not work correctly.");
    }
  });

// Try to configure storage permissions
configureStoragePermissions('dictation')
  .then(result => {
    console.log('Storage permissions configuration result:', result);
  });

export interface TestResult {
  id: string;
  question_id: string;
  user_id: string;
  answers: string[];
  score: number;
  created_at: string;
}

// Hàm kiểm tra xác thực
export const verifyAuthentication = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Authentication error:", error);
      return false;
    }
    
    if (data && data.session) {
      console.log("User is authenticated");
      return true;
    } else {
      console.log("No active session found");
      return false;
    }
  } catch (err) {
    console.error("Error verifying authentication:", err);
    return false;
  }
};

// Helper function to get correct bucket name
export const getBucketName = async () => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error("Error listing buckets:", error);
      return ['dictation'];
    }
    
    if (data && data.length > 0) {
      console.log("Available buckets:", data.map(b => b.name));
      return data.map(b => b.name);
    }
    
    return ['dictation'];
  } catch (err) {
    console.error("Error getting bucket names:", err);
    return ['dictation'];
  }
};

// Create necessary audio bucket if it doesn't exist
export const createAudioBucket = async () => {
  try {
    // Get existing buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return false;
    }
    
    // Check if audio bucket exists
    const audioBucket = buckets?.find(b => b.name === 'audio');
    
    if (!audioBucket) {
      console.log("Creating 'audio' bucket...");
      const { error: createError } = await supabase.storage.createBucket('audio', {
        public: true
      });
      
      if (createError) {
        console.error("Error creating 'audio' bucket:", createError);
        return false;
      }
      
      console.log("'audio' bucket created successfully");
      return true;
    }
    
    console.log("'audio' bucket already exists");
    return true;
  } catch (err) {
    console.error("Error creating audio bucket:", err);
    return false;
  }
};

// Helper function to get user role
export const getUserRole = async () => {
  const session = await checkAuth();
  if (!session) return null;
  return session.user.user_metadata.role;
};

// Helper function to ensure storage bucket exists
export const ensureStorageBucket = async (bucketName: string) => {
  try {
    // First try to get the bucket
    const { data: bucket, error: getBucketError } = await supabase
      .storage
      .getBucket(bucketName);

    // If bucket doesn't exist, create it
    if (!bucket && getBucketError) {
      const { data, error: createError } = await supabase
        .storage
        .createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['audio/*'],
          fileSizeLimit: 50000000 // 50MB
        });

      if (createError) throw createError;
      return data;
    }

    return bucket;
  } catch (error) {
    console.error(`Error ensuring bucket ${bucketName} exists:`, error);
    throw error;
  }
};

// Helper function to ensure storage bucket exists
export const ensureDictationBucket = async () => {
  try {
    console.log('DEBUG-STORAGE: Checking dictation bucket...');
    
    // First check if bucket exists using Admin client if available, otherwise regular client
    const client = supabaseServiceKey ? supabaseAdmin : supabase;
    console.log('DEBUG-STORAGE: Using client type:', supabaseServiceKey ? 'admin' : 'regular');
    
    // Simplified approach - just try to access the bucket
    console.log('DEBUG-STORAGE: Attempting to list bucket contents...');
    const { data, error } = await client.storage.from('dictation').list('', {
      limit: 1
    });
    
    if (error) {
      console.log('DEBUG-STORAGE: Error details:', {
        message: error.message,
        name: error.name,
        error: error
      });
      
      // Only try to create if we have admin access
      if (supabaseServiceKey) {
        console.log('DEBUG-STORAGE: Creating bucket using admin client...');
        console.log('DEBUG-STORAGE: Service key prefix:', supabaseServiceKey.substring(0, 10) + '...');
        const { error: createError } = await supabaseAdmin.storage.createBucket('dictation', {
          public: true
        });
        
        if (createError) {
          console.log('DEBUG-STORAGE: Create bucket error details:', {
            message: createError.message,
            name: createError.name,
            error: createError
          });
          throw createError;
        }
        
        console.log('DEBUG-STORAGE: Bucket created successfully');
      } else {
        console.warn('DEBUG-STORAGE: Cannot create bucket: No admin access');
        // Instead of failing, just return a warning
        return { success: false, message: 'No admin access to create bucket' };
      }
    } else {
      console.log('DEBUG-STORAGE: Successfully accessed bucket, found items:', data?.length || 0);
    }
    
    return { success: true };
  } catch (error) {
    console.error('DEBUG-STORAGE: Error ensuring dictation bucket:', error);
    // Return the error instead of throwing it
    return { success: false, error };
  }
};

// Initialize storage on load
ensureDictationBucket().then(success => {
  if (success) {
    console.log('Dictation bucket ready');
  } else {
    console.error('Failed to setup dictation bucket');
  }
});

// Add a custom function that calls the translate_to_vietnamese function safely
export const translateToVietnamese = async (text: string): Promise<string> => {
  try {
    // Clean the input text to avoid any problematic characters
    const cleanedText = text.replace(/[<>]/g, '').trim();
    
    if (!cleanedText) {
      return 'Không có nghĩa';
    }
    
    // Call the function with sanitized input
    const { data, error } = await supabase.rpc('translate_to_vietnamese', {
      text_to_translate: cleanedText
    });
    
    if (error) {
      console.error("Translation RPC error:", error);
      return `Nghĩa tiếng Việt của "${text}"`;
    }
    
    return data || `Nghĩa tiếng Việt của "${text}"`;
  } catch (error) {
    console.error("Translation error:", error);
    return `Nghĩa tiếng Việt của "${text}"`;
  }
};

// Thêm interface cho kết quả từ hàm check
interface FunctionExistsResult {
  exists: boolean;
}

// Thêm hàm kiểm tra function tồn tại 
export const checkFunctionExists = async (functionName: string): Promise<boolean> => {
  try {
    // Use a direct custom fetch with proper headers to avoid 406 errors
    const apiUrl = `${supabaseUrl}/rest/v1/rpc/check_function_exists`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ function_name: functionName })
    });
    
    // If we get a 404, the function endpoint doesn't exist
    if (response.status === 404) {
      console.log(`Function check_function_exists doesn't exist on the server`);
      return false;
    }
    
    // If we get a 406, there's an Accept header issue, try a different approach
    if (response.status === 406) {
      console.log(`Got 406 Not Acceptable when checking for function ${functionName}`);
      // Try a direct approach with the actual function instead
      const functionResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'HEAD',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Accept': 'application/json'
        }
      });
      
      // If the HEAD request to the actual function succeeds or gets a method not allowed,
      // the function likely exists (method not allowed means it's there but HEAD isn't supported)
      return functionResponse.status !== 404;
    }
    
    // If we got a successful response, parse it
    if (response.ok) {
      const result = await response.json();
      return !!result;
    }
    
    // Any other error means the function likely doesn't exist
    console.log(`Error checking if function ${functionName} exists: ${response.status}`);
    return false;
  } catch (err) {
    console.warn(`Exception checking if function ${functionName} exists:`, err);
    return false;
  }
};

// Cập nhật hàm initializeStorage để sử dụng logic tốt hơn
export const initializeStorage = async () => {
  try {
    console.log('Configuring storage permissions');
    
    // Kiểm tra xem function storage_permission_check có tồn tại không
    const setupFunctionExists = await checkFunctionExists('setup_storage_policies');
    
    if (!setupFunctionExists) {
      console.log('Function setup_storage_policies không tồn tại, bỏ qua việc cài đặt storage policies');
      return { success: true, message: 'RPC function không tồn tại, đã bỏ qua' };
    }
    
    // Đảm bảo bucket tồn tại
    await ensureDictationBucket();
    
    // Cài đặt policies nếu function tồn tại
    const { error } = await supabaseAdmin
      .rpc('setup_storage_policies', {
        allowed_roles: ['authenticated', 'anon'],
        bucket_name: 'dictation'
      });
      
    if (error) {
      // Ghi log lỗi nhưng không dừng chương trình
      console.warn('Warning: Could not set bucket policies:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Storage permissions configured successfully');
    return { success: true };
  } catch (error) {
    console.error('Error configuring storage permissions:', error);
    return { success: false, error };
  }
};
