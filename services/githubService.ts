
import { CodeFile, CodeProject } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
  };
}

// Check if a repo exists and get details (Token optional but needed for private repos)
export async function fetchRepoInfo(owner: string, repo: string, token?: string | null): Promise<{ default_branch: string, id: number, full_name: string, private: boolean, permissions?: { push: boolean } }> {
  const headers: Record<string, string> = {};
  if (token) {
      headers.Authorization = `token ${token}`;
  }
  
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
  if (!response.ok) {
      if (response.status === 404) throw new Error(`Repository '${owner}/${repo}' not found. Check spelling or access rights.`);
      if (response.status === 403) throw new Error('GitHub API rate limit exceeded. Please sign in.');
      if (response.status === 401) throw new Error('Unauthorized. Please check your GitHub token.');
      throw new Error(`Failed to fetch repository info: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

// Fetch list of repositories for the authenticated user
export async function fetchUserRepos(token: string): Promise<GithubRepo[]> {
  const response = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
      if (response.status === 403) throw new Error('GitHub API rate limit exceeded.');
      throw new Error('Failed to fetch repositories');
  }
  return await response.json();
}

// Helper to determine language
function getLanguageFromExt(path: string): any {
    const ext = path.split('.').pop()?.toLowerCase();
    let language: any = 'text';
    if (['js', 'jsx'].includes(ext || '')) language = 'javascript';
    else if (['ts', 'tsx'].includes(ext || '')) language = 'typescript';
    else if (ext === 'py') language = 'python';
    else if (['cpp', 'c', 'h', 'hpp', 'cc', 'hh', 'cxx'].includes(ext || '')) language = 'c++';
    else if (ext === 'java') language = 'java';
    else if (ext === 'go') language = 'go';
    else if (ext === 'rs') language = 'rust';
    else if (ext === 'json') language = 'json';
    else if (ext === 'md') language = 'markdown';
    else if (ext === 'html') language = 'html';
    else if (ext === 'css') language = 'css';
    return language;
}

// Helper: Transform GitHub tree item to CodeFile
const transformTreeItem = (item: any, prefix: string = ''): CodeFile => {
    // If it's a file but size is huge, mark as not loaded but present
    const fullPath = prefix ? `${prefix}/${item.path}` : item.path;
    const isDir = item.type === 'tree';
    
    return {
        name: fullPath,
        language: getLanguageFromExt(fullPath),
        content: '', // Lazy load content
        sha: item.sha,
        path: fullPath,
        loaded: false,
        isDirectory: isDir,
        treeSha: isDir ? item.sha : undefined,
        childrenFetched: false
    };
};

// Fetch single file content (Lazy Load)
export async function fetchFileContent(token: string | null, owner: string, repo: string, path: string, branch: string = 'main'): Promise<string> {
    const headers: Record<string, string> = {};
    if (token) {
        headers.Authorization = `token ${token}`;
    }

    // Use Raw CDN for public/anonymous access to avoid API limits on content
    if (!token) {
        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
        // Append a timestamp to bust cache for latest version
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}?t=${Date.now()}`;
        try {
            const res = await fetch(rawUrl);
            if (!res.ok) throw new Error("Failed to fetch raw content");
            return await res.text();
        } catch (e) {
            console.warn("Raw fetch failed, trying API fallback", e);
        }
    }

    // API Fallback (or primary for private repos)
    // Also use timestamp for API to avoid caching stale content
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to fetch file content: ${res.status}`);
    
    const data = await res.json();
    if (data.encoding === 'base64' && data.content) {
        return atob(data.content.replace(/\n/g, ''));
    }
    return "// Unable to decode file content";
}

// Fetch the ROOT file tree (Non-Recursive for Lazy Loading)
export async function fetchRepoContents(token: string | null, owner: string, repo: string, branch: string): Promise<{ files: CodeFile[], latestSha: string }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  // 1. Get the reference of the branch (latest commit SHA)
  const refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  if (!refRes.ok) {
      if (refRes.status === 403) throw new Error('GitHub API rate limit exceeded. Please sign in.');
      if (refRes.status === 404) throw new Error('Branch not found or repo is empty.');
      throw new Error('Failed to fetch branch reference');
  }
  const refData = await refRes.json();
  const latestSha = refData.object.sha;

  // 2. Get the Tree (Recursive=0 for root only)
  // This allows fetching HUGE repos like MySQL without hitting API limits
  const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${latestSha}`, { headers });
  if (!treeRes.ok) {
      if (treeRes.status === 403) throw new Error('GitHub API rate limit exceeded. Please sign in.');
      throw new Error('Failed to fetch repository tree');
  }
  const treeData = await treeRes.json();

  // 3. Transform Items
  const files: CodeFile[] = treeData.tree.map((item: any) => transformTreeItem(item, ''));

  return { files, latestSha };
}

