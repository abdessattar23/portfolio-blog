import {openDraft} from '../../../lib/studio/drafts';
import {RecordEditor} from '../record-editor';

export const dynamic = 'force-dynamic';

const FIELDS = ['name', 'fullName', 'handle', 'role', 'jobTitle', 'employer', 'location', 'bio', 'url', 'github', 'linkedin', 'alternateNames', 'knowsAbout'];

export default async function SettingsPage() {
  let draft: Awaited<ReturnType<typeof openDraft>> | undefined;
  let message = '';
  try {
    draft = await openDraft('site', 'site');
  } catch (error) {
    message = error instanceof Error ? error.message : 'Storage is unavailable.';
  }
  if (!draft) return <p className="studio-alert">{message}</p>;
  return (
    <>
      <section className="page-intro">
        <a className="back" href="/studio">← Dashboard</a>
        <div className="eyebrow">SETTINGS</div>
        <h1>The site<span>.</span></h1>
        <p>Name variants and topics go one per line.</p>
      </section>
      <RecordEditor id={draft.id} slug={draft.slug} frontmatter={draft.frontmatter} fields={FIELDS} />
    </>
  );
}
