import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RawCardsModule } from './modules/raw-cards/raw-cards.module';
import { SlabsModule } from './modules/slabs/slabs.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SalesModule } from './modules/sales/sales.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ImagesModule } from './modules/images/images.module';
import { FacebookGeneratorModule } from './modules/facebook-generator/facebook-generator.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
      serveRoot: '/uploads',
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    RawCardsModule,
    SlabsModule,
    ActivityLogsModule,
    CustomersModule,
    PaymentsModule,
    SalesModule,
    ShipmentsModule,
    SettingsModule,
    NotificationsModule,
    AnalyticsModule,
    ReportsModule,
    FavoritesModule,
    ImagesModule,
    FacebookGeneratorModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },  // rate limiting
    { provide: APP_GUARD, useClass: JwtAuthGuard },     // auth (respects @Public)
    { provide: APP_GUARD, useClass: RolesGuard },       // role authorization
  ],
})
export class AppModule {}
