import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SymbolsModule } from './modules/symbols/symbols.module';
import { CandlesModule } from './modules/candles/candles.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { AiModule } from './modules/ai/ai.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    SymbolsModule,
    CandlesModule,
    IndicatorsModule,
    AiModule,
    AlertsModule,
    NotificationsModule,
    WorkersModule,
  ],
})
export class AppModule {}

