
import { logger } from './logger';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
}

const APP_STATE_FILE = 'aivoicecast_state_v2.json';

export function getDriveFileStreamUrl(accessToken: string, fileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`;
}

export function getDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export async function findFolder(accessToken: string, name: string, parentId?: string): Promise<string|null> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await searchRes.json();
  return (data.files && data.files.length > 0) ? data.files[0].id : null;
}

export async function ensureFolder(accessToken: string, path: string, parentId?: string): Promise<string> {
  if (!path || path === '/' || path === '.') return parentId || 'root';
  const segments = path.split('/').filter(Boolean);
  let currentParentId = parentId;

  for (const segment of segments) {
    const existingId = await findFolder(accessToken, segment, currentParentId);
    if (existingId) {
      currentParentId = existingId;
    } else {
      logger.info(`Sovereign Vault: Fabricating segment [${segment}]`);
      const metadata: any = { name: segment, mimeType: 'application/vnd.google-apps.folder' };
      if (currentParentId) metadata.parents = [currentParentId];
      
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });
      const folder = await createRes.json();
      currentParentId = folder.id;
    }
  }
  return currentParentId!;
}

export async function ensureCodeStudioFolder(accessToken: string): Promise<string> {
  return ensureFolder(accessToken, 'CodeStudio');
}

/**
 * FIXED: Added missing createGoogleDoc export for DiscussionModal
 */
export async function createGoogleDoc(accessToken: string, name: string, content: string): Promise<string> {
  const metadata = { name, mimeType: 'application/vnd.google-apps.document' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/plain' }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
  if (!res.ok) throw new Error("Failed to create Google Doc");
  const data = await res.json();
  return data.id;
}

/**
 * FIXED: Added missing createDriveFolder export for CodeStudio
 */
export async function createDriveFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const metadata: any = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) metadata.parents = [parentId];
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  if (!res.ok) throw new Error("Failed to create folder");
  const data = await res.json();
  return data.id;
}

/**
 * FIXED: Added missing moveDriveFile export for CodeStudio
 */
export async function moveDriveFile(accessToken: string, fileId: string, removeParents: string, addParents: string, newName?: string): Promise<void> {
  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?`;
  if (removeParents) url += `removeParents=${removeParents}&`;
  if (addParents) url += `addParents=${addParents}&`;
  
  const body: any = {};
  if (newName) body.name = newName;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error("Failed to move/rename file");
}

/**
 * FIXED: Added missing makeFilePubliclyViewable export for CheckDesigner
 */
export async function makeFilePubliclyViewable(accessToken: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'viewer', type: 'anyone' })
  });
  if (!res.ok) throw new Error("Failed to set public permissions");
}

export async function saveToDrive(accessToken: string, folderId: string, filename: string, content: string, fileId?: string): Promise<string> {
  let existingFileId = fileId;
  if (!existingFileId) {
    const query = `'${folderId}' in parents and name='${filename}' and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    existingFileId = searchData.files?.[0]?.id;
  }

  const metadata: any = { name: filename, mimeType: 'text/plain' };
  if (!existingFileId) metadata.parents = [folderId];

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/plain' }));

  const url = existingFileId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  logger.info(`Sovereign Vault: Syncing asset [${filename}]...`);
  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });

  if (!res.ok) throw new Error(`Drive sync failed`);
  const data = await res.json();
  logger.success(`Sovereign Vault: Asset [${filename}] persistent.`);
  return data.id;
}

export async function uploadToDrive(accessToken: string, folderId: string, filename: string, blob: Blob): Promise<string> {
    logger.info(`Sovereign Vault: Streaming binary [${filename}]...`);
    const metadata = { name: filename, parents: [folderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
    });
    if (!res.ok) throw new Error(`Drive upload failed`);
    const data = await res.json();
    logger.success(`Sovereign Vault: Binary [${filename}] persistent.`);
    return data.id;
}

/**
 * Uploads a large binary with real-time progress tracking via XHR.
 */
export async function uploadToDriveWithProgress(
    accessToken: string,
    folderId: string,
    filename: string,
    blob: Blob,
    onProgress: (progress: number, speed: number, eta: number) => void
  ): Promise<string> {
      return new Promise((resolve, reject) => {
          const metadata = { name: filename, parents: [folderId] };
          const formData = new FormData();
          formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          formData.append('file', blob);
  
          const xhr = new XMLHttpRequest();
          xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
  
          const startTime = Date.now();
  
          xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                  const progress = (event.loaded / event.total) * 100;
                  const elapsedSeconds = (Date.now() - startTime) / 1000;
                  const bytesPerSecond = event.loaded / Math.max(0.1, elapsedSeconds);
                  const remainingBytes = event.total - event.loaded;
                  const eta = remainingBytes / bytesPerSecond;
                  onProgress(progress, bytesPerSecond, eta);
              }
          };
  
          xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                  const response = JSON.parse(xhr.responseText);
                  resolve(response.id);
              } else {
                  reject(new Error(`Drive upload failed: ${xhr.status} ${xhr.statusText}`));
              }
          };
  
          xhr.onerror = () => reject(new Error("Network error during Drive upload"));
          xhr.send(formData);
      });
  }

export async function listDriveFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,size)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.files || [];
}

export async function readDriveFile(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("Failed to read Drive file");
  return await res.text();
}

export async function downloadDriveFileAsBlob(accessToken: string, fileId: string): Promise<Blob> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("Failed to download file media");
  return await res.blob();
}

export async function getDriveFileSharingLink(accessToken: string, fileId: string): Promise<string> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    return data.webViewLink;
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error("Failed to delete Drive file");
}
