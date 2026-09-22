// Session-only cache of the real File behind an inspection's blob: preview
// URL. The store only ever holds that URL string — but both the scan engine
// (server-side analysis) and Finalize need the actual bytes, and a blob: URL
// can only be read back inside the tab that created it, never from the
// server. Populated at upload time (the Hub); nothing here is meant to
// survive a refresh, matching every other pre-Finalize state in the app.
const files = new Map<string, File>();

export function rememberUploadedFile(id: string, file: File): void {
  files.set(id, file);
}

// A read, not a remove — a Retry needs the same file again, so nothing here
// deletes it on its own. Call forgetUploadedFile once nothing will read it
// again (Finalize does, on a successful save; the Hub does, when an item
// leaves the queue).
export function takeUploadedFile(id: string): File | null {
  return files.get(id) ?? null;
}

export function forgetUploadedFile(id: string): void {
  files.delete(id);
}
