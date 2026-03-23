import { ensureSchema, surveyPool } from 'lib/db';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { getAdminUserFromRequest } from 'lib/auth';
import { bizError, httpError, success } from 'lib/response';
import { readJson } from 'lib/request';
import {
  getSurveyQuestionByNumber,
  updateSurveyQuestion
} from 'lib/surveyQuestionConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const question = await getSurveyQuestionByNumber(surveyPool, params?.number);
    if (!question) {
      return httpError(404, 'Question not found');
    }

    return success('success', question);
  } catch (error) {
    console.error('GET /api/admin/survey-questions/[number] failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}

export async function PUT(request, { params }) {
  try {
    ensureServerBootstrap();
    await ensureSchema();

    const authResult = await getAdminUserFromRequest(request);
    if (authResult.error) {
      return httpError(authResult.error.status, authResult.error.msg);
    }

    const body = await readJson(request);
    const updateResult = await updateSurveyQuestion(
      surveyPool,
      params?.number,
      {
        section_title: body?.section_title,
        question_text: body?.question_text,
        display_order: body?.display_order
      },
      authResult.user.id
    );

    if (!updateResult.ok) {
      if (updateResult.status === 404) {
        return httpError(404, updateResult.msg);
      }
      return bizError(400, updateResult.msg);
    }

    return success('Survey question updated', updateResult.data);
  } catch (error) {
    console.error('PUT /api/admin/survey-questions/[number] failed:', error);
    return httpError(500, 'Internal Server Error');
  }
}
