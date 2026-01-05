
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
        const error = await initRes.json();
        throw new Error(`YouTube initialization failed: ${error.error?.message || initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error("Did not receive a YouTube upload location header.");

    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': videoBlob.type
        },
        body: videoBlob
    });

    if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(`YouTube upload failed: ${error.error?.message || uploadRes.statusText}`);
    }

    const data = await uploadRes.json();
    return data.id; 
}

export function getYouTubeVideoUrl(videoId: string): string {
    // Return standard watch URL which is used for string-matching in RecordingList
    return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}
