import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';
import type { StorageService } from './storage.interface';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export class CloudinaryStorage implements StorageService {
  async save(filename: string, buffer: Buffer, mimeType: string): Promise<string> {
    const folder = mimeType.includes('pdf') || mimeType.includes('word') ? 'cv-scan/documents' : 'cv-scan/files';

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'upload',
          access_mode: 'public',
          folder,
          public_id: filename,
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result!.secure_url);
        },
      );
      stream.end(buffer);
    });
  }

  async delete(storagePath: string): Promise<void> {
    const publicId = this.extractPublicId(storagePath);
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => {
      // Ignore if already deleted
    });
  }

  async getUrl(storagePath: string): Promise<string> {
    return storagePath;
  }

  private extractPublicId(url: string): string {
    // URL format: https://res.cloudinary.com/{cloud}/raw/upload/v{version}/{folder}/{filename}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) throw new Error(`Cannot extract public_id from Cloudinary URL: ${url}`);
    // Remove file extension for the public_id
    return match[1].replace(/\.[^/.]+$/, '');
  }
}
