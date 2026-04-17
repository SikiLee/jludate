import { bizError } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return bizError(410, 'Match chat API has been removed');
}

export async function POST() {
  return bizError(410, 'Match chat API has been removed');
}
