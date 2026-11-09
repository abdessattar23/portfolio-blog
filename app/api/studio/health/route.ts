import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {database, studioEnv} from '../../../../lib/studio/db';

export async function GET(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const env = studioEnv();
  let schema = false;
  if (env.DB) {
    await database();
    schema = true;
  }
  return Response.json({
    database: Boolean(env.DB),
    media: Boolean(env.MEDIA),
    schema,
  });
}
