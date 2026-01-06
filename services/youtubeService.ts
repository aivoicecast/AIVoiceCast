
/**
 * YouTube Data API v3 Resumable Upload Service
 */

export interface YouTubeUploadMetadata {
    title: string;
    description: string;
    privacyStatus: 'private' | 'unlisted' | 'public';
}

/**
 * Uploads a video blob to the user's YouTube channel using the resumable protocol.
 */
export async function uploadToYouTube(accessToken: string, videoBlob: Blob, metadata: YouTubeUploadMetadata): Promise<string> {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    console.log("[YouTube] Handshake attempt from origin:", origin);
    
    // NEW: Pre-flight Audit. Check if the token/origin is fundamentally blocked before starting upload.
    try {
        console.log("[YouTube] Audit: Verifying account permissions...");
        const auditRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!auditRes.ok) console.warn("[YouTube] Audit non-200, proceeding anyway...");
    } catch (auditErr: any) {
        if (auditErr.message === 'Failed to fetch') {
            throw new Error(`Audit Blocked: 'Failed to fetch'. 
            
CRITICAL: The browser blocked the connection before it reached Google. 
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID.
3. ADD '${origin}' to 'Authorized JavaScript origins'.
4. Wait 5 minutes for Google to propagate the change.`);
        }
    }

    const mimeType = videoBlob.type || 'video/webm';
    const initUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
    
    const body = {
        snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: ['AIVoiceCast', 'AI'],
            categoryId: '27' // Education
        },
        status: {
            privacyStatus: metadata.privacyStatus,
            selfDeclaredMadeForKids: false
        }
    };

    console.log("[YouTube] Phase 1: Requesting upload URL...");
    
    let initRes: Response;
    try {
        initRes = await fetch(initUrl, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(body)
        });
    } catch (fetchErr: any) {
        console.error("[YouTube] Handshake network error:", fetchErr);
        if (fetchErr.message === 'Failed to fetch') {
            throw new Error(`Handshake Blocked: 'Failed to fetch'. 
            
Ensure '${origin}' is authorized in Google Cloud Console.`);
        }
        throw fetchErr;
    }

    if (!initRes.ok) {
        let errorData: any = {};
        try { errorData = await initRes.json(); } catch(e) {}
        console.error("[YouTube] Handshake failed:", errorData);
        
        if (initRes.status === 403) {
            throw new Error("403: Forbidden. Verify OAuth scopes (youtube.upload) and verify your channel exists.");
        }
        
        throw new Error(`YouTube error (${initRes.status}): ${errorData.error?.message || initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
        throw new Error("No Location header returned from YouTube.");
    }

    console.log("[YouTube] Phase 2: Streaming binary data...");
    
    let uploadRes: Response;
    try {
        uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            mode: 'cors',
            headers: { 
                'Content-Type': mimeType,
                'Content-Length': videoBlob.size.toString()
            },
            body: videoBlob
        });
    } catch (uploadErr: any) {
        console.error("[YouTube] Binary push error:", uploadErr);
        throw new Error(`Upload stream failed: ${uploadErr.message}`);
    }

    if (!uploadRes.ok) {
        const error = await uploadRes.json().catch(() => ({}));
        throw new Error(`YouTube finalization failed (${uploadRes.status}): ${error.error?.message || uploadRes.statusText}`);
    }

    const data = await uploadRes.json();
    console.log("[YouTube] Phase 3: Done! Video ID:", data.id);
    return data.id; 
}

export function getYouTubeVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}
