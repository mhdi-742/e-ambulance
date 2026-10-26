import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth
  const authPaths = ['/auth/login', '/auth/register'];
  const publicPaths = ['/', ...authPaths, '/auth/reset-password'];
  const isPublicPath = publicPaths.includes(pathname);

  // Redirect unauthenticated users to login (except public pages)
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Role-based route protection & auth-page redirect for logged-in users
  if (
    user &&
    (authPaths.includes(pathname) ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/driver') ||
      pathname.startsWith('/user'))
  ) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'user';
    const homeByRole =
      role === 'admin' ? '/admin' : role === 'driver' ? '/driver' : '/user';

    // If already logged in and visiting /auth/login or /auth/register (unless kicked), redirect to their portal
    const wasKicked = request.nextUrl.searchParams.get('kicked') === '1';
    if (authPaths.includes(pathname) && !wasKicked) {
      const url = request.nextUrl.clone();
      url.pathname = homeByRole;
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (
      (pathname.startsWith('/admin') && role !== 'admin') ||
      (pathname.startsWith('/driver') && role !== 'driver') ||
      (pathname.startsWith('/user') && role !== 'user')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = homeByRole;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
