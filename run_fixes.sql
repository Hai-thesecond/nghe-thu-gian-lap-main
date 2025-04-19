-- Apply fixes in the correct order
\echo 'Creating text_distance function...'
\i migrations/fix_text_distance.sql

\echo 'Adding RLS policies for error_analysis table...'
\i migrations/error_analysis_policies.sql

\echo 'Updating RPC function for error analysis...'
\i migrations/fix_error_analysis_rpc.sql

\echo 'All fixes applied successfully!' 