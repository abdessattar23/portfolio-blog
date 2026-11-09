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
    <RecordEditor
      id={draft.id}
      slug={draft.slug}
      frontmatter={draft.frontmatter}
      fields={FIELDS}
      eyebrow="SITE IDENTITY · CONTENT/SITE.JSON"
      heading="The site identity"
      subtitle="Name variants and expertise topics go one per line and feed the Schema.org Person & WebSite JSON-LD graph."
    />
  );
}
