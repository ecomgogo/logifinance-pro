import { Controller, Post, Body, UploadedFile, UseInterceptors, Headers } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('integration')
export class IntegrationController {
  
  // 🌟 Milestone 4: 與 Python 解析服務進行 API 串聯
  @Post('parse-doc')
  @UseInterceptors(FileInterceptor('file'))
  async parseDoc(@UploadedFile() file: any) { // 💡 將 Express.Multer.File 改為 any，消除 multer 型別缺失的報錯
    
    // 💡 使用全域的 FormData 與 Blob 繞過 TypeScript 嚴格模式的環境衝突
    const formData = new (globalThis as any).FormData();
    const blob = new (globalThis as any).Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);

    try {
      // 呼叫 FastAPI 微服務
      const response = await fetch('http://127.0.0.1:8000/parse', {
        method: 'POST',
        body: formData,
      });
      return await response.json();
    } catch (error) {
      return { error: '無法連線至 Python 解析服務，請確認 FastAPI 是否啟動在 Port 8000' };
    }
  }

  // 🌟 Milestone 6: 實作物流 Webhook 接收端點
  @Post('webhook/logistics')
  async receiveLogisticsWebhook(@Body() payload: any, @Headers('x-api-key') apiKey: string) {
    // 收到第三方系統傳來的更新
    console.log('📦 收到第三方物流狀態更新 Webhook:', payload);
    
    return { 
      status: 'success', 
      message: 'Webhook received successfully',
      receivedData: payload 
    };
  }
}