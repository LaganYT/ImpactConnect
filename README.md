# ImpactConnect - Modern Chat Application

A real-time chat application built with Next.js 15, Supabase, and modern web technologies. Features include direct messaging, private rooms, real-time messaging, and user authentication.

## Features

- 🔐 **Authentication**: Email/password and Google OAuth via Supabase Auth
- 💬 **Direct Messages**: Private 1-on-1 conversations between users
- 🏠 **Private Rooms**: Invite-only group chat rooms
- ⚡ **Real-time Messaging**: Instant message delivery using Supabase Realtime
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- 🎨 **Modern UI**: Clean, professional interface with smooth animations
- 🔒 **Security**: Row Level Security (RLS) policies for data protection

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Backend**: Supabase (Database, Auth, Realtime)
- **Styling**: CSS Modules (no Tailwind or UI libraries)
- **Deployment**: Vercel-ready

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd ImpactConnect
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Copy the SQL from `database-schema.sql` and run it in your Supabase SQL editor

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Configure Supabase Auth

1. In your Supabase dashboard, go to Authentication > Settings
2. Add your domain to the Site URL (e.g., `http://localhost:3000` for development)
3. Configure Google OAuth (optional):
   - Go to Authentication > Providers
   - Enable Google provider
   - Add your Google OAuth credentials

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

The application uses the following main tables:

- **users**: Extended user profiles (linked to Supabase auth.users)
- **direct_messages**: DM threads between two users
- **rooms**: Group chat rooms with metadata
- **room_members**: Room membership and roles
- **messages**: All messages (DMs and room messages)

## Project Structure

```
ImpactConnect/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   │   ├── login/         # Login page
│   │   └── signup/        # Signup page
│   ├── chat/              # Main chat application
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ChatLayout.tsx     # Main chat layout
│   ├── Sidebar.tsx        # Chat sidebar
│   └── ChatWindow.tsx     # Chat messages and input
├── lib/                   # Utility functions
│   ├── supabase.ts        # Supabase client configuration
│   └── types.ts           # TypeScript type definitions
├── middleware.ts          # Next.js middleware for auth
└── database-schema.sql    # Database setup script
```

## Key Features Implementation

### Authentication
- Server-side authentication checks
- Automatic redirects for authenticated/unauthenticated users
- Google OAuth integration

### Real-time Messaging
- Supabase Realtime subscriptions for instant message delivery
- Optimistic UI updates
- Message persistence

### Direct Messages
- Unique DM threads between users
- User lookup by email
- Duplicate prevention

### Private Rooms
- Invite-only access
- Admin/member roles
- Invite code generation

### Security
- Row Level Security (RLS) policies
- User-based data access control
- Secure API endpoints

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your Vercel dashboard:

```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_anon_key
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, please open an issue in the GitHub repository or contact the development team.
