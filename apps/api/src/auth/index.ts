export { AuthModule } from './auth.module';
export {
  TenantMiddleware,
  type JwtPayloadWithTenant,
} from './tenant.middleware';
// apps/api/src/auth/index.ts
export * from './auth.controller';
export * from './auth.service';
export * from './auth.dto';
export * from './auth.guard'; // ✅ 補上這行，讓 Guard 可以被外部看見
