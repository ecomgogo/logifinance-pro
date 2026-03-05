// 一般 CSV 匯出
export function exportToCSV(data: Record<string, any>[], filename: string) {
    if (!data || data.length === 0) return alert('目前沒有資料可供匯出');
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  
    downloadBlob(csvContent, filename);
  }
  
  // 🌟 Milestone 6: 實作金蝶 (Kingdee) 相容格式一鍵導出
  export function exportToKingdeeCSV(chargesData: any[], filename: string) {
    if (!chargesData || chargesData.length === 0) return alert('無資料可匯出');
    
    // 金蝶 K/3 或 雲星空 標準財務憑證匯出格式
    const headers = ['憑證日期', '憑證字', '憑證號', '摘要', '科目代碼', '科目名稱', '借方金額', '貸方金額'];
    
    const formattedData = chargesData.map((c, index) => {
      const isAR = c.arApType === 'AR';
      return [
        new Date().toISOString().split('T')[0], // 憑證日期
        '記',                                  // 憑證字
        String(index + 1).padStart(4, '0'),    // 憑證號
        `物流業務帳款 - ${c.feeCode}`,         // 摘要
        isAR ? '1122' : '2202',                // 科目代碼 (1122 應收, 2202 應付)
        isAR ? '應收帳款' : '應付帳款',         // 科目名稱
        isAR ? c.baseAmount : 0,               // 借方金額
        !isAR ? c.baseAmount : 0,              // 貸方金額
      ];
    });
  
    const csvContent = [
      headers.join(','),
      ...formattedData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  
    downloadBlob(csvContent, filename);
  }
  
  function downloadBlob(csvContent: string, filename: string) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }