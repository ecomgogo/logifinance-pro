# LogiFinance Pro 架構升級執行計畫

@Cursor：你是一位資深的全端架構師。請閱讀以下任務清單，當我要求你執行特定 Task 時，請嚴格遵守專案 `.cursorrules` 中的規範（特別是財務 Decimal 精度與 RLS 政策），並結合 `@Docs` 或 `@Codebase` 來實作。

---

## Task 1: 實作 Request-Scoped Prisma Service (支援多租戶 RLS)
**背景：** 目前的 Prisma Service 未能完美支援 PostgreSQL 的 Row-Level Security (RLS)。我們需要能在每個 Request 中動態注入 `tenant_id` 到資料庫的 session 中。

**執行步驟：**
1. 請參考 `@Docs https://www.prisma.io/docs/orm/prisma-client/queries/extending-prisma-client` 關於 Prisma Client Extensions 的寫法。
2. 掃描 `@apps/api/src/prisma` 目錄，修改現有的 `PrismaService`。
3. 請利用 NestJS 的 `REQUEST` scope 注入，從 Request 的 user payload (由 AuthGuard 解析出) 中提取 `tenant_id`。
4. 實作一個擴展，在執行任何查詢前，先執行類似 `SET LOCAL app.current_tenant_id = '${tenant_id}'` 的原生 SQL。
5. 確保這不會影響全域的 Prisma 實例，並且在每次請求結束後能安全釋放。

---

## Task 2: 全域 Decimal (財務數據) 序列化攔截器
**背景：** Prisma 查詢出來的 `Decimal` 型別，在 NestJS 預設的 JSON 序列化過程中會變成 `{ d, e, s }` 的奇怪物件，導致前端拿到錯誤的格式。

**執行步驟：**
1. 掃描 `@apps/api/src/main.ts` 與整個後端架構。
2. 請幫我寫一個全域的 NestJS Interceptor (例如 `DecimalInterceptor`)，或者配置 `class-transformer` 的全域規則。
3. 將所有 Response API 中遇到的 `Decimal` (來自 `decimal.js` 或 `Prisma.Decimal`) 物件，強制 `.toString()` 轉換為字串。
4. 確保不會影響其他一般的字串或數字欄位，並將此 Interceptor 註冊到 `main.ts` 中。

---

## Task 3: Python 微服務 (OCR) 的多租戶隔離機制
**背景：** NestJS 呼叫 Python FastAPI 進行提單解析時，沒有傳遞租戶資訊，這會導致快取或檔案處理跨租戶洩漏。

**執行步驟：**
1. 讀取 `@apps/api/src/integration/integration.service.ts` (呼叫端) 以及 `@python-parser/main.py` (接收端)。
2. 在 NestJS 端：修改 `axios` 呼叫邏輯，在 HTTP Header 中加入 `X-Tenant-ID`。
3. 在 FastAPI 端：新增一個 Dependency (依賴注入) 來攔截並提取 Header 中的 `X-Tenant-ID`。
4. 在 Python 解析邏輯中，將這個 `tenant_id` 作為前綴 (Prefix) 加入到臨時檔案儲存或 Redis 快取的 Key 中，確保不同租戶的解析任務被完全隔離。