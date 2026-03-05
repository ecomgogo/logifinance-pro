import io
import os
import re
import tempfile
import uuid
from decimal import Decimal, InvalidOperation
from typing import Annotated
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
import pandas as pd
import uvicorn

app = FastAPI(title="LogiFinance 智能文檔解析服務")

def get_tenant_id(
    x_tenant_id: Annotated[str | None, Header(alias="X-Tenant-ID")] = None,
) -> str:
    """
    從 Header 取得租戶 ID。
    若缺少租戶資訊則拒絕請求，避免跨租戶混用解析資源。
    """
    if not x_tenant_id or not x_tenant_id.strip():
        raise HTTPException(status_code=400, detail="Missing X-Tenant-ID header")
    return x_tenant_id.strip()


@app.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id),
):
    filename = (file.filename or "").strip()
    ext = os.path.splitext(filename)[1].lower()
    allowed_exts = {".csv", ".xls", ".xlsx", ".xlsm"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail="僅支援 Excel/CSV 檔案（csv/xls/xlsx/xlsm）",
        )

    content = await file.read()
    text = ""
    temp_file_path = None

    # 以 tenant_id 作為前綴建立暫存檔，確保不同租戶任務不會共用暫存命名空間
    safe_tenant = re.sub(r"[^a-zA-Z0-9_-]", "_", tenant_id)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".tmp"
    unique_suffix = uuid.uuid4().hex

    with tempfile.NamedTemporaryFile(
        mode="wb",
        prefix=f"{safe_tenant}_{unique_suffix}_",
        suffix=ext,
        delete=False,
    ) as temp_file:
        temp_file.write(content)
        temp_file_path = temp_file.name
    
    try:
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(content), dtype=str).fillna("")
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str).fillna("")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"檔案解析失敗：{exc}") from exc

    normalized_columns = {_normalize_col_name(col): col for col in df.columns}

    customer_order_col = _pick_column(
        normalized_columns,
        ["客戶單號", "reference", "reference_no", "customer_order", "customerorderno"],
    )
    logistics_no_col = _pick_column(
        normalized_columns,
        ["物流單號", "tracking", "tracking_no", "物流号", "waybill", "awb", "mbl"],
    )
    receivable_col = _pick_column(
        normalized_columns,
        ["應收", "receivable", "ar", "customer_receivable"],
    )
    payable_col = _pick_column(
        normalized_columns,
        ["應付", "payable", "ap", "vendor_payable", "supplier_payable"],
    )
    currency_col = _pick_column(
        normalized_columns,
        ["幣種", "币种", "currency", "currency_code", "幣別", "币别"],
    )
    customer_name_col = _pick_column(
        normalized_columns,
        ["客戶名稱", "客户名称", "customer_name", "customer"],
    )
    customer_code_col = _pick_column(
        normalized_columns,
        ["客戶代碼", "客户代码", "customer_code", "customercode"],
    )
    carrier_col = _pick_column(
        normalized_columns,
        ["物流商", "carrier", "provider", "courier", "shipping_provider"],
    )

    parsed_rows = []
    for _, row in df.iterrows():
        logistics_no = _read_cell(row, logistics_no_col)
        customer_order_no = _read_cell(row, customer_order_col)
        if not logistics_no and not customer_order_no:
            continue

        parsed_rows.append(
            {
                "customer_order_no": customer_order_no,
                "logistics_no": logistics_no,
                "receivable": _to_decimal_str(_read_cell(row, receivable_col)),
                "payable": _to_decimal_str(_read_cell(row, payable_col)),
                "currency": _read_cell(row, currency_col).upper(),
                "customer_name": _read_cell(row, customer_name_col),
                "customer_code": _read_cell(row, customer_code_col),
                "carrier": _read_cell(row, carrier_col),
            }
        )

    text = "\n".join([str(v) for v in parsed_rows[:3]])
    tracking_numbers = list(
        {item["logistics_no"] for item in parsed_rows if item["logistics_no"]}
    )

    try:
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "filename": file.filename,
            "temp_file_key": os.path.basename(temp_file_path) if temp_file_path else None,
            "recognized_count": len(parsed_rows),
            "recognized_fields": {
                "customer_order_no": bool(customer_order_col),
                "logistics_no": bool(logistics_no_col),
                "receivable": bool(receivable_col),
                "payable": bool(payable_col),
                "currency": bool(currency_col),
                "customer_name": bool(customer_name_col),
                "customer_code": bool(customer_code_col),
                "carrier": bool(carrier_col),
            },
            "parsed_rows": parsed_rows[:200],
            "extracted_tracking_numbers": tracking_numbers,
            "raw_text_snippet": (text[:200] + "...") if text else "",
        }
    finally:
        # 解析完成後刪除暫存檔，避免磁碟累積與資料外洩風險
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


def _normalize_col_name(col_name: str) -> str:
    return re.sub(r"[\s_\-()（）\[\]【】]+", "", str(col_name).strip().lower())


def _pick_column(normalized_columns: dict[str, str], aliases: list[str]) -> str | None:
    normalized_aliases = [_normalize_col_name(alias) for alias in aliases]
    for alias in normalized_aliases:
        for normalized, original in normalized_columns.items():
            if alias == normalized or alias in normalized:
                return original
    return None


def _read_cell(row, column_name: str | None) -> str:
    if not column_name:
        return ""
    value = str(row.get(column_name, "")).strip()
    return "" if value.lower() in {"nan", "none"} else value


def _to_decimal_str(raw: str) -> str:
    if not raw:
        return ""
    normalized = raw.replace(",", "").replace("$", "").strip()
    try:
        return str(Decimal(normalized))
    except (InvalidOperation, ValueError):
        return raw

if __name__ == "__main__":
    # 啟動微服務：python main.py
    uvicorn.run(app, host="127.0.0.1", port=8000)