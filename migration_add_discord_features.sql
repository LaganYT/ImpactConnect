-- Migration Script: Add Discord-like Features to ImpactConnect
-- Run this in your Supabase SQL Editor to add invite system, user presence, and enhanced roles

-- =====================================================
-- 1. ENHANCE EXISTING TABLES
-- =====================================================

-- Add new columns to existing rooms table
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS invite_code TEXT,
ADD COLUMN IF NOT EXISTS max_members INTEGER,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add new columns to existing messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.messages(id),
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- Add new columns to existing room_members table
ALTER TABLE public.room_members 
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Update room_members role constraint to include 'moderator'
ALTER TABLE public.room_members 
DROP CONSTRAINT IF EXISTS room_members_role_check;

ALTER TABLE public.room_members 
ADD CONSTRAINT room_members_role_check 
CHECK (role IN ('admin', 'moderator', 'member'));

-- Add new columns to existing users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'busy')),
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- =====================================================
-- 2. CREATE NEW TABLES
-- =====================================================

-- Create room_invites table
CREATE TABLE IF NOT EXISTS public.room_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Ensure unique constraint on code exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'room_invites_code_key' 
    AND conrelid = 'public.room_invites'::regclass
  ) THEN
    ALTER TABLE public.room_invites 
    ADD CONSTRAINT room_invites_code_key UNIQUE (code);
  END IF;
END $$;

-- Create user_presence table
CREATE TABLE IF NOT EXISTS public.user_presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'busy')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL
);

-- Handle case where table exists but might have different constraints
DO $$
BEGIN
  -- Add status constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_presence_status_check' 
    AND conrelid = 'public.user_presence'::regclass
  ) THEN
    ALTER TABLE public.user_presence 
    ADD CONSTRAINT user_presence_status_check 
    CHECK (status IN ('online', 'offline', 'away', 'busy'));
  END IF;
END $$;

-- =====================================================
-- 3. CREATE INDEXES FOR NEW TABLES
-- =====================================================

-- Indexes for room_invites
CREATE INDEX IF NOT EXISTS idx_room_invites_room_id ON public.room_invites(room_id);
CREATE INDEX IF NOT EXISTS idx_room_invites_code ON public.room_invites(code);
CREATE INDEX IF NOT EXISTS idx_room_invites_created_by ON public.room_invites(created_by);
CREATE INDEX IF NOT EXISTS idx_room_invites_is_active ON public.room_invites(is_active);

-- Indexes for user_presence
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_room_id ON public.user_presence(room_id);

-- Indexes for new columns in existing tables
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen);

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY ON NEW TABLES
-- =====================================================

ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. DROP EXISTING POLICIES (TO AVOID CONFLICTS)
-- =====================================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view all public rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can view messages in rooms they're in" ON public.messages;
DROP POLICY IF EXISTS "Users can view direct messages" ON public.messages;

-- Drop new policies that might already exist
DROP POLICY IF EXISTS "Users can view public rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can view private rooms they're members of" ON public.rooms;
DROP POLICY IF EXISTS "Users can view messages in rooms they have access to" ON public.messages;
DROP POLICY IF EXISTS "Users can view direct messages they're part of" ON public.messages;

-- Completely reset RLS on new tables to clear all policies
DO $$
BEGIN
  -- Disable RLS on new tables
  ALTER TABLE public.room_invites DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_presence DISABLE ROW LEVEL SECURITY;
  
  -- Re-enable RLS (this will clear all existing policies)
  ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
END $$;

-- =====================================================
-- 6. CREATE ENHANCED POLICIES
-- =====================================================

-- Enhanced rooms policies (support invite-only access)
CREATE POLICY "Users can view public rooms" ON public.rooms
  FOR SELECT USING (NOT is_private);

CREATE POLICY "Users can view private rooms they're members of" ON public.rooms
  FOR SELECT USING (
    is_private AND EXISTS (
      SELECT 1 FROM public.room_members WHERE room_id = public.rooms.id AND user_id = auth.uid()
    )
  );

-- Enhanced messages policies (support invite-only rooms)
CREATE POLICY "Users can view messages in rooms they have access to" ON public.messages
  FOR SELECT USING (
    room_id IS NULL OR EXISTS (
      SELECT 1 FROM public.rooms WHERE id = public.messages.room_id AND (
        NOT is_private OR EXISTS (
          SELECT 1 FROM public.room_members WHERE room_id = public.messages.room_id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can view direct messages they're part of" ON public.messages
  FOR SELECT USING (
    recipient_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = recipient_id)
  );

-- Room invites policies
DO $$
BEGIN
  -- Create policies only if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'room_invites' 
    AND policyname = 'Users can view invites for rooms they have access to'
  ) THEN
    CREATE POLICY "Users can view invites for rooms they have access to" ON public.room_invites
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.rooms WHERE id = public.room_invites.room_id AND (
            NOT is_private OR EXISTS (
              SELECT 1 FROM public.room_members WHERE room_id = public.room_invites.room_id AND user_id = auth.uid()
            )
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'room_invites' 
    AND policyname = 'Room admins can create invites'
  ) THEN
    CREATE POLICY "Room admins can create invites" ON public.room_invites
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.room_members 
          WHERE room_id = public.room_invites.room_id 
          AND user_id = auth.uid() 
          AND role IN ('admin', 'moderator')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'room_invites' 
    AND policyname = 'Room admins can update invites'
  ) THEN
    CREATE POLICY "Room admins can update invites" ON public.room_invites
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.room_members 
          WHERE room_id = public.room_invites.room_id 
          AND user_id = auth.uid() 
          AND role IN ('admin', 'moderator')
        )
      );
  END IF;
