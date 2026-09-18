import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "src/core/database/prisma.service";
import * as argon from "argon2";
import { JwtService } from "@nestjs/jwt";
import { User, UserRoles } from "@prisma/client";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RedisService } from "src/common/redis/redis.service";
import { PaymentsService } from "../payments/payments.service";
import { JWTAccessOptions, JWTRefreshOptions } from "src/common/config/jwt";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly payments: PaymentsService,
  ) { }

  private async hashPassword(password: string) {
    return await argon.hash(password);
  }

  private async verifyPassword(
    hashedPassword: string,
    originalPassword: string,
  ) {
    return await argon.verify(hashedPassword, originalPassword);
  }

  async generateToken(
    user: Pick<User, 'id' | 'role'>,
    accessTokenOnly?: boolean
  ) {
    const tokens: { accessToken?: string, refreshToken?: string } = {
      accessToken: undefined,
      refreshToken: undefined,
    };

    tokens.accessToken = await this.jwtService.signAsync(
      {
        id: user.id,
        role: user.role,
      },
      JWTAccessOptions,
    );
    if (!accessTokenOnly) {
      tokens.refreshToken = await this.jwtService.signAsync(
        {
          id: user.id,
        },
        JWTRefreshOptions,
      );
    } else {
      delete tokens.refreshToken;
    }

    return tokens;
  }

  async register(payload: RegisterDto, courseId?: number) {
    const existing = await this.prisma.user.findFirst({
      where: {
        phone: payload.phone,
      },
    });

    if (existing) {
      throw new ConflictException(
        "Bunday raqamli foydalanuvchi allaqachon mavjud!",
      );
    }

    const redisKey = `reg_${payload.phone}`;
    const storedOtp = await this.redisService.get(redisKey);
    
    // Ixtiyoriy 6 xonali raqam (masalan 123456) yoki saqlangan OTP ni qabul qilish
    const isSixDigits = /^\d{6}$/.test(payload.otp?.trim() || '');
    const isStoredOtpMatch = storedOtp && storedOtp === payload.otp;

    if (!isSixDigits && !isStoredOtpMatch) {
      throw new HttpException(
        'Noto\'g\'ri tasdiqlash kodi. 6 ta raqam kiriting (masalan: 123456)',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Delete OTP after successful verification to prevent reuse
    if (storedOtp) {
      await this.redisService.del(redisKey);
    }

    const hashedPassword = await this.hashPassword(payload.password);

    const user = await this.prisma.user.create({
      data: {
        fullName: payload.fullName,
        phone: payload.phone,
        password: hashedPassword,
        role: UserRoles.STUDENT,
      },
    });

    const { password, ...result } = user;

    if (courseId) {
      try {
        const { course } = await this.payments.checkCoursePurchased(courseId, user.id);

        await this.prisma.payments.create({
          data: {
            courseId,
            userId: user.id,
            amount: Number(course.price),
          }
        });
      } catch (error) {
        await this.prisma.user.delete({ where: { id: user.id } });
        throw error;
      }
    }

    return {
      data: result,
      tokens: await this.generateToken(user)
    };
  }

  async login(payload: LoginDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        phone: payload.phone,
      },
    });

    if (!existing) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    const isSame = await this.verifyPassword(
      existing.password,
      payload.password,
    );

    if (!isSame) {
      throw new UnauthorizedException("Parol xato");
    }

    const { password, ...result } = existing;

    return {
      success: true,
      tokens: await this.generateToken(result),
      data: result
    };
  }

}
