import { z } from 'zod';

export const AcceleratorSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  peakComputeTflops: z.number().positive().max(100_000),
  hbmBandwidthTBps: z.number().positive().max(200),
  hbmCapacityGB: z.number().positive().max(2048).default(80),
  tdpWatts: z.number().positive().max(5000),
  cloudHourlyUsd: z.number().positive().max(100).default(3.25),
  precisionLabel: z.string().default('FP8 / BF16 Dense'),
});

export type AcceleratorSpec = z.infer<typeof AcceleratorSpecSchema>;

export interface WorkloadPoint {
  id: string;
  label: string;
  arithmeticIntensity: number; // FLOPs / Byte
  attainableTflops: number;
  bottleneck: 'memory-bound' | 'compute-bound';
  hardwareUtilizationPct: number;
}

export interface RooflineAnalysis {
  ridgePointFlopsPerByte: number;
  tflopsPerWattPeak: number;
  workloads: WorkloadPoint[];
  curve: Array<{ ai: number; tflops: number }>;
}

export interface LlmModelPreset {
  id: string;
  name: string;
  totalParamsB: number;
  activeParamsB: number; // Equals totalParamsB for dense; smaller for MoE (e.g. DeepSeek-V3 37B active)
  numLayers: number;
  kvHeads: number; // GQA or MLA effective KV dimension
  headDim: number;
  mlaCompressionFactor: number; // 1.0 for standard GQA; ~0.12 for DeepSeek MLA latent KV cache
}

export const LLM_MODEL_PRESETS: LlmModelPreset[] = [
  {
    id: 'llama31-70b',
    name: 'Llama-3.1 70B (Dense, GQA 8×)',
    totalParamsB: 70.6,
    activeParamsB: 70.6,
    numLayers: 80,
    kvHeads: 8,
    headDim: 128,
    mlaCompressionFactor: 1.0,
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3 671B MoE (37B Active, MLA)',
    totalParamsB: 671,
    activeParamsB: 37,
    numLayers: 61,
    kvHeads: 128,
    headDim: 128,
    mlaCompressionFactor: 0.035, // Latent compressed KV (~576 dims/layer vs 16384 full)
  },
  {
    id: 'qwen25-72b',
    name: 'Qwen-2.5 72B (Dense, GQA)',
    totalParamsB: 72.7,
    activeParamsB: 72.7,
    numLayers: 80,
    kvHeads: 8,
    headDim: 128,
    mlaCompressionFactor: 1.0,
  },
  {
    id: 'llama31-405b',
    name: 'Llama-3.1 405B (Dense, GQA 16×)',
    totalParamsB: 405,
    activeParamsB: 405,
    numLayers: 126,
    kvHeads: 8,
    headDim: 128,
    mlaCompressionFactor: 1.0,
  },
];

export const LlmServingInputSchema = z.object({
  modelId: z.string().default('llama31-70b'),
  precisionBytes: z.union([z.literal(2), z.literal(1), z.literal(0.5)]).default(1), // BF16=2, FP8=1, INT4=0.5
  contextLength: z.number().int().min(512).max(262_144).default(8192),
  batchSize: z.number().int().min(1).max(256).default(16),
  numGpus: z.number().int().min(1).max(16).default(1),
});

export type LlmServingInput = z.infer<typeof LlmServingInputSchema>;

export interface LlmServingAnalysis {
  modelName: string;
  weightsVramGB: number;
  kvCacheVramGB: number;
  totalVramRequiredGB: number;
  totalClusterHbmGB: number;
  fitsInHbm: boolean;
  vramUtilizationPct: number;
  decodeThroughputTokPerSec: number;
  perUserTokPerSec: number;
  prefillTtftMs: number;
  costPer1MOutputTokensUsd: number;
}

