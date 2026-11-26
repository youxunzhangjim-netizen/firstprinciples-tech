import { z } from 'zod';

export const SurfaceCodeInputSchema = z.object({
  physicalErrorRate: z.number().min(1e-5).max(0.05),
  thresholdErrorRate: z.number().min(0.001).max(0.03).default(0.01),
  prefactorA: z.number().min(0.01).max(1.0).default(0.1),
  codeDistance: z.number().int().min(3).max(99).refine((d) => d % 2 === 1, 'Code distance d must be odd'),
  targetLogicalErrorRate: z.number().min(1e-18).max(1e-2).default(1e-12),
  logicalQubitCount: z.number().int().min(1).max(100_000).default(100),
  magicStateOverheadMultiplier: z.number().min(1).max(5).default(2.0),
  // Azure Quantum Resource Estimator style runtime & T-gate factory parameters (optional defaults)
  cycleTimeMicroseconds: z.number().min(0.1).max(5000).default(1.0),
  algorithmTGates: z.number().min(1e4).max(1e15).default(1e9),
  magicStateFactories: z.number().int().min(1).max(200).default(4),
});

export type SurfaceCodeInput = z.infer<typeof SurfaceCodeInputSchema>;

export interface SurfaceCodeResult {
  belowThreshold: boolean;
  suppressionFactorLambda: number;
  logicalErrorPerCycle: number;
  physicalPerLogicalRotated: number;
  requiredDistanceForTarget: number | null;
  physicalPerLogicalAtTarget: number | null;
  magicStateFactoryPhysicalQubits: number | null;
  totalPhysicalQubitsWithRouting: number | null;
  estimatedRuntimeHours: number | null;
  runtimeLabel: string;
  curvePoints: Array<{ d: number; logicalError: number; physicalQubitsPerLogical: number }>;
  verdict: string;
}

export interface QuantumHardwarePreset {
  id: string;
  name: string;
  physicalErrorRate: number;
  thresholdErrorRate: number;
  cycleTimeMicroseconds: number;
  note: string;
}

export interface QuantumAlgorithmPreset {
  id: string;
  name: string;
  logicalQubits: number;
  tGates: number;
  targetExp: number;
  factories: number;
  description: string;
}

export const QUANTUM_HARDWARE_PRESETS: QuantumHardwarePreset[] = [
  {
    id: 'superconducting-2026',
    name: 'Superconducting Transmon (p=0.30%, 1 µs)',
    physicalErrorRate: 0.003,
    thresholdErrorRate: 0.01,
    cycleTimeMicroseconds: 1.0,
    note: 'Fast ~1 µs QEC cycle (~99.7% 2Q fidelity); requires higher physical qubit count but runs orders of magnitude faster.',
  },
  {
    id: 'trapped-ion',
    name: 'Trapped Ion (p=0.10%, 500 µs)',
    physicalErrorRate: 0.001,
    thresholdErrorRate: 0.01,
    cycleTimeMicroseconds: 500,
    note: 'Higher 2Q fidelity (~99.9%) cuts physical qubit count dramatically, trading off slower 500 µs syndrome cycles.',
  },
  {
    id: 'neutral-atom',
    name: 'Neutral Atom Array (p=0.25%, 100 µs)',
    physicalErrorRate: 0.0025,
    thresholdErrorRate: 0.01,
    cycleTimeMicroseconds: 100,
    note: 'Transversal CNOT & zoned optical tweezers; balanced physical-to-logical ratio and ~100 µs cycle clock.',
  },
  {
    id: 'near-threshold-hype',
    name: 'Near-Threshold Hype (p=0.85%, 1 µs)',
    physicalErrorRate: 0.0085,
    thresholdErrorRate: 0.01,
    cycleTimeMicroseconds: 1.0,
    note: 'Barely below 1% threshold: scaling to 10⁻¹² requires enormous physical qubit overhead!',
  },
];

export const QUANTUM_ALGORITHM_PRESETS: QuantumAlgorithmPreset[] = [
  {
    id: 'hubbard-2d',
    name: '2D Fermi-Hubbard (Condensed Matter)',
    logicalQubits: 100,
    tGates: 1e8,
    targetExp: -9,
    factories: 4,
    description: 'High-Tc superconductor lattice dynamics (~100 logical qubits, 10⁸ T-gates).',
  },
  {
    id: 'femoco-chem',
    name: 'FeMoco Nitrogenase Catalysis',
    logicalQubits: 200,
    tGates: 1e10,
    targetExp: -11,
    factories: 8,
    description: 'Fertilizer catalysis ground-state energy (Reiher/Lee benchmark: 10¹⁰ T-gates).',
  },
  {
    id: 'rsa-2048',
    name: 'RSA-2048 Factoring (Gidney–Ekerå)',
    logicalQubits: 4096,
    tGates: 3e9,
    targetExp: -14,
    factories: 16,
    description: 'Cryptographic fault-tolerant benchmark (~4,096 logical qubits, 3×10⁹ Toffoli/T budget).',
  },
];

