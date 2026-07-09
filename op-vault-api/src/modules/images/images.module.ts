import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { CleanupService } from './cleanup.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { SupabaseStorageProvider } from './storage/supabase-storage.provider';
import { STORAGE_PROVIDER } from './storage/storage.interface';

@Module({
  providers: [
    ImagesService,
    CleanupService,
    LocalStorageProvider,
    SupabaseStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider, SupabaseStorageProvider],
      useFactory: (
        config: ConfigService,
        local: LocalStorageProvider,
        supabase: SupabaseStorageProvider,
      ) =>
        config.get<string>('storageDriver') === 'supabase' ? supabase : local,
    },
  ],
  controllers: [ImagesController],
  exports: [ImagesService],
})
export class ImagesModule {}