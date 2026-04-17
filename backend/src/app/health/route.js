import { success } from 'lib/response';
import { ensureServerBootstrap } from 'lib/bootstrap';
import { ensureSchema } from 'lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  ensureServerBootstrap();
  await ensureSchema();
  return success('ok');
}
