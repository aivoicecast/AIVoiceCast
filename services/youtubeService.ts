
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
    
    console.log("[YouTube] Resumable upload started.");
    
    // Step 0: Permission Audit (Optional, but helps debug)
    try {
        const auditRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!auditRes.ok) {
            console.warn("[YouTube Audit] User might not have a YouTube channel initialized.");
        }
    } catch (auditErr: any) {
        console.warn("[YouTube Audit] Pre-check failed, proceeding anyway:", auditErr.message);
    }

    const mimeType = videoBlob.type || 'video/webm';
    const size = videoBlob.size;
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
        // CRITICAL: Resumable uploads require X-Upload headers in the initiation request
        initRes = await fetch(initUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': mimeType,
                'X-Upload-Content-Length': size.toString()
            },
            body: JSON.stringify(body)
        });
    } catch (fetchErr: any) {
        console.error("[YouTube Handshake Error]", fetchErr);
        if (fetchErr.message === 'Failed to fetch') {
            throw new Error(`YouTube Handshake Failed: Network Error or CORS Block. Check if '${origin}' is authorized for Client ID ${clientId} in Google Cloud Console.`);
        }
        throw new Error(`Handshake Failed: ${fetchErr.message}`);
    }

    if (!initRes.ok) {
        const errorData = await initRes.json().catch(() => ({}));
        console.error("[YouTube Handshake Error Payload]", errorData);
        throw new Error(`YouTube Handshake Error (${initRes.status}): ${errorData.error?.message || initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
        throw new Error("Missing Location header from YouTube handshake response.");
    }

    console.log("[YouTube] Phase 2: Pushing Binary Stream...");
    
    let uploadRes: Response;
    try {
        uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 
                'Content-Type': mimeType,
                'Content-Length': size.toString()
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
    console.log("[YouTube] Phase 3: Transfer Complete. Video ID:", data.id);
    return data.id; 
}

/**
 * Deletes a video from the user's YouTube channel.
 */
export async function deleteYouTubeVideo(accessToken: string, videoId: string): Promise<void> {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok && res.status !== 404) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`YouTube Deletion Failed (${res.status}): ${errorData.error?.message || res.statusText}`);
    }
}

export function getYouTubeVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}
