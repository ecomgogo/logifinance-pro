// apps/web/src/lib/export.ts

export function exportToCSV(data: Record<string, any>[], filename: string) {
    if (!data || data.length === 0) {
      alert('目前沒有資料可供匯出');
      return;
    }
    
    // 1. 取得所有欄位標題 (Object 的 Key)
    const headers = Object.keys(data[0]);
    
    // 2. 組裝 CSV 內容
    // 💡 關鍵：加上 \uFEFF (BOM)，這樣 Excel 打開中文才不會變亂碼！
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const cell = row[header] === null || row[header] === undefined ? '' : row[header];
        // 處理字串中可能包含的逗號或換行，並用雙引號包起來
        return `"${String(cell).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
  
    // 3. 觸發瀏覽器下載
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }