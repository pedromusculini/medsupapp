/**
 * Pastas e arquivos aninhados dentro de MedSupApp/ no Google Drive.
 */

import { baixarArquivoDoDrive } from '@/lib/googleDrive';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

const APP_FOLDER_NAME = 'MedSupApp';

export async function getAppFolderId(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Erro ao buscar pasta MedSupApp no Drive');

  const data = await res.json();
  if (data.files?.[0]?.id) return data.files[0].id;

  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) throw new Error('Erro ao criar pasta MedSupApp no Drive');
  const folder = await createRes.json();
  return folder.id as string;
}

export async function findOrCreateFolder(
  accessToken: string,
  parentId: string,
  folderName: string,
): Promise<string> {
  const safeName = folderName.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Erro ao buscar pasta ${folderName}`);

  const data = await res.json();
  if (data.files?.[0]?.id) return data.files[0].id;

  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!createRes.ok) throw new Error(`Erro ao criar pasta ${folderName}`);
  const folder = await createRes.json();
  return folder.id as string;
}

export async function findFileInFolder(
  accessToken: string,
  parentId: string,
  fileName: string,
): Promise<{ fileId: string | null }> {
  const safeName = fileName.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name='${safeName}' and '${parentId}' in parents and trashed=false`,
  );
  const res = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Erro ao buscar arquivo ${fileName}`);
  const data = await res.json();
  return { fileId: data.files?.[0]?.id ?? null };
}

export async function readFileInFolder(
  accessToken: string,
  parentId: string,
  fileName: string,
): Promise<{ content: string | null; fileId: string | null }> {
  const { fileId } = await findFileInFolder(accessToken, parentId, fileName);
  if (!fileId) return { content: null, fileId: null };
  const content = await baixarArquivoDoDrive(accessToken, fileId);
  return { content, fileId };
}

export async function writeFileInFolder(
  accessToken: string,
  parentId: string,
  fileName: string,
  content: string,
  mimeType: string = 'application/json',
): Promise<string> {
  const { fileId } = await findFileInFolder(accessToken, parentId, fileName);

  if (fileId) {
    const updateRes = await fetch(`${UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: content,
    });
    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erro ao atualizar ${fileName}`);
    }
    return fileId;
  }

  const boundary = 'medsupapp_nested_' + Date.now();
  const metadata = {
    name: fileName,
    parents: [parentId],
    mimeType,
  };
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  const createRes = await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ao criar ${fileName}`);
  }
  const file = await createRes.json();
  return file.id as string;
}

export type DriveChildItem = {
  id: string;
  name: string;
  mimeType: string;
};

/** Lista arquivos e subpastas diretas de uma pasta. */
export async function listChildrenInFolder(
  accessToken: string,
  parentId: string,
): Promise<DriveChildItem[]> {
  const query = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
  const res = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name,mimeType)&pageSize=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error('Erro ao listar pasta no Drive');
  const data = await res.json();
  return (data.files ?? []) as DriveChildItem[];
}

/** Copia arquivo para outra pasta com novo nome. */
export async function copyFileToFolder(
  accessToken: string,
  sourceFileId: string,
  destParentId: string,
  newName: string,
): Promise<string> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${sourceFileId}/copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: newName,
      parents: [destParentId],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Erro ao copiar arquivo no Drive');
  }
  const file = await res.json();
  return file.id as string;
}
