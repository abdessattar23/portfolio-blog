import type {Metadata} from 'next';
import {IBM_Plex_Mono, IBM_Plex_Sans, Literata} from 'next/font/google';
import {requireOwner} from '../../lib/studio/auth';
import {listDrafts, type Draft} from '../../lib/studio/drafts';
import {livePosts, liveTalks, liveWorkCases} from '../../lib/studio/published';
import {StudioShell, type BinderItem} from './studio-shell';
import './atelier.css';

const studioSans = IBM_Plex_Sans({subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-studio-sans', display: 'swap'});
const studioSerif = Literata({subsets: ['latin'], variable: '--font-studio-serif', display: 'swap'});
const studioMono = IBM_Plex_Mono({subsets: ['latin'], weight: ['400', '500'], variable: '--font-studio-mono', display: 'swap'});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Studio — Atelier',
  robots: {index: false, follow: false},
};

export default async function StudioLayout({children}: Readonly<{children: React.ReactNode}>) {
  const session = await requireOwner();

  let drafts: Draft[] = [];
  let storageError = '';
  try {
    drafts = await listDrafts();
  } catch (error) {
    storageError = error instanceof Error ? error.message : 'Storage is unavailable.';
  }

  const [posts, workCases, talks] = await Promise.all([
    livePosts(),
    liveWorkCases(),
    liveTalks(),
  ]);

  const draftItems: BinderItem[] = drafts.map((draft) => {
    let title = draft.slug;
    try {
      const parsed: unknown = JSON.parse(draft.frontmatter);
      if (typeof parsed === 'object' && parsed !== null && 'title' in parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
        title = parsed.title.trim();
      }
    } catch {
      // keep slug
    }
    const href =
      draft.kind === 'site'
        ? '/studio/settings'
        : draft.kind === 'post'
          ? `/studio/posts/${draft.id}`
          : draft.kind === 'work'
            ? `/studio/work/${draft.id}`
            : `/studio/talks/${draft.id}`;
    return {
      id: draft.id,
      slug: draft.slug,
      title,
      kind: draft.kind,
      subtitle: `${draft.kind} · ${new Date(draft.updatedAt).toISOString().slice(11, 16)} UTC`,
      href,
      isDraft: true,
    };
  });

  const postItems: BinderItem[] = posts.map((post) => {
    const activeDraft = drafts.find((d) => d.kind === 'post' && d.slug === post.slug);
    return {
      id: post.slug,
      slug: post.slug,
      title: post.title,
      kind: 'post',
      subtitle: `${post.template} · ${post.publishedAt}`,
      href: activeDraft ? `/studio/posts/${activeDraft.id}` : undefined,
      isDraft: Boolean(activeDraft),
      unpublishedFile: post.draft,
    };
  });

  const workItems: BinderItem[] = workCases.map((work) => {
    const activeDraft = drafts.find((d) => d.kind === 'work' && d.slug === work.slug);
    return {
      id: work.slug,
      slug: work.slug,
      title: work.shortTitle || work.title,
      kind: 'work',
      subtitle: `PR #${work.number} · ${work.topic}`,
      href: activeDraft ? `/studio/work/${activeDraft.id}` : undefined,
      isDraft: Boolean(activeDraft),
    };
  });

  const talkItems: BinderItem[] = talks.map((talk) => {
    const activeDraft = drafts.find((d) => d.kind === 'talk' && d.slug === talk.slug);
    return {
      id: talk.slug,
      slug: talk.slug,
      title: talk.title,
      kind: 'talk',
      subtitle: `${talk.status} · ${talk.event}`,
      href: activeDraft ? `/studio/talks/${activeDraft.id}` : undefined,
      isDraft: Boolean(activeDraft),
    };
  });

  return (
    <StudioShell
      className={`${studioSans.variable} ${studioSerif.variable} ${studioMono.variable}`}
      login={session.login}
      storageError={storageError}
      drafts={draftItems}
      posts={postItems}
      workCases={workItems}
      talks={talkItems}
    >
      {children}
    </StudioShell>
  );
}
