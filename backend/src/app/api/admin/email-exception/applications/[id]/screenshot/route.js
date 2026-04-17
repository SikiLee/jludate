import path from 'node:path';
import { NextResponse } from 'next/server';
import { ensureSchema, identityPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { httpError } from 'lib/response';
import { readExceptionScreenshot } from 'lib/emailException';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveMimeTypeFromName(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export async function GET(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const id = Number(params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return httpError(400, 'Invalid id');
    }

    const result = await identityPool.query(
      `
      SELECT screenshot_path, status
      FROM unidate_app.email_exception_applications
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (result.rowCount === 0) {
      return httpError(404, 'Not found');
    }

    const row = result.rows[0];
    const fileName = typeof row.screenshot_path === 'string' ? row.screenshot_path.trim() : '';
    if (!fileName) {
      return httpError(404, 'Screenshot deleted');
    }

    const binary = await readExceptionScreenshot(fileName);
    if (!binary) {
      return httpError(404, 'Screenshot missing');
    }

    return new NextResponse(binary, {
      status: 200,
      headers: {
        'Content-Type': resolveMimeTypeFromName(fileName),
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('GET /api/admin/email-exception/applications/:id/screenshot failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

