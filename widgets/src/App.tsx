import React, { useEffect, useState } from 'react';
import { Cpu, Atom, KeyRound, Moon, Radio, Sun } from 'lucide-react';
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
    title: 'Below-Threshold Surface Code Decoding at 99.65% Two-Qubit Gate Fidelity',
    signals: ['Quantitative Gate Fidelity', 'T1/T2 Coherence Measurement', 'Fault-Tolerant QEC Breakthrough'],
    hypeFlags: [],
  },
  {
    source: 'USPTO ODP (H01L)',
    id: 'US-18999123',
    score: 55,
    title: '[Taiwan Semiconductor] HBM4 2nm CoWoS Interposer at 8 TB/s and 700 W Liquid Cooling',
    signals: ['Leading-Edge Process Node', 'Memory Bandwidth & Packaging', 'Thermal / Power Efficiency'],
    hypeFlags: [],
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
        {initialWidget === 'roofline' ? <AiRooflineWidget embedMode /> : <QuantumOverheadWidget embedMode />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5EF] text-[#111315] flex flex-col">
      <header className="border-b border-[#D8D3C8] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono-lab text-[11px] text-[#B45309] font-semibold">
              FirstPrinciples Tech
            </p>
            <h1 className="font-editorial text-2xl font-bold tracking-tight mt-0.5">
              Quantum &amp; AI Hardware Calculators
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
              Surface Code QEC
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
              AI Roofline
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
              Digest Preview
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
                  ? 'EDITION: PRO (LOCAL)'
                  : 'EDITION: PRO'
                : 'Edition & License'}
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono-lab border border-[#D8D3C8] bg-[#F7F5EF] text-[#111315] cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-[#FBBF24]" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="px-4 py-2.5 border border-[#D8D3C8] bg-white text-xs text-[#4B5563] flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono-lab text-[#111315] font-semibold">How to use:</span>
          {activeTab === 'quantum' ? (
            <>
              <span>1. Pick a qubit modality and target algorithm.</span>
              <span>2. Adjust physical error rate and cycle time.</span>
              <span>3. Check required code distance, total qubits, and runtime.</span>
            </>
          ) : activeTab === 'roofline' ? (
            <>
              <span>1. Pick an accelerator preset (e.g. H100, B200, MI325X).</span>
              <span>2. Set precision, batch size, and sequence length.</span>
              <span>3. Check whether inference is memory-bound or compute-bound.</span>
            </>
          ) : (
            <>
              <span>1. Run <code className="font-mono-lab">pipeline/src/radar/cli.py</code> locally or on a schedule.</span>
              <span>2. Posts are saved to Ghost as drafts for manual review.</span>
            </>
          )}
        </div>
        {activeTab === 'quantum' && (
          <QuantumOverheadWidget
            embedMode={false}
            isPro={license.isPro}
            onOpenMembership={() => setMemberOpen(true)}
          />
        )}
        {activeTab === 'roofline' && (
          <AiRooflineWidget
            embedMode={false}
            isPro={license.isPro}
            onOpenMembership={() => setMemberOpen(true)}
          />
        )}
        {activeTab === 'radar' && (
          <section className="border border-[#D8D3C8] bg-white p-5 space-y-4">
            <div className="border-b border-[#D8D3C8] pb-3">
              <p className="font-mono-lab text-[11px] uppercase tracking-widest text-[#B45309]">
                Ghost Admin API Draft Output Preview
              </p>
              <h2 className="font-editorial text-2xl font-semibold mt-0.5">
                Automated arXiv + USPTO ODP First-Principles Digest
              </h2>
              <p className="text-xs text-[#4B5563] mt-1">
                Generated daily at 06:00 UTC by <code className="font-mono-lab">pipeline/src/radar/cli.py</code> with strict ≥3.5s arXiv serial rate limiting and mandatory <code className="font-mono-lab">status=&quot;draft&quot;</code> editorial review lock.
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
                      RUBRIC SCORE: {item.score}
                    </span>
                  </div>
                  <h3 className="font-editorial text-lg font-semibold">{item.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.signals.map((s) => (
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
          <span>FirstPrinciples Tech · Embed with ?embed=1</span>
          <span>Runs locally in your browser</span>
        </div>
      </footer>
      <MembershipModal
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
