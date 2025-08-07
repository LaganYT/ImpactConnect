import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/chat')
  } else {
    redirect('/auth/login')
  }
}
