import React, { useState } from 'react';
import { Check, ExternalLink, KeyRound, ShieldCheck, X } from 'lucide-react';
import {
  FP_DEMO_KEYS,
  FpLicenseState,
  validateFpKeyLocally,
} from '../engine/licenseEngine';
import { FpLang, tr } from '../i18n';

interface Props {
  lang: FpLang;
  open: boolean;
  onClose: () => void;
  license: FpLicenseState;
  isLocalHost: boolean;
  onActivate: (next: FpLicenseState) => void;
  onSimulateFree: () => void;
  onRestoreLocalFull: () => void;
}

const ENV = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const READER_CHECKOUT = ENV.VITE_FPTH_CHECKOUT_READER || '';
const INST_CHECKOUT = ENV.VITE_FPTH_CHECKOUT_INST || '';

export const MembershipModal: React.FC<Props> = ({
  lang,
  open,
  onClose,
  license,
  isLocalHost,
  onActivate,
  onSimulateFree,
  onRestoreLocalFull,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkoutHint, setCheckoutHint] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const check = validateFpKeyLocally(keyInput);
    if (!check.valid || !check.state) {
      setMsg({
        ok: false,
        text: tr(lang, '金鑰格式錯誤（應為 FPTH-XXXX-XXXX-XXXX）。', 'Invalid key format (expected FPTH-XXXX-XXXX-XXXX).'),
      });
      return;
    }
    onActivate(check.state);
    setMsg({
      ok: true,
      text: tr(
        lang,
        `已成功啟用 ${check.state.planId.replace('_', ' ').toUpperCase()} 授權。`,
        `Activated ${check.state.planId.replace('_', ' ').toUpperCase()}.`
      ),
    });
    setKeyInput('');
  };

  const handleCheckout = (tier: 'reader' | 'inst'): void => {
    const url = tier === 'inst' ? INST_CHECKOUT : READER_CHECKOUT;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setCheckoutHint(
      tier === 'inst'
        ? tr(
            lang,
            '請於 Cloudflare 環境變數設定 VITE_FPTH_CHECKOUT_INST 以連結機構研究席次 US$499/yr 結帳頁。',
            'Set VITE_FPTH_CHECKOUT_INST (Ghost / Lemon Squeezy US$499/yr desk link) in Cloudflare to go live.'
          )
        : tr(
            lang,
            '請於 Cloudflare 環境變數設定 VITE_FPTH_CHECKOUT_READER 以連結讀者專業版 US$12/mo 或 US$99/yr 結帳頁。',
            'Set VITE_FPTH_CHECKOUT_READER (Ghost Paid Member / Lemon Squeezy US$12/mo or US$99/yr link) in Cloudflare to go live.'
          )
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FirstPrinciples Tech Membership & Licensing"
      className="fixed inset-0 z-50 bg-[#111315]/65 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="max-w-3xl w-full bg-[#F7F5EF] border border-[#111315]/25 max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="px-5 py-4 bg-[#111315] text-white flex items-start justify-between gap-3">
          <div>
            <p className="font-mono-lab text-[10.5px] uppercase tracking-widest text-[#F59E0B]">
              {tr(lang, 'FirstPrinciples Tech · 專欄會員與硬科技研究授權', 'FirstPrinciples Tech · Ghost Member & Research Desk License')}
            </p>
            <h2 className="font-editorial text-xl font-bold mt-0.5">
              {tr(lang, 'Pro 讀者會員 & 機構硬體研究團隊授權', 'Reader Pro & Institutional Hardware Desk')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close membership dialog"
            className="p-1 text-[#9CA3AF] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {license.isPro && (
            <div className="p-3.5 border border-[#059669] bg-[#ECFDF5] text-[#065F46] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <div>
                  <strong className="block">
                    {tr(lang, '目前啟用：', 'Active: ')}
                    {license.mode === 'local_full'
                      ? tr(lang, '本機完整專業版', 'Local Full Desk Edition')
                      : license.planId.toUpperCase()}{' '}
                    ({license.keyMasked})
                  </strong>
                  {license.mode === 'local_full' && (
                    <span className="text-[11px]">
                      {tr(
                        lang,
                        'Localhost 自動解鎖全部專業版功能；公開網站預設為免費讀者模式。',
                        'Localhost unlocks all Pro features automatically; public visitors start on Free Tier.'
                      )}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSimulateFree();
                  setMsg(null);
                }}
                className="px-2.5 py-1 border border-[#065F46] bg-white text-[#065F46] hover:bg-[#065F46] hover:text-white font-mono-lab text-[11px] cursor-pointer"
              >
                {isLocalHost ? tr(lang, '模擬免費讀者', 'Simulate Free Reader') : tr(lang, '移除金鑰', 'Remove Key')}
              </button>
            </div>
          )}

          {!license.isPro && isLocalHost && (
            <div className="p-3 border border-[#1D4ED8] bg-[#EFF6FF] text-[#111315] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>{tr(lang, '目前於本機預覽免費公開讀者模式。', 'Previewing public Free Reader mode on localhost.')}</span>
              <button
                type="button"
                onClick={() => {
                  onRestoreLocalFull();
                  setMsg(null);
                }}
                className="px-2.5 py-1 bg-[#1D4ED8] text-white font-mono-lab text-[11px] font-semibold cursor-pointer"
              >
                {tr(lang, '恢復本機完整版', 'Restore Local Full Edition')}
              </button>
            </div>
          )}

          <div className="p-3 border border-[#D8D3C8] bg-white text-xs text-[#4B5563]">
            <strong className="text-[#111315]">{tr(lang, '免費公開計算器：', 'Free Public Calculators:')}</strong>{' '}
            {tr(
              lang,
              '互動式量子表面碼 QEC 與 AI 加速器 Roofline 模型完全免費開放。升級 Pro 可匯出完整掃描數據 CSV、複製無浮水印 <iframe> 專欄嵌入碼，並訂閱每週 arXiv + USPTO 硬科技專利深度週報。',
              'Interactive QEC Surface Code and AI Accelerator Roofline exploration are free for all readers. Pro unlocks CSV data-table sweeps, clean Ghost/Notion <iframe> embed snippets, and weekly deep-dive patent & arXiv digests.'
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 border border-[#1D4ED8] bg-white flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-editorial text-lg font-bold">{tr(lang, 'Pro 專欄讀者會員', 'Pro Reader')}</h3>
                  <div className="text-right font-mono-lab tabular-nums">
                    <span className="text-lg font-bold text-[#1D4ED8] block">US$12/mo</span>
                    <span className="text-[10px] text-[#4B5563]">or US$99/yr · CA$135 · NT$3,200</span>
                  </div>
                </div>
                <ul className="space-y-1 text-xs text-[#374151]">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    {tr(lang, '匯出 Roofline 與量子表面碼掃描 CSV 數據表', 'Export Roofline & QEC sweep CSV tables')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    {tr(lang, '複製 Ghost / Notion 互動式 <iframe> 嵌入碼', 'Copy clean <iframe> embeds for memos')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    {tr(lang, '每週 arXiv quant-ph ＋ USPTO 半導體專利評析', 'Weekly arXiv quant-ph + USPTO ODP briefs')}
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleCheckout('reader')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1D4ED8] text-white text-xs font-semibold hover:bg-[#1E40AF] cursor-pointer"
              >
                {tr(lang, '透過 Ghost / Lemon Squeezy 訂閱', 'Subscribe via Ghost / Lemon Squeezy')} <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 border border-[#D8D3C8] bg-white flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-editorial text-lg font-bold">
                    {tr(lang, '機構法人／創投研究席次', 'Institutional Research Desk')}
                  </h3>
                  <div className="text-right font-mono-lab tabular-nums">
                    <span className="text-lg font-bold text-[#B45309] block">US$499/yr</span>
                    <span className="text-[10px] text-[#4B5563]">CA$680/yr · NT$16,200/yr</span>
                  </div>
                </div>
                <ul className="space-y-1 text-xs text-[#374151]">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#B45309]" />
                    {tr(lang, '5 組半導體／硬科技創投／量化分析師席次', '5 analyst seats for semiconductor / VC / quant teams')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#B45309]" />
                    {tr(lang, '自訂評分權重與特定大廠 USPTO 專利追蹤', 'Custom rubric weights & USPTO assignee tracking')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#B45309]" />
                    {tr(lang, '提供公司報帳發票與自動化 JSON 資料源', 'Corporate invoice receipt & JSON pipeline feed')}
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleCheckout('inst')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#111315] text-[#111315] text-xs font-semibold hover:bg-[#111315] hover:text-white cursor-pointer"
              >
                {tr(lang, '購買機構研究授權', 'Get Institutional License')} <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {checkoutHint && (
            <div className="p-3 border border-[#B45309]/40 bg-[#FFFBEB] text-xs text-[#92400E]">
              {checkoutHint}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3.5 border border-[#D8D3C8] bg-white space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="fp-key-input" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111315]">
                <KeyRound className="w-3.5 h-3.5 text-[#B45309]" />
                {tr(lang, '啟用會員授權金鑰', 'Activate Member License Key')}
              </label>
              {!license.isPro && (
                <button
                  type="button"
                  onClick={() => {
                    const check = validateFpKeyLocally(FP_DEMO_KEYS.readerPro);
                    if (check.valid && check.state) {
                      onActivate(check.state);
                      setMsg({ ok: true, text: tr(lang, '已啟用展示用 Pro 金鑰。', 'Demo Pro key activated.') });
                    }
                  }}
                  className="text-[11px] font-mono-lab text-[#1D4ED8] underline cursor-pointer"
                >
                  {tr(lang, `試用展示金鑰 (${FP_DEMO_KEYS.readerPro})`, `Try Demo Key (${FP_DEMO_KEYS.readerPro})`)}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                id="fp-key-input"
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="FPTH-XXXX-XXXX-XXXX"
                className="flex-1 border border-[#D8D3C8] bg-[#F7F5EF] px-3 py-1.5 font-mono-lab text-xs uppercase"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#111315] text-white text-xs font-semibold hover:bg-[#374151] cursor-pointer"
              >
                {tr(lang, '啟用', 'Activate')}
              </button>
            </div>
            {msg && (
              <p className={`text-xs font-medium ${msg.ok ? 'text-[#065F46]' : 'text-[#B91C1C]'}`}>
                {msg.text}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
