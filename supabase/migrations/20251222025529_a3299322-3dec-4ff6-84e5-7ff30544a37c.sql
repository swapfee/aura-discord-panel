-- Create profiles table for Discord users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  discord_avatar TEXT,
  discord_access_token TEXT,
  discord_refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create user_servers table to store Discord servers
CREATE TABLE public.user_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  discord_server_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  server_icon TEXT,
  member_count INTEGER DEFAULT 0,
  bot_connected BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, discord_server_id)
);

-- Enable RLS
ALTER TABLE public.user_servers ENABLE ROW LEVEL SECURITY;

-- Users can view their own servers
CREATE POLICY "Users can view own servers"
  ON public.user_servers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own servers
CREATE POLICY "Users can insert own servers"
  ON public.user_servers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own servers
CREATE POLICY "Users can update own servers"
  ON public.user_servers
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own servers
CREATE POLICY "Users can delete own servers"
  ON public.user_servers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_servers_updated_at
  BEFORE UPDATE ON public.user_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_id, discord_username, discord_avatar)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'provider_id',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();