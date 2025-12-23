-- Deny anonymous access to profiles table
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR SELECT 
TO anon 
USING (false);

-- Deny anonymous access to user_servers table
CREATE POLICY "Deny anonymous access to user_servers" 
ON public.user_servers 
FOR SELECT 
TO anon 
USING (false);