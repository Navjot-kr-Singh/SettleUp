import { withAuth } from 'next-auth/middleware';

export const proxy = withAuth({
  pages: {
    signIn: '/login',
  },
});

export default proxy;

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/groups/:path*',
    '/import/:path*',
    '/audit-logs/:path*',
    '/settings/:path*',
  ],
};
