import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import ChatLayout from '@/components/ChatLayout'

export default async function ChatPage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/login')
  }

  return <ChatLayout user={user} />
} 