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

-- Allow viewing basic profiles of DM partners
CREATE POLICY "Users can view DM partners' profiles" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.direct_messages dm
            WHERE (dm.user1_id = auth.uid() AND dm.user2_id = users.id)
               OR (dm.user2_id = auth.uid() AND dm.user1_id = users.id)
        )
    );

-- Allow viewing basic profiles of users who share a room with the caller
CREATE POLICY "Users can view profiles of room members in shared rooms" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.room_members rm_self
            JOIN public.room_members rm_other ON rm_self.room_id = rm_other.room_id
            WHERE rm_self.user_id = auth.uid()
              AND rm_other.user_id = users.id
        )
    );

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

-- Read receipts
-- Track which users have read which messages
create table if not exists public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  read_at timestamp with time zone not null default now(),
  constraint message_reads_pkey primary key (message_id, user_id)
);

-- Index to speed up lookups by user
create index if not exists idx_message_reads_user on public.message_reads using btree (user_id);

-- Enable RLS for message_reads
alter table public.message_reads enable row level security;

-- Policies for message_reads
-- Users can view read receipts for messages they are allowed to view
create policy "Users can view reads for messages they can view" on public.message_reads
  for select using (
    exists (
      select 1 from public.messages m
      left join public.direct_messages dm on dm.id = m.direct_message_id
      left join public.room_members rm on rm.room_id = m.room_id and rm.user_id = auth.uid()
      where m.id = message_reads.message_id
        and (
          (m.direct_message_id is not null and (dm.user1_id = auth.uid() or dm.user2_id = auth.uid()))
          or (m.room_id is not null and rm.user_id is not null)
        )
    )
  );

-- Users can insert read receipts for themselves only on messages they can view
create policy "Users can mark messages as read" on public.message_reads
  for insert with check (
    user_id = auth.uid() and exists (
      select 1 from public.messages m
      left join public.direct_messages dm on dm.id = m.direct_message_id
      left join public.room_members rm on rm.room_id = m.room_id and rm.user_id = auth.uid()
      where m.id = message_reads.message_id
        and (
          (m.direct_message_id is not null and (dm.user1_id = auth.uid() or dm.user2_id = auth.uid()))
          or (m.room_id is not null and rm.user_id is not null)
        )
    )
  );

-- Allow users to update their own read_at timestamp (for upserts)
create policy "Users can update their own reads" on public.message_reads
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime for read receipts
alter publication supabase_realtime add table public.message_reads;

-- Utility RPCs
-- Create room and add creator as admin in one transaction
create or replace function public.create_room_with_owner(
  p_name text,
  p_description text default null,
  p_is_private boolean default true
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_room_id uuid;
begin
  insert into public.rooms (name, description, created_by, is_private, invite_code)
  values (
    p_name,
    p_description,
    auth.uid(),
    coalesce(p_is_private, true),
    encode(gen_random_bytes(6), 'hex')
  ) returning id into new_room_id;

  insert into public.room_members (room_id, user_id, role)
  values (new_room_id, auth.uid(), 'admin');

  return new_room_id;
end;
$$;

-- Accept invite by code and add caller as member
-- To change the return type, you must drop the function first if it already exists.
drop function if exists public.accept_invite_by_code(text);

create function public.accept_invite_by_code(
  p_invite_code text
)
returns uuid
language plpgsql
security definer
as $$
declare
  rid uuid;
begin
  select id into rid from public.rooms where invite_code = p_invite_code;
  if rid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (rid, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;

  return rid;
end;
$$;

-- List room members with basic profiles regardless of users RLS, but only if caller is a member
create or replace function public.list_room_members_with_profiles(
  p_room_id uuid
)
returns table (
  user_id uuid,
  role public.user_role,
  username text,
  email text,
  full_name text
)
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select rm.user_id, rm.role, u.username, u.email, u.full_name
  from public.room_members rm
  join public.users u on u.id = rm.user_id
  where rm.room_id = p_room_id;
end;
$$;