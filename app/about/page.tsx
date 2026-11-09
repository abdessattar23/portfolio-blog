import type {Metadata} from 'next';
import {buildPageMetadata, buildProfilePageJsonLd, serializeJsonLd} from '../../lib/seo';
import {SITE} from '../../lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: 'About',
  description: `About ${SITE.fullName} (${SITE.handle}) — Java backend engineer at ${SITE.employer} in ${SITE.location}, OpenTelemetry Java SDK contributor, and Devoxx Morocco speaker.`,
  path: '/about',
  type: 'profile',
  includeIdentityKeywords: true,
});

export default function About() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: serializeJsonLd(buildProfilePageJsonLd('/about'))}}
      />
      <section className="page-intro">
        <div className="eyebrow">ABOUT / {SITE.fullName.toUpperCase()}</div>
        <h1>
          Java. Open source.<br />
          <em>Shared understanding.</em>
        </h1>
        <p>I’m a Java backend engineer at {SITE.employer}, based in Rabat, Morocco.</p>
      </section>
      <div className="article-layout">
        <aside>
          <div className="eyebrow">FIND ME</div>
          <a href={SITE.github} rel="me">GitHub (@{SITE.handle}) ↗</a>
          <a href={SITE.linkedin} rel="me">LinkedIn ↗</a>
          <a href={SITE.llms}>llms.txt ↗</a>
        </aside>
        <article className="prose">
          <h2>Working in the details</h2>
          <p>
            Alongside my Java backend work, I contribute to the OpenTelemetry Java SDK. My public contributions cover collection behavior, executor limits, sampler configuration, and configuration error messages.
          </p>
          <p>
            This site keeps the explanations close to their evidence: the code, the tests, and the review discussion.
          </p>
          <a className="text-link" href="/work">Explore the casebook ↗</a>
          <h2>Speaking</h2>
          <p>I spoke at Devoxx Morocco 2026 about the next generation entering open source.</p>
          <a className="text-link" href="/speaking">View speaking ↗</a>
          <h2>Get in touch</h2>
          <p>
            For technical conversations or speaking inquiries, reach me on <a href={SITE.linkedin} rel="me">LinkedIn</a>. For discussions about a specific contribution, its GitHub pull request provides the context.
          </p>
          <h2>Name &amp; citation</h2>
          <p className="muted">
            Full name: <strong>{SITE.fullName}</strong>. Depending on French or English transliteration from Arabic, my name also appears in conference programs and commit records as{' '}
            <span lang="fr">Mohammed Abdessattar Elyagoubi</span>,{' '}
            <span lang="fr">Mohamed Elyagoubi</span>,{' '}
            <span lang="fr">Mohammed El Yagoubi</span>, or{' '}
            <span lang="fr">Mohamed Abdessattar El Yagoubi</span>, and across GitHub as{' '}
            <code>{SITE.handle}</code>.
          </p>
        </article>
      </div>
    </>
  );
}
