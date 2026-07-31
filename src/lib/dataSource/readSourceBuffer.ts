import fs from "fs";

/**
 * Reads a source file into a Buffer, whether `ref` is a local file path or
 * an http(s) URL. Used by both weeklySource.ts and monthlySource.ts so the
 * exact same xlsx/xls parsing works for:
 *  - an uploaded file (saved to a local path, then read)
 *  - a live source (e.g. a Google Sheets "publish to web" link with
 *    format=xlsx) once one exists
 *
 * No caching, no retries -- this runs on a schedule or on manual trigger,
 * not on every page load, so simplicity wins here.
 */
export async function readSourceBuffer(ref: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(ref)) {
    const res = await fetch(ref);
    if (!res.ok) {
      throw new Error(`Failed to fetch source file from ${ref}: ${res.status} ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  return fs.readFileSync(ref);
}