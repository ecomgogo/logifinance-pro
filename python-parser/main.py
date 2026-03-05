import re
import io
from fastapi import FastAPI, File, UploadFile
import PyPDF2
import uvicorn

app = FastAPI(title="LogiFinance 智能文檔解析服務")

@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    content = await file.read()
    text = ""
    
    # 解析 PDF 文本或直接讀取 CSV/TXT
    if file.filename.lower().endswith(".pdf"):
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

    return {
        "status": "success",
        "filename": file.filename,
        "extracted_mbls": mbls,
        "extracted_amounts": amounts,
        "raw_text_snippet": text[:200] + "..." # 預覽前200字
    }

if __name__ == "__main__":
    # 啟動微服務：python main.py
    uvicorn.run(app, host="127.0.0.1", port=8000)