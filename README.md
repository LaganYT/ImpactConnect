# ImpactConnect - Simple Real-time Chat Application

A clean, simple real-time messaging application built with Next.js, React, TypeScript, and Supabase. Perfect for basic chat functionality without overwhelming complexity.

## ✨ Core Features

### **Simple Messaging**
- **Real-time Text Messaging**: Instant message delivery with real-time updates
- **Message Editing**: Edit your own messages with inline editing
- **Message Deletion**: Delete your own messages with confirmation
- **Reply System**: Reply to specific messages with context
- **Message Copying**: Copy message content to clipboard

### **User Management**
- **User Authentication**: Secure sign-up and sign-in with Supabase Auth
- **User Profiles**: Basic user information display
- **User Search**: Find users in the sidebar
- **Direct Messages**: Private conversations between users

### **Room Management**
- **Room Display**: View and join existing rooms
- **Room Information**: See room names and descriptions
- **Room Search**: Find rooms in the sidebar

### **User Experience**
- **Right-click Context Menus**: Quick access to common actions
- **Dark/Light Theme**: Built-in theme support
- **Responsive Design**: Works on desktop and mobile
- **Typing Indicators**: See when others are typing
- **Message Timestamps**: Clear time display for messages

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **UI Components**: Custom components with Radix UI primitives
- **Icons**: Lucide React

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
   - Get your project URL and anon key
   - Create a `.env.local` file with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE=your_service_role_key
   ```

4. **Run database migration**
   - Copy the SQL from `migration_add_discord_features.sql`
   - Run it in your Supabase SQL Editor

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Sign up or sign in to start chatting

## 📱 Usage

### **Basic Messaging**
1. Select a room or user from the sidebar
2. Type your message in the input field
3. Press Enter or click Send to send the message
4. Messages appear in real-time

### **Message Actions**
- **Right-click on messages** to see context menu options
- **Edit messages** by clicking the edit button (your messages only)
- **Delete messages** by clicking the delete button (your messages only)
- **Reply to messages** by clicking the reply button

### **User Interactions**
- **Right-click on users** to see user options
- **Right-click on rooms** to see room options
- **Right-click on your profile** to access settings

## 🗄️ Database Schema

The application uses a simple database structure with these main tables:

- **users**: User accounts and profiles
- **rooms**: Chat rooms
- **messages**: Chat messages
- **room_members**: Room membership
- **room_invites**: Room invitation system

## 🔒 Security Features

- **Row Level Security (RLS)**: Database-level access control
- **Supabase Auth**: Secure authentication system
- **Input Validation**: Client and server-side validation
- **SQL Injection Protection**: Parameterized queries

## 🎨 Customization

### **Themes**
The application supports light and dark themes. Users can switch themes in their settings.

### **Styling**
All styling is done with Tailwind CSS, making it easy to customize colors, spacing, and layout.

## 🚧 Development

### **Project Structure**
```
ImpactConnect/
├── app/                 # Next.js app directory
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── chat/           # Chat-related components
│   └── ui/             # Reusable UI components
├── lib/                # Utility functions and configurations
└── public/             # Static assets
```

### **Key Components**
- **ChatLayout**: Main chat interface layout
- **Sidebar**: Room and user list
- **ChatArea**: Message display and input
- **MessageBubble**: Individual message component
- **MessageInput**: Message input with reply support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues or have questions:
1. Check the documentation
2. Search existing issues
3. Create a new issue with details

---

**ImpactConnect** - Simple, clean, and focused on what matters most: connecting people through messaging.
