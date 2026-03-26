import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { httpError, success } from 'lib/response';
import { listPublicTypeInterpretations } from 'lib/typeInterpretation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const rows = await listPublicTypeInterpretations(surveyPool);
    return success('success', { items: rows });
  } catch (error) {
    console.error('GET /api/public/rose-types failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
