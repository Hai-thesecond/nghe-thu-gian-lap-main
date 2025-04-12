export interface Question {
  id: string;
  title: string;
  script: string;
  difficulty: 'easy' | 'medium' | 'hard';
  blanks_count: number;
  time_limit: number;
  audio_url?: string;
  created_at: string;
  created_by: string;
  is_published: boolean;
} 