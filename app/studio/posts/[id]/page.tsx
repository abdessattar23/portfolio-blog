import {notFound} from 'next/navigation';
import {getDraft} from '../../../../lib/studio/drafts';
import {livePosts} from '../../../../lib/studio/published';
import {PostEditor} from './editor';

export const dynamic = 'force-dynamic';

export default async function PostDraftPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const draft = await getDraft(id);
  if (!draft || draft.kind !== 'post') notFound();
  const posts = await livePosts();
  const existing = posts.filter((post) => post.slug !== draft.slug).map((post) => ({
    slug: post.slug,
    title: post.title,
    description: post.description,
  }));
  return (
    <>
      <section className="page-intro">
        <a className="back" href="/studio">← Dashboard</a>
        <div className="eyebrow">POST / {draft.slug}</div>
        <h1>Edit the note<span>.</span></h1>
      </section>
      <PostEditor id={draft.id} slug={draft.slug} frontmatter={draft.frontmatter} body={draft.body} existing={existing} />
    </>
  );
}
