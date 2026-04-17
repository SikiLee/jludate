import { bizError } from 'lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return bizError(410, 'ROSE personality survey API has been removed');
}
