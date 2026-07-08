import { Module } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { CleanupService } from './cleanup.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { STORAGE_PROVIDER } from './storage/storage.interface';

@Module({
  providers: [
    ImagesService,
    CleanupService,
    LocalStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: LocalStorageProvider },
  ],
  controllers: [ImagesController],
  exports: [ImagesService],
})
export class ImagesModule {}
