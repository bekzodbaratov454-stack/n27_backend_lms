import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "src/core/database/prisma.module";
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from "@nestjs/passport";
import { JwtAccessStrategy } from "src/common/strategies/jwt-access.strategy";
import { TokenConfig } from "src/common/config/token.config";
import { PaymentsService } from "../payments/payments.service";

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('SECRET_KEY') || configService.get<string>('ACCESS_SECRET_KEY') || 'jwt_secret_key_default',
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, TokenConfig, PaymentsService],
})
export class AuthModule {}
