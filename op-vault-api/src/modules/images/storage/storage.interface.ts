export interface StoredImage {
  url: string;
  storageKey: string;
}

/** Storage abstraction — swap LocalStorageProvider for S3/Cloudinary later
 *  without touching ImagesService. */
export interface StorageProvider {
  save(key: string, data: Buffer, contentType: string): Promise<StoredImage>;
  delete(storageKey: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
