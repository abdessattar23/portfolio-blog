import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {contributions, getContribution, prUrl} from '../../../lib/contributions';
import {SITE} from '../../../lib/site';

type CasePageProps = {params: Promise<{slug: string}>};

export function generateStaticParams() {
  return contributions.map((c) => ({slug: c.slug}));
}

export async function generateMetadata({params}: CasePageProps): Promise<Metadata> {
  const {slug} = await params;
  const c = getContribution(slug);
  if (!c) return {};
  return {title: c.title, description: c.summary};
}

export default async function CasePage({params}: CasePageProps) {
  const {slug} = await params;
  const c = getContribution(slug);
  if (!c) return notFound();

  return (
    <>
      <section className="page-intro">
        <a className="back" href="/work">← All contributions</a>
        <div className="eyebrow">OPENTELEMETRY JAVA / MERGED #{c.number}</div>
        <h1>{c.title}<span>.</span></h1>
        <p>{c.summary}</p>
      </section>
      <div className="article-layout">
        <aside>
          <div className="eyebrow">SOURCE RECORD</div>
          <p>Author<br /><strong>{SITE.handle}</strong></p>
          <p>Repository<br /><strong>opentelemetry-java</strong></p>
          <a className="text-link" href={prUrl(c.number)}>PR #{c.number} ↗</a>
          <p className="muted">Summary based on the merged diff and public review.</p>
        </aside>
        <article className="prose">
          <h2>The problem</h2>
          <p>{c.problem}</p>
          <h2>The change</h2>
          <p>{c.change}</p>
          <h2>What the tests establish</h2>
          <p>{c.verification}</p>
          <div className="note">
            <h3>Scope matters</h3>
            <p>{c.boundary}</p>
          </div>
          <h2>Inspect the evidence</h2>
          <p>The public pull request contains the implementation, regression tests, review discussion, and merge status.</p>
          <a className="button" href={prUrl(c.number)}>Open the merged contribution ↗</a>
          {c.noteSlug && (
            <p>
              <a href={`/blog/${c.noteSlug}`}>Read the technical note with an interactive bucket example →</a>
            </p>
          )}
        </article>
      </div>
    </>
  );
}
