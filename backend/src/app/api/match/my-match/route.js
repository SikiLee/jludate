import { bizError } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return bizError(410, 'Matching result API has been removed');
}
