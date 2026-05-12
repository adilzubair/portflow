import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function checkApproval(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Response | null> {
  if (userId === 'demo-user') return null;
  try {
    const { data } = await (supabase as ReturnType<typeof createServerClient>)
      .from('user_profiles')
      .select('approved')
      .eq('user_id', userId)
      .single();
    if (!data?.approved) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, return a mock client stub
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_project_url') {
    return {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: 'demo-user',
              email: 'demo@portflow.app',
              app_metadata: {},
              user_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        }),
        signOut: async () => ({ error: null }),
        exchangeCodeForSession: async () => ({ data: { session: null, user: null }, error: null }),
      },
    } as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });
}
