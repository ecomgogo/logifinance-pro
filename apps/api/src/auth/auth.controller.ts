import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterTenantDto } from './auth.dto';
import type { AuthResult } from './auth.service'; // AuthResult 只是 interface，保留 type 沒關係

/**
 * AuthController：登入與租戶註冊 API。
 * 路由前綴為 /auth，無需 JWT 即可呼叫（公開端點）。
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 租戶註冊：建立新公司與首位 BOSS 帳號，回傳 JWT。
   * POST /auth/register
   */
  @Post('register')
  async register(@Body() dto: RegisterTenantDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  /**
   * 登入：Email + 密碼驗證，回傳 JWT。
   * POST /auth/login
   */
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }
}
