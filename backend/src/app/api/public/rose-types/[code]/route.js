import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { httpError, success } from 'lib/response';
import { getPublicTypeInterpretation } from 'lib/typeInterpretation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const roseCode = params?.code;
    const detail = await getPublicTypeInterpretation(surveyPool, roseCode);
    if (!detail) {
      return httpError(404, 'Type not found');
    }

    return success('success', detail);
  } catch (error) {
    console.error('GET /api/public/rose-types/[code] failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
