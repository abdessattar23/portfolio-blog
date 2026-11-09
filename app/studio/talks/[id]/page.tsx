import {notFound} from 'next/navigation';
import {getDraft} from '../../../../lib/studio/drafts';
import {RecordEditor} from '../../record-editor';

export const dynamic = 'force-dynamic';

const FIELDS = ['title', 'status', 'event', 'location', 'summary', 'detail'];

export default async function TalkDraftPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const draft = await getDraft(id);
  if (!draft || draft.kind !== 'talk') notFound();
  return (
    <RecordEditor
      id={draft.id}
      slug={draft.slug}
      frontmatter={draft.frontmatter}
      fields={FIELDS}
      eyebrow="SPEAKING & STAGE"
      heading="Edit conference talk"
      subtitle="Manage session status, conference venue, abstract summary, and technical takeaways."
    />
  );
}
