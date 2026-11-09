export function publishConflict(currentSha: string | null, baseSha: string | null): string | null {
  if (currentSha && currentSha !== baseSha) {
    return 'This file changed on GitHub after the draft was opened. Delete the draft and open it again.';
  }
  if (!currentSha && baseSha) return 'The file this draft started from is no longer on GitHub.';
  return null;
}
