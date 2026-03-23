import { NextResponse } from 'next/server';
import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { readHomeHeroBackgroundBinary } from 'lib/siteConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const asset = await readHomeHeroBackgroundBinary(surveyPool);
    if (!asset) {
      return NextResponse.json({ code: 404, msg: 'Background image not found' }, { status: 404 });
    }

    return new NextResponse(asset.content, {
      status: 200,
      headers: {
        'content-type': asset.mime_type || 'application/octet-stream',
        'cache-control': 'public, max-age=300'
      }
    });
  } catch (error) {
    console.error('GET /api/public/site-assets/home-hero-background failed:', error);
    return NextResponse.json({ code: 500, msg: 'Internal Server Error' }, { status: 500 });
  }
}
