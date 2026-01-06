
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
    console.log("[YouTube] Starting upload process from origin:", origin);
    console.log("[YouTube] Metadata:", metadata.title);
    
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

    console.log("[YouTube] Step 1: Initializing resumable session...");
    
    let initRes: Response;
    try {
        initRes = await fetch(initUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Length': videoBlob.size.toString(),
                'X-Upload-Content-Type': mimeType
            },
            body: JSON.stringify(body)
        });
    } catch (fetchErr: any) {
        console.error("[YouTube] Handshake network error:", fetchErr);
        if (fetchErr.message === 'Failed to fetch') {
            throw new Error(`Handshake Failed: 'Failed to fetch'. 
            
1. Ensure the origin '${origin}' is added to 'Authorized JavaScript origins' in your Google Cloud Console for the OAuth Client ID.
2. Verify 'YouTube Data API v3' is enabled in your GCP project.
3. Check if an ad-blocker is blocking googleapis.com.`);
        }
        throw fetchErr;
    }

    if (!initRes.ok) {
        let errorData: any = {};
        try { errorData = await initRes.json(); } catch(e) {}
        console.error("[YouTube] Initialization failed:", errorData);
        
        if (initRes.status === 403) {
            throw new Error("403 Forbidden: Ensure your API key/token has 'youtube.upload' scope and the YouTube channel is set up.");
        }
        
        throw new Error(`YouTube initialization failed (${initRes.status}): ${errorData.error?.message || initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
        throw new Error("No upload Location header received from YouTube.");
    }

    console.log("[YouTube] Step 2: Uploading binary data...");
    
    let uploadRes: Response;
    try {
        uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: videoBlob
        });
    } catch (uploadErr: any) {
        console.error("[YouTube] Binary upload error:", uploadErr);
        throw new Error(`Binary upload failed: ${uploadErr.message}`);
    }

    if (!uploadRes.ok) {
        const error = await uploadRes.json().catch(() => ({}));
        throw new Error(`YouTube upload failed (${uploadRes.status}): ${error.error?.message || uploadRes.statusText}`);
    }

    const data = await uploadRes.json();
    console.log("[YouTube] Step 3: Success! ID:", data.id);
    return data.id; 
}

export function getYouTubeVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}
