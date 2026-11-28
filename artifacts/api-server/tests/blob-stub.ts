// Test-only stub for @vercel/blob, used by the security integration suite
// (tests/run-integration.mjs resolves @vercel/blob to this file, so the
// suite never touches real Blob storage).
//
// The document-upload route calls put() before inserting the row; the stub
// records every put() so tests can prove a refused upload never wrote a
// Blob object. get() returns null, so document downloads 404 in the suite
// (the download route treats a missing blob as "Document not found").

export const putCalls: Array<{
  pathname: string;
  access: string;
  contentType?: string;
}> = [];

export function resetPutCalls(): void {
  putCalls.length = 0;
}

export async function put(
  pathname: string,
  _body: unknown,
  options?: {
    access?: string;
    contentType?: string;
    addRandomSuffix?: boolean;
  },
): Promise<{ url: string; pathname: string }> {
  putCalls.push({
    pathname,
    access: options?.access ?? "public",
    contentType: options?.contentType,
  });
  return { url: `blob://test/${pathname}`, pathname };
}

export async function get(_pathname: string): Promise<null> {
  return null;
}
