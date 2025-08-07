import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'

export default async function ChatLandingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Prefer a room if any, else a DM
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (room?.id) {
    redirect(`/chat/${room.id}`)
  }

  const { data: dm } = await supabase
    .from('direct_messages')
    .select('id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()

  if (dm?.id) {
    redirect(`/chat/${dm.id}`)
  }

  // No chats yet, go to generic /chat selection UI
  redirect('/auth/login')
}