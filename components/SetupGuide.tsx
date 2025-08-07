'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { 
  Settings, 
  Database, 
  Code, 
  Copy, 
  Check, 
  ExternalLink,
  MessageSquare,
  Zap,
  Shield,
  Users,
  Globe
} from 'lucide-react'

export function SetupGuide() {
  const [copiedEnv, setCopiedEnv] = useState(false)
  const [copiedSchema, setCopiedSchema] = useState(false)

  const envContent = `NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key`

  const schemaContent = `-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (room_id IS NOT NULL OR recipient_id IS NOT NULL)
);

-- Create room_members table
CREATE TABLE IF NOT EXISTS room_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for rooms
DROP POLICY IF EXISTS "Users can view all public rooms" ON rooms;
CREATE POLICY "Users can view all public rooms" ON rooms
  FOR SELECT USING (is_private = false OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can create rooms" ON rooms;
CREATE POLICY "Users can create rooms" ON rooms
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Room creators can update rooms" ON rooms;
CREATE POLICY "Room creators can update rooms" ON rooms
  FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for messages
DROP POLICY IF EXISTS "Users can view messages in accessible rooms" ON messages;
CREATE POLICY "Users can view messages in accessible rooms" ON messages
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM rooms WHERE is_private = false OR created_by = auth.uid()
    )
    OR sender_id = auth.uid()
    OR recipient_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for room_members
DROP POLICY IF EXISTS "Users can view room members" ON room_members;
DROP POLICY IF EXISTS "Users can insert room members" ON room_members;
DROP POLICY IF EXISTS "Users can update room members" ON room_members;
DROP POLICY IF EXISTS "Users can delete room members" ON room_members;

CREATE POLICY "Users can view room members" ON room_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_members rm 
      WHERE rm.room_id = room_members.room_id 
      AND rm.user_id = auth.uid()
    )
    OR 
    EXISTS (
      SELECT 1 FROM rooms r 
      WHERE r.id = room_members.room_id 
      AND (r.is_private = false OR r.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can insert room members" ON room_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM rooms r 
        WHERE r.id = room_id 
        AND (r.is_private = false OR r.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update room members" ON room_members
  FOR UPDATE USING (
    auth.uid() = user_id
    OR 
    EXISTS (
      SELECT 1 FROM room_members rm 
      WHERE rm.room_id = room_members.room_id 
      AND rm.user_id = auth.uid() 
      AND rm.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM rooms r 
      WHERE r.id = room_members.room_id 
      AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete room members" ON room_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR 
    EXISTS (
      SELECT 1 FROM room_members rm 
      WHERE rm.room_id = room_members.room_id 
      AND rm.user_id = auth.uid() 
      AND rm.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM rooms r 
      WHERE r.id = room_members.room_id 
      AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "Room creators can add members" ON room_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r 
      WHERE r.id = room_id 
      AND r.created_by = auth.uid()
    )
  );

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update room updated_at timestamp
CREATE OR REPLACE FUNCTION update_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rooms SET updated_at = NOW() WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update room timestamp when message is inserted
DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_room_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;`

  const copyToClipboard = async (text: string, setCopied: (value: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const steps = [
    {
      icon: <Database className="w-5 h-5" />,
      title: "Create Supabase Project",
      description: "Set up your database and authentication",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Supabase.com</a> and create a new project.
          </p>
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-gray-400" />
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Open Supabase Dashboard
            </a>
          </div>
        </div>
      )
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: "Get API Keys",
      description: "Copy your project URL and anon key",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            In your Supabase project dashboard, go to Settings → API and copy your project URL and anon key.
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Environment Variables</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(envContent, setCopiedEnv)}
                className="h-8 px-2"
              >
                {copiedEnv ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-3 rounded border overflow-x-auto">
              {envContent}
            </pre>
          </div>
        </div>
      )
    },
    {
      icon: <Code className="w-5 h-5" />,
      title: "Create .env.local",
      description: "Add your environment variables",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create a <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">.env.local</code> file in your project root and paste the environment variables above.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> Replace the placeholder values with your actual Supabase project URL and anon key.
            </p>
          </div>
        </div>
      )
    },
    {
      icon: <Database className="w-5 h-5" />,
      title: "Run Database Schema",
      description: "Set up your database tables and policies",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            In your Supabase dashboard, go to SQL Editor and run the following schema to create all necessary tables, policies, and functions.
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Database Schema</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(schemaContent, setCopiedSchema)}
                className="h-8 px-2"
              >
                {copiedSchema ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-3 rounded border overflow-x-auto max-h-96">
              {schemaContent}
            </pre>
          </div>
        </div>
      )
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Real-time Messaging (Optional)",
      description: "Multiple strategies for real-time functionality",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The app includes multiple real-time strategies that work automatically:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Supabase Real-time</span>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300">Works if available in your plan</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Polling Fallback</span>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300">Automatic fallback system</p>
            </div>
          </div>
        </div>
      )
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Start the App",
      description: "Run your development server",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Once you've completed the setup, start your development server:
          </p>
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center justify-between mb-2">
              <span>Terminal</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard('npm run dev', () => {})}
                className="h-6 px-2 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <code>npm run dev</code>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Success!</strong> Your chat app should now be running at <code className="bg-green-100 dark:bg-green-800 px-1 py-0.5 rounded text-xs">http://localhost:3000</code>
            </p>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to ImpactConnect
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            A modern real-time chat application with rooms and direct messages
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Real-time Messaging</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Instant message delivery with multiple real-time strategies
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Rooms & Direct Messages</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Create chat rooms or start private conversations
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Secure & Scalable</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Built with Supabase for enterprise-grade security
            </p>
          </div>
        </div>

        {/* Setup Steps */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Setup Guide
          </h2>
          
          {steps.map((step, index) => (
            <Card key={index} className="shadow-lg border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      {step.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                      <CardDescription className="text-sm">{step.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {step.content}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400">
            Need help? Check out our{' '}
            <a href="https://github.com/your-repo/impactconnect" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
              documentation
            </a>
            {' '}or{' '}
            <a href="https://github.com/your-repo/impactconnect/issues" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
              report an issue
            </a>
          </p>
        </div>
      </div>
    </div>
  )
} 