export function refuseArtifactDelete(confirm: boolean, references: number, stored: boolean): string | null {
  if (!confirm) return 'Refusing to delete an artifact without confirm: true.';
  if (references > 0) return 'This artifact is still referenced by a note. Remove the fence before deleting it.';
  if (!stored) return 'No studio copy of that artifact. The git catalog is not deleted from here.';
  return null;
}
