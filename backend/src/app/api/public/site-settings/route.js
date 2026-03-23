import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { httpError, success } from 'lib/response';
import { getPublicSiteSettings } from 'lib/siteConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const settings = await getPublicSiteSettings(surveyPool);
    return success('success', settings);
  } catch (error) {
    console.error('GET /api/public/site-settings failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
