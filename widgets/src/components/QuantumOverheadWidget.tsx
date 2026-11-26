import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy, Download, Lock } from 'lucide-react';
import {
  evaluateSurfaceCode,
  QUANTUM_ALGORITHM_PRESETS,
  QUANTUM_HARDWARE_PRESETS,
} from '../engine/quantumSurfaceCode';

interface Props {
  embedMode: boolean;
  isPro?: boolean;
  onOpenMembership?: () => void;
}

export const QuantumOverheadWidget: React.FC<Props> = ({
  embedMode,
  isPro = true,
  onOpenMembership,
}) => {
  const [pErrorPct, setPErrorPct] = useState(0.3);
  const [pThPct, setPThPct] = useState(1.0);
  const [distance, setDistance] = useState(11);
  const [targetExp, setTargetExp] = useState(-12);
  const [logicalQubits, setLogicalQubits] = useState(100);
  const [cycleTimeUs, setCycleTimeUs] = useState(1.0);
  const [tGatesExp, setTGatesExp] = useState(9); // 10^9 T-gates
  const [factories, setFactories] = useState(4);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const res = useMemo(
    () =>
      evaluateSurfaceCode({
        physicalErrorRate: pErrorPct / 100,
        thresholdErrorRate: pThPct / 100,
        prefactorA: 0.1,
        codeDistance: distance,
        targetLogicalErrorRate: Math.pow(10, targetExp),
        logicalQubitCount: logicalQubits,
        magicStateOverheadMultiplier: 2.0,
        cycleTimeMicroseconds: cycleTimeUs,
        algorithmTGates: Math.pow(10, tGatesExp),
        magicStateFactories: factories,
      }),
    [pErrorPct, pThPct, distance, targetExp, logicalQubits, cycleTimeUs, tGatesExp, factories]
  );

  const W = 540;
  const H = 220;
  const padL = 56;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const mapX = (d: number) => padL + ((d - 3) / (31 - 3)) * plotW;
  const mapY = (err: number) => {
    const logVal = Math.max(-15, Math.min(0, Math.log10(Math.max(1e-20, err))));
    return padT + ((0 - logVal) / 15) * plotH;
  };

  const pathD = res.curvePoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${mapX(pt.d).toFixed(1)} ${mapY(pt.logicalError).toFixed(1)}`)
    .join(' ');

  const targetY = mapY(Math.pow(10, targetExp));

  const embedSnippet = `<iframe src="${window.location.origin}${window.location.pathname}?widget=quantum&embed=1" width="100%" height="740" style="border:1px solid #D8D3C8;" loading="lazy" title="Quantum Surface-Code & T-Factory Resource Estimator"></iframe>`;

  const copyEmbed = async (): Promise<void> => {
    if (!isPro && onOpenMembership) {
      onOpenMembership();
      return;
    }
    await navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 1800);
  };

  const exportSweepCsv = (): void => {
    if (!isPro && onOpenMembership) {
      onOpenMembership();
      return;
    }
    const header = 'code_distance,logical_error_rate,physical_qubits_per_logical\n';
    const rows = res.curvePoints
      .map((pt) => `${pt.d},${pt.logicalError.toExponential(4)},${2 * pt.d * pt.d - 1}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firstprinciples-surface-code-sweep.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="border border-[#D8D3C8] bg-white">
      <div className="px-5 py-4 border-b border-[#D8D3C8] flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-lab text-[11px] text-[#1D4ED8] font-semibold">
            Surface Code &amp; T-Factory Estimator
          </p>
          <h2 className="font-editorial text-2xl font-semibold text-[#111315] mt-0.5">
            Logical Qubit &amp; Runtime Estimator
          </h2>
          <p className="text-xs text-[#4B5563] mt-1">
            <code className="font-mono-lab">p_L ≈ 0.1·(p / p_th)^((d+1)/2)</code>, <code className="font-mono-lab">2d²−1</code> physical qubits per patch, 15-to-1 T-state factories, and runtime cycle count.
          </p>
        </div>
        {!embedMode && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={exportSweepCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono-lab border border-[#D8D3C8] hover:border-[#1D4ED8] text-[#111315] cursor-pointer"
            >
              {isPro ? <Download className="w-3.5 h-3.5 text-[#1D4ED8]" /> : <Lock className="w-3 h-3 text-[#B45309]" />}
              {isPro ? 'CSV Sweep' : 'CSV (Pro)'}
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
              {copiedEmbed ? 'Copied' : isPro ? 'Copy <iframe>' : 'Embed (Pro)'}
            </button>
          </div>
        )}
      </div>

      {/* Hardware & Fault-Tolerant Algorithm Preset Strips */}
      <div className="px-5 py-2.5 bg-[#F7F5EF] border-b border-[#D8D3C8] space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-lab text-[11px] text-[#4B5563]">MODALITY PRESETS:</span>
          {QUANTUM_HARDWARE_PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => {
                setPErrorPct(Number((pr.physicalErrorRate * 100).toFixed(3)));
                setPThPct(Number((pr.thresholdErrorRate * 100).toFixed(2)));
                setCycleTimeUs(pr.cycleTimeMicroseconds);
              }}
              className="px-2.5 py-1 border border-[#D8D3C8] bg-white hover:border-[#1D4ED8] text-[#111315] cursor-pointer"
            >
              {pr.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-lab text-[11px] text-[#4B5563]">BENCHMARK ALGORITHMS:</span>
          {QUANTUM_ALGORITHM_PRESETS.map((alg) => (
            <button
              key={alg.id}
              type="button"
              onClick={() => {
                setLogicalQubits(alg.logicalQubits);
                setTargetExp(alg.targetExp);
                setTGatesExp(Math.round(Math.log10(alg.tGates)));
                setFactories(alg.factories);
              }}
              className="px-2.5 py-1 border border-[#1D4ED8]/30 bg-[#EFF6FF] text-[#1E3A8A] hover:border-[#1D4ED8] cursor-pointer"
            >
              {alg.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-[#D8D3C8] space-y-3.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="p-err" className="font-medium">Physical 2Q Gate Error Rate (p)</label>
              <span className="font-mono-lab font-semibold text-[#1D4ED8] tabular-nums">{pErrorPct.toFixed(2)}% ({(pErrorPct / 100).toExponential(1)})</span>
            </div>
            <input id="p-err" type="range" min={0.05} max={1.5} step={0.05} value={pErrorPct} onChange={(e) => setPErrorPct(Number(e.target.value))} className="w-full accent-[#1D4ED8]" />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="p-th" className="font-medium">Surface-Code Threshold (p_th)</label>
              <span className="font-mono-lab font-semibold tabular-nums">{pThPct.toFixed(2)}%</span>
            </div>
            <input id="p-th" type="range" min={0.5} max={1.5} step={0.05} value={pThPct} onChange={(e) => setPThPct(Number(e.target.value))} className="w-full accent-[#1D4ED8]" />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="code-d" className="font-medium">Inspected Code Distance (d, odd)</label>
              <span className="font-mono-lab font-semibold tabular-nums">d = {distance} ({res.physicalPerLogicalRotated} phys/log)</span>
            </div>
            <input id="code-d" type="range" min={3} max={31} step={2} value={distance} onChange={(e) => setDistance(Number(e.target.value))} className="w-full accent-[#1D4ED8]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="target-pl" className="block text-xs font-medium mb-1">Target Logical Error</label>
              <select id="target-pl" value={targetExp} onChange={(e) => setTargetExp(Number(e.target.value))} className="w-full border border-[#D8D3C8] bg-[#F7F5EF] px-2 py-1.5 font-mono-lab text-xs">
                <option value={-6}>10⁻⁶ (NISQ Demo)</option>
                <option value={-9}>10⁻⁹ (Hubbard / Pilot)</option>
                <option value={-11}>10⁻¹¹ (FeMoco Chem)</option>
                <option value={-12}>10⁻¹² (FTQC Std)</option>
                <option value={-14}>10⁻¹⁴ (RSA-2048)</option>
              </select>
            </div>
            <div>
              <label htmlFor="log-q" className="block text-xs font-medium mb-1">Logical Qubits</label>
              <input id="log-q" type="number" min={1} max={10000} value={logicalQubits} onChange={(e) => setLogicalQubits(Math.max(1, Number(e.target.value) || 1))} className="w-full border border-[#D8D3C8] bg-[#F7F5EF] px-2 py-1.5 font-mono-lab text-xs" />
            </div>
            <div>
              <label htmlFor="cycle-us" className="block text-xs font-medium mb-1">QEC Cycle Time (µs)</label>
              <input id="cycle-us" type="number" step={1} min={0.5} max={2000} value={cycleTimeUs} onChange={(e) => setCycleTimeUs(Math.max(0.5, Number(e.target.value) || 1))} className="w-full border border-[#D8D3C8] bg-[#F7F5EF] px-2 py-1.5 font-mono-lab text-xs" />
            </div>
            <div>
              <label htmlFor="t-fac" className="block text-xs font-medium mb-1">T-Factories (10^{tGatesExp} T)</label>
              <input id="t-fac" type="number" min={1} max={100} value={factories} onChange={(e) => setFactories(Math.max(1, Number(e.target.value) || 1))} className="w-full border border-[#D8D3C8] bg-[#F7F5EF] px-2 py-1.5 font-mono-lab text-xs" />
            </div>
          </div>

          <div
            className={`p-3 border text-xs leading-relaxed ${
              res.belowThreshold
                ? 'border-[#1D4ED8]/40 bg-[#EFF6FF] text-[#1E3A8A]'
                : 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
            }`}
          >
            <strong>First-Principles Verdict:</strong> {res.verdict}
          </div>
        </div>

        {/* Readout & Log Scaling Plot */}
        <div className="lg:col-span-7 p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-lab tabular-nums">
            <div className="p-3 border border-[#D8D3C8] bg-[#F7F5EF]">
              <span className="text-[10px] text-[#4B5563] block">SUPPRESSION Λ</span>
              <span className={`text-lg font-bold ${res.belowThreshold ? 'text-[#1D4ED8]' : 'text-[#DC2626]'}`}>
                {res.suppressionFactorLambda.toFixed(2)}×
              </span>
            </div>
            <div className="p-3 border border-[#D8D3C8] bg-[#F7F5EF]">
              <span className="text-[10px] text-[#4B5563] block">CODE DISTANCE</span>
              <span className="text-lg font-bold text-[#111315]">
                {res.requiredDistanceForTarget ? `d = ${res.requiredDistanceForTarget}` : 'N/A'}
              </span>
            </div>
            <div className="p-3 border border-[#D8D3C8] bg-[#F7F5EF]">
              <span className="text-[10px] text-[#4B5563] block">DATA + T-FACTORY</span>
              <span className="text-base font-bold text-[#B45309]">
                {res.totalPhysicalQubitsWithRouting !== null && res.magicStateFactoryPhysicalQubits !== null
                  ? (res.totalPhysicalQubitsWithRouting + res.magicStateFactoryPhysicalQubits).toLocaleString()
                  : '∞'}
              </span>
            </div>
            <div className="p-3 border border-[#D8D3C8] bg-[#F7F5EF]">
              <span className="text-[10px] text-[#4B5563] block">WALL-CLOCK TIME</span>
              <span className="text-base font-bold text-[#0F766E]">{res.runtimeLabel}</span>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block border border-[#ECE8DE] bg-[#FCFBF8]"
            role="img"
            aria-label="Logical error rate vs surface code distance log-scale chart"
          >
            {[0, -3, -6, -9, -12, -15].map((exp) => {
              const y = mapY(Math.pow(10, exp));
              return (
                <g key={exp}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E5E0D5" strokeWidth="0.8" />
                  <text x={padL - 7} y={y + 3} textAnchor="end" fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fill="#4B5563">
                    10^{exp}
                  </text>
                </g>
              );
            })}
            {[3, 7, 11, 15, 19, 23, 27, 31].map((d) => {
              const x = mapX(d);
              return (
                <text key={d} x={x} y={H - 12} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fill="#4B5563">
                  d={d}
                </text>
              );
            })}
            <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke="#B45309" strokeWidth="1.2" strokeDasharray="4 3" />
            <text x={W - padR - 4} y={targetY - 4} textAnchor="end" fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#B45309">
              Target 10^{targetExp}
            </text>

            <path d={pathD} fill="none" stroke={res.belowThreshold ? '#1D4ED8' : '#DC2626'} strokeWidth="2.2" />
            <circle cx={mapX(distance)} cy={mapY(res.logicalErrorPerCycle)} r="4.5" fill="#B45309" stroke="#FFFFFF" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {!embedMode && (
        <div className="px-5 py-2.5 bg-[#F7F5EF] border-t border-[#D8D3C8] flex items-center justify-between gap-2 text-[11px] font-mono-lab text-[#4B5563]">
          <span className="truncate">{embedSnippet}</span>
          <button type="button" onClick={copyEmbed} className="inline-flex items-center gap-1 text-[#1D4ED8] shrink-0 cursor-pointer">
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
      )}
    </section>
  );
};
