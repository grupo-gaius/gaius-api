SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
SELECT column_name FROM information_schema.columns WHERE table_name = 'assets' ORDER BY 1;
