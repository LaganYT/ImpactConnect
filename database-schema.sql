-- ImpactConnect Database Schema
-- Run this in your Supabase SQL editor

-- Enable Row Level Security

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'member');

-- Create users table (extends Supabase auth.users)
create table public.users (
  id uuid not null,
  email text not null,
  full_name text null,
  avatar_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  username text not null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create direct_messages table
create table public.direct_messages (
  id uuid not null default gen_random_uuid (),
  user1_id uuid not null,
  user2_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint direct_messages_pkey primary key (id),
  constraint direct_messages_user1_id_user2_id_key unique (user1_id, user2_id),
  constraint direct_messages_user1_id_fkey foreign KEY (user1_id) references users (id) on delete CASCADE,
  constraint direct_messages_user2_id_fkey foreign KEY (user2_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create rooms table
create table public.rooms (
  id uuid not null default gen_random_uuid (),
  name text not null,
  description text null,
  created_by uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_private boolean null default true,
  invite_code text null,
  constraint rooms_pkey primary key (id),
  constraint rooms_invite_code_key unique (invite_code),
  constraint rooms_created_by_fkey foreign KEY (created_by) references users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create room_members table
create table public.room_members (
  id uuid not null default gen_random_uuid (),
  room_id uuid not null,
  user_id uuid not null,
  joined_at timestamp with time zone null default now(),
  role public.user_role null default 'member'::user_role,
  constraint room_members_pkey primary key (id),
  constraint room_members_room_id_user_id_key unique (room_id, user_id),
  constraint room_members_room_id_fkey foreign KEY (room_id) references rooms (id) on delete CASCADE,
  constraint room_members_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create messages table
create table public.messages (
  id uuid not null default gen_random_uuid (),
  content text not null,
  sender_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  direct_message_id uuid null,
  room_id uuid null,
  sender_name text null,
  sender_email text null,
  sender_username text null,
  constraint messages_pkey primary key (id),
  constraint messages_direct_message_id_fkey foreign KEY (direct_message_id) references direct_messages (id) on delete CASCADE,
  constraint messages_room_id_fkey foreign KEY (room_id) references rooms (id) on delete CASCADE,
  constraint messages_sender_id_fkey foreign KEY (sender_id) references users (id) on delete CASCADE,
  constraint messages_check check (
    (
      (
        (direct_message_id is not null)
        and (room_id is null)
      )
      or (
        (direct_message_id is null)
        and (room_id is not null)
      )
    )
  )
) TABLESPACE pg_default;

-- Create indexes for better performance
create index IF not exists idx_direct_messages_users on public.direct_messages using btree (user1_id, user2_id) TABLESPACE pg_default;
create index IF not exists idx_messages_dm on public.messages using btree (direct_message_id) TABLESPACE pg_default;
create index IF not exists idx_messages_room on public.messages using btree (room_id) TABLESPACE pg_default;
create index IF not exists idx_messages_created_at on public.messages using btree (created_at) TABLESPACE pg_default;
create index IF not exists idx_room_members_room on public.room_members using btree (room_id) TABLESPACE pg_default;
create index IF not exists idx_room_members_user on public.room_members using btree (user_id) TABLESPACE pg_default;
create unique INDEX IF not exists users_username_unique_ci on public.users using btree (lower(username)) TABLESPACE pg_default;

-- Triggers for username management
create trigger trg_set_username_from_email BEFORE INSERT
or
update OF email,
username on users for EACH row
execute FUNCTION set_username_from_email ();

create trigger on_user_username_updated
after
update OF username on users for EACH row
execute FUNCTION sync_message_usernames ();

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