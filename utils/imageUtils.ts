
/**
 * Resizes an image to a maximum width/height while maintaining aspect ratio.
 * Returns a Base64 Data URL (JPEG).
 */
export const resizeImage = (file: File, maxWidth: number = 1024, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Convert to JPEG for efficiency
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } else {
                    reject(new Error("Canvas context failed"));
                }
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};
