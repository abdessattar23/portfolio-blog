'use client';

import {useEffect} from 'react';
import {trackEvent} from '../lib/analytics/events';
import {
  completedEngagedSeconds,
  createReadingClock,
  markActivity,
  nextScrollMilestones,
  readingEmissions,
} from '../lib/analytics/reading';

export function ArticleEngagement({
  slug,
  title,
  topics,
  estimatedReadingMinutes,
}: {
  slug: string;
  title: string;
  topics: string;
  estimatedReadingMinutes: number;
}) {
  useEffect(() => {
    const viewId = crypto.randomUUID();
    const context = {
      articleSlug: slug,
      articleTitle: title,
      category: topics,
      pagePath: `/blog/${slug}`,
      estimatedReadingMinutes,
    };
    trackEvent('article_opened', {...context, viewId});
    let clock = createReadingClock(performance.now());
    let stopped = false;
    let summarySent = false;
    let maxScroll = 0;

    const emitCheckpoints = () => {
      if (stopped) return;
      const visible = document.visibilityState === 'visible';
      const focused = document.hasFocus();
      const result = readingEmissions(clock, performance.now(), visible, focused);
      clock = result.clock;
      for (const seconds of result.checkpoints) {
        trackEvent('article_reading_checkpoint', {...context, viewId, seconds});
      }
    };
    const finishView = () => {
      if (summarySent) return;
      summarySent = true;
      const seconds = completedEngagedSeconds(clock, performance.now(), document.visibilityState === 'visible', document.hasFocus());
      if (seconds <= 0) return;
      trackEvent('article_reading_summary', {
        ...context,
        viewId,
        engagedSeconds: seconds,
        maxScrollPercent: maxScroll,
        reachedEnd: clock.endSent ? 1 : 0,
        status: 'complete',
      });
    };

    const onActivity = () => {
      clock = markActivity(clock, performance.now());
    };
    const onScroll = () => {
      onActivity();
      const article = document.querySelector('[data-article-body]');
      if (!(article instanceof HTMLElement)) return;
      const progress = articleProgress(article);
      maxScroll = Math.max(maxScroll, Math.round(progress));
      const milestones = nextScrollMilestones(clock.scrollSent, progress);
      if (milestones.length === 0) return;
      clock = {...clock, scrollSent: [...clock.scrollSent, ...milestones]};
      for (const percent of milestones) {
        trackEvent('article_scroll_depth', {...context, viewId, percent});
        if (percent === 100 && !clock.endSent) {
          clock = {...clock, endSent: true};
          trackEvent('article_end_reached', {...context, viewId, meaning: 'reached_article_end'});
        }
      }
    };
    const timer = window.setInterval(emitCheckpoints, 15_000);
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('pointerdown', onActivity, {passive: true});
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, {passive: true});
    window.addEventListener('pagehide', finishView);
    onScroll();

    return () => {
      finishView();
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('pagehide', finishView);
    };
  }, [slug, title, topics, estimatedReadingMinutes]);

  return null;
}

function articleProgress(article: HTMLElement): number {
  const rect = article.getBoundingClientRect();
  const total = Math.max(article.offsetHeight, 1);
  if (total <= window.innerHeight && rect.top >= 0 && rect.bottom <= window.innerHeight + 8) return 100;
  const seen = Math.min(total, Math.max(0, window.innerHeight - rect.top));
  return Math.max(0, Math.min(100, (seen / total) * 100));
}
