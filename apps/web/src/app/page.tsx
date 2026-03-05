import Link from 'next/link';
import { ArrowRight, BarChart3, Globe, Shield, Zap, CheckCircle2, Package, Banknote, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans selection:bg-blue-500/30">
      
      {/* 導覽列 */}
      <nav className="fixed w-full z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg">
              <Package size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">LogiFinance Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
            >
              登入
            </Link>
            <Link 
              href="/login" 
              className="text-sm font-medium bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full hover:scale-105 transition-transform shadow-sm"
            >
              免費試用
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero 區塊 (主視覺) */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 relative overflow-hidden">
        {/* 背景光暈效果 */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/20 dark:bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium mb-6 border border-blue-100 dark:border-blue-500/20">
            <Zap size={14} /> 專為現代國際物流與貨代業打造
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-zinc-900 dark:text-white tracking-tighter leading-tight mb-8">
            終結混亂的 Excel 帳本。<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">
              重新定義貨代財務管理。
            </span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            LogiFinance Pro 是一套強大的 B2B SaaS 系統。從單票利潤分析、自動業績抽成、一鍵對帳到報表匯出，完美串聯業務與財務的每一段流程。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95"
            >
              進入系統 <ArrowRight size={20} />
            </Link>
            <a 
              href="#features" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
            >
              了解功能
            </a>
          </div>
        </div>
      </section>

      {/* 核心功能區塊 */}
      <section id="features" className="py-20 bg-zinc-100 dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">企業級的強大功能</h2>
            <p className="text-zinc-500 dark:text-zinc-400">我們把最複雜的財務邏輯，變成最直覺的操作體驗。</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                <BarChart3 size={24} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">動態利潤引擎</h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                即時計算單票海空運的 AR (應收) 與 AP (應付)，準確掌握每一張單的真實毛利，告別人工算錯的風險。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                <Banknote size={24} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">資金核銷閉環</h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                支援一鍵核銷收款與付款。系統會自動計算客戶欠款與應付帳款餘額，內建會計防護鎖，確保帳本絕對安全。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">多租戶與權限隔離</h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                完美的 RBAC 角色防護。老闆掌握全公司數據與業績自動結算；業務員只能看見自己的業績，資料嚴密隔離。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 數據驗證與 CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto bg-black dark:bg-zinc-900 rounded-3xl p-8 md:p-16 text-center shadow-2xl relative overflow-hidden border border-zinc-800">
           <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/50 to-transparent pointer-events-none" />
           <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">準備好提升公司的營運效率了嗎？</h2>
            <p className="text-zinc-400 mb-10 text-lg">
              不要再讓傳統的 Excel 消耗你團隊的寶貴時間。立即登入系統，體驗現代化 SaaS 帶來的無縫財務管理。
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6 text-zinc-300 mb-10">
              <span className="flex items-center justify-center gap-2"><CheckCircle2 className="text-emerald-500" size={20} /> 免費註冊體驗</span>
              <span className="flex items-center justify-center gap-2"><CheckCircle2 className="text-emerald-500" size={20} /> 無需綁定信用卡</span>
              <span className="flex items-center justify-center gap-2"><CheckCircle2 className="text-emerald-500" size={20} /> 隨時匯出報表</span>
            </div>
            <Link 
              href="/login" 
              className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-200 transition-colors"
            >
              立即開始使用
            </Link>
          </div>
        </div>
      </section>

      {/* 頁尾 */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Globe size={16} /> <span>Built for Freight Forwarders & Logistics</span>
        </div>
        <p>© 2026 LogiFinance Pro SaaS. All rights reserved.</p>
      </footer>
    </div>
  );
}