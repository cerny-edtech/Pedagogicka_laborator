import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((s) => provider.addScope(s));

// In-memory token cache (never stored in localStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!user) cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Sign-in already in progress');
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Access token was not returned from Google Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (auth.currentUser) {
    try {
      const res = await signInWithGoogle();
      return res.accessToken;
    } catch {
      return null;
    }
  }
  return null;
};

export const ensureAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) return cachedAccessToken;
  const res = await signInWithGoogle();
  return res.accessToken;
};

export const hasCachedToken = (): boolean => Boolean(cachedAccessToken);

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Directly creates a real Google Document in user's Google Drive via Google Docs REST API
export async function createRealGoogleDoc(
  title: string,
  content: string
): Promise<{ documentId: string; documentUrl: string }> {
  const token = await ensureAccessToken();

  // 1. Create document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Chyba při vytváření Google Dokumentu (${createRes.status}): ${errText}`);
  }

  const createData = await createRes.json();
  const documentId = createData.documentId;

  // 2. Insert content into the new document
  if (content && content.trim().length > 0) {
    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content + '\n',
              },
            },
          ],
        }),
      }
    );

    if (!updateRes.ok) {
      console.warn('Batch update text failed, document created blank:', await updateRes.text());
    }
  }

  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  return { documentId, documentUrl };
}

export function extractGoogleDocId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

// List Google Docs files created by or shared with this app (via drive.file scope)
export async function listAppGoogleDocs(): Promise<
  Array<{ id: string; name: string; modifiedTime?: string }>
> {
  const token = await ensureAccessToken();
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.document' and trashed=false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=20`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chyba při načítání seznamu Google Dokumentů (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.files || [];
}

// Extract plain text from a Google Docs JSON structure
function extractTextFromDocBody(doc: any): string {
  const chunks: string[] = [];
  const content = doc?.body?.content || [];
  for (const structuralElement of content) {
    if (structuralElement.paragraph?.elements) {
      let line = '';
      for (const el of structuralElement.paragraph.elements) {
        if (el.textRun?.content) {
          line += el.textRun.content;
        }
      }
      chunks.push(line);
    } else if (structuralElement.table?.tableRows) {
      for (const row of structuralElement.table.tableRows) {
        const cellTexts: string[] = [];
        for (const cell of row.tableCells || []) {
          let cellStr = '';
          for (const cEl of cell.content || []) {
            for (const el of cEl.paragraph?.elements || []) {
              if (el.textRun?.content) cellStr += el.textRun.content.trim();
            }
          }
          cellTexts.push(cellStr);
        }
        chunks.push(cellTexts.join(' | ') + '\n');
      }
    }
  }
  return chunks.join('');
}

// Read a Google Document by ID or URL via Google Docs API
export async function readGoogleDocContent(
  docIdOrUrl: string
): Promise<{ documentId: string; title: string; text: string }> {
  const documentId = extractGoogleDocId(docIdOrUrl);
  if (!documentId) {
    throw new Error('Neplatný odkaz nebo ID Google Dokumentu.');
  }
  const token = await ensureAccessToken();
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Nepodařilo se načíst Google Dokument (${res.status}): ${errText}`);
  }
  const doc = await res.json();
  return {
    documentId,
    title: doc.title || 'Importovaný dokument',
    text: extractTextFromDocBody(doc),
  };
}

// Create a real Google Spreadsheet and populate it with class evaluation data
export async function createRealGoogleSheet(
  title: string,
  sheetTitle: string,
  rows: (string | number)[][]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await ensureAccessToken();

  // 1. Create spreadsheet with custom sheet title
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: sheetTitle } }],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Chyba při vytváření Google Tabulky (${createRes.status}): ${errText}`);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const actualSheetTitle = spreadsheet.sheets?.[0]?.properties?.title || sheetTitle;

  // 2. Write rows into the sheet
  if (rows.length > 0) {
    const range = encodeURIComponent(`${actualSheetTitle}!A1`);
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `${actualSheetTitle}!A1`,
          majorDimension: 'ROWS',
          values: rows,
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Tabulka vytvořena, ale zápis dat selhal (${updateRes.status}): ${errText}`);
    }
  }

  const spreadsheetUrl =
    spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return { spreadsheetId, spreadsheetUrl };
}