export const ACCELERATOR_PRESETS: AcceleratorSpec[] = [
  {
    id: 'nvidia-b200',
    name: 'NVIDIA B200 SXM (192GB, FP8)',
    peakComputeTflops: 4500,
    hbmBandwidthTBps: 8.0,
    hbmCapacityGB: 192,
    tdpWatts: 1000,
    cloudHourlyUsd: 5.5,
    precisionLabel: 'FP8 Dense (No Sparsity)',
  },
  {
    id: 'nvidia-h200',
    name: 'NVIDIA H200 SXM (141GB, FP8)',
    peakComputeTflops: 1979,
    hbmBandwidthTBps: 4.8,
    hbmCapacityGB: 141,
    tdpWatts: 700,
    cloudHourlyUsd: 3.9,
    precisionLabel: 'FP8 Dense + HBM3e',
  },
  {
    id: 'nvidia-h100',
    name: 'NVIDIA H100 SXM5 (80GB, FP8)',
    peakComputeTflops: 1979,
    hbmBandwidthTBps: 3.35,
    hbmCapacityGB: 80,
    tdpWatts: 700,
    cloudHourlyUsd: 3.25,
    precisionLabel: 'FP8 Dense',
  },
  {
    id: 'amd-mi325x',
    name: 'AMD Instinct MI325X (256GB, FP8)',
    peakComputeTflops: 2614,
    hbmBandwidthTBps: 6.0,
    hbmCapacityGB: 256,
    tdpWatts: 1000,
    cloudHourlyUsd: 3.5,
    precisionLabel: 'FP8 Dense + HBM3e',
  },
  {
    id: 'google-tpuv6e',
    name: 'Google TPU v6e Trillium (32GB, BF16)',
    peakComputeTflops: 918,
    hbmBandwidthTBps: 1.6,
    hbmCapacityGB: 32,
    tdpWatts: 300,
    cloudHourlyUsd: 1.8,
    precisionLabel: 'BF16 Matrix',
  },
];

export const DEFAULT_WORKLOADS: Array<{ id: string; label: string; ai: number }> = [
  { id: 'decode-b1', label: 'LLM Decode (Batch 1, FP8)', ai: 2 },
  { id: 'decode-b32', label: 'LLM Decode (Batch 32, KV-Heavy)', ai: 48 },
  { id: 'decode-b256', label: 'LLM Decode (Batch 256)', ai: 280 },
  { id: 'prefill-4k', label: 'LLM Prefill / Dense GEMM', ai: 1200 },
];

export function evaluateRoofline(
  rawSpec: AcceleratorSpec,
  customWorkloadAi = 64
): RooflineAnalysis {
  const spec = AcceleratorSpecSchema.parse(rawSpec);
  const ridgePointFlopsPerByte = spec.peakComputeTflops / spec.hbmBandwidthTBps;
  const tflopsPerWattPeak = spec.peakComputeTflops / spec.tdpWatts;

  const allWorkloads = [
    ...DEFAULT_WORKLOADS,
    { id: 'custom', label: `Custom Kernel (${customWorkloadAi} FLOP/B)`, ai: Math.max(0.5, customWorkloadAi) },
  ];

  const workloads: WorkloadPoint[] = allWorkloads.map((w) => {
    const bwBoundTflops = spec.hbmBandwidthTBps * w.ai;
    const attainableTflops = Math.min(spec.peakComputeTflops, bwBoundTflops);
    const bottleneck: 'memory-bound' | 'compute-bound' =
      w.ai < ridgePointFlopsPerByte ? 'memory-bound' : 'compute-bound';
    const hardwareUtilizationPct = (attainableTflops / spec.peakComputeTflops) * 100;
    return {
      id: w.id,
      label: w.label,
      arithmeticIntensity: w.ai,
      attainableTflops,
      bottleneck,
      hardwareUtilizationPct,
    };
  });

  const aiGrid = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const curve = aiGrid.map((ai) => ({
    ai,
    tflops: Math.min(spec.peakComputeTflops, spec.hbmBandwidthTBps * ai),
  }));

  return {
    ridgePointFlopsPerByte,
    tflopsPerWattPeak,
    workloads,
    curve,
  };
}

