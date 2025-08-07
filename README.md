# ImpactConnect - Modern Multi-Device Chat App

A modern, real-time chat application built with Next.js, TypeScript, and Supabase. Features chat rooms, direct messages, and a beautiful responsive UI.

## ✨ Features

### 🚀 Core Chat Features
- **Real-time messaging** with multiple fallback strategies
- **Chat rooms** for group conversations with invite-only access
- **Direct messages** for private conversations
- **Message reactions** with emoji support
- **Reply to messages** with threaded conversations
- **Typing indicators** to show when users are typing
- **Message search** with keyboard navigation
- **File attachments** support (images, documents)
- **Voice messages** (UI ready for implementation)
- **Invite system** with unique codes and expiration dates
- **User presence** with real-time status updates
- **Room member management** with roles (admin, moderator, member)

### 🎨 Modern UI/UX
- **Responsive design** that works on all devices
- **Dark/Light mode** support
- **Modern message bubbles** with status indicators
- **User avatars** with fallback initials
- **Status indicators** (online, offline, away, busy)
- **Smooth animations** and transitions
- **Keyboard shortcuts** for quick navigation
- **Tooltips** for better user guidance

### 🔧 Technical Features
- **TypeScript** for type safety
- **Supabase** for backend and real-time features
- **Real-time subscriptions** with WebSocket fallback
- **Authentication** with Supabase Auth
- **Optimistic updates** for better UX
- **Error handling** and loading states
- **Mobile-first** responsive design

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Icons**: Lucide React
- **State Management**: React hooks with local state
- **Real-time**: Supabase Realtime with fallback strategies

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ImpactConnect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project
   - Copy your project URL and anon key
   - Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   Run the SQL commands in your Supabase SQL editor:
   ```sql
   -- Create users table
   CREATE TABLE users (
     id UUID REFERENCES auth.users(id) PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     full_name TEXT NOT NULL,
     avatar_url TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create rooms table
   CREATE TABLE rooms (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     is_private BOOLEAN DEFAULT FALSE,
     created_by UUID REFERENCES users(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create messages table
   CREATE TABLE messages (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     content TEXT NOT NULL,
     room_id UUID REFERENCES rooms(id),
     sender_id UUID REFERENCES users(id),
     recipient_id UUID REFERENCES users(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

       -- Create room_members table
    CREATE TABLE room_members (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      room_id UUID REFERENCES rooms(id),
      user_id UUID REFERENCES users(id),
      role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      nickname TEXT,
      UNIQUE(room_id, user_id)
    );

    -- Create room_invites table
    CREATE TABLE room_invites (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      room_id UUID REFERENCES rooms(id),
      code TEXT UNIQUE NOT NULL,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE,
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE
    );

    -- Create user_presence table
    CREATE TABLE user_presence (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) UNIQUE,
      status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'busy')),
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      room_id UUID REFERENCES rooms(id)
    );

    -- Enable Row Level Security
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE room_invites ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

   -- Create policies
   CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
   CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

   CREATE POLICY "Users can view public rooms" ON rooms FOR SELECT USING (NOT is_private);
   CREATE POLICY "Users can view private rooms they're members of" ON rooms FOR SELECT USING (
     is_private AND EXISTS (
       SELECT 1 FROM room_members WHERE room_id = rooms.id AND user_id = auth.uid()
     )
   );
   CREATE POLICY "Users can create rooms" ON rooms FOR INSERT WITH CHECK (auth.uid() = created_by);

   CREATE POLICY "Users can view messages in rooms they have access to" ON messages FOR SELECT USING (
     room_id IS NULL OR EXISTS (
       SELECT 1 FROM rooms WHERE id = messages.room_id AND (
         NOT is_private OR EXISTS (
           SELECT 1 FROM room_members WHERE room_id = messages.room_id AND user_id = auth.uid()
         )
       )
     )
   );
   CREATE POLICY "Users can view direct messages they're part of" ON messages FOR SELECT USING (
     recipient_id IS NOT NULL AND (auth.uid() = sender_id OR auth.uid() = recipient_id)
   );
   CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

       CREATE POLICY "Users can view room members" ON room_members FOR SELECT USING (true);
    CREATE POLICY "Users can join rooms" ON room_members FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Room invites policies
    CREATE POLICY "Users can view invites for rooms they have access to" ON room_invites FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM rooms WHERE id = room_invites.room_id AND (
          NOT is_private OR EXISTS (
            SELECT 1 FROM room_members WHERE room_id = room_invites.room_id AND user_id = auth.uid()
          )
        )
      )
    );
    CREATE POLICY "Room admins can create invites" ON room_invites FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM room_members 
        WHERE room_id = room_invites.room_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'moderator')
      )
    );
    CREATE POLICY "Room admins can update invites" ON room_invites FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM room_members 
        WHERE room_id = room_invites.room_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'moderator')
      )
    );

    -- User presence policies
    CREATE POLICY "Users can view all presence" ON user_presence FOR SELECT USING (true);
    CREATE POLICY "Users can update own presence" ON user_presence FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own presence" ON user_presence FOR UPDATE USING (auth.uid() = user_id);
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Usage

### Authentication
- Sign up with email and password
- Or use the demo account (if configured)

### Chat Rooms
- Browse available public rooms
- Create new rooms for specific topics
- Join private rooms with invitation
- **Invite-only access** - Rooms require invite links to join
- **Invite management** - Create, copy, and delete invite links
- **Member roles** - Admin, moderator, and member permissions
- **Real-time member updates** - See who joins and leaves

### Direct Messages
- Click on any user to start a direct message
- Private conversations between two users

### Message Features
- **Send messages** by typing and pressing Enter
- **React to messages** with emojis
- **Reply to messages** to create threaded conversations
- **Search messages** using the search icon
- **Attach files** using the paperclip icon
- **Use emojis** with the emoji picker
- **Real-time updates** with live message delivery
- **Message status indicators** (sending, sent, delivered)

### Keyboard Shortcuts
- `Ctrl/Cmd + K` - Quick search
- `Ctrl/Cmd + D` - Toggle debug mode
- `Escape` - Close modals
- `Enter` - Send message
- `Shift + Enter` - New line

## 🎨 Design System

The app uses a custom design system built with CSS variables and Tailwind CSS:

### Colors
- **Primary**: Blue (#3b82f6)
- **Secondary**: Gray (#f8fafc)
- **Success**: Green (#10b981)
- **Warning**: Yellow (#f59e0b)
- **Destructive**: Red (#ef4444)

### Components
- **Avatar**: User profile pictures with fallback initials
- **Badge**: Status indicators and labels
- **Button**: Multiple variants (default, outline, ghost, etc.)
- **Input**: Form inputs with focus states
- **Tooltip**: Hover information
- **MessageBubble**: Chat message containers
- **TypingIndicator**: Shows when users are typing

## 🔧 Configuration

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Customization
- Modify colors in `app/globals.css`
- Update component styles in `components/ui/`
- Add new features in `components/chat/`

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables
3. Deploy automatically on push

### Other Platforms
- Netlify
- Railway
- DigitalOcean App Platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for the backend
- [Next.js](https://nextjs.org) for the framework
- [Lucide](https://lucide.dev) for icons

---

Built with ❤️ for modern communication
