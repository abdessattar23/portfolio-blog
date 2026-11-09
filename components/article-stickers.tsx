import type {ArticleSticker} from '../lib/content/schema';

function seed(text: string): number {
  let value = 0;
  for (const character of text) value = (value * 33 + character.charCodeAt(0)) % 997;
  return value;
}

export function ArticleStickers({slug, stickers}: {slug: string; stickers: ArticleSticker[]}) {
  return (
    <div className="article-stickers" aria-hidden="true">
      {stickers.map((sticker, index) => {
        const mix = seed(`${slug}:${sticker}:${index}`);
        const top = 10 + (mix % 24) + index * 15;
        const rotate = (mix % 15) - 7;
        return (
          <span
            key={`${sticker}-${index}`}
            className="article-sticker"
            data-sticker={sticker}
            style={{top: `${top}%`, right: index % 2 === 0 ? '-6px' : '18px', transform: `rotate(${rotate}deg)`}}
          >
            <StickerMark name={sticker} />
          </span>
        );
      })}
    </div>
  );
}

function StickerMark({name}: {name: ArticleSticker}) {
  if (name === 'star') {
    return (
      <svg viewBox="0 0 80 80" width="76" height="76">
        <circle cx="40" cy="40" r="34" fill="#f4c95d" stroke="#2a2118" strokeWidth="2" />
        <path d="M40 16l6.2 14.2 15.3.8-11.8 9.8 3.8 14.8L40 47.8 26.5 55.6l3.8-14.8-11.8-9.8 15.3-.8z" fill="#fff8e4" stroke="#2a2118" strokeWidth="1.4" />
      </svg>
    );
  }
  if (name === 'bug') {
    return (
      <svg viewBox="0 0 80 80" width="76" height="76">
        <ellipse cx="40" cy="44" rx="22" ry="24" fill="#e15b4a" stroke="#2a2118" strokeWidth="2" />
        <circle cx="32" cy="40" r="3" fill="#2a2118" />
        <circle cx="48" cy="40" r="3" fill="#2a2118" />
        <path d="M22 30l-8-8M58 30l8-8M24 58l-8 8M56 58l8 8" stroke="#2a2118" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'ship') {
    return (
      <svg viewBox="0 0 80 80" width="76" height="76">
        <path d="M12 48h56l-8 16H20z" fill="#2f6fed" stroke="#1b2430" strokeWidth="2" />
        <path d="M40 16v32M40 20l18 14H40" fill="#f7f4ea" stroke="#1b2430" strokeWidth="2" />
      </svg>
    );
  }
  if (name === 'coffee') {
    return (
      <svg viewBox="0 0 80 80" width="76" height="76">
        <path d="M18 30h36v22a14 14 0 0 1-14 14H32a14 14 0 0 1-14-14z" fill="#f3efe6" stroke="#2a2118" strokeWidth="2" />
        <path d="M54 36h8a8 8 0 0 1 0 16h-8" fill="none" stroke="#2a2118" strokeWidth="2" />
        <path d="M30 20c2 4 2 4 0 8M40 16c2 4 2 4 0 8" fill="none" stroke="#2a2118" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'pin') {
    return (
      <svg viewBox="0 0 80 80" width="76" height="76">
        <path d="M40 14a16 16 0 0 0-16 16c0 12 16 32 16 32s16-20 16-32A16 16 0 0 0 40 14z" fill="#d4537e" stroke="#2a2118" strokeWidth="2" />
        <circle cx="40" cy="30" r="5" fill="#fff8f2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 92 92" width="86" height="86">
      <circle cx="46" cy="46" r="38" fill="none" stroke="#b42318" strokeWidth="3" strokeDasharray="4 3" />
      <circle cx="46" cy="46" r="30" fill="none" stroke="#b42318" strokeWidth="1.5" />
      <text x="46" y="42" textAnchor="middle" fill="#b42318" fontSize="11" fontFamily="ui-monospace, monospace" transform="rotate(-12 46 46)">REVIEWED</text>
      <text x="46" y="58" textAnchor="middle" fill="#b42318" fontSize="9" fontFamily="ui-monospace, monospace" transform="rotate(-12 46 46)">OK</text>
    </svg>
  );
}