/**
 * LLM-Viewer style Prefill TTFT, KV-Cache Footprint & Decode Throughput Calculator
 * First-principles physics:
 *   Weights VRAM = TotalParams * precisionBytes
 *   KV Cache VRAM = 2 (K+V) * numLayers * kvHeads * headDim * precisionBytes * mlaCompression * batchSize * contextLen
 *   Decode Latency/step ≈ max((ActiveWeights + KVCache) / (TotalBW * eff), (2 * ActiveParams * Batch) / (TotalTFLOPS * eff))
 */
export function evaluateLlmServing(
  rawSpec: AcceleratorSpec,
  rawServing: Partial<LlmServingInput>
): LlmServingAnalysis {
  const spec = AcceleratorSpecSchema.parse(rawSpec);
  const cfg = LlmServingInputSchema.parse(rawServing);
  const model = LLM_MODEL_PRESETS.find((m) => m.id === cfg.modelId) ?? LLM_MODEL_PRESETS[0];

  const weightsVramGB = Number((model.totalParamsB * cfg.precisionBytes * 1.05).toFixed(1)); // +5% activation/framework overhead
  const kvBytesPerToken =
    2 * model.numLayers * model.kvHeads * model.headDim * cfg.precisionBytes * model.mlaCompressionFactor;
  const kvCacheVramGB = Number(((kvBytesPerToken * cfg.batchSize * cfg.contextLength) / 1e9).toFixed(2));
  const totalVramRequiredGB = Number((weightsVramGB + kvCacheVramGB).toFixed(1));
  const totalClusterHbmGB = Number((spec.hbmCapacityGB * cfg.numGpus).toFixed(1));
  const fitsInHbm = totalVramRequiredGB <= totalClusterHbmGB;
  const vramUtilizationPct = Number(((totalVramRequiredGB / totalClusterHbmGB) * 100).toFixed(1));

  // Effective bandwidth & compute scaling across tensor-parallel GPUs (0.85 TP efficiency factor)
  const tpEfficiency = cfg.numGpus === 1 ? 0.78 : Math.max(0.55, 0.78 - 0.025 * Math.log2(cfg.numGpus));
  const effectiveBwGBps = spec.hbmBandwidthTBps * 1000 * cfg.numGpus * tpEfficiency;
  const effectiveTflops = spec.peakComputeTflops * cfg.numGpus * (cfg.precisionBytes === 2 ? 0.5 : 1.0) * tpEfficiency;

  const activeWeightsGB = model.activeParamsB * cfg.precisionBytes;
  const bytesReadPerDecodeStepGB = activeWeightsGB + kvCacheVramGB;
  const memTimeSec = bytesReadPerDecodeStepGB / Math.max(1, effectiveBwGBps);
  const computeTimeSec = (2 * model.activeParamsB * cfg.batchSize) / Math.max(1, effectiveTflops * 1000);
  const stepTimeSec = Math.max(memTimeSec, computeTimeSec);

  const decodeThroughputTokPerSec = fitsInHbm ? Number((cfg.batchSize / stepTimeSec).toFixed(1)) : 0;
  const perUserTokPerSec = fitsInHbm ? Number((1 / stepTimeSec).toFixed(1)) : 0;

  // Prefill TTFT for 1 request at contextLength (compute-bound ~ 2 * ActiveParams * ContextLen FLOPs)
  const prefillFlopsT = (2 * model.activeParamsB * cfg.contextLength) / 1000;
  const prefillTtftMs = fitsInHbm ? Number(((prefillFlopsT / Math.max(1, effectiveTflops)) * 1000).toFixed(1)) : 0;

  const clusterCostPerSecUsd = (spec.cloudHourlyUsd * cfg.numGpus) / 3600;
  const costPer1MOutputTokensUsd =
    decodeThroughputTokPerSec > 0
      ? Number(((clusterCostPerSecUsd / decodeThroughputTokPerSec) * 1_000_000).toFixed(3))
      : 0;

  return {
    modelName: model.name,
    weightsVramGB,
    kvCacheVramGB,
    totalVramRequiredGB,
    totalClusterHbmGB,
    fitsInHbm,
    vramUtilizationPct,
    decodeThroughputTokPerSec,
    perUserTokPerSec,
    prefillTtftMs,
    costPer1MOutputTokensUsd,
  };
}
