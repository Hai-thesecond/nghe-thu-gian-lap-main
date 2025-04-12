
CREATE OR REPLACE FUNCTION create_profiles_table()
RETURNS boolean AS $$
BEGIN
  -- Create profiles table
  CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT CHECK (role IN ('teacher', 'student')) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
  );

  -- Set up Row Level Security (RLS)
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  
  -- Create policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;

  -- Grant access to authenticated users
  GRANT ALL ON public.profiles TO authenticated;
  GRANT ALL ON public.profiles TO anon;
  GRANT ALL ON public.profiles TO service_role;

  -- Create questions table
  CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    script TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) NOT NULL,
    blanks_count INTEGER DEFAULT 5,
    time_limit INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
  );

  -- Set up RLS for questions
  ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
  
  -- Create policies for questions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questions' AND policyname = 'Teachers can insert questions'
  ) THEN
    CREATE POLICY "Teachers can insert questions"
      ON public.questions FOR INSERT
      WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questions' AND policyname = 'Teachers can update their own questions'
  ) THEN
    CREATE POLICY "Teachers can update their own questions"
      ON public.questions FOR UPDATE
      USING (created_by = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questions' AND policyname = 'Teachers can delete their own questions'
  ) THEN
    CREATE POLICY "Teachers can delete their own questions"
      ON public.questions FOR DELETE
      USING (created_by = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questions' AND policyname = 'Everyone can view questions'
  ) THEN
    CREATE POLICY "Everyone can view questions"
      ON public.questions FOR SELECT
      USING (true);
  END IF;

  -- Grant access to authenticated users
  GRANT ALL ON public.questions TO authenticated;
  GRANT ALL ON public.questions TO service_role;

  -- Create test_results table
  CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL,
    errors JSONB DEFAULT '[]'::jsonb,
    time_taken INTEGER NOT NULL,
    cheating_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
  );

  -- Set up RLS for test_results
  ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
  
  -- Create policies for test_results
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'test_results' AND policyname = 'Students can insert their own test results'
  ) THEN
    CREATE POLICY "Students can insert their own test results"
      ON public.test_results FOR INSERT
      WITH CHECK (student_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'test_results' AND policyname = 'Students can view their own test results'
  ) THEN
    CREATE POLICY "Students can view their own test results"
      ON public.test_results FOR SELECT
      USING (student_id = auth.uid() OR 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'test_results' AND policyname = 'Teachers can view all test results'
  ) THEN
    CREATE POLICY "Teachers can view all test results"
      ON public.test_results FOR SELECT
      USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher');
  END IF;

  -- Grant access to authenticated users
  GRANT ALL ON public.test_results TO authenticated;
  GRANT ALL ON public.test_results TO service_role;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating tables: %', SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql;
