import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage.interface';
import { UploadImageDto } from './dto/upload-image.dto';

@Injectable()
export class ImagesService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async upload(file: Express.Multer.File, dto: UploadImageDto) {
    // Validate the target exists before storing anything.
    if (dto.itemType === 'RAW') {
      const c = await this.prisma.rawCard.findUnique({ where: { id: dto.itemId } });
      if (!c) throw new NotFoundException('Raw card not found');
    } else {
      const s = await this.prisma.slabCard.findUnique({ where: { id: dto.itemId } });
      if (!s) throw new NotFoundException('Slab not found');
    }

    const id = randomUUID();
    // 1:1 compressed main image + square thumbnail (webp for size).
    const main = await sharp(file.buffer)
      .resize(1000, 1400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const thumb = await sharp(file.buffer)
      .resize(300, 420, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const mainKey = `cards/${id}.webp`;
    const thumbKey = `cards/${id}_thumb.webp`;
    const saved = await this.storage.save(mainKey, main, 'image/webp');
    await this.storage.save(thumbKey, thumb, 'image/webp');

    const image = await this.prisma.cardImage.create({
      data: {
        itemType: dto.itemType,
        rawCardId: dto.itemType === 'RAW' ? dto.itemId : null,
        slabId: dto.itemType === 'SLAB' ? dto.itemId : null,
        url: saved.url,
        storageKey: mainKey,
        isPrimary: true,
      },
    });
    return { ...image, thumbnailUrl: saved.url.replace('.webp', '_thumb.webp') };
  }

  async remove(id: string) {
    const image = await this.prisma.cardImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('Image not found');
    await this.storage.delete(image.storageKey);
    await this.storage.delete(image.storageKey.replace('.webp', '_thumb.webp'));
    await this.prisma.cardImage.delete({ where: { id } });
    return { message: 'Image deleted' };
  }
}
