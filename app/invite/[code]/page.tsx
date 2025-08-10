import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { code } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  try {
    // If RPC isn't installed, this will error; we ignore and just redirect
    await supabase.rpc("accept_invite_by_code", { p_invite_code: code });
    redirect("/chat");
  } catch (error: unknown) {
    // For any errors, just redirect to chat
    redirect("/chat");
  }
}
