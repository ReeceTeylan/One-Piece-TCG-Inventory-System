import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('sales/:saleId/payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get() list(@Param('saleId') saleId: string) { return this.service.findForSale(saleId); }
  @Post() add(@Param('saleId') saleId: string, @Body() dto: CreatePaymentDto, @CurrentUser('id') userId: string) {
    return this.service.addPayment(saleId, dto, userId);
  }
}
