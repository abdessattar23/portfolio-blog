import type {Metadata} from 'next';
import {contributions, prUrl} from '../../lib/contributions';

export const metadata: Metadata = {title: 'Open-source work'};

export default function Work() {
  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">THE CASEBOOK / OPEN SOURCE</div>
        <h1>Work you can inspect<span>.</span></h1>
        <p>
          Selected merged contributions to the OpenTelemetry Java SDK. Each record connects the problem, the change, and the tests to the source.
        </p>
      </section>
      <section className="case-list">
        {contributions.map((c, index) => (
          <article className="case" key={c.slug}>
            <div className="case-index">
              0{index + 1}
              <span>MERGED<br />#{c.number}</span>
            </div>
            <div>
              <div className="eyebrow">{c.topic}</div>
              <h2>
                <a href={`/work/${c.slug}`}>{c.title} ↗</a>
              </h2>
              <p>{c.summary}</p>
              <div className="inline-links">
                <a href={`/work/${c.slug}`}>Read the case</a>
                <a href={prUrl(c.number)}>View pull request ↗</a>
              </div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
