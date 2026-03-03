import { env } from '../../config/env';
import { LocalStorage } from './local.storage';
import type { StorageService } from './storage.interface';

let _storage: StorageService | null = null;

export function getStorage(): StorageService {
  if (!_storage) {
    if (env.STORAGE_PROVIDER === 'local') {
      _storage = new LocalStorage();
    } else {
      // S3 storage: add when needed
      throw new Error('S3 storage not implemented');
    }
  }
  return _storage;
}

export type { StorageService };