END $$;

-- User presence policies
DO $$
BEGIN
  -- Create policies only if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_presence' 
    AND policyname = 'Users can view all presence'
  ) THEN
    CREATE POLICY "Users can view all presence" ON public.user_presence
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_presence' 
    AND policyname = 'Users can update own presence'
  ) THEN
    CREATE POLICY "Users can update own presence" ON public.user_presence
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_presence' 
    AND policyname = 'Users can update own presence'
    AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "Users can update own presence" ON public.user_presence
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- 7. CREATE HELPER FUNCTIONS
-- =====================================================

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.generate_invite_code();
DROP FUNCTION IF EXISTS public.create_room_invite(UUID, UUID, INTEGER, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.use_room_invite(TEXT, UUID);
DROP FUNCTION IF EXISTS public.update_user_presence(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.handle_room_member_change();

-- Function to generate invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars))::integer + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create room invite
CREATE OR REPLACE FUNCTION public.create_room_invite(
  p_room_id UUID,
  p_created_by UUID,
  p_max_uses INTEGER DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS public.room_invites AS $$
DECLARE
  invite_code TEXT;
  new_invite public.room_invites;
BEGIN
  -- Generate unique invite code
  LOOP
    invite_code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.room_invites WHERE code = invite_code);
  END LOOP;
  
  -- Insert new invite
  INSERT INTO public.room_invites (room_id, code, created_by, max_uses, expires_at)
  VALUES (p_room_id, invite_code, p_created_by, p_max_uses, p_expires_at)
  RETURNING * INTO new_invite;
  
  RETURN new_invite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use room invite
CREATE OR REPLACE FUNCTION public.use_room_invite(
  p_invite_code TEXT,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  invite_record public.room_invites;
  result JSON;
BEGIN
  -- Get invite
  SELECT * INTO invite_record 
  FROM public.room_invites 
  WHERE code = p_invite_code AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;
  
  -- Check if expired
  IF invite_record.expires_at IS NOT NULL AND invite_record.expires_at < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Invite has expired');
  END IF;
  
  -- Check if max uses reached
  IF invite_record.max_uses IS NOT NULL AND invite_record.used_count >= invite_record.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Invite has reached maximum uses');
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (SELECT 1 FROM public.room_members WHERE room_id = invite_record.room_id AND user_id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'You are already a member of this room');
  END IF;
  
  -- Add user to room
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (invite_record.room_id, p_user_id, 'member');
  
  -- Increment used count
  UPDATE public.room_invites 
  SET used_count = used_count + 1 
  WHERE id = invite_record.id;
  
  RETURN json_build_object('success', true, 'room_id', invite_record.room_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user presence
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_user_id UUID,
  p_status TEXT DEFAULT 'online',
  p_room_id UUID DEFAULT NULL
)
RETURNS public.user_presence AS $$
DECLARE
  presence_record public.user_presence;
BEGIN
  INSERT INTO public.user_presence (user_id, status, last_seen, room_id)
  VALUES (p_user_id, p_status, NOW(), p_room_id)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    last_seen = EXCLUDED.last_seen,
    room_id = EXCLUDED.room_id
  RETURNING * INTO presence_record;
  
  -- Also update the users table
  UPDATE public.users 
  SET status = p_status, last_seen = NOW()
  WHERE id = p_user_id;
  
  RETURN presence_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. CREATE TRIGGERS
-- =====================================================

-- Trigger to update user presence when they join/leave rooms
CREATE OR REPLACE FUNCTION public.handle_room_member_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- User joined a room
    PERFORM public.update_user_presence(NEW.user_id, 'online', NEW.room_id);
  ELSIF TG_OP = 'DELETE' THEN
    -- User left a room
    PERFORM public.update_user_presence(OLD.user_id, 'online', NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for room member changes
DROP TRIGGER IF EXISTS on_room_member_change ON public.room_members;
CREATE TRIGGER on_room_member_change
  AFTER INSERT OR DELETE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_room_member_change();

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

-- Grant permissions on new tables
GRANT ALL ON public.room_invites TO anon, authenticated;
GRANT ALL ON public.user_presence TO anon, authenticated;

-- Grant permissions on new functions
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_room_invite(UUID, UUID, INTEGER, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_room_invite(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_presence(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_room_member_change() TO anon, authenticated;

-- =====================================================
-- 10. MIGRATION COMPLETE
-- =====================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'New features added:';
  RAISE NOTICE '- Room invite system with unique codes';
  RAISE NOTICE '- User presence tracking';
  RAISE NOTICE '- Enhanced member roles (admin, moderator, member)';
  RAISE NOTICE '- Invite-only room access';
  RAISE NOTICE '- Real-time presence updates';
END $$; 