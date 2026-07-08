import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { GeneratePostDto } from './dto/generate-post.dto';

const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class FacebookGeneratorService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  /** Compose a high-resolution 5×4 square-card PNG for Facebook posting. */
  async generate(dto: GeneratePostDto): Promise<Buffer> {
    const cards = dto.cardIds?.length
      ? await this.prisma.rawCard.findMany({ where: { id: { in: dto.cardIds } } })
      : await this.prisma.rawCard.findMany({
          where: { quantity: { gt: 0 } }, orderBy: { createdAt: 'desc' }, take: dto.count,
        });

    const storeName = await this.settings.get<string>('storeName');
    const dark = dto.theme === 'dark';
    const bg = dark ? '#111111' : '#FFFFFF';
    const fg = dark ? '#F1F1F3' : '#111111';
    const sub = dark ? '#9A9AA2' : '#666666';
    const cardBg = dark ? '#1C1C1F' : '#F5F5F5';
    const green = '#16A34A';

    const cols = 5;
    const gap = 24;
    const pad = 40;
    const cell = 360;                       // square cell
    const meta = 96;                        // meta strip height
    const headerH = dto.showLogo ? 90 : 0;
    const rows = Math.max(1, Math.ceil(cards.length / cols));
    const width = pad * 2 + cols * cell + (cols - 1) * gap;
    const height = pad * 2 + headerH + rows * (cell + meta) + (rows - 1) * gap;

    let body = '';
    if (dto.showLogo) {
      body += `
        <rect x="${pad}" y="${pad}" width="56" height="56" rx="12" fill="#1E293B"/>
        <text x="${pad + 28}" y="${pad + 37}" font-size="24" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">OP</text>
        <text x="${pad + 72}" y="${pad + 26}" font-size="26" font-weight="800" fill="${fg}" font-family="Arial">${esc(storeName)}</text>
        <text x="${pad + 72}" y="${pad + 54}" font-size="16" fill="${sub}" font-family="Arial">One Piece TCG · DM to order · prices in PHP</text>`;
    }

    cards.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * (cell + gap);
      const y = pad + headerH + row * (cell + meta + gap);
      const price = `PHP ${Number(c.postedPrice).toLocaleString('en-PH')}`;
      body += `
        <g>
          <rect x="${x}" y="${y}" width="${cell}" height="${cell + meta}" rx="16" fill="${cardBg}"/>
          <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="16" fill="${dark ? '#242428' : '#E5E5E5'}"/>
          <text x="${x + cell / 2}" y="${y + cell / 2}" font-size="18" fill="${sub}" text-anchor="middle" font-family="Arial">CARD IMAGE</text>
          <rect x="${x + cell - 78}" y="${y + 14}" width="64" height="26" rx="6" fill="#1E293B"/>
          <text x="${x + cell - 46}" y="${y + 32}" font-size="15" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">${esc(c.rarity)}</text>
          <text x="${x + 16}" y="${y + cell + 34}" font-size="19" font-weight="800" fill="${fg}" font-family="Arial">${esc(c.name.slice(0, 22))}</text>
          <text x="${x + 16}" y="${y + cell + 58}" font-size="15" fill="${sub}" font-family="Arial">${esc(c.cardNumber)} · Qty ${c.quantity}</text>
          <text x="${x + 16}" y="${y + cell + 84}" font-size="20" font-weight="800" fill="${green}" font-family="Arial">${esc(price)}</text>
        </g>`;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="${bg}"/>${body}</svg>`;

    return sharp(Buffer.from(svg)).png({ quality: 100 }).toBuffer();
  }
}
