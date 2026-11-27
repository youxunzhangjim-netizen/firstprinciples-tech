import React, { useEffect, useState } from 'react';
import { Cpu, Atom, Globe, KeyRound, Moon, Radio, Sun } from 'lucide-react';
import { QuantumOverheadWidget } from './components/QuantumOverheadWidget';
import { AiRooflineWidget } from './components/AiRooflineWidget';
import { MembershipModal } from './components/MembershipModal';
import {
  buildLocalFullFpLicense,
  FpLicenseState,
  FREE_FP_LICENSE,
  isLocalPreviewHost,
  parseStoredFpLicense,
  validateFpKeyLocally,
} from './engine/licenseEngine';
import { FpLang, loadInitialFpLang, saveFpLang, tr } from './i18n';

const FP_STORAGE_KEY = 'fpth_license_v1';
const FP_LOCAL_FREE_KEY = 'fpth_local_sim_free_v1';

function detectLocalHost(): boolean {
  try {
    return typeof window !== 'undefined' && isLocalPreviewHost(window.location.hostname);
  } catch (err) {
    console.warn('Hostname check fallback:', err);
    return false;
  }
}

function loadInitialFpLicense(localHost: boolean): FpLicenseState {
  try {
    const qKey = new URLSearchParams(window.location.search).get('license');
    if (qKey) {
      const checked = validateFpKeyLocally(qKey);
      if (checked.valid && checked.state) {
        window.localStorage.setItem(FP_STORAGE_KEY, JSON.stringify(checked.state));
        window.localStorage.removeItem(FP_LOCAL_FREE_KEY);
        return checked.state;
      }
    }
    const stored = parseStoredFpLicense(window.localStorage.getItem(FP_STORAGE_KEY));
    if (stored.isPro) return stored;
    if (localHost && window.localStorage.getItem(FP_LOCAL_FREE_KEY) !== '1') {
      return buildLocalFullFpLicense();
    }
    return FREE_FP_LICENSE;
  } catch (err) {
    console.warn('License load fallback:', err);
    return localHost ? buildLocalFullFpLicense() : FREE_FP_LICENSE;
  }
}

const SAMPLE_RADAR_ITEMS = [
  {
    source: 'arXiv quant-ph',
    id: '2604.01922v2',
    score: 59,
    titleEn: 'Below-Threshold Surface Code Decoding at 99.65% Two-Qubit Gate Fidelity',
    titleZh: '雙量子閘保真度 99.65% 下之低於閾值表面碼即時解碼實證',
    signalsEn: ['Quantitative Gate Fidelity', 'T1/T2 Coherence Measurement', 'Fault-Tolerant QEC Breakthrough'],
    signalsZh: ['量化雙閘保真度數據', 'T1/T2 相干時間實測', '容錯量子糾錯里程碑'],
  },
  {
    source: 'USPTO ODP (H01L)',
    id: 'US-18999123',
    score: 55,
    titleEn: '[Taiwan Semiconductor] HBM4 2nm CoWoS Interposer at 8 TB/s and 700 W Liquid Cooling',
    titleZh: '[台積電專利] HBM4 2 奈米 CoWoS 中介層：8 TB/s 頻寬與 700 W 液冷散熱架構',
    signalsEn: ['Leading-Edge Process Node', 'Memory Bandwidth & Packaging', 'Thermal / Power Efficiency'],
    signalsZh: ['先進製程節點 (2nm)', 'HBM4 頻寬與先進封裝', '熱傳與液冷能效設計'],
  },
];

