import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterTenantDto } from './auth.dto';

/** bcrypt 鹽輪數 */
const SALT_ROUNDS = 10;

/** JWT Payload 型別，與 TenantMiddleware 解析的格式一致 */
export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
}

/** 登入／註冊成功回傳的 Token 結構 */
export interface AuthResult {
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 租戶註冊：建立新 Tenant 與首位 BOSS 使用者，並回傳 JWT。
   * 使用 prisma.raw 繞過 RLS，因註冊時尚無租戶上下文。
   */
  async register(dto: RegisterTenantDto): Promise<AuthResult> {
    const existing = await this.prisma.raw.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('此 Email 已被註冊');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const { user } = await this.prisma.raw.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          companyName: dto.companyName,
          baseCurrency: dto.baseCurrency.toUpperCase(),
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          role: dto.role === 'SALES' ? UserRole.SALES : UserRole.BOSS,
          commissionRate: 0,
        },
      });
      return { tenant, user };
    });

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  /**
   * 登入：以 Email 查詢使用者（raw 繞過 RLS），驗證密碼後簽發 JWT。
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.raw.user.findFirst({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email 或密碼錯誤');
    }

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Email 或密碼錯誤');
    }

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }
}
