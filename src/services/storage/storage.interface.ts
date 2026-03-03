export interface StorageService {
  save(filename: string, buffer: Buffer, mimeType: string): Promise<string>;
  delete(storagePath: string): Promise<void>;
  getUrl(storagePath: string): Promise<string>;
}
