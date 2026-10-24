import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { imageUrlForSource, readReferenceImage, yuyuteiImageFallback, type ArtworkSource } from '../market-prices/artwork-compare';
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
    // Preserve the card's real aspect ratio (e.g. 5:7) instead of square-cropping it.
    // 'inside' bounds the image within 1000x1400 without cropping or enlarging.
    const main = await sharp(file.buffer)
      .resize(1000, 1400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    // 63x88mm card ratio, same as the main image — a square crop cuts the card's sides off.
    const thumb = await sharp(file.buffer)
      .resize(300, 420, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const mainKey = `cards/${id}.webp`;
    const thumbKey = `cards/${id}_thumb.webp`;
    const saved = await this.storage.save(mainKey, main, 'image/webp');
    await this.storage.save(thumbKey, thumb, 'image/webp');

    // Replace behavior: remove any existing image(s) for this item so a card
    // has exactly one image and old files don't become orphans.
    const existing = await this.prisma.cardImage.findMany({
      where: dto.itemType === 'RAW' ? { rawCardId: dto.itemId } : { slabId: dto.itemId },
    });
    for (const old of existing) {
      await this.storage.delete(old.storageKey);
      await this.storage.delete(old.storageKey.replace('.webp', '_thumb.webp'));
    }
    if (existing.length) {
      await this.prisma.cardImage.deleteMany({
        where: { id: { in: existing.map((e) => e.id) } },
      });
    }

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

  /**
   * Opt-in import from a specifically chosen and verified market catalog listing.
   * The client never supplies a URL; all lookup and fetching is server-side.
   * Image copying is only allowed after the owner confirms reuse rights.
   */
  async importMarketArtwork(dto: {
    itemId: string; listingKey: string; source: ArtworkSource; authorized: boolean;
  }) {
    if (dto.authorized !== true) throw new ForbiddenException('Confirm permission to reuse this third-party artwork');
    if (!['YUYUTEI', 'CARDRUSH', 'TCGPLAYER'].includes(dto.source)) throw new BadRequestException('Invalid market source');
    const card = await this.prisma.rawCard.findUnique({
      where: { id: dto.itemId },
      select: { id: true, cardNumber: true, marketListingKey: true },
    });
    if (!card) throw new NotFoundException('Raw card not found');
    if (!dto.listingKey || card.marketListingKey !== dto.listingKey)
      throw new BadRequestException('Select and save the verified listing before importing its image');

    const listing = dto.source === 'TCGPLAYER'
      ? await this.prisma.tcgplayerPrice.findFirst({
          where: { listingKey: dto.listingKey, cardNumber: card.cardNumber },
          select: { imageUrl: true },
        })
      : await this.prisma.marketPrice.findFirst({
          where: { listingKey: dto.listingKey, cardNumber: card.cardNumber,
            source: dto.source === 'CARDRUSH' ? 'CARDRUSH' : { in: ['YUYUTEI', 'YUYUTEI_LINK'] } },
          select: { imageUrl: true },
        });
    if (!listing) throw new BadRequestException('The selected source image is no longer linked to this card');
    const url = imageUrlForSource(listing.imageUrl, dto.source)
      ?? (dto.source === 'YUYUTEI' ? yuyuteiImageFallback(dto.listingKey) : null);
    if (!url) throw new BadRequestException('This source listing has no usable artwork');
    let image: Buffer;
    try {
      image = await readReferenceImage(url, dto.source);
      await sharp(image, { limitInputPixels: 16000000 }).metadata();
    } catch {
      throw new BadRequestException('Artwork unavailable from this source. Upload your own photo instead.');
    }
    // Reuse the standard image processing, storage, and replacement path.
    return this.upload({ buffer: image } as Express.Multer.File, { itemType: 'RAW', itemId: dto.itemId });
  }

  /**
   * GCash / Maya QR for the sale receipt image. Stored losslessly (QR codes
   * must stay sharp) outside cards/ so the orphan cleanup never touches it;
   * its URL lives in settings as gcashQrUrl / mayaQrUrl.
   */
  async uploadPaymentQr(file: Express.Multer.File, method: PaymentQr) {
    const data = await sharp(file.buffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ lossless: true })
      .toBuffer();
    const key = `payment/${method}-${randomUUID()}.webp`;
    const saved = await this.storage.save(key, data, 'image/webp');
    await this.replaceQrSetting(method, { url: saved.url, key });
    return { method, url: saved.url };
  }

  async removePaymentQr(method: PaymentQr) {
    await this.replaceQrSetting(method, null);
    return { method, url: null };
  }

  private async replaceQrSetting(method: PaymentQr, next: { url: string; key: string } | null) {
    const keyName = `${method}QrKey`;
    const old = await this.prisma.setting.findUnique({ where: { key: keyName } });
    const set = (key: string, value: string | null) => this.prisma.setting.upsert({
      where: { key },
      update: { value: value === null ? Prisma.JsonNull : value },
      create: { key, value: value === null ? Prisma.JsonNull : value },
    });
    await this.prisma.$transaction([set(`${method}QrUrl`, next?.url ?? null), set(keyName, next?.key ?? null)]);
    if (typeof old?.value === 'string' && old.value !== next?.key) {
      await this.storage.delete(old.value).catch(() => undefined);
    }
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

export type PaymentQr = 'gcash' | 'maya';
