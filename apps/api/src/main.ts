// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. 啟用 CORS，允許前端 (Next.js) 跨網域呼叫 API
  app.enableCors();

  // 2. 啟動全域驗證管道，嚴格過濾前端傳來的參數
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // 自動剔除 DTO 中未定義的欄位
      transform: true,            // 自動轉換資料型別
      forbidNonWhitelisted: true, // 遇到未知欄位直接拋出 400 錯誤
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();