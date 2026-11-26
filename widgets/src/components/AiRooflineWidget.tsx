import React, { useMemo, useState } from 'react';
import { Check, Code2, Download, Lock } from 'lucide-react';
import {
  ACCELERATOR_PRESETS,
  AcceleratorSpec,
  evaluateLlmServing,
  evaluateRoofline,
  LLM_MODEL_PRESETS,
} from '../engine/aiRoofline';

interface Props {
  embedMode: boolean;
  isPro?: boolean;
  onOpenMembership?: () => void;
}

export const AiRooflineWidget: React.FC<Props> = ({
  embedMode,
  isPro = true,
  onOpenMembership,
}) => {
  const [spec, setSpec] = useState<AcceleratorSpec>(ACCELERATOR_PRESETS[0]);
  const [customAi, setCustomAi] = useState(128);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // LLM-Viewer style KV-Cache & Decode Throughput controls
  const [modelId, setModelId] = useState<string>('llama31-70b');
  const [precisionBytes, setPrecisionBytes] = useState<2 | 1 | 0.5>(1);
  const [contextLength, setContextLength] = useState<number>(16384);
  const [batchSize, setBatchSize] = useState<number>(16);
  const [numGpus, setNumGpus] = useState<number>(1);

  const analysis = useMemo(() => evaluateRoofline(spec, customAi), [spec, customAi]);
  const h100Baseline = useMemo(
    () => evaluateRoofline(ACCELERATOR_PRESETS.find((p) => p.id === 'nvidia-h100') ?? ACCELERATOR_PRESETS[2], customAi),
    [customAi]
  );
  const llmServing = useMemo(
    () => evaluateLlmServing(spec, { modelId, precisionBytes, contextLength, batchSize, numGpus }),
    [spec, modelId, precisionBytes, contextLength, batchSize, numGpus]
  );

  // Log-log SVG Roofline plot
  const W = 540;
  const H = 230;
  const padL = 56;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const mapX = (ai: number) => padL + (Math.min(3.6, Math.max(0, Math.log10(ai))) / 3.6) * plotW;
  const mapY = (tf: number) => padT + (1 - Math.min(4, Math.max(0, Math.log10(Math.max(1, tf)))) / 4) * plotH;

  const ridgeX = mapX(analysis.ridgePointFlopsPerByte);
  const ridgeY = mapY(spec.peakComputeTflops);
  const startY = mapY(spec.hbmBandwidthTBps * 1);

  const h100Spec = ACCELERATOR_PRESETS.find((p) => p.id === 'nvidia-h100') ?? ACCELERATOR_PRESETS[2];
  const h100RidgeX = mapX(h100Baseline.ridgePointFlopsPerByte);
  const h100RidgeY = mapY(h100Spec.peakComputeTflops);
  const h100StartY = mapY(h100Spec.hbmBandwidthTBps * 1);

  const embedSnippet = `<iframe src="${window.location.origin}${window.location.pathname}?widget=roofline&embed=1" width="100%" height="780" style="border:1px solid #D8D3C8;" loading="lazy" title="AI Accelerator Roofline & LLM KV-Cache Visualizer"></iframe>`;

  const copyEmbed = async (): Promise<void> => {
    if (!isPro && onOpenMembership) {
      onOpenMembership();
      return;
    }
    await navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 1800);
  };

  const exportRooflineCsv = (): void => {
    if (!isPro && onOpenMembership) {
      onOpenMembership();
      return;
    }
    const customPt = analysis.workloads.find((w) => w.id === 'custom') ?? analysis.workloads[0];
    const rows = [
      ['Accelerator', spec.name],
      ['Peak TFLOP/s', spec.peakComputeTflops],
      ['HBM Bandwidth TB/s', spec.hbmBandwidthTBps],
      ['Ridge Point (FLOPs/Byte)', analysis.ridgePointFlopsPerByte.toFixed(1)],
      ['Custom Arithmetic Intensity', customAi],
      ['Attainable TFLOP/s', (customPt?.attainableTflops ?? 0).toFixed(1)],
      ['Model', llmServing.modelName],
      ['Context Length', contextLength],
      ['Batch Size', batchSize],
      ['Total VRAM Required GB', llmServing.totalVramRequiredGB.toFixed(2)],
      ['Est. Decode tok/s', llmServing.decodeThroughputTokPerSec.toFixed(1)],
      ['Est. Cost US$/1M Tokens', llmServing.costPer1MOutputTokensUsd.toFixed(4)],
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firstprinciples-roofline-${spec.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="border border-[#D8D3C8] bg-white">
      <div className="px-5 py-4 border-b border-[#D8D3C8] flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-lab text-[11px] text-[#B45309] font-semibold">
            Roofline &amp; LLM KV-Cache Model
          </p>
          <h2 className="font-editorial text-2xl font-semibold text-[#111315] mt-0.5">
            AI Accelerator Roofline &amp; Serving Cost
          </h2>
          <p className="text-xs text-[#4B5563] mt-1">
            <code className="font-mono-lab">Ridge Point = Peak TFLOP/s ÷ HBM TB/s</code> (vs. H100 dashed line), prefill TTFT, KV-cache VRAM, and US$/1M token cost.
          </p>
        </div>
        {!embedMode && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={exportRooflineCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono-lab border border-[#D8D3C8] hover:border-[#B45309] text-[#111315] cursor-pointer"
            >
              {isPro ? <Download className="w-3.5 h-3.5 text-[#B45309]" /> : <Lock className="w-3 h-3 text-[#B45309]" />}
              {isPro ? 'CSV Report' : 'CSV (Pro)'}
            </button>
            <button
              type="button"
              onClick={copyEmbed}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-lab border border-[#D8D3C8] hover:border-[#1D4ED8] text-[#111315] cursor-pointer"
            >
              {copiedEmbed ? (
                <Check className="w-3.5 h-3.5 text-[#059669]" />
              ) : isPro ? (
                <Code2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
              ) : (
                <Lock className="w-3 h-3 text-[#B45309]" />
              )}
              {copiedEmbed ? 'Copied Ghost <iframe>' : isPro ? 'Copy Ghost <iframe>' : 'Embed (Pro)'}
            </button>
          </div>
        )}
      </div>

      {/* Accelerator Presets */}
      <div className="px-5 py-2.5 bg-[#F7F5EF] border-b border-[#D8D3C8] flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono-lab text-[11px] text-[#4B5563]">SILICON PRESETS:</span>
        {ACCELERATOR_PRESETS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSpec(chip)}
            className={`px-2.5 py-1 border cursor-pointer ${
              spec.id === chip.id
                ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                : 'border-[#D8D3C8] bg-white text-[#111315] hover:border-[#1D4ED8]'
            }`}
          >
            {chip.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-[#D8D3C8] space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="peak-tf" className="font-medium">Peak Dense Compute (TFLOP/s)</label>
              <span className="font-mono-lab font-semibold text-[#1D4ED8] tabular-nums">{spec.peakComputeTflops.toLocaleString()} TFLOP/s</span>
            </div>
            <input
              id="peak-tf"
              type="range"
              min={200}
              max={10000}
              step={50}
              value={spec.peakComputeTflops}
              onChange={(e) => setSpec({ ...spec, id: 'custom', name: 'Custom Silicon', peakComputeTflops: Number(e.target.value) })}
              className="w-full accent-[#1D4ED8]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="hbm-bw" className="font-medium">HBM Memory Bandwidth (TB/s)</label>
              <span className="font-mono-lab font-semibold text-[#B45309] tabular-nums">{spec.hbmBandwidthTBps.toFixed(2)} TB/s</span>
            </div>
            <input
              id="hbm-bw"
              type="range"
              min={0.5}
              max={16}
              step={0.1}
              value={spec.hbmBandwidthTBps}
              onChange={(e) => setSpec({ ...spec, id: 'custom', name: 'Custom Silicon', hbmBandwidthTBps: Number(e.target.value) })}
              className="w-full accent-[#B45309]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="custom-ai" className="font-medium">Custom Kernel Arithmetic Intensity</label>
              <span className="font-mono-lab font-semibold tabular-nums">{customAi} FLOPs / Byte</span>
            </div>
            <input
              id="custom-ai"
              type="range"
              min={1}
              max={2048}
              step={1}
              value={customAi}
              onChange={(e) => setCustomAi(Number(e.target.value))}
              className="w-full accent-[#1D4ED8]"
            />
          </div>

          {/* Workload classification table */}
          <div className="border border-[#D8D3C8] overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F7F5EF] border-b border-[#D8D3C8] text-[#4B5563]">
                <tr>
                  <th className="text-left px-2.5 py-1.5">Workload</th>
                  <th className="text-right px-2.5 py-1.5">Attainable</th>
                  <th className="text-right px-2.5 py-1.5">Regime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE8DE] font-mono-lab tabular-nums">
                {analysis.workloads.map((w) => (
                  <tr key={w.id} className={w.id === 'custom' ? 'bg-[#EFF6FF]' : ''}>
                    <td className="px-2.5 py-1.5 font-sans">{w.label}</td>
                    <td className="px-2.5 py-1.5 text-right">{w.attainableTflops.toFixed(0)} TF/s</td>
                    <td className={`px-2.5 py-1.5 text-right font-semibold ${w.bottleneck === 'memory-bound' ? 'text-[#B45309]' : 'text-[#1D4ED8]'}`}>
                      {w.bottleneck === 'memory-bound' ? 'MEM-BOUND' : 'COMPUTE'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Log-Log SVG Roofline Chart */}
        <div className="lg:col-span-7 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 font-mono-lab tabular-nums">
            <div className="p-3 border border-[#D8D3C8] bg-[#F7F5EF]">
              <span className="text-[10px] text-[#4B5563] block">RIDGE POINT (OPS:BYTE)</span>
              <span className="text-lg font-bold text-[#B45309]">{analysis.ridgePointFlopsPerByte.toFixed(0)} FLOP/B</span>
            </div>
            <div className="p-3 border border-[#D8D3C8] bg-[#F7F5EF]">
              <span className="text-[10px] text-[#4B5563] block">PEAK EFFICIENCY</span>
              <span className="text-lg font-bold text-[#111315]">{analysis.tflopsPerWattPeak.toFixed(2)} TF/W</span>
            </div>
            <div className="p-3 border border-[#D8D3C8] bg-[#F7F5EF]">
              <span className="text-[10px] text-[#4B5563] block">DECODE B=1 UTILIZATION</span>
              <span className="text-lg font-bold text-[#DC2626]">
                {analysis.workloads[0].hardwareUtilizationPct.toFixed(2)}%
              </span>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block border border-[#ECE8DE] bg-[#FCFBF8]"
            role="img"
            aria-label="Log-log AI Accelerator Roofline chart with H100 comparison"
          >
            {[1, 10, 100, 1000, 10000].map((tf) => {
              const y = mapY(tf);
              return (
                <g key={tf}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E5E0D5" strokeWidth="0.8" />
                  <text x={padL - 7} y={y + 3} textAnchor="end" fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fill="#4B5563">
                    {tf}
                  </text>
                </g>
              );
            })}
            {[1, 10, 100, 1000].map((ai) => {
              const x = mapX(ai);
              return (
                <g key={ai}>
                  <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#E5E0D5" strokeWidth="0.8" />
                  <text x={x} y={H - 12} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fill="#4B5563">
                    {ai} F/B
                  </text>
                </g>
              );
            })}

            {/* H100 Reference Roofline (dashed gray comparison) */}
            {spec.id !== 'nvidia-h100' && (
              <polyline
                points={`${padL},${h100StartY.toFixed(1)} ${h100RidgeX.toFixed(1)},${h100RidgeY.toFixed(1)} ${W - padR},${h100RidgeY.toFixed(1)}`}
                fill="none"
                stroke="#94A3B8"
                strokeWidth="1.4"
                strokeDasharray="4 3"
              />
            )}

            {/* Selected Silicon Roofline */}
            <polyline
              points={`${padL},${startY.toFixed(1)} ${ridgeX.toFixed(1)},${ridgeY.toFixed(1)} ${W - padR},${ridgeY.toFixed(1)}`}
              fill="none"
              stroke="#111315"
              strokeWidth="2.4"
            />
            <line x1={ridgeX} y1={ridgeY} x2={ridgeX} y2={padT + plotH} stroke="#B45309" strokeWidth="1.2" strokeDasharray="4 3" />
            <text x={ridgeX + 4} y={padT + 12} fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#B45309">
              Ridge {analysis.ridgePointFlopsPerByte.toFixed(0)} F/B
            </text>

            {analysis.workloads.map((w) => {
              const cx = mapX(w.arithmeticIntensity);
              const cy = mapY(w.attainableTflops);
              const color = w.id === 'custom' ? '#1D4ED8' : w.bottleneck === 'memory-bound' ? '#B45309' : '#0F766E';
              return (
                <circle key={w.id} cx={cx} cy={cy} r={w.id === 'custom' ? 5 : 3.8} fill={color} stroke="#FFFFFF" strokeWidth="1.1" />
              );
            })}
          </svg>
        </div>
      </div>

      {/* LLM-Viewer Style KV-Cache, Prefill TTFT & Decode Token Economics Panel */}
      <div className="border-t border-[#D8D3C8] bg-[#F7F5EF] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111315]">
              LLM Serving Simulator (KV-Cache VRAM · Prefill TTFT · Decode Throughput &amp; $/1M Tokens)
            </h3>
            <p className="text-[11px] text-[#4B5563]">
              Models GQA vs DeepSeek MLA latent KV-cache compression across Tensor-Parallel GPU nodes.
            </p>
          </div>
          <span
            className={`px-2.5 py-1 text-xs font-mono-lab font-bold border ${
              llmServing.fitsInHbm
                ? 'border-[#059669]/40 bg-[#ECFDF5] text-[#065F46]'
                : 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
            }`}
          >
            {llmServing.fitsInHbm
              ? `FITS HBM (${llmServing.vramUtilizationPct}% of ${llmServing.totalClusterHbmGB} GB)`
              : `OOM: NEEDS ${llmServing.totalVramRequiredGB} GB > ${llmServing.totalClusterHbmGB} GB`}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="llm-model" className="block text-[11px] text-[#4B5563] mb-1">LLM Architecture</label>
            <select id="llm-model" value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full border border-[#D8D3C8] bg-white px-2 py-1.5 text-xs">
              {LLM_MODEL_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="llm-prec" className="block text-[11px] text-[#4B5563] mb-1">Quantization</label>
            <select id="llm-prec" value={precisionBytes} onChange={(e) => setPrecisionBytes(Number(e.target.value) as 2 | 1 | 0.5)} className="w-full border border-[#D8D3C8] bg-white px-2 py-1.5 font-mono-lab text-xs">
              <option value={2}>BF16 (2 Bytes)</option>
              <option value={1}>FP8 (1 Byte)</option>
              <option value={0.5}>INT4 (0.5 Byte)</option>
            </select>
          </div>
          <div>
            <label htmlFor="llm-ctx" className="block text-[11px] text-[#4B5563] mb-1">Context Tokens</label>
            <select id="llm-ctx" value={contextLength} onChange={(e) => setContextLength(Number(e.target.value))} className="w-full border border-[#D8D3C8] bg-white px-2 py-1.5 font-mono-lab text-xs">
              <option value={4096}>4K</option>
              <option value={16384}>16K</option>
              <option value={32768}>32K</option>
              <option value={131072}>128K</option>
            </select>
          </div>
          <div>
            <label htmlFor="llm-batch" className="block text-[11px] text-[#4B5563] mb-1">Batch Size</label>
            <input id="llm-batch" type="number" min={1} max={256} value={batchSize} onChange={(e) => setBatchSize(Math.max(1, Math.min(256, Number(e.target.value) || 1)))} className="w-full border border-[#D8D3C8] bg-white px-2 py-1.5 font-mono-lab text-xs" />
          </div>
          <div>
            <label htmlFor="llm-gpus" className="block text-[11px] text-[#4B5563] mb-1">GPUs (TP Degree)</label>
            <select id="llm-gpus" value={numGpus} onChange={(e) => setNumGpus(Number(e.target.value))} className="w-full border border-[#D8D3C8] bg-white px-2 py-1.5 font-mono-lab text-xs">
              <option value={1}>1× GPU</option>
              <option value={2}>2× TP2</option>
              <option value={4}>4× TP4</option>
              <option value={8}>8× TP8 Node</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 font-mono-lab tabular-nums">
          <div className="p-3 bg-white border border-[#D8D3C8]">
            <span className="text-[10px] text-[#4B5563] block">WEIGHTS / KV CACHE</span>
            <strong className="text-sm text-[#111315]">{llmServing.weightsVramGB}G / {llmServing.kvCacheVramGB}G</strong>
          </div>
          <div className="p-3 bg-white border border-[#D8D3C8]">
            <span className="text-[10px] text-[#4B5563] block">TOTAL DECODE</span>
            <strong className="text-sm text-[#1D4ED8]">{llmServing.decodeThroughputTokPerSec.toLocaleString()} tok/s</strong>
          </div>
          <div className="p-3 bg-white border border-[#D8D3C8]">
            <span className="text-[10px] text-[#4B5563] block">PER-USER SPEED</span>
            <strong className="text-sm text-[#111315]">{llmServing.perUserTokPerSec} tok/s</strong>
          </div>
          <div className="p-3 bg-white border border-[#D8D3C8]">
            <span className="text-[10px] text-[#4B5563] block">PREFILL TTFT</span>
            <strong className="text-sm text-[#B45309]">{llmServing.prefillTtftMs.toLocaleString()} ms</strong>
          </div>
          <div className="p-3 bg-white border border-[#D8D3C8]">
            <span className="text-[10px] text-[#4B5563] block">EST. $/1M OUTPUT TOK</span>
            <strong className="text-sm text-[#065F46]">
              {llmServing.fitsInHbm ? `$${llmServing.costPer1MOutputTokensUsd.toFixed(3)}` : 'OOM'}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
};
