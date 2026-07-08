import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, relative, sep } from 'path';
import { StorageProvider, StoredImage } from './storage.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly dir: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.dir = config.get<string>('uploadDir') ?? './uploads';
    this.publicUrl = config.get<string>('publicUrl') ?? '';
  }

  async save(key: string, data: Buffer): Promise<StoredImage> {
    const full = join(this.dir, key);
    await fs.mkdir(join(full, '..'), { recursive: true });
    await fs.writeFile(full, data);
    return { url: `${this.publicUrl}/uploads/${key}`, storageKey: key };
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await fs.unlink(join(this.dir, storageKey));
    } catch {
      /* already gone — safe to ignore */
    }
  }

  async list(prefix = ''): Promise<string[]> {
    const base = join(this.dir, prefix);
    const out: string[] = [];
    const walk = async (abs: string) => {
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(abs, { withFileTypes: true });
      } catch {
        return; // directory doesn't exist yet
      }
      for (const e of entries) {
        const child = join(abs, e.name);
        if (e.isDirectory()) await walk(child);
        else if (e.isFile()) {
          // Return keys relative to the storage root, using posix separators.
          out.push(relative(this.dir, child).split(sep).join('/'));
        }
      }
    };
    await walk(base);
    return out;
  }
}
