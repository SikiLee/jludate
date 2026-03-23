import { NextResponse } from 'next/server';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema, surveyPool } from 'lib/db';
import { getSiteBrandName } from 'lib/siteConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  ensureServerBootstrap();
  await ensureSchema();
  const brandName = await getSiteBrandName(surveyPool);

  return NextResponse.json({
    code: 200,
    msg: `${brandName} backend is running`,
    data: {
      health: '/health',
      api_base: '/api'
    }
  });
}
