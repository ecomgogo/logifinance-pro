import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DecimalInterceptor } from './common/interceptors/decimal.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🌟 1. 啟動 CORS，允許前端 3001 Port 自由進出 API
  app.enableCors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true,
  });

  // 🛡️ 2. 啟動全域資料驗證防護 (ValidationPipe)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 💰 3. 全域 Decimal 序列化攔截器：統一將 Decimal 轉為字串，避免回傳 { d, e, s }
  app.useGlobalInterceptors(new DecimalInterceptor());

  // 🚀 4. 監聽 3000 Port
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();