function formatDurationHours(hours: number): string {
  if (hours < 1 / 60) return `${(hours * 3600).toFixed(1)} sec`;
  if (hours < 1) return `${(hours * 60).toFixed(1)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  if (hours < 24 * 365) return `${(hours / 24).toFixed(1)} days`;
  return `${(hours / (24 * 365)).toFixed(2)} yrs`;
}

/**
 * Standard rotated planar surface code scaling + Azure-style T-state factory & wall-clock estimator:
 *   p_L(d) ≈ A * (p / p_th)^((d + 1) / 2)
 *   n_phys(d) = 2 * d^2 - 1  (data + ancilla qubits per rotated surface-code patch)
 *   T-state factory footprint ≈ 15 * (2 * d_f^2 - 1) per 15-to-1 distillation unit (d_f ≈ max(5, d - 4))
 *   Logical T-gate clock ≈ 15 * d * cycleTime / factories
 */
export function evaluateSurfaceCode(rawInput: Partial<SurfaceCodeInput> & Pick<SurfaceCodeInput, 'physicalErrorRate' | 'codeDistance'>): SurfaceCodeResult {
  const input = SurfaceCodeInputSchema.parse(rawInput);
  const ratio = input.physicalErrorRate / input.thresholdErrorRate;
  const belowThreshold = ratio < 1;
  const suppressionFactorLambda = ratio > 0 ? 1 / ratio : Infinity;

  const calcLogicalErr = (d: number) => input.prefactorA * Math.pow(ratio, (d + 1) / 2);
  const calcPhysPerLogical = (d: number) => 2 * d * d - 1;

  const logicalErrorPerCycle = calcLogicalErr(input.codeDistance);
  const physicalPerLogicalRotated = calcPhysPerLogical(input.codeDistance);

  let requiredDistanceForTarget: number | null = null;
  if (belowThreshold) {
    const logTarget = Math.log10(input.targetLogicalErrorRate);
    const logA = Math.log10(input.prefactorA);
    const logRatio = Math.log10(ratio);
    for (let d = 3; d <= 199; d += 2) {
      const logErr = logA + ((d + 1) / 2) * logRatio;
      if (logErr <= logTarget + 1e-12) {
        requiredDistanceForTarget = d;
        break;
      }
    }
  }

  const physicalPerLogicalAtTarget =
    requiredDistanceForTarget !== null ? calcPhysPerLogical(requiredDistanceForTarget) : null;

  // 15-to-1 Magic State Factory physical qubit estimate (when target distance exists)
  const factoryDist = requiredDistanceForTarget !== null ? Math.max(5, requiredDistanceForTarget - 4) : null;
  const magicStateFactoryPhysicalQubits =
    factoryDist !== null ? input.magicStateFactories * 15 * calcPhysPerLogical(factoryDist) : null;

  const totalPhysicalQubitsWithRouting =
    physicalPerLogicalAtTarget !== null
      ? Math.round(physicalPerLogicalAtTarget * input.logicalQubitCount * input.magicStateOverheadMultiplier)
      : null;

  // Wall-clock execution estimate: ~12 * d syndrome cycles per distilled T-state across parallel factories
  const estimatedRuntimeHours =
    requiredDistanceForTarget !== null
      ? Number(
          (
            (input.algorithmTGates * (12 * requiredDistanceForTarget) * (input.cycleTimeMicroseconds * 1e-6)) /
            (Math.max(1, input.magicStateFactories) * 3600)
          ).toFixed(4)
        )
      : null;

  const runtimeLabel = estimatedRuntimeHours !== null ? formatDurationHours(estimatedRuntimeHours) : '∞ (Above Threshold)';

  const curvePoints: SurfaceCodeResult['curvePoints'] = [];
  for (let d = 3; d <= 31; d += 2) {
    curvePoints.push({
      d,
      logicalError: calcLogicalErr(d),
      physicalQubitsPerLogical: calcPhysPerLogical(d),
    });
  }

  let verdict: string;
  if (!belowThreshold) {
    verdict = `ABOVE THRESHOLD (p/p_th = ${ratio.toFixed(2)} ≥ 1): Adding more physical qubits WORSENS logical error rate.`;
  } else if (requiredDistanceForTarget === null) {
    verdict = `Below threshold (Λ = ${suppressionFactorLambda.toFixed(2)}), but p is too close to p_th — reaching target requires d > 199 (>79,000 physical qubits/logical).`;
  } else {
    verdict = `Below threshold (Λ = ${suppressionFactorLambda.toFixed(2)}): Target p_L ≤ ${input.targetLogicalErrorRate.toExponential(0)} demands d = ${requiredDistanceForTarget} (${physicalPerLogicalAtTarget?.toLocaleString()} phys/logical; ~${totalPhysicalQubitsWithRouting?.toLocaleString()} data+routing + ${magicStateFactoryPhysicalQubits?.toLocaleString()} T-factory qubits; runtime ≈ ${runtimeLabel}).`;
  }

  return {
    belowThreshold,
    suppressionFactorLambda,
    logicalErrorPerCycle,
    physicalPerLogicalRotated,
    requiredDistanceForTarget,
    physicalPerLogicalAtTarget,
    magicStateFactoryPhysicalQubits,
    totalPhysicalQubitsWithRouting,
    estimatedRuntimeHours,
    runtimeLabel,
    curvePoints,
    verdict,
  };
}
