-- ImpactConnect Database Schema
-- Run this in your Supabase SQL editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO '/0RqsuzuSR9WdmsBadN4GfY9LoUf8wEgi5zwXfWuWtTzsdKXaNrS119MJbz2omfrwXiLr+HcNBAZ3hRBfnp21A==';

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'member');

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create direct_messages table
CREATE TABLE public.direct_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user1_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    user2_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

-- Create rooms table
CREATE TABLE public.rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_private BOOLEAN DEFAULT true,
    invite_code TEXT UNIQUE
);

-- Create room_members table
CREATE TABLE public.room_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role user_role DEFAULT 'member',
    UNIQUE(room_id, user_id)
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    direct_message_id UUID REFERENCES public.direct_messages(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    CHECK (
        (direct_message_id IS NOT NULL AND room_id IS NULL) OR
        (direct_message_id IS NULL AND room_id IS NOT NULL)
    )
);

-- Create indexes for better performance
CREATE INDEX idx_direct_messages_users ON public.direct_messages(user1_id, user2_id);
CREATE INDEX idx_room_members_room ON public.room_members(room_id);
CREATE INDEX idx_room_members_user ON public.room_members(user_id);
CREATE INDEX idx_messages_dm ON public.messages(direct_message_id);
CREATE INDEX idx_messages_room ON public.messages(room_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for direct_messages
CREATE POLICY "Users can view DMs they are part of" ON public.direct_messages
    FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create DMs" ON public.direct_messages
    FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- RLS Policies for rooms
CREATE POLICY "Users can view rooms they are members of" ON public.rooms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.room_members 
            WHERE room_id = rooms.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create rooms" ON public.rooms
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update rooms" ON public.rooms
    FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for room_members
CREATE POLICY "Users can view room members for rooms they are in" ON public.room_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.room_members rm2
            WHERE rm2.room_id = room_members.room_id AND rm2.user_id = auth.uid()
        )
    );

CREATE POLICY "Room admins can add members" ON public.room_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = room_members.room_id 
            AND rm.user_id = auth.uid() 
            AND rm.role = 'admin'
        )
    );

CREATE POLICY "Room admins can remove members" ON public.room_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = room_members.room_id 
            AND rm.user_id = auth.uid() 
            AND rm.role = 'admin'
        )
    );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their DMs" ON public.messages
    FOR SELECT USING (
        direct_message_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.direct_messages dm
            WHERE dm.id = direct_message_id 
            AND (dm.user1_id = auth.uid() OR dm.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can view messages in rooms they are members of" ON public.messages
    FOR SELECT USING (
        room_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = room_id AND rm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages in their DMs" ON public.messages
    FOR INSERT WITH CHECK (
        direct_message_id IS NOT NULL AND
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.direct_messages dm
            WHERE dm.id = direct_message_id 
            AND (dm.user1_id = auth.uid() OR dm.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in rooms they are members of" ON public.messages
    FOR INSERT WITH CHECK (
        room_id IS NOT NULL AND
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = room_id AND rm.user_id = auth.uid()
        )
    );

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user profile
CREATE OR REPLACE FUNCTION public.update_user_profile(
    user_id UUID,
    full_name TEXT DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET 
        full_name = COALESCE(update_user_profile.full_name, users.full_name),
        avatar_url = COALESCE(update_user_profile.avatar_url, users.avatar_url),
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members; 