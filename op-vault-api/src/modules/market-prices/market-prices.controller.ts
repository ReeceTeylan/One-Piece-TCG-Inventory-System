import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { MarketPricesService } from './market-prices.service';
import { QueryMarketPricesDto } from './dto/query-market-prices.dto';
import { LinkListingDto } from './dto/link-listing.dto';
import { LinkUrlDto } from './dto/link-url.dto';

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

  @Get('sync/status')
  status() {
    return this.service.status();
  }

  @Post('sync')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Start a Yuyu-tei price sync now (runs in the background)' })
  sync() {
    return this.service.startManual();
  }

  @Get('listings/:cardNumber')
  listings(@Param('cardNumber') cardNumber: string) {
    return this.service.listingsFor(cardNumber);
  }

  @Patch('raw-cards/:id/link')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Match a raw card to a specific Yuyu-tei listing (null = automatic)' })
  link(@Param('id') id: string, @Body() dto: LinkListingDto) {
    return this.service.link(id, dto.listingKey ?? null);
  }

  @Patch('raw-cards/:id/link-url')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Match a raw card by pasting its Yuyu-tei card page link' })
  linkUrl(@Param('id') id: string, @Body() dto: LinkUrlDto) {
    return this.service.linkByUrl(id, dto.url);
  }
}
