import type {Metadata} from 'next';
import {SITE} from '../../lib/site';

export const metadata: Metadata = {title: 'Speaking'};

export default function Speaking() {
  return (
    <>
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
          <h2>The Future of Open Source Has New Faces</h2>
          <p>
            AI can lower the barrier to entering open source. Earning trust still requires understanding the work and taking responsibility for a contribution.
          </p>
          <p className="muted">
            A talk on entering open source and contributing beyond the amount of code written.
          </p>
          <a className="text-link" href={SITE.linkedin}>Connect on LinkedIn ↗</a>
        </div>
      </article>
    </>
  );
}
