import type {Metadata} from 'next';
import {buildPageMetadata, buildSpeakingEventJsonLd, serializeJsonLd} from '../../lib/seo';
import {talks} from '../../lib/content/load';
import {SITE} from '../../lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Speaking',
  description: `Conference talks by ${SITE.fullName} (${SITE.handle}) on open source and observability engineering, including Devoxx Morocco 2026.`,
  path: '/speaking',
  includeIdentityKeywords: true,
  keywords: ['Devoxx Morocco 2026', 'The Future of Open Source Has New Faces', 'Conference Speaker'],
});

export default function Speaking() {
  const delivered = talks.find((talk) => talk.status === 'Delivered');
  const proposalTalk = talks.find((talk) => talk.status === 'Proposal');
  if (!delivered || !proposalTalk) throw new Error('Talk records are incomplete.');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: serializeJsonLd(buildSpeakingEventJsonLd())}}
      />
      <section className="page-intro">
        <div className="eyebrow">SPEAKING / SHARING THE WORK</div>
        <h1>
          From the code<br />
          to the conversation<span>.</span>
        </h1>
        <p>Talks about open source and the engineering behind observability.</p>
      </section>
      <article className="talk">
        <div className="eyebrow">
          DELIVERED<br /><br />
          DEVOXX MOROCCO 2026<br />
          CASABLANCA
        </div>
        <div>
          <h2>{delivered.title}</h2>
          <p>{delivered.summary}</p>
          {delivered.detail ? <p className="muted">{delivered.detail}</p> : null}
          <a className="text-link" href={SITE.linkedin} rel="me">Connect on LinkedIn ↗</a>
        </div>
      </article>
      <section className="proposal">
        <div className="eyebrow">PROPOSAL / NOT AN ACCEPTED APPEARANCE</div>
        <h3>{proposalTalk.title}</h3>
        <p>{proposalTalk.summary}</p>
        <a className="text-link" href="/work">Explore the underlying contributions ↗</a>
      </section>
    </>
  );
}
