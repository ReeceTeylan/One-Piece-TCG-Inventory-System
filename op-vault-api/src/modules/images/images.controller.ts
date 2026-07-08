import {
  Controller, Delete, Param, ParseFilePipeBuilder, Post, UploadedFile, UseInterceptors, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { UploadImageDto } from './dto/upload-image.dto';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

@ApiTags('images')
@ApiBearerAuth()
@Controller('images')
export class ImagesController {
  constructor(private service: ImagesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a card/slab image (jpeg/png/webp, max 5MB). Auto 1:1 + thumbnail.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        itemType: { type: 'string', enum: ['RAW', 'SLAB'] },
        itemId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) =>
        /^image\/(jpeg|png|webp)$/.test(file.mimetype)
          ? cb(null, true)
          : cb(new Error('Only JPEG, PNG or WebP images are allowed'), false),
    }),
  )
  upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: MAX_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadImageDto,
  ) {
    return this.service.upload(file, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an image (removes files + record)' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
