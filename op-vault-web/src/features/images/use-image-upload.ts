import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { imagesService } from '@/services';
import type { CardImage } from '@/types';

// Shared image upload/remove logic with progress + cache invalidation.
export function useImageUpload() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['raw-cards'] });
    qc.invalidateQueries({ queryKey: ['slabs'] });
    qc.invalidateQueries({ queryKey: ['favorites'] });
    qc.invalidateQueries({ queryKey: ['pinned'] });
  };

  const upload = async (file: File, itemType: 'RAW' | 'SLAB', itemId: string): Promise<CardImage> => {
    setUploading(true); setProgress(0);
    try {
      const image = await imagesService.upload(file, itemType, itemId, setProgress);
      invalidate();
      return image;
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (id: string) => {
    await imagesService.remove(id);
    invalidate();
  };

  return { upload, removeImage, uploading, progress };
}
