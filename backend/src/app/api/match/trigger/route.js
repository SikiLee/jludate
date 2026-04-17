import { bizError } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return bizError(410, 'Matching trigger has been removed');
}
