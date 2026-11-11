import type {Metadata} from 'next';
import {buildPageMetadata, buildSpeakingEventJsonLd, serializeJsonLd} from '../../lib/seo';
import {liveSiteSettings, liveTalks} from '../../lib/studio/published';
import {SITE} from '../../lib/site';
import type {Talk} from '../../lib/content/schema';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const site = await liveSiteSettings();
  return buildPageMetadata({
    title: 'Speaking',
    description: `Conference talks by ${site.fullName} (${site.handle}) on open source and observability engineering, including Devoxx Morocco 2026.`,
    path: '/speaking',
    includeIdentityKeywords: true,
    keywords: ['Devoxx Morocco 2026', 'The Future of Open Source Has New Faces', 'Conference Speaker'],
    site,
  });
}

function readableSummary(summary: string): string | null {
  const text = summary.trim();
  if (!text || /^[.\s…-]+$/.test(text)) return null;
  return text;
}

function TalkFacts({talk}: {talk: Talk}) {
  return (
    <dl className="talk-facts">
      <div>
        <dt>Event</dt>
        <dd>{talk.event}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{talk.status}</dd>
      </div>
      {talk.location && talk.location !== 'TBD' ? (
        <div>
          <dt>{talk.location.toLowerCase() === 'webinar' || talk.location.toLowerCase() === 'online' ? 'Format' : 'Place'}</dt>
          <dd>{talk.location}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export default async function Speaking() {
  const allTalks = await liveTalks();
  const upcomingTalks = allTalks.filter((talk) => talk.status === 'Upcoming');
  const deliveredTalks = allTalks.filter((talk) => talk.status === 'Delivered');
  const proposalTalks = allTalks.filter((talk) => talk.status === 'Proposal');
  const featured = deliveredTalks.find((talk) => talk.slug === 'future-of-open-source') ?? deliveredTalks[0];
  const otherDelivered = featured ? deliveredTalks.filter((talk) => talk.slug !== featured.slug) : deliveredTalks;
  const featuredSummary = featured ? readableSummary(featured.summary) : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: serializeJsonLd(buildSpeakingEventJsonLd())}}
      />
      <section className="page-intro speaking-intro">
        <div className="eyebrow">Speaking / sharing the work</div>
        <h1>
          From the code<br />
          to the conversation<span>.</span>
        </h1>
        <p>Talks about observability, Java, the JVM, and open source. The mechanism, not the brochure.</p>
        <a className="button" href="#invite">Invite me to a talk</a>
      </section>

      {featured ? (
        <article className="talk-feature">
          <p className="eyebrow">Delivered</p>
          <h2>{featured.title}</h2>
          <p className="talk-feature-event">{featured.event}</p>
          <TalkFacts talk={featured} />
          {featuredSummary ? <p>{featuredSummary}</p> : null}
          {featured.detail ? <p className="muted">{featured.detail}</p> : null}
          {featured.slug === "future-of-open-source" ? (
            <p>Start with the work behind the talk: <a href="/blog/pooled-hashmap">a collection iteration bug</a>, <a href="/blog/how-http-client-creates-too-many-threads">a bounded HTTP sender</a>, <a href="/blog/jaeger-interval">a configuration key mismatch</a>, and <a href="/blog/configuration-errors">safer configuration errors</a>.</p>
          ) : null}
          <a className="text-link" href={SITE.linkedin} rel="me">Connect on LinkedIn ↗</a>
        </article>
      ) : null}

      {upcomingTalks.length > 0 ? (
        <section className="talk-schedule" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading">Upcoming</h2>
          <ul>
            {upcomingTalks.map((talk) => {
              const summary = readableSummary(talk.summary);
              return (
                <li key={talk.slug}>
                  <p className="eyebrow">{talk.status}</p>
                  <h3>{talk.title}</h3>
                  <TalkFacts talk={talk} />
                  {summary ? <p>{summary}</p> : null}
                  {talk.detail ? <p className="muted">{talk.detail}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {otherDelivered.length > 0 ? (
        <section className="talk-schedule" aria-labelledby="delivered-heading">
          <h2 id="delivered-heading">Also delivered</h2>
          <ul>
            {otherDelivered.map((talk) => {
              const summary = readableSummary(talk.summary);
              return (
                <li key={talk.slug}>
                  <p className="eyebrow">{talk.status}</p>
                  <h3>{talk.title}</h3>
                  <TalkFacts talk={talk} />
                  {summary ? <p>{summary}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {proposalTalks.map((talk) => {
        const summary = readableSummary(talk.summary);
        return (
          <section className="proposal" key={talk.slug}>
            <div className="eyebrow">Proposal / not an accepted appearance</div>
            <h3>{talk.title}</h3>
            {summary ? <p>{summary}</p> : null}
            <a className="text-link" href="/work">Explore the underlying contributions ↗</a>
          </section>
        );
      })}

      <section className="speaking-close" id="invite">
        <div className="eyebrow">For organizers</div>
        <h2>Invite me<span>.</span></h2>
        <p>
          I speak at conferences, meetups, and internal engineering sessions. The subjects are observability, Java, the JVM, open source, and how a system actually works.
        </p>
        <p className="muted">
          Tell me the event, the city or that it is online, the date, who is in the room, and how long you want.
        </p>
        <a className="button" href="mailto:elyagoubiabdessattar@gmail.com">Email me</a>
      </section>
    </>
  );
}
