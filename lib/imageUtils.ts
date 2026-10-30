/**
 * Client-side WebP Image Optimization & Conversion Utility
 * Converts uploaded images to high-efficiency WebP format before storage
 */

export interface WebPConversionResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  webpSize: number;
}

/**
 * Converts any image File (JPEG, PNG, GIF, BMP, etc.) to a high-quality WebP Blob
 */
export async function convertToWebP(
  file: File | Blob,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.85
): Promise<WebPConversionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));

    img.onload = () => {
      let { width, height } = img;

      // Maintain aspect ratio while bounding maximum dimensions
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas rendering context not available'));
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to WebP blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('WebP compression failed'));
          }

          const dataUrl = canvas.toDataURL('image/webp', quality);
          resolve({
            blob,
            dataUrl,
            width,
            height,
            originalSize: file.size,
            webpSize: blob.size,
          });
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to decode image data'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validates that an uploaded file is a valid image
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a valid image file (JPG, PNG, WebP, GIF, or BMP).',
    };
  }

  // 10MB limit before compression
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Image is too large. Please select an image under 10MB.',
    };
  }

  return { valid: true };
}

