import {notFound} from 'next/navigation';
import {getDraft} from '../../../../lib/studio/drafts';
import {RecordEditor} from '../../record-editor';

export const dynamic = 'force-dynamic';

const FIELDS = ['title', 'shortTitle', 'number', 'topic', 'summary', 'problem', 'change', 'verification', 'boundary', 'noteSlug'];

export default async function WorkDraftPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const draft = await getDraft(id);
  if (!draft || draft.kind !== 'work') notFound();
  return (
    <>
      <section className="page-intro">
        <a className="back" href="/studio">← Dashboard</a>
        <div className="eyebrow">CASE / {draft.slug}</div>
        <h1>Edit the case<span>.</span></h1>
      </section>
      <RecordEditor id={draft.id} slug={draft.slug} frontmatter={draft.frontmatter} fields={FIELDS} />
    </>
  );
}