export const App: React.FC = () => {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const embedMode = params.get('embed') === '1';
  const initialWidget = params.get('widget') === 'roofline' ? 'roofline' : 'quantum';

  const [activeTab, setActiveTab] = useState<'quantum' | 'roofline' | 'radar'>(initialWidget);
  const [isLocalHost] = useState<boolean>(() => detectLocalHost());
  const [license, setLicense] = useState<FpLicenseState>(() => loadInitialFpLicense(detectLocalHost()));
  const [memberOpen, setMemberOpen] = useState(false);
  const [lang, setLang] = useState<FpLang>(() => loadInitialFpLang());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('fpth_theme_v1') === 'dark';
    } catch (err) {
      console.warn('Theme read fallback:', err);
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try {
      window.localStorage.setItem('fpth_theme_v1', darkMode ? 'dark' : 'light');
    } catch (err) {
      console.warn('Theme save fallback:', err);
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant' : 'en';
    saveFpLang(lang);
  }, [lang]);

  const handleActivate = (next: FpLicenseState): void => {
    setLicense(next);
    try {
      window.localStorage.setItem(FP_STORAGE_KEY, JSON.stringify(next));
      window.localStorage.removeItem(FP_LOCAL_FREE_KEY);
    } catch (err) {
      console.warn('License save skipped:', err);
    }
  };

  const handleSimulateFree = (): void => {
    setLicense(FREE_FP_LICENSE);
    try {
      window.localStorage.removeItem(FP_STORAGE_KEY);
      if (isLocalHost) window.localStorage.setItem(FP_LOCAL_FREE_KEY, '1');
    } catch (err) {
      console.warn('Free sim save skipped:', err);
    }
  };

  const handleRestoreLocalFull = (): void => {
    const full = buildLocalFullFpLicense();
    setLicense(full);
    try {
      window.localStorage.removeItem(FP_LOCAL_FREE_KEY);
      window.localStorage.removeItem(FP_STORAGE_KEY);
    } catch (err) {
      console.warn('Restore local full skipped:', err);
    }
  };

  if (embedMode) {
    return (
      <div className="p-2 bg-[#F7F5EF]">
        {initialWidget === 'roofline' ? (
          <AiRooflineWidget lang={lang} embedMode />
        ) : (
          <QuantumOverheadWidget lang={lang} embedMode />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#111315] flex flex-col">
      <header className="border-b border-[#D8D3C8] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono-lab text-[11px] text-[#B45309] font-semibold">
              FirstPrinciples Tech · 第一性原理硬科技實驗室
            </p>
            <h1 className="font-editorial text-2xl font-bold tracking-tight mt-0.5">
              {tr(lang, '量子容錯糾錯 & AI 硬體 Roofline 計算器', 'Quantum & AI Hardware Calculators')}
            </h1>
          </div>

          <nav aria-label="Widget modules" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('quantum')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-lab border cursor-pointer ${
                activeTab === 'quantum'
                  ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                  : 'border-[#D8D3C8] text-[#4B5563] hover:text-[#111315]'
              }`}
            >
              <Atom className="w-3.5 h-3.5" />
              {tr(lang, '量子表面碼 QEC', 'Surface Code QEC')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roofline')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-lab border cursor-pointer ${
                activeTab === 'roofline'
                  ? 'border-[#B45309] bg-[#FFFBEB] text-[#B45309] font-semibold'
                  : 'border-[#D8D3C8] text-[#4B5563] hover:text-[#111315]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              {tr(lang, 'AI 晶片 Roofline', 'AI Roofline')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-lab border cursor-pointer ${
                activeTab === 'radar'
                  ? 'border-[#111315] bg-[#111315] text-white font-semibold'
                  : 'border-[#D8D3C8] text-[#4B5563] hover:text-[#111315]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {tr(lang, '專利與論文雷達預覽', 'Digest Preview')}
            </button>
            <button
              type="button"
              onClick={() => setMemberOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-lab border cursor-pointer font-semibold ${
                license.isPro
                  ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46]'
                  : 'border-[#111315] bg-[#F7F5EF] text-[#111315] hover:border-[#B45309]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              {license.isPro
                ? license.mode === 'local_full'
                  ? tr(lang, '版本：專業版 (本機)', 'EDITION: PRO (LOCAL)')
                  : tr(lang, '版本：PRO', 'EDITION: PRO')
                : tr(lang, '會員與商業授權', 'Edition & License')}
            </button>
            <button
              type="button"
              onClick={() => setLang((l) => (l === 'zh-TW' ? 'en' : 'zh-TW'))}
              aria-label="Switch interface language"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono-lab border border-[#D8D3C8] bg-[#F7F5EF] text-[#111315] hover:border-[#1D4ED8] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>{lang === 'zh-TW' ? '繁中 | EN' : 'EN | 繁中'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono-lab border border-[#D8D3C8] bg-[#F7F5EF] text-[#111315] cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-[#FBBF24]" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? tr(lang, '淺色', 'Light') : tr(lang, '深色', 'Dark')}</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="px-4 py-2.5 border border-[#D8D3C8] bg-white text-xs text-[#4B5563] flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono-lab text-[#111315] font-semibold">
            {tr(lang, '操作指南：', 'How to use:')}
          </span>
          {activeTab === 'quantum' ? (
            <>
              <span>{tr(lang, '1. 選擇物理量子位元路線與目標演算法。', '1. Pick a qubit modality and target algorithm.')}</span>
              <span>{tr(lang, '2. 調整雙量子閘物理錯誤率與糾錯週期時間。', '2. Adjust physical error rate and cycle time.')}</span>
              <span>{tr(lang, '3. 即時檢視所需碼距 d、總實體位元數（含 T-Factory）與實際執行時間。', '3. Check required code distance, total qubits, and runtime.')}</span>
            </>
          ) : activeTab === 'roofline' ? (
            <>
              <span>{tr(lang, '1. 點選 AI 加速器晶片預設值（如 B200、H200、H100、MI325X）。', '1. Pick an accelerator preset (e.g. H100, B200, MI325X).')}</span>
              <span>{tr(lang, '2. 設定量化精度、Context 長度、Batch 與 Tensor Parallel 卡數。', '2. Set precision, batch size, and sequence length.')}</span>
              <span>{tr(lang, '3. 判斷算子受限於 HBM 頻寬或算力，並試算 KV-Cache 與每百萬 Token 成本。', '3. Check whether inference is memory-bound or compute-bound.')}</span>
            </>
          ) : (
            <>
              <span>
                {tr(lang, '1. 於本地或排程執行 ', '1. Run ')}
                <code className="font-mono-lab">pipeline/src/radar/cli.py</code>
                {tr(lang, ' 抓取最新 arXiv 與 USPTO 專利。', ' locally or on a schedule.')}
              </span>
              <span>
                {tr(lang, '2. 系統自動以草稿（draft）模式送入 Ghost 後台供人工審閱發布。', '2. Posts are saved to Ghost as drafts for manual review.')}
              </span>
            </>
          )}
        </div>
        {activeTab === 'quantum' && (
          <QuantumOverheadWidget
            lang={lang}
            embedMode={false}
            isPro={license.isPro}
            onOpenMembership={() => setMemberOpen(true)}
          />
        )}
        {activeTab === 'roofline' && (
          <AiRooflineWidget
            lang={lang}
            embedMode={false}
            isPro={license.isPro}
            onOpenMembership={() => setMemberOpen(true)}
          />
        )}
        {activeTab === 'radar' && (
          <section className="border border-[#D8D3C8] bg-white p-5 space-y-4">
            <div className="border-b border-[#D8D3C8] pb-3">
              <p className="font-mono-lab text-[11px] uppercase tracking-widest text-[#B45309]">
                {tr(lang, 'Ghost Admin API 自動化研究摘要草稿預覽', 'Ghost Admin API Draft Output Preview')}
              </p>
              <h2 className="font-editorial text-2xl font-semibold mt-0.5">
                {tr(
                  lang,
                  'arXiv 物理預印本 ＋ 美國專利局 USPTO ODP 第一性原理評分雷達',
                  'Automated arXiv + USPTO ODP First-Principles Digest'
                )}
              </h2>
              <p className="text-xs text-[#4B5563] mt-1">
                {tr(
                  lang,
                  '由 pipeline/src/radar/cli.py 每日自動擷取，嚴格遵守 arXiv ≥ 3.5 秒單線程限速與 Ghost status="draft" 人工審稿保護鎖。',
                  'Generated daily at 06:00 UTC by pipeline/src/radar/cli.py with strict ≥3.5s arXiv serial rate limiting and mandatory status="draft" editorial review lock.'
                )}
              </p>
            </div>
            <div className="divide-y divide-[#ECE8DE]">
              {SAMPLE_RADAR_ITEMS.map((item) => (
                <article key={item.id} className="py-3.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-lab text-[11px] px-2 py-0.5 bg-[#F7F5EF] border border-[#D8D3C8]">
                      {item.source} · {item.id}
                    </span>
                    <span className="font-mono-lab text-xs font-bold text-[#1D4ED8] tabular-nums">
                      {tr(lang, `量化評分：${item.score}`, `RUBRIC SCORE: ${item.score}`)}
                    </span>
                  </div>
                  <h3 className="font-editorial text-lg font-semibold">
                    {lang === 'zh-TW' ? item.titleZh : item.titleEn}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(lang === 'zh-TW' ? item.signalsZh : item.signalsEn).map((s) => (
                      <span key={s} className="font-mono-lab text-[10px] px-2 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                        + {s}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[#D8D3C8] bg-white py-3.5 text-xs text-[#4B5563]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap justify-between gap-2 font-mono-lab text-[11px]">
          <span>
            {tr(
              lang,
              'FirstPrinciples Tech · 支援 ?embed=1&lang=zh-TW 嵌入技術專欄與投資備忘錄',
              'FirstPrinciples Tech · Embed with ?embed=1'
            )}
          </span>
          <span>
            {tr(lang, '100% 瀏覽器本地端物理模型運算', 'Runs locally in your browser')}
          </span>
        </div>
      </footer>
      <MembershipModal
        lang={lang}
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        license={license}
        isLocalHost={isLocalHost}
        onActivate={handleActivate}
        onSimulateFree={handleSimulateFree}
        onRestoreLocalFull={handleRestoreLocalFull}
      />
    </div>
  );
};

export default App;
