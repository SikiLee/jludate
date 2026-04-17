import { NextResponse } from 'next/server';

function resolveRequestProtocol(request) {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (typeof forwardedProto === 'string' && forwardedProto.trim()) {
    return forwardedProto.trim().toLowerCase();
  }

  const protocol = request.nextUrl.protocol || '';
  return protocol.replace(':', '').toLowerCase();
}

export function middleware(request) {
  const protocol = resolveRequestProtocol(request);
  const forceHttps = process.env.FORCE_HTTPS === 'true';

  if (forceHttps && protocol !== 'https') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = 'https:';
    return NextResponse.redirect(redirectUrl, 307);
  }

  const response = NextResponse.next();
  if (protocol === 'https') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return response;
}

export const config = {
  matcher: ['/api/:path*']
};
