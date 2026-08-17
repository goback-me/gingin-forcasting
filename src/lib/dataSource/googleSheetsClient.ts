import { JWT } from "google-auth-library";

let cachedClient: JWT | null = null;

function getClient(): JWT {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must both be set to read a private Google Sheet."
    );
  }
  // .env can't hold a literal multi-line private key cleanly -- it's
  // stored with \n escaped, so unescape it back to real newlines here.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  cachedClient = new JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return cachedClient;
}

export async function fetchPrivateSheetRows(spreadsheetId: string, gid: string | number): Promise<any[][]> {
  const client = getClient();
  const { token: accessToken } = await client.getAccessToken();
  if (!accessToken) {
    throw new Error("Failed to get a Google access token -- check the service account credentials are correct.");
  }
  const headers = { Authorization: `Bearer ${accessToken}` };

  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers,
  });
  if (!metaRes.ok) {
    throw new Error(
      `Couldn't read sheet metadata (HTTP ${metaRes.status}). Make sure the sheet has been shared with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} (Viewer access).`
    );
  }
  const meta = await metaRes.json();
  const sheet = meta.sheets?.find((s: any) => String(s.properties.sheetId) === String(gid));
  if (!sheet) {
    throw new Error(`No tab with gid=${gid} was found in this spreadsheet -- double check the gid in the sheet's URL.`);
  }
  const title = sheet.properties.title;

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(title)}`,
    { headers }
  );
  if (!valuesRes.ok) {
    throw new Error(`Couldn't read values from tab "${title}" (HTTP ${valuesRes.status}).`);
  }
  const data = await valuesRes.json();
  return data.values ?? [];
}