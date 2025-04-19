-- Setup storage bucket and policies for audio files

-- Check if the bucket exists, create if it doesn't
BEGIN
    PERFORM 1 FROM storage.buckets WHERE id = 'dictation';
    
    IF NOT FOUND THEN
        -- Create the bucket
        INSERT INTO storage.buckets (id, name) 
        VALUES ('dictation', 'Dictation audio files');
    END IF;
END;

-- Set RLS for the bucket
DO $$
BEGIN
    -- Drop existing policy if it exists
    BEGIN
        DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Policy does not exist or failed to drop: %', SQLERRM;
    END;
    
    -- Create new policy for public read access
    CREATE POLICY "Allow public read access" 
    ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'dictation');
    
    -- Policy for authenticated users to upload files
    BEGIN
        DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Policy does not exist or failed to drop: %', SQLERRM;
    END;
    
    CREATE POLICY "Allow authenticated users to upload files" 
    ON storage.objects 
    FOR INSERT 
    WITH CHECK (
        bucket_id = 'dictation' 
        AND auth.role() = 'authenticated'
    );
END $$;

-- Print storage configuration after setup
SELECT id, name FROM storage.buckets WHERE id = 'dictation';
SELECT name, definition FROM storage.policies WHERE name LIKE 'Allow%'; 