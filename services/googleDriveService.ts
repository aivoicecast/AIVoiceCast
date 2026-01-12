
// Service for Google Drive state synchronization

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
}

const APP_STATE_FILE = 'aivoicecast_state_v2.json';

/**
 * Generates a streamable URL for media tags (video/audio/pdf).
 * NOTE: Using access_token in URL is the most reliable way to enable 
 * native browser Range Requests (streaming) for private Drive files.
 */
export function getDriveFileStreamUrl(accessToken: string, fileId: string): string {
  // Ensure the URL is properly formatted for the media endpoint
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`;
}

/**
 * Returns the Google Drive Preview link which is the most reliable for PDFs.
 */
export function getDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Searches for a folder by name, optionally within a parent folder.
 */
export async function findFolder(accessToken: string, name: string, parentId?: string): Promise<string | null> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Ensures a folder path exists (e.g., "src/components") by creating segments as needed.
 */
export async function ensureFolder(accessToken: string, path: string, parentId?: string): Promise<string> {
  if (!path || path === '/' || path === '.') return parentId || 'root';
  
  const segments = path.split('/').filter(Boolean);
  let currentParentId = parentId;

  for (const segment of segments) {
    const existingId = await findFolder(accessToken, segment, currentParentId);
    if (existingId) {
      currentParentId = existingId;
    } else {
      // Create segment
      const metadata: any = {
        name: segment,
        mimeType: 'application/vnd.google-apps.folder'
      };
      if (currentParentId) metadata.parents = [currentParentId];
      
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });
      
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(`Drive folder creation failed (${createRes.status}): ${errData.error?.message || createRes.statusText}`);
      }

      const folder = await createRes.json();
      currentParentId = folder.id;
    }
  }

  if (!currentParentId) throw new Error("Could not resolve folder ID for path: " + path);
  return currentParentId;
}

/**
 * Legacy wrapper for backward compatibility with CodeStudio
 */
export async function ensureCodeStudioFolder(accessToken: string): Promise<string> {
  return ensureFolder(accessToken, 'CodeStudio');
}

/**
 * Saves a file to Google Drive. Updates if ID or name matches, creates if not.
 */
export async function saveToDrive(accessToken: string, folderId: string, filename: string, content: string, fileId?: string): Promise<string> {
  let existingFileId = fileId;

  // If no ID was provided, try to find the file by name in the target folder
  if (!existingFileId) {
    const query = `'${folderId}' in parents and name='${filename}' and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    existingFileId = searchData.files?.[0]?.id;
  }

  const metadata: any = { name: filename, mimeType: 'text/plain' };
  // Only set parents for new files. Patching by ID doesn't require parents field.
  if (!existingFileId) metadata.parents = [folderId];

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/plain' }));

  const url = existingFileId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Drive save failed (${res.status}): ${errData.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.id;
}

export async function saveAppStateToDrive(accessToken: string, folderId: string, state: any): Promise<void> {
    const query = `'${folderId}' in parents and name='${APP_STATE_FILE}' and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    const existingFileId = searchData.files?.[0]?.id;

    const metadata: any = { name: APP_STATE_FILE, mimeType: 'application/json' };
    if (!existingFileId) metadata.parents = [folderId];

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(state)], { type: 'application/json' }));

    const url = existingFileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    await fetch(url, {
        method: existingFileId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
    });
}

export async function loadAppStateFromDrive(accessToken: string, folderId: string): Promise<any | null> {
    const query = `'${folderId}' in parents and name='${APP_STATE_FILE}' and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await searchRes.json();
    if (!data.files || data.files.length === 0) return null;

    const fileId = data.files[0].id;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
}

export async function listDriveFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,size)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.files || [];
}

/**
 * Reads a Drive file using an access token.
 */
export async function readDriveFile(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("Failed to read Drive file. You may not have access.");
  return await res.text();
}

/**
 * Fetches the raw blob of a Drive file.
 */
export async function downloadDriveFileAsBlob(accessToken: string, fileId: string): Promise<Blob> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("Failed to download file media.");
  return await res.blob();
}

/**
 * Reads a publicly shared Drive file using the application's API key.
 * This bypasses the 'drive.file' scope restriction for recipients.
 */
export async function readPublicDriveFile(apiKey: string, fileId: string): Promise<string> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`);
    if (!res.ok) throw new Error("Failed to read public Drive file. Ensure file is shared correctly.");
    return await res.text();
}

export async function uploadToDrive(accessToken: string, folderId: string, filename: string, blob: Blob): Promise<string> {
    const metadata = { name: filename, parents: [folderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Drive upload failed (${res.status}): ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.id;
}

export async function shareFileWithEmail(accessToken: string, fileId: string, email: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            role: role,
            type: 'user',
            emailAddress: email
        })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Sharing failed: ${err.error?.message || 'Unknown error'}`);
    }
}

export async function makeFilePubliclyViewable(accessToken: string, fileId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
        })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Public sharing failed: ${err.error?.message || 'Unknown error'}`);
    }
}

export async function getDriveFileSharingLink(accessToken: string, fileId: string): Promise<string> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    return data.webViewLink;
}

export async function createGoogleDoc(accessToken: string, title: string, content: string): Promise<string> {
    const metadata = {
        name: title,
        mimeType: 'application/vnd.google-apps.document'
    };

    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });
    
    if (!res.ok) throw new Error("Failed to create Google Doc");
    const file = await res.json();
    return `https://docs.google.com/document/d/${file.id}/edit`;
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error("Failed to delete Drive file");
}

export async function createDriveFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
    const metadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) metadata.parents = [parentId];

    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Drive folder creation failed: ${err.error?.message || res.statusText}`);
    }
    const folder = await res.json();
    return folder.id;
}

/**
 * Moves a Drive file by changing its parent and optionally renaming it.
 */
export async function moveDriveFile(accessToken: string, fileId: string, currentParentId: string, newParentId: string, newName?: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('addParents', newParentId);
    params.append('removeParents', currentParentId);
    
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`;
    const body = newName ? JSON.stringify({ name: newName }) : undefined;

    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body
    });
    
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`Drive move failed (${res.status}): ${errData.error?.message || res.statusText}`);
    }
}
