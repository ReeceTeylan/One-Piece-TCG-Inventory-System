import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { FacebookGeneratorService } from './facebook-generator.service';
import { GeneratePostDto } from './dto/generate-post.dto';

@ApiTags('facebook-generator')
@ApiBearerAuth()
@ApiProduces('image/png')
@Controller('facebook')
export class FacebookGeneratorController {
  constructor(private service: FacebookGeneratorService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a high-res 5×4 Facebook post PNG (light/dark, optional logo)' })
  async generate(@Body() dto: GeneratePostDto, @Res() res: Response) {
    const png = await this.service.generate(dto);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="op-vault-post.png"');
    res.send(png);
  }
}
