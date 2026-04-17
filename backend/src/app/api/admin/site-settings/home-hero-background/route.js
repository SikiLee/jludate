import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError, success } from 'lib/response';
import { removeHomeHeroBackground, saveHomeHeroBackground } from 'lib/siteConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return bizError(400, 'multipart/form-data is required');
    }
    const file = form.get('file');
    const saveResult = await saveHomeHeroBackground(surveyPool, file, authResult.user.id);

    if (!saveResult.ok) {
      return bizError(400, saveResult.msg || 'Invalid upload file');
    }

    return success('Home hero background updated', saveResult.data);
  } catch (error) {
    console.error('POST /api/admin/site-settings/home-hero-background failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function DELETE(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const removeResult = await removeHomeHeroBackground(surveyPool);
    if (!removeResult.ok) {
      return bizError(400, removeResult.msg || 'Unable to remove image');
    }

    return success('Home hero background removed', removeResult.data);
  } catch (error) {
    console.error('DELETE /api/admin/site-settings/home-hero-background failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
