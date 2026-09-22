// Session-only cache of the real File behind an inspection's blob: preview
// URL. The store only ever holds that URL string — but Finalize needs the
// actual bytes to hand to the server action, and a blob: URL can only be read
// back inside the tab that created it, never from the server. Populated at
// upload time (the Hub), consumed once at Finalize, and dropped either way:
// nothing here is meant to survive a refresh, matching every other pre-
// Finalize state in the app.
const files = new Map<string, File>();

export function rememberUploadedFile(id: string, file: File): void {
  files.set(id, file);
}

export function takeUploadedFile(id: string): File | null {
  return files.get(id) ?? null;
}

export function forgetUploadedFile(id: string): void {
  files.delete(id);
}
