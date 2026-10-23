import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarketPricesService } from './market-prices.service';
import { QueryMarketPricesDto } from './dto/query-market-prices.dto';
import { LinkListingDto } from './dto/link-listing.dto';
import { LinkUrlDto } from './dto/link-url.dto';
import { SuggestPriceDto } from './dto/suggest-price.dto';

@ApiTags('market-prices')
@ApiBearerAuth()
@Controller('market-prices')
export class MarketPricesController {
  constructor(private service: MarketPricesService) {}

  @Get()
  @ApiOperation({ summary: 'In-stock raw cards with their Yuyu-tei price and underpriced flag' })
  list(@Query() query: QueryMarketPricesDto) {
    return this.service.list(query);
  }

  @Get('movers')
  @ApiOperation({ summary: 'Biggest price moves since the last sync (dashboard card)' })
  movers(@Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 5, 1), 20);
    return this.service.movers(n);
  }

  @Get('cards')
  @ApiOperation({ summary: 'Market price for specific raw card ids (comma-separated, max 200)' })
  cards(@Query('ids') ids?: string) {
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
    return list.length ? this.service.forCards(list) : {};
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Suggested posted price for a card number + rarity (Add Card form)' })
  suggest(@Query() q: SuggestPriceDto) {
    return this.service.suggest(q.cardNumber, q.rarity, q.notes);
  }

  @Get('sync/status')
  status() {
    return this.service.status();
  }

  @Post('sync')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Refresh prices of linked cards now (runs in the background; never changes links)' })
  sync() {
    return this.service.startManual();
  }

  @Post('link-new')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Find listings for in-stock cards that were never linked (runs in the background)' })
  linkNew() {
    return this.service.startLink();
  }

  @Get('listings/:cardNumber')
  listings(@Param('cardNumber') cardNumber: string, @Query('source') source?: string) {
    return this.service.listingsFor(cardNumber, source === 'TCGPLAYER' || source === 'CARDRUSH' ? source : 'YUYUTEI');
  }

  @Post('raw-cards/:id/match')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: "Set a card's posted price to its rounded market price" })
  match(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.matchOne(id, userId);
  }

  @Post('match-underpriced')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Raise every underpriced in-stock card to its rounded market price' })
  matchAll(@CurrentUser('id') userId: string) {
    return this.service.matchAllUnderpriced(userId);
  }

  @Patch('raw-cards/:id/link')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Link a raw card to a listing ("none" = no market price, null = find one automatically now)' })
  link(@Param('id') id: string, @Body() dto: LinkListingDto) {
    return this.service.link(id, dto.listingKey ?? null);
  }

  @Patch('raw-cards/:id/link-url')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Match a raw card by pasting its Yuyu-tei or Cardrush card link' })
  linkUrl(@Param('id') id: string, @Body() dto: LinkUrlDto) {
    return this.service.linkByUrl(id, dto.url);
  }
}
