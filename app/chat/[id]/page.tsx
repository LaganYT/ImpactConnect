import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import ChatLayout from "@/components/ChatLayout";

export default async function ChatByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { id } = await params;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  return <ChatLayout user={user} selectedChatId={id} />;
}
