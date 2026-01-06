
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
    console.log("[YouTube] Starting upload process for:", metadata.title);
    console.log("[YouTube] Blob size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");

    const initUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
    
    const body = {
        snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: ['AIVoiceCast', 'MockInterview', 'AI'],
            categoryId: '27' // Education
        },
        status: {
            privacyStatus: metadata.privacyStatus,
            selfDeclaredMadeForKids: false
        }
    };

    console.log("[YouTube] Step 1: Initializing resumable session...");
    const initRes = await fetch(initUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': videoBlob.size.toString(),
            'X-Upload-Content-Type': videoBlob.type
        },
        body: JSON.stringify(body)
    });

    if (!initRes.ok) {
        let errorData: any = {};
        try { errorData = await initRes.json(); } catch(e) {}
        
        console.error("[YouTube] Initialization failed:", errorData);
        
        // Specific check for insufficient scopes
        if (initRes.status === 403 || (errorData.error?.errors?.[0]?.reason === 'insufficientPermissions')) {
            throw new Error("403: Insufficient YouTube Permissions. You must sign out and sign in again to grant the 'youtube.upload' scope.");
        }
        
        throw new Error(`YouTube initialization failed: ${errorData.error?.message || initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
        console.error("[YouTube] No Location header received.");
        throw new Error("Did not receive a YouTube upload location header.");
    }

    console.log("[YouTube] Step 2: Uploading binary data to location...");
    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': videoBlob.type
        },
        body: videoBlob
    });

    if (!uploadRes.ok) {
        const error = await uploadRes.json();
        console.error("[YouTube] Binary upload failed:", error);
        throw new Error(`YouTube upload failed: ${error.error?.message || uploadRes.statusText}`);
    }

    const data = await uploadRes.json();
    console.log("[YouTube] Step 3: Upload successful! Video ID:", data.id);
    return data.id; 
}

export function getYouTubeVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}
