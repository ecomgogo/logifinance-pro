import io
import os
import re
import tempfile
import uuid
from typing import Annotated
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
import PyPDF2
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
    
    # 解析 PDF 文本或直接讀取 CSV/TXT
    if (file.filename or "").lower().endswith(".pdf"):
        pdf = PyPDF2.PdfReader(io.BytesIO(content))
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
    else:
        text = content.decode("utf-8", errors="ignore")

    # 🌟 Regex 智能提取：自動抓取物流主單號 (例如 ABC-1234567)
    mbl_pattern = r'[A-Z]{3,4}-\d{6,8}'
    # 🌟 Regex 智能提取：自動抓取幣別與金額 (例如 USD 1,200.50)
    amount_pattern = r'(?:USD|HKD|TWD)\$?\s*([0-9,]+(?:\.[0-9]{2})?)'

    mbls = list(set(re.findall(mbl_pattern, text)))
    amounts = re.findall(amount_pattern, text)

    try:
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "filename": file.filename,
            "temp_file_key": os.path.basename(temp_file_path) if temp_file_path else None,
            "extracted_mbls": mbls,
            "extracted_amounts": amounts,
            "raw_text_snippet": text[:200] + "..." # 預覽前200字
        }
    finally:
        # 解析完成後刪除暫存檔，避免磁碟累積與資料外洩風險
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    # 啟動微服務：python main.py
    uvicorn.run(app, host="127.0.0.1", port=8000)