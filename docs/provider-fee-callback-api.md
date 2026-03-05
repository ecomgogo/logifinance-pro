# 物流供應商費用回調 API（DHL / FEDEX / UPS / LOGTT / 自建）

## 1) 供應商管理 API

### 建立固定供應商（每租戶）
- `POST /logistics-providers/bootstrap-fixed`
- 需要 JWT
- 會建立：`LOGTT`、`DHL`、`FEDEX`、`UPS`

### 查詢供應商
- `GET /logistics-providers`
- 需要 JWT

### 新增自建供應商
- `POST /logistics-providers`
- 需要 JWT
- Body 範例：

```json
{
  "name": "SF Express",
  "code": "SF",
  "type": "CUSTOM"
}
```

### 設定供應商 API 憑證 / Webhook 密鑰
- `POST /logistics-providers/:code/credentials`
- 需要 JWT
- Body 範例：

```json
{
  "appToken": "xxx",
  "appKey": "xxx",
  "webhookSecret": "xxx"
}
```

### 設定費目映射（external -> internal）
- `POST /logistics-providers/:code/fee-mappings`
- 需要 JWT
- Body 範例：

```json
{
  "externalFeeCode": "FUEL",
  "internalFeeCode": "FUEL_SURCHARGE",
  "defaultArApType": "AP"
}
```

### 查詢費目映射
- `GET /logistics-providers/:code/fee-mappings`
- 需要 JWT

---

## 2) 通用費用回調 API

### Endpoint
- `POST /integration/webhook/providers/:providerCode/fee`

### Header
- `x-tenant-id`: 租戶 ID（必填）
- `x-signature`: 簽名（如果該供應商已設定 `webhookSecret` 則必填）
- `x-timestamp`: 毫秒時間戳（如果該供應商已設定 `webhookSecret` 則必填）

### 簽名規則（若有 webhookSecret）
- `signature = HMAC_SHA256(webhookSecret, rawBody + "." + timestamp)`

### Body 範例

```json
{
  "reference_no": "CUST-2026-001",
  "shipping_method_no": "DHL123456789",
  "data": [
    {
      "fee_kind_code": "FREIGHT",
      "currency_code": "USD",
      "currency_amount": "120.50"
    },
    {
      "fee_kind_code": "FUEL",
      "currency_code": "USD",
      "currency_amount": "8.25"
    }
  ]
}
```

### 行為
- 依 `reference_no` / `shipping_method_no` 自動匹配 `Shipment`
- 先查詢費目映射（`externalFeeCode -> internalFeeCode`）
- 自動建立 `Charge`（預設 `AP`）
- `partnerName` 使用供應商名稱（例如 DHL、FEDEX）
- 若遇到系統性錯誤（非 4xx），會自動排入 retry queue，超過次數進 dead-letter。

### Retry / Dead Letter 維運 API
- `POST /integration/webhook/retry/process`（需要 JWT）
  - 立即處理最多 10 筆重試任務
- `GET /integration/webhook/retry/dead-letter`（需要 JWT）
  - 查看 dead-letter 內容，便於人工排查
  - 支援 query：`providerCode`、`source`、`limit`
- `GET /integration/webhook/retry/stats`（需要 JWT）
  - 查看 queue/dead-letter 數量與 maxAttempts
- `POST /integration/webhook/retry/dead-letter/:jobId/requeue`（需要 JWT）
  - 將指定 dead-letter 任務重新入列（attempt 會重置）
- `POST /integration/webhook/retry/dead-letter/requeue-batch`（需要 JWT）
  - 批次重新入列，可帶 `providerCode`、`source`、`limit`

---

## 3) 供應商追蹤查詢 API

- `GET /integration/providers/:providerCode/tracking/:trackingNumber`
- 需要 JWT
- 已接入 `DHL / FEDEX / UPS` 正式呼叫流程：
  - DHL：Basic Auth + MyDHL Tracking
  - FEDEX：OAuth Token + Tracking API
  - UPS：OAuth Token + Tracking API
- token 會使用 Redis 快取，減少重複授權請求。

### appToken / appKey 對應方式
- `DHL`：`appToken = API Username`、`appKey = API Password`
- `FEDEX`：`appToken = client_id`、`appKey = client_secret`
- `UPS`：`appToken = client_id`、`appKey = client_secret`

### 建議環境變數（多環境切換）
- `DHL_API_BASE_URL`（預設：`https://express.api.dhl.com/mydhlapi`）
- `FEDEX_API_BASE_URL`（預設：`https://apis.fedex.com`）
- `UPS_API_BASE_URL`（預設：`https://onlinetools.ups.com`）
- `PROVIDER_HTTP_TIMEOUT_MS`（預設：`15000`）
- `PROVIDER_HTTP_RETRY_COUNT`（預設：`2`）

> 若要切換沙箱，可在部署環境覆蓋 base URL，例如 FEDEX 沙箱 `https://apis-sandbox.fedex.com`、UPS 沙箱 `https://wwwcie.ups.com`。

### Webhook Retry Worker 環境變數
- `WEBHOOK_RETRY_WORKER_ENABLED`（預設：`true`）
- `WEBHOOK_RETRY_INTERVAL_MS`（預設：`15000`）
- `WEBHOOK_RETRY_BATCH_SIZE`（預設：`10`）

