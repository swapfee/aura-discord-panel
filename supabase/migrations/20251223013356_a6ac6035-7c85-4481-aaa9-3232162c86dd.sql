-- Force RLS on profiles table (ensures even table owners follow RLS)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Force RLS on user_servers table (ensures even table owners follow RLS)
ALTER TABLE public.user_servers FORCE ROW LEVEL SECURITY;