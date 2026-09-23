import { supabase } from "./create-client"

export async function loginWithFacebook(): Promise<void> {
  if (!supabase) throw new Error('Tính năng đăng nhập chưa được thiết lập.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    throw error
  }
}