// Fetch a specific sub-tree (folder contents)
export async function fetchRepoSubTree(token: string | null, owner: string, repo: string, treeSha: string, prefix: string): Promise<CodeFile[]> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}`, { headers });
    if (!treeRes.ok) {
        throw new Error('Failed to fetch folder contents');
    }
    const treeData = await treeRes.json();
    
    // Transform items with the current prefix (e.g. 'src/utils')
    const files: CodeFile[] = treeData.tree.map((item: any) => transformTreeItem(item, prefix));
    
    return files;
}

// Fetch Commit History
export async function fetchRepoCommits(token: string | null, owner: string, repo: string, branch: string, limit = 20): Promise<any[]> {
    const headers: Record<string, string> = {};
    if (token) {
        headers.Authorization = `token ${token}`;
    }
    
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Failed to fetch commits");
    return await res.json();
}

// Update (Save) a single file
export async function updateRepoFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha: string | undefined, // File SHA needed for update
  message: string,
  branch: string
): Promise<{ sha: string }> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
  
  // If we don't have a SHA, try to get it first (in case it wasn't tracked or changed remotely)
  let fileSha = sha;
  if (!fileSha) {
      try {
          const check = await fetch(url + `?ref=${branch}`, { headers: { Authorization: `token ${token}` } });
          if (check.ok) {
              const data = await check.json();
              fileSha = data.sha;
          }
      } catch(e) {}
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      content: btoa(content),
      sha: fileSha, // Required for updates, omitted for new files
      branch: branch
    })
  });

  if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub Save Failed: ${err.message}`);
  }
  
  const data = await res.json();
  return { sha: data.content.sha };
}

// Delete a file
export async function deleteRepoFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string,
  message: string,
  branch: string
): Promise<void> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      sha: sha,
      branch: branch
    })
  });

  if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub Delete Failed: ${err.message}`);
  }
}

// Move/Rename a file
export async function renameRepoFile(
  token: string,
  owner: string,
  repo: string,
  oldPath: string,
  newPath: string,
  content: string, // Need content to recreate file
  oldSha: string,
  branch: string
): Promise<{ newSha: string }> {
    
    // 1. Create new file
    const createRes = await updateRepoFile(token, owner, repo, newPath, content, undefined, `Rename ${oldPath} to ${newPath}`, branch);
    
    // 2. Delete old file
    // Note: This is not atomic. In a real-world scenario, you'd use the Git Tree API for atomic moves.
    // For this simple implementation, we do it sequentially.
    await deleteRepoFile(token, owner, repo, oldPath, oldSha, `Remove ${oldPath} (Renamed to ${newPath})`, branch);
    
    return { newSha: createRes.sha };
}

// Commit and Push changes (Batch - Legacy method for CodeStudio project sync)
export async function commitToRepo(
  token: string, 
  project: CodeProject, 
  message: string
): Promise<string> {
  if (!project.github) throw new Error("Project is not linked to GitHub");
  const { owner, repo, branch, sha: parentSha } = project.github;

  // 1. Create Blobs for changed files
  // Filter out files that were not loaded (lazy loaded files that user didn't touch shouldn't be overwritten with empty string)
  // Also filter out directories, as git/trees expects blobs for files
  const filesToCommit = project.files.filter(f => f.loaded !== false && !f.isDirectory);

  const treeItems = await Promise.all(filesToCommit.map(async (file) => {
    const blobRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: file.content,
        encoding: 'utf-8'
      })
    });
    const blobData = await blobRes.json();
    return {
      path: file.name, // or file.path
      mode: '100644', // file mode
      type: 'blob',
      sha: blobData.sha
    };
  }));

  // 2. Create Tree
  const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({
      base_tree: parentSha, // Important: base off previous commit to keep deleted files etc (unless we want to overwrite)
      tree: treeItems
    })
  });
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = await treeRes.json();

  // 3. Create Commit
  const commitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({
      message: message,
      tree: treeData.sha,
      parents: [parentSha]
    })
  });
  if (!commitRes.ok) throw new Error('Failed to create commit');
  const commitData = await commitRes.json();

  // 4. Update Reference (Move HEAD)
  const updateRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH', // Update reference
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({
      sha: commitData.sha,
      force: false
    })
  });
  if (!updateRes.ok) throw new Error('Failed to update branch reference');

  return commitData.sha;
}
