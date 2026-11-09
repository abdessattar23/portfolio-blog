import {notFound} from 'next/navigation';
import {mergedArtifacts} from '../../../../lib/artifacts/resolve';
import {getDraft} from '../../../../lib/studio/drafts';
import {livePosts} from '../../../../lib/studio/published';
import {PostEditor} from './editor';

export const dynamic = 'force-dynamic';

export default async function PostDraftPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const draft = await getDraft(id);
  if (!draft || draft.kind !== 'post') notFound();
  const posts = await livePosts();
  const existing = posts
    .filter((post) => post.slug !== draft.slug)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
    }));
  const isPublishedAlready = posts.some((post) => post.slug === draft.slug && !post.draft);
  const artifacts = await mergedArtifacts();
  return (
    <PostEditor
      id={draft.id}
      slug={draft.slug}
      frontmatter={draft.frontmatter}
      body={draft.body}
      existing={existing}
      isPublishedAlready={isPublishedAlready}
      artifacts={artifacts}
    />
  );
}
