export type SeoNote = {
  level: 'ok' | 'warn';
  text: string;
};

export function seoHealth(input: {title: string; description: string; topics: string[]; body: string}): SeoNote[] {
  const notes: SeoNote[] = [];
  const titleFit = input.title.length >= 20 && input.title.length <= 70;
  notes.push({
    level: titleFit ? 'ok' : 'warn',
    text: `Title is ${input.title.length} characters${titleFit ? '' : '; aim for 20–70'}`,
  });
  const descriptionFit = input.description.length >= 80 && input.description.length <= 170;
  notes.push({
    level: descriptionFit ? 'ok' : 'warn',
    text: `Description is ${input.description.length} characters${descriptionFit ? '' : '; aim for 80–170'}`,
  });
  if (input.topics.length === 0) notes.push({level: 'warn', text: 'Add at least one topic'});
  else notes.push({level: 'ok', text: `Topics: ${input.topics.join(', ')}`});
  const missingAlt = [...input.body.matchAll(/!\[([^\]]*)\]\([^)]+\)/g)].filter((match) => (match[1] ?? '').trim() === '').length;
  if (missingAlt > 0) notes.push({level: 'warn', text: `${missingAlt} image${missingAlt === 1 ? '' : 's'} missing alt text`});
  return notes;
}
