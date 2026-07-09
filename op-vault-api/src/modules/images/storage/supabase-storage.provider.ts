import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageProvider, StoredImage } from './storage.interface';

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private readonly logger = new Logger(SupabaseStorageProvider.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('supabase.url');
    const key = config.get<string>('supabase.serviceKey');
    this.bucket = config.get<string>('supabase.bucket') ?? 'card-images';
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required for supabase storage');
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async save(key: string, data: Buffer, contentType: string): Promise<StoredImage> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, data, { contentType, upsert: true, cacheControl: '3600' });
    if (error) {
      this.logger.error(`Supabase upload failed for ${key}: ${error.message}`);
      throw error;
    }
    const { data: pub } = this.client.storage.from(this.bucket).getPublicUrl(key);
    return { url: pub.publicUrl, storageKey: key };
  }

  async delete(storageKey: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([storageKey]);
    if (error) this.logger.warn(`Supabase delete failed for ${storageKey}: ${error.message}`);
  }

  async list(prefix = ''): Promise<string[]> {
    const folder = prefix.replace(/\/$/, '');
    const out: string[] = [];
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { limit: 1000 });
    if (error) { this.logger.warn(`Supabase list failed: ${error.message}`); return out; }
    for (const item of data ?? []) {
      if (item.id) out.push(folder ? `${folder}/${item.name}` : item.name);
    }
    return out;
  }
}