# 速遞管家 API 對照與 LogiFinance Pro 優化建議

參考文件：
- [速遞管家 API 接口文檔](http://order.logtt.com/usercenter/manager/api_document.aspx)
- [速遞管家 消息通知接口文檔](http://order.logtt.com/usercenter/manager/api_notice_document.aspx)

---

## 一、速遞管家 API 設計摘要

### 1.1 訂單與業務維度
- **統一入口**：`POST` → `http://order.logtt.com/webservice/PublicService.asmx/ServiceInterfaceUTF8`
- **Body**：`appToken`、`appKey`、`serviceMethod`、`paramsJson`（JSON 字串）
- **核心識別**：`reference_no`（客戶參考號）≈ 貴系統的 `internalNo`；`shipping_method_no`（服務商單號）≈ 承運商主單號
- **訂單生命週期**：創建訂單 → 提交預報 → 修改/刪除；另可取得標籤、跟蹤單號、跟蹤記錄、**訂單費用**、**訂單費用明細**、訂單重量、費用試算、基礎數據

### 1.2 費用與財務維度
- **getbusinessfee**：按費用種類分組的訂單費用（fee_kind_code、currency_amount、amount 等）
- **getbusinessfee_detail**：每筆費用變動明細（含 create_date、occur_date、bill_date、note）
- 與貴系統的 **Charge（應收/應付明細）**、**Settlement（實收實付）** 概念可直接對應

### 1.3 消息通知（Webhook）
- **Content-Type**：`application/json; charset=UTF-8`
- **Header**：`datatype`（hawbcode | weight | tracking | fee）、`sign`、`timestamp`
- **簽名**：`Md5(Body 內容 + datatype + API 密鑰 + timestamp)`
- **類型**：單號更新、重量更新、軌跡更新、**費用更新**

---

## 二、與 LogiFinance Pro 的對照

| 速遞管家概念 | 貴系統對應 | 說明 |
|-------------|------------|------|
| reference_no | Shipment.internalNo | 客戶參考號，唯一識別一筆業務 |
| shipping_method_no | Shipment.mblNumber（或擴充欄位） | 服務商/主單號 |
| packages[].child_tracknumber | 可擴充為 Shipment 子單或獨立表 | 分單跟蹤號 |
| getbusinessfee / getbusinessfee_detail | Charge（+ 可選 FeeKind） | 費用種類、原幣/本位幣、明細 |
| 費用更新 Webhook (datatype=fee) | Charge 新增/更新 + 可選 Settlement | 第三方回推費用時寫入 Charge |
| 軌跡更新 Webhook (datatype=tracking) | 可新增 Tracking 或擴充 Shipment | 目前僅 getTracking 查詢，可改為「寫入 DB + 查詢」 |
| 重量更新 Webhook (datatype=weight) | 可擴充 Shipment.chargeWeight 等 | 計費重、體積重影響應收應付 |
| appToken / appKey | 租戶級別第三方 API 憑證 | 建議存 Tenant 或 TenantApiCredential 表，按 tenantId 隔離 |

---

## 三、優化建議（按優先級）

### 3.1 資料模型與欄位擴充

1. **Shipment 擴充（對齊「訂單」維度）**
   - 新增 `referenceNo`（對外參考號，可與 internalNo 一致或另訂規則）、`shippingMethodCode`（運輸方式代碼）、`carrierOrderId`（服務商訂單 ID，若有）。
   - 若有「子單/分單」需求：可新增 `ShipmentPackage` 表（shipmentId、childNumber、childTrackNumber、childLabelUrl），對應速遞管家之 packages[]。
   - 重量相關：`chargeWeight`、`volumeWeight`、`grossWeight`（Decimal，單位 KG），供費用試算與費用更新寫入。

2. **Charge / 費用種類對齊**
   - 速遞管家有 **fee_kind_code**（如 E1 速遞運費、E2 掛號費）。建議：
     - 新增 **FeeKind** 主數據表（tenantId、code、cnName、enName），或至少在本系統維護一組 feeCode 枚舉/配置；
     - Charge.feeCode 改為關聯 FeeKind，或保持字串但與速遞管家 fee_kind_code 對照一致，方便後續「費用更新 Webhook」寫入。

3. **租戶級別第三方 API 憑證**
   - 新增 **TenantApiCredential**（或類似）表：tenantId、provider（如 `logtt`）、appToken、appKey、isActive 等，加密存儲。
   - Integration 呼叫速遞管家時，依當前 tenantId 取對應 appToken/appKey，避免寫死在環境變數，並符合多租戶隔離。

### 3.2 Webhook 接收與安全（對齊消息通知文檔）

4. **統一 Webhook 路由與 datatype 分派**
   - 速遞管家是 **單一回調地址**，用 Header **datatype** 區分：hawbcode | weight | tracking | fee。
   - 建議：保留現有 `POST /integration/webhook/logistics`，在 Controller 內讀取 `Headers('datatype')`，依值分派到不同 handler（單號 / 重量 / 軌跡 / 費用），避免多個 URL 難以在第三方後台配置。

5. **簽名驗證**
   - 文檔要求：`sign = Md5(Body 原始字串 + datatype + API 密鑰 + timestamp)`。
   - 建議：實作 **LogttWebhookGuard** 或 **Pipe**：
     - 從 Header 取 datatype、sign、timestamp；
     - 用當前租戶的 API Key（或系統級 Webhook 密鑰）依相同規則計算 sign；
     - 比對一致後再進入業務邏輯，避免偽造與重放（可再加 timestamp 時效檢查）。

6. **Webhook 與租戶綁定**
   - 若回調 URL 為「每租戶一個」或回調 Body 帶 reference_no，可透過 reference_no 反查 Shipment 所屬 tenantId，再寫入該租戶的 Charge/Tracking 等，嚴格 RLS。

### 3.3 費用與財務流程

7. **「費用更新」Webhook 寫入 Charge**
   - 當 datatype=fee 時：
     - 依 reference_no（或 shipping_method_no）找到對應 Shipment；
     - 依 fee_kind_code 對應到 feeCode（或 FeeKind）；
     - 寫入或更新 **Charge**（shipmentId、partnerId 依業務規則決定，arApType 可為 AP「應付承運商」）；
     - 金額用 Decimal，currency、amount、exchangeRate、baseAmount 與現有 Charge 一致。

8. **「訂單費用明細」與 Settlement 的關係**
   - 速遞管家 getbusinessfee_detail 為「每筆費用變動」；貴系統 Settlement 為「實收實付」。
   - 建議：Charge 表示「應收/應付一筆」，Settlement 表示「對該筆 Charge 的實際付款」；若第三方有「結算單/賬單日期」可考慮在 Charge 加 billDate 或由 Settlement 表示，視貴司對帳流程而定。

### 3.4 對外呼叫速遞管家

9. **統一封裝 LogTT 客戶端**
   - 建立 **LogttApiService**（或類似）：baseUrl、呼叫方法 `call(serviceMethod, paramsJson)`，內部組裝 appToken、appKey、paramsJson，並做錯誤與重試。
   - 所有「創建訂單、提交預報、獲取跟蹤、獲取費用、費用試算」等都經此客戶端，並從 TenantApiCredential 取該租戶的 appToken/appKey。

10. **getTracking 與軌跡落庫**
    - 目前 getTracking 僅查第三方並回傳；建議可選「寫入本庫」：
      - 新增 **ShipmentTracking** 表（shipmentId、trackStatus、trackStatusName、occurredAt、location、description 等），
      - 查詢時先查第三方，再寫入/更新 ShipmentTracking，之後列表/詳情可優先讀 DB，減少對第三方即時依賴。

### 3.5 其他

11. **錯誤與訊息**
    - 速遞管家回傳 success（0/1/2）、cnmessage、enmessage；建議對外 API 或 Webhook 回傳也採用統一結構（如 success、message、code），方便前端與監控。

12. **基礎數據緩存**
    - 速遞管家有 getshippingmethod、getcountry、getmailcargotype 等；若貴系統需「運輸方式/國家/申報種類」下拉選單，可定期拉取並按 tenantId 緩存（Redis 或 DB），減少即時請求。

---

## 四、實作優先級建議

| 優先級 | 項目 | 說明 |
|--------|------|------|
| P0 | Webhook 簽名驗證 + datatype 分派 | 安全與合規，避免偽造回調 |
| P0 | 費用更新 Webhook → 寫入 Charge | 第三方費用自動入帳，與現有財務模型對齊 |
| P1 | TenantApiCredential 表與 Integration 取憑證 | 多租戶隔離、支援多客戶對接速遞管家 |
| P1 | Shipment 擴充 referenceNo、重量欄位 | 與速遞管家 reference_no、重量更新對齊 |
| P2 | 軌跡落庫（ShipmentTracking） | 查詢效能與離線查軌跡 |
| P2 | FeeKind 主數據與 feeCode 對照 | 費用種類標準化、報表與對帳一致 |
| P3 | 子單/分單 ShipmentPackage | 若有「一主單多分單」需求再擴充 |

---

## 五、小結

速遞管家 API 以「客戶參考號 + 服務商單號」為核心，搭配訂單費用/費用明細與四類 Webhook（單號、重量、軌跡、費用），與 LogiFinance Pro 的 Shipment–Charge–Settlement 模型高度對應。建議先做：**Webhook 安全（簽名 + datatype）**、**費用更新寫入 Charge**、**租戶級 API 憑證**，再依業務需要擴充 Shipment 欄位與軌跡/子單模型。所有金額與重量請維持 Decimal 與 RLS 多租戶隔離，符合現有 .cursorrules 規範。
