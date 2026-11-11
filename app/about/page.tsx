import type {Metadata} from 'next';
import {buildPageMetadata, buildProfilePageJsonLd, serializeJsonLd} from '../../lib/seo';
import {SITE} from '../../lib/site';
import {liveSiteSettings} from '../../lib/studio/published';

export async function generateMetadata(): Promise<Metadata> {
  const site = await liveSiteSettings();
  return buildPageMetadata({
    title: 'About',
    description: site.bio,
    path: '/about',
    type: 'profile',
    includeIdentityKeywords: true,
    site,
  });
}

export default async function About() {
  const site = await liveSiteSettings();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: serializeJsonLd(buildProfilePageJsonLd('/about', site))}}
      />
      <section className="page-intro">
        <div className="eyebrow">ABOUT / {SITE.fullName.toUpperCase()}</div>
        <h1>
          How it works.<br />
          <em>Not what it does.</em>
        </h1>
        <p>I’m a Java backend engineer at {SITE.employer}, based in Rabat. The rest of the time goes into observability, the JVM, open source, and AI.</p>
      </section>
      <div className="article-layout">
        <aside>
          <div className="eyebrow">FIND ME</div>
          <a href={SITE.github} rel="me">GitHub (@{SITE.handle}) ↗</a>
          <a href="mailto:elyagoubiabdessattar@gmail.com">Email ↗</a>
          <a href={SITE.linkedin} rel="me">LinkedIn ↗</a>
          <a href={SITE.llms}>llms.txt ↗</a>
        </aside>
        <article className="prose">
          <h2>Working in the details</h2>
          <p>
            I contribute to the OpenTelemetry Java SDK because that is where the mechanism is public: collection behavior, executor limits, sampler configuration, and configuration errors. Same habit each time. Read how it works, then read the tests.
          </p>
          <p>
            This site keeps the explanations close to their evidence: the code, the tests, and the review discussion.
          </p>
          <a className="text-link" href="/work">Explore the casebook ↗</a>
          <h2>Speaking</h2>
          <p>I spoke at Devoxx Morocco 2026 about the next generation entering open source. Organizers can <a href="/speaking#invite">invite me to a talk</a>.</p>
          <a className="text-link" href="/speaking">View speaking ↗</a>
          <h2>Get in touch</h2>
          <p>
            For technical conversations or speaking inquiries, email me at <a href="mailto:elyagoubiabdessattar@gmail.com">elyagoubiabdessattar@gmail.com</a>. For discussions about a specific contribution, its GitHub pull request provides the context.
          </p>
          <h2>About this site</h2>
          <p>The public pages, private writing Studio, and analytics boundary are explained in <a href="/blog/how-this-site-works">how this site works</a>.</p>
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
