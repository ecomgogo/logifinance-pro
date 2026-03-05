'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Printer, FileText } from 'lucide-react';
import api from '@/lib/api';

interface Charge {
  id: string;
  arApType: 'AR' | 'AP';
  feeCode: string;
  currency: string;
  amount: number;
  baseAmount: number;
  partner: { name: string };
}

export default function InvoicePage() {
  const params = useParams();
  const shipmentId = params.id as string;
  
  const [shipment, setShipment] = useState<any>(null);
  const [arCharges, setArCharges] = useState<Charge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [shipmentRes, chargesRes] = await Promise.all([
        api.get(`/shipments/${shipmentId}`),
        api.get(`/charges/shipment/${shipmentId}`)
      ]);
      setShipment(shipmentRes.data);
      // 請款單只需要列印「應收 (AR)」的項目
      setArCharges(chargesRes.data.filter((c: Charge) => c.arApType === 'AR'));
    } catch (error) {
      console.error(error);
      alert('載入資料失敗');
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-zinc-500" /></div>;

  const totalBaseAmount = arCharges.reduce((sum, c) => sum + Number(c.baseAmount), 0);
  // 抓出這筆單所有的客戶名稱 (去重複)
  const customers = Array.from(new Set(arCharges.map(c => c.partner.name))).join(', ');

  return (
    // 背景使用灰色，但在列印時 (print:bg-white) 自動變成純白
    <div className="min-h-screen bg-zinc-200 py-8 flex justify-center font-sans print:p-0 print:bg-white">
      
      {/* 模擬 A4 紙張大小與陰影 */}
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-12 shadow-2xl print:shadow-none print:w-full print:max-w-none">
        
        {/* 標頭區塊 */}
        <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-black text-white p-1.5 rounded-lg"><FileText size={24} /></div>
              <h1 className="text-4xl font-black text-zinc-900 tracking-tighter">DEBIT NOTE</h1>
            </div>
            <p className="text-zinc-500 font-medium tracking-wide">LogiFinance Pro Ltd.</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">Invoice Number</p>
            <p className="text-xl font-mono font-bold text-zinc-900">{shipment.internalNo}-INV</p>
            <p className="text-sm text-zinc-500 mt-2">Date: {new Date().toLocaleDateString('en-US')}</p>
            
            {/* 這個按鈕在畫面上看得到，但列印時 (print:hidden) 會自動隱藏！ */}
            <button 
              onClick={() => window.print()} 
              className="mt-6 print:hidden bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center justify-end gap-2 text-sm font-medium hover:bg-blue-700 transition-colors shadow-md ml-auto"
            >
              <Printer size={18} /> 列印 / 儲存 PDF
            </button>
          </div>
        </div>

        {/* 收件人資訊 */}
        <div className="mb-12">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Billed To (客戶)</h3>
          <p className="text-2xl font-bold text-zinc-900">{customers || 'Valued Customer'}</p>
          <p className="text-zinc-500 mt-1 flex gap-4">
            <span>MBL: <span className="font-mono text-zinc-700">{shipment.mblNumber || 'N/A'}</span></span>
            <span>Type: <span className="font-medium text-zinc-700">{shipment.type}</span></span>
          </p>
        </div>

        {/* 費用明細表格 */}
        <table className="w-full text-left mb-12">
          <thead>
            <tr className="border-b-2 border-zinc-200 text-zinc-900">
              <th className="py-3 font-bold uppercase text-sm tracking-wider">Description (費用項目)</th>
              <th className="py-3 font-bold uppercase text-sm tracking-wider">Currency</th>
              <th className="py-3 font-bold uppercase text-sm tracking-wider text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {arCharges.map(charge => (
              <tr key={charge.id}>
                <td className="py-4 text-zinc-800 font-medium">{charge.feeCode}</td>
                <td className="py-4 text-zinc-500">{charge.currency}</td>
                <td className="py-4 text-right font-mono text-lg text-zinc-900">{Number(charge.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 總計區塊 */}
        <div className="flex justify-end">
          <div className="w-1/2 border-t-2 border-zinc-900 pt-4 flex justify-between items-center">
            <span className="font-bold text-zinc-900 text-lg uppercase tracking-wider">Total Due (HKD)</span>
            <span className="font-black text-4xl text-zinc-900 font-mono">${totalBaseAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* 頁尾條款 */}
        <div className="mt-32 pt-8 border-t border-zinc-200 text-center text-sm text-zinc-400">
          <p className="font-medium text-zinc-500 mb-1">Please make payments payable to LogiFinance Pro Ltd.</p>
          <p>Bank Account: 123-456-789 (HSBC) | SWIFT: HSBCXXXX</p>
          <p className="mt-4">Thank you for your business!</p>
        </div>

      </div>
    </div>
  );
}