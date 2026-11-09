import {database, studioEnv} from '../../../../lib/studio/db';

export async function GET() {
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
