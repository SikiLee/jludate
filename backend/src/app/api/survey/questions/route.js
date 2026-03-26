import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getSurveySectionsForClient } from 'lib/surveyQuestionConfig';
import { httpError, success } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const sections = await getSurveySectionsForClient(surveyPool);
    return success('success', { sections });
  } catch (error) {
    console.error('GET /api/survey/questions failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
