# Setup Guide for ImpactConnect

This guide will walk you through setting up the ImpactConnect chat application.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- A Supabase account (free tier works fine)

## Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd ImpactConnect
npm install
```

## Step 2: Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new account
2. Create a new project
3. Wait for the project to be set up (this may take a few minutes)

## Step 3: Configure Database

1. In your Supabase dashboard, go to the SQL Editor
2. Copy the entire contents of `database-schema.sql`
3. Paste it into the SQL editor and run it
4. This will create all the necessary tables and security policies

## Step 4: Get API Keys

1. In your Supabase dashboard, go to Settings > API
2. Copy the following values:
   - Project URL
   - anon/public key

## Step 5: Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Replace the values with your actual Supabase project URL and anon key.

## Step 6: Configure Authentication

1. In your Supabase dashboard, go to Authentication > Settings
2. Set the Site URL to `http://localhost:3000` (for development)
3. Add `http://localhost:3000/auth/callback` to the Redirect URLs

### Optional: Google OAuth Setup

1. Go to Authentication > Providers
2. Enable Google provider
3. Create a Google OAuth application at [Google Cloud Console](https://console.cloud.google.com/)
4. Add your Google Client ID and Secret to Supabase

## Step 7: Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 8: Test the Application

1. Create a new account using the signup page
2. Verify your email (check spam folder if needed)
3. Log in and start chatting!

## Troubleshooting

### Common Issues

1. **"User not found" when creating DMs**
   - Make sure the user has signed up and verified their email
   - Check that you're using the correct email address

2. **Real-time messages not working**
   - Ensure you've enabled realtime in Supabase
   - Check that the database schema was applied correctly

3. **Authentication errors**
   - Verify your environment variables are correct
   - Check that the Site URL and Redirect URLs are configured properly

4. **Database errors**
   - Make sure you ran the complete `database-schema.sql` script
   - Check that Row Level Security (RLS) policies are in place

### Getting Help

If you encounter issues:

1. Check the browser console for error messages
2. Check the Supabase dashboard logs
3. Verify all environment variables are set correctly
4. Ensure the database schema was applied successfully

## Production Deployment

When deploying to production:

1. Update the Site URL in Supabase to your production domain
2. Add your production domain to the Redirect URLs
3. Set the environment variables in your hosting platform (Vercel, etc.)
4. Update the JWT secret in your Supabase project settings

## Security Notes

- Never commit your `.env.local` file to version control
- Keep your Supabase keys secure
- Regularly update your dependencies
- Monitor your Supabase usage and costs 