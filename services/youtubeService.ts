
/**
 * YouTube Data API v3 Resumable Upload Service
 */
import { firebaseKeys } from './private_keys';

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
    const clientId = firebaseKeys.googleClientId;
    
    console.log("[YouTube Debug] Handshake started.");
    console.log("[YouTube Debug] Origin:", origin);
    console.log("[YouTube Debug] Client ID:", clientId);
    
    // Step 0: Permission Audit
    try {
        const auditRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!auditRes.ok) console.warn("[YouTube Audit] Permission check non-200. Check scopes.");
    } catch (auditErr: any) {
        if (auditErr.message === 'Failed to fetch') {
            throw new Error(`CORS BLOCK: 'Failed to fetch'. 
            
The browser blocked the request before it left your computer.
1. Visit Google Cloud Console.
2. Select Client ID: ${clientId}
3. Confirm '${origin}' is in 'Authorized JavaScript origins'.
4. Ensure no ad-blockers are active.`);
        }
    }

    const mimeType = videoBlob.type || 'video/webm';
    const initUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
    
    const body = {
        snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: ['AIVoiceCast', 'NeuralArchive'],
            categoryId: '27' // Education
        },
        status: {
            privacyStatus: metadata.privacyStatus,
            selfDeclaredMadeForKids: false
        }
    };

    console.log("[YouTube] Phase 1: Obtaining Upload Location...");
    
    let initRes: Response;
    try {
        initRes = await fetch(initUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(body)
        });
    } catch (fetchErr: any) {
        console.error("[YouTube Handshake Error]", fetchErr);
        throw new Error(`Handshake Failed: ${fetchErr.message}`);
    }

    if (!initRes.ok) {
        let errorData: any = {};
        try { errorData = await initRes.json(); } catch(e) {}
        console.error("[YouTube Handshake Error Payload]", errorData);
        
        if (initRes.status === 403) {
            throw new Error("YouTube API 403: Verify 'youtube.upload' scope is granted and channel is initialized.");
        }
        
        throw new Error(`YouTube Handshake Error (${initRes.status}): ${errorData.error?.message || initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
        throw new Error("Missing Location header from YouTube handshake.");
    }

    console.log("[YouTube] Phase 2: Pushing Binary Stream...");
    
    let uploadRes: Response;
    try {
        uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 
                'Content-Type': mimeType
            },
            body: videoBlob
        });
    } catch (uploadErr: any) {
        console.error("[YouTube Binary Stream Error]", uploadErr);
        throw new Error(`Binary Stream Failure: ${uploadErr.message}`);
    }

    if (!uploadRes.ok) {
        const error = await uploadRes.json().catch(() => ({}));
        throw new Error(`YouTube Finalization Failure (${uploadRes.status}): ${error.error?.message || uploadRes.statusText}`);
    }

    const data = await uploadRes.json();
    console.log("[YouTube] Phase 3: Transfer Complete. ID:", data.id);
    return data.id; 
}

export function getYouTubeVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}
