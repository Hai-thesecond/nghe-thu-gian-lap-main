-- Initialize the application_settings table and insert the Hugging Face API key
BEGIN;

-- Create the application_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.application_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grant appropriate permissions
GRANT ALL ON public.application_settings TO authenticated;
GRANT ALL ON public.application_settings TO service_role;

-- Insert or update the Hugging Face API key
INSERT INTO public.application_settings (key, value, description)
VALUES ('huggingface_api_key', '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', 'Hugging Face API key for translation service')
ON CONFLICT (key) 
DO UPDATE SET 
  value = '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',
  updated_at = now(),
  description = 'Hugging Face API key for translation service';

COMMIT; 