import { identityPool, surveyPool } from 'lib/db';
import { findUserByEmail, getRespondentIdByUserId, normalizeEmail } from 'lib/identityLink';
import { computeEmailHash } from 'lib/emailException';
import { logError } from 'lib/securityLog';

async function purgeSurveyDataByRespondentId(client, respondentId) {
  if (!respondentId) {
    return;
  }

  // Messages can exist even if match_result was deleted later.
  await client.query(
    'DELETE FROM unidate_app.match_messages WHERE sender_respondent_id = $1',
    [respondentId]
  );

  // Deleting match_results will cascade match_messages via FK.
  await client.query(
    `
    DELETE FROM unidate_app.match_results
    WHERE respondent1_id = $1 OR respondent2_id = $1
    `,
    [respondentId]
  );

  await client.query('DELETE FROM unidate_app.match_questionnaire_drafts WHERE respondent_id = $1', [respondentId]);
  await client.query('DELETE FROM unidate_app.love_questionnaire_drafts WHERE respondent_id = $1', [respondentId]);
  await client.query('DELETE FROM unidate_app.survey_responses WHERE respondent_id = $1', [respondentId]);
}

async function purgeIdentityData(client, { userId, schoolEmail }) {
  const email = normalizeEmail(schoolEmail);
  const schoolEmailHash = computeEmailHash(email);

  // Remove exception request records first.
  await client.query('DELETE FROM unidate_app.email_exception_mappings WHERE school_email_hash = $1', [schoolEmailHash]);
  await client.query('DELETE FROM unidate_app.email_exception_applications WHERE school_email_hash = $1', [schoolEmailHash]);

  // Best-effort: remove access logs for the user actor string.
  await client.query('DELETE FROM unidate_app.access_audit_logs WHERE actor = $1', [`user:${userId}`]);

  // Finally remove the user itself. This cascades user_respondent_links via FK.
  await client.query('DELETE FROM unidate_app.users WHERE id = $1', [userId]);
}

export async function purgeAccountBySchoolEmail(schoolEmail, { actor = 'system' } = {}) {
  const email = normalizeEmail(schoolEmail);
  if (!email) {
    return { ok: false, msg: 'invalid email' };
  }

  const user = await findUserByEmail(identityPool, email);
  if (!user) {
    // Still purge exception records if any.
    const emailHash = computeEmailHash(email);
    await identityPool.query('DELETE FROM unidate_app.email_exception_mappings WHERE school_email_hash = $1', [emailHash]);
    await identityPool.query('DELETE FROM unidate_app.email_exception_applications WHERE school_email_hash = $1', [emailHash]);
    return { ok: true, deleted_user: false };
  }

  const respondentId = await getRespondentIdByUserId(identityPool, user.id, {
    actor,
    purpose: 'exception_reject_purge'
  }).catch(() => null);

  const surveyClient = await surveyPool.connect();
  try {
    await surveyClient.query('BEGIN');
    await purgeSurveyDataByRespondentId(surveyClient, respondentId);
    await surveyClient.query('COMMIT');
  } catch (error) {
    await surveyClient.query('ROLLBACK');
    logError('purge survey data failed', error, { actor });
    // Continue purging identity data regardless.
  } finally {
    surveyClient.release();
  }

  const identityClient = await identityPool.connect();
  try {
    await identityClient.query('BEGIN');
    await purgeIdentityData(identityClient, { userId: user.id, schoolEmail: email });
    await identityClient.query('COMMIT');
  } catch (error) {
    await identityClient.query('ROLLBACK');
    logError('purge identity data failed', error, { actor });
    throw error;
  } finally {
    identityClient.release();
  }

  return { ok: true, deleted_user: true };
}

