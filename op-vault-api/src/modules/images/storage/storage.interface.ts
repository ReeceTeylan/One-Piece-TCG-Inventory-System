export interface StoredImage {
  url: string;
  storageKey: string;
}

/** Storage abstraction — swap LocalStorageProvider for S3/Cloudinary later
 *  without touching ImagesService. */
export interface StorageProvider {
  save(key: string, data: Buffer, contentType: string): Promise<StoredImage>;
  delete(storageKey: string): Promise<void>;
  /** List all stored keys, optionally under a prefix (e.g. 'cards/').
   *  Used by the orphan-image cleanup job. Implementations for S3/Cloudinary
   *  will page through their object listing APIs. */
  list(prefix?: string): Promise<string[]>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
