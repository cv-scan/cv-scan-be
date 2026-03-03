import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import type { StorageService } from './storage.interface';

export class LocalStorage implements StorageService {
  private uploadDir = env.LOCAL_UPLOAD_DIR;

  async save(filename: string, buffer: Buffer, _mimeType: string): Promise<string> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const filePath = path.join(this.uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  async delete(storagePath: string): Promise<void> {
    await fs.unlink(storagePath).catch(() => {
      // Ignore if file already deleted
    });
  }

  async getUrl(storagePath: string): Promise<string> {
    return storagePath;
  }
}
