import {mergedArtifacts, readMergedArtifact} from '../../../../lib/artifacts/resolve';
import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {deleteArtifactIfAllowed, parseStoredArtifact, writeArtifact} from '../../../../lib/studio/artifacts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const artifacts = await mergedArtifacts();
  return Response.json({artifacts});
}

export async function PUT(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const payload: unknown = await request.json().catch(() => null);
  if (!isRecord(payload)) return Response.json({errors: ['Send an artifact document.']}, {status: 400});
  let artifact;
  try {
    artifact = parseStoredArtifact(payload['document']);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That artifact is invalid.';
    return Response.json({errors: message.split(/(?<=\.)\s+/).filter(Boolean)}, {status: 400});
  }
  const existing = await readMergedArtifact(artifact.id);
  if (payload['create'] === true && existing) {
    return Response.json({errors: ['An artifact with that id already exists.']}, {status: 409});
  }
  if (payload['create'] !== true && !existing) {
    return Response.json({errors: ['No artifact with that id.']}, {status: 404});
  }
  await writeArtifact(artifact);
  return Response.json({artifact});
}

export async function DELETE(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const payload: unknown = await request.json().catch(() => null);
  if (!isRecord(payload) || typeof payload['id'] !== 'string') return Response.json({errors: ['Send an artifact id.']}, {status: 400});
  try {
    const result = await deleteArtifactIfAllowed(payload['id'], payload['confirm'] === true);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The artifact could not be deleted.';
    return Response.json({errors: [message]}, {status: 400});
  }
}
