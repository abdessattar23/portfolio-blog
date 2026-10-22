import type {Metadata} from 'next';
import {SITE} from '../../lib/site';

export const metadata: Metadata = {title: 'About'};

export default function About() {
  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">ABOUT / {SITE.fullName.toUpperCase()}</div>
        <h1>
          Java. Open source.<br />
          <em>Shared understanding.</em>
        </h1>
        <p>I’m a Java backend engineer at Orange/Sofrecom, based in Rabat, Morocco.</p>
      </section>
      <div className="article-layout">
        <aside>
          <div className="eyebrow">FIND ME</div>
          <a href={SITE.github}>GitHub ↗</a>
          <a href={SITE.linkedin}>LinkedIn ↗</a>
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
            For technical conversations or speaking inquiries, reach me on <a href={SITE.linkedin}>LinkedIn</a>. For discussions about a specific contribution, its GitHub pull request provides the context.
          </p>
        </article>
      </div>
    </>
  );
}
