-- Remove Discord OAuth token columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS discord_access_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS discord_refresh_token;