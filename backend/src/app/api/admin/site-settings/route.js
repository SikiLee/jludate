import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';
import { getAdminSiteSettings, updateSiteSettings } from 'lib/siteConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const settings = await getAdminSiteSettings(surveyPool);
    return success('success', settings);
  } catch (error) {
    console.error('GET /api/admin/site-settings failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function PUT(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const body = await readJson(request);
    const updateResult = await updateSiteSettings(surveyPool, body, authResult.user.id);
    if (!updateResult.ok) {
      return bizError(400, updateResult.msg || 'Invalid parameters');
    }

    return success('Site settings updated', updateResult.data);
  } catch (error) {
    console.error('PUT /api/admin/site-settings failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
