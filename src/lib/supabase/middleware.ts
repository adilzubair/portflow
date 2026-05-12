import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, allow all requests (demo mode)
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_project_url') {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the session — IMPORTANT: use getUser() not getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/pending-approval');

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // Check approval status
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('approved')
      .eq('user_id', user.id)
      .single();

    const isApproved = profile?.approved === true;

    // Unapproved users can only access /pending-approval
    if (!isApproved && !pathname.startsWith('/pending-approval') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone();
      url.pathname = '/pending-approval';
      return NextResponse.redirect(url);
    }

    // Approved users get redirected away from /login and /pending-approval
    if (isApproved && (pathname.startsWith('/login') || pathname.startsWith('/pending-approval'))) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
