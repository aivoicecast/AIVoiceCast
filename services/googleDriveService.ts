
// Service for Google Drive state synchronization

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

const APP_STATE_FILE = 'aivoicecast_state_v1.json';

export async function ensureCodeStudioFolder(accessToken: string): Promise<string> {
  const query = "mimeType='application/vnd.google-apps.folder' and name='CodeStudio' and trashed=false";
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  const metadata = {
    name: 'CodeStudio',
    mimeType: 'application/vnd.google-apps.folder'
  };
  
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  
  const folder = await createRes.json();
  return folder.id;
}

/**
 * Saves the entire application state object to a specific file in Drive
 */
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

/**
 * Loads the application state from Drive
 */
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
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.files || [];
}

export async function readDriveFile(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return await res.text();
}

export async function saveToDrive(accessToken: string, folderId: string, filename: string, content: string, mimeType: string = 'text/plain'): Promise<void> {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: filename, parents: [folderId] })], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: mimeType }));
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
    });
}

/* Fixed: Exported createGoogleDoc for DocumentStudio exports */
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

/* Fixed: Exported deleteDriveFile for CodeStudio vfs management */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error("Failed to delete Drive file");
}

/* Fixed: Exported createDriveFolder for CodeStudio project structure */
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
    if (!res.ok) throw new Error("Failed to create Drive folder");
    const folder = await res.json();
    return folder.id;
}

/* Fixed: Exported moveDriveFile for CodeStudio organization */
export async function moveDriveFile(accessToken: string, fileId: string, currentParentId: string, newParentId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${currentParentId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error("Failed to move Drive file");
}
