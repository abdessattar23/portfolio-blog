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
    <RecordEditor
      id={draft.id}
      slug={draft.slug}
      frontmatter={draft.frontmatter}
      fields={FIELDS}
      eyebrow="OPEN SOURCE CASE"
      heading="Edit engineering case"
      subtitle="Document the upstream problem, architectural fix, verification benchmarks, and scope boundary."
    />
  );
}
