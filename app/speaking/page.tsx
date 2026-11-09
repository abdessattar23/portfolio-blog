import type {Metadata} from 'next';
import {buildPageMetadata, buildSpeakingEventJsonLd, serializeJsonLd} from '../../lib/seo';
import {liveTalks} from '../../lib/studio/published';
import {SITE} from '../../lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'Speaking',
  description: `Conference talks by ${SITE.fullName} (${SITE.handle}) on open source and observability engineering, including Devoxx Morocco 2026.`,
  path: '/speaking',
  includeIdentityKeywords: true,
  keywords: ['Devoxx Morocco 2026', 'The Future of Open Source Has New Faces', 'Conference Speaker'],
});

export default async function Speaking() {
  const allTalks = await liveTalks();
  const upcomingTalks = allTalks.filter((talk) => talk.status === 'Upcoming');
  const deliveredTalks = allTalks.filter((talk) => talk.status === 'Delivered');
  const proposalTalks = allTalks.filter((talk) => talk.status === 'Proposal');

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
      {upcomingTalks.map((talk) => (
        <article className="talk" key={talk.slug}>
          <div className="eyebrow">
            UPCOMING<br /><br />
            {talk.event.toUpperCase()}
            {talk.location !== 'TBD' ? (
              <>
                <br />
                {talk.location.toUpperCase()}
              </>
            ) : null}
          </div>
          <div>
            <h2>{talk.title}</h2>
            <p>{talk.summary}</p>
            {talk.detail ? <p className="muted">{talk.detail}</p> : null}
          </div>
        </article>
      ))}
      {deliveredTalks.map((talk) => (
        <article className="talk" key={talk.slug}>
          <div className="eyebrow">
            DELIVERED<br /><br />
            {talk.event.toUpperCase()}
            {talk.location !== 'TBD' ? (
              <>
                <br />
                {talk.location.toUpperCase()}
              </>
            ) : null}
          </div>
          <div>
            <h2>{talk.title}</h2>
            <p>{talk.summary}</p>
            {talk.detail ? <p className="muted">{talk.detail}</p> : null}
            <a className="text-link" href={SITE.linkedin} rel="me">Connect on LinkedIn ↗</a>
          </div>
        </article>
      ))}
      {proposalTalks.map((talk) => (
        <section className="proposal" key={talk.slug}>
          <div className="eyebrow">PROPOSAL / NOT AN ACCEPTED APPEARANCE</div>
          <h3>{talk.title}</h3>
          <p>{talk.summary}</p>
          <a className="text-link" href="/work">Explore the underlying contributions ↗</a>
        </section>
      ))}
    </>
  );
}
