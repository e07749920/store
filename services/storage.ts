import { supabase } from '../lib/supabaseClient';

const BUCKET_NAME = 'inventory-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const storageService = {
  async uploadImage(file: File, materialNo: string): Promise<string> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size must be less than 5MB');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPG, PNG, and WebP images are allowed');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${materialNo}-${Date.now()}.${fileExt}`;
    const filePath = `items/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrl;
  },

  async deleteImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return;

    try {
      const urlParts = imageUrl.split(`/${BUCKET_NAME}/`);
      if (urlParts.length < 2) return;

      const filePath = urlParts[1];

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  },

  compressImage(file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            file.type,
            quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
};
