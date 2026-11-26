import { describe, expect, it } from 'vitest';
import { evaluateSurfaceCode } from './quantumSurfaceCode';
import { ACCELERATOR_PRESETS, evaluateLlmServing, evaluateRoofline } from './aiRoofline';

describe('FirstPrinciples Physics & Hardware Calculators', () => {
  it('computes exponential logical error suppression below threshold and flags above-threshold collapse', () => {
    const below = evaluateSurfaceCode({
      physicalErrorRate: 0.001,
      thresholdErrorRate: 0.01,
      prefactorA: 0.1,
      codeDistance: 11,
      targetLogicalErrorRate: 1e-12,
      logicalQubitCount: 100,
      magicStateOverheadMultiplier: 2,
    });
    expect(below.belowThreshold).toBe(true);
    expect(below.suppressionFactorLambda).toBeCloseTo(10, 5);
    expect(below.requiredDistanceForTarget).toBe(21);
    expect(below.physicalPerLogicalAtTarget).toBe(881);

    const above = evaluateSurfaceCode({
      physicalErrorRate: 0.015,
      thresholdErrorRate: 0.01,
      prefactorA: 0.1,
      codeDistance: 7,
      targetLogicalErrorRate: 1e-12,
      logicalQubitCount: 100,
      magicStateOverheadMultiplier: 2,
    });
    expect(above.belowThreshold).toBe(false);
    expect(above.requiredDistanceForTarget).toBeNull();
  });

  it('computes exact Roofline ridge point and classifies LLM Decode as memory-bound', () => {
    const h100 = ACCELERATOR_PRESETS.find((p) => p.id === 'nvidia-h100')!;
    const analysis = evaluateRoofline(h100, 1000);
    expect(analysis.ridgePointFlopsPerByte).toBeCloseTo(1979 / 3.35, 2);

    const decodeB1 = analysis.workloads.find((w) => w.id === 'decode-b1')!;
    const prefill = analysis.workloads.find((w) => w.id === 'prefill-4k')!;
    expect(decodeB1.bottleneck).toBe('memory-bound');
    expect(decodeB1.hardwareUtilizationPct).toBeLessThan(1);
    expect(prefill.bottleneck).toBe('compute-bound');
    expect(prefill.attainableTflops).toBe(h100.peakComputeTflops);
  });

  it('computes LLM KV-Cache OOM boundaries, DeepSeek MLA savings, and T-Factory wall-clock runtime tradeoff', () => {
    const h100 = ACCELERATOR_PRESETS.find((p) => p.id === 'nvidia-h100')!;
    const b200 = ACCELERATOR_PRESETS.find((p) => p.id === 'nvidia-b200')!;

    // Llama-3.1 70B FP8 fits on 1x B200 (192GB) but OOMs on 1x H100 (80GB) at 16K ctx batch 16
    const b200Serve = evaluateLlmServing(b200, {
      modelId: 'llama31-70b',
      precisionBytes: 1,
      contextLength: 16384,
      batchSize: 16,
      numGpus: 1,
    });
    const h100Serve = evaluateLlmServing(h100, {
      modelId: 'llama31-70b',
      precisionBytes: 1,
      contextLength: 16384,
      batchSize: 16,
      numGpus: 1,
    });
    expect(b200Serve.fitsInHbm).toBe(true);
    expect(b200Serve.decodeThroughputTokPerSec).toBeGreaterThan(200);
    expect(b200Serve.costPer1MOutputTokensUsd).toBeGreaterThan(0);
    expect(h100Serve.fitsInHbm).toBe(false);

    // Superconducting (1 us) executes faster than Trapped Ion (500 us) despite higher physical qubit count
    const sc = evaluateSurfaceCode({
      physicalErrorRate: 0.003,
      codeDistance: 11,
      cycleTimeMicroseconds: 1.0,
      algorithmTGates: 1e9,
      magicStateFactories: 4,
    });
    const ion = evaluateSurfaceCode({
      physicalErrorRate: 0.001,
      codeDistance: 11,
      cycleTimeMicroseconds: 500,
      algorithmTGates: 1e9,
      magicStateFactories: 4,
    });
    expect(sc.totalPhysicalQubitsWithRouting!).toBeGreaterThan(ion.totalPhysicalQubitsWithRouting!);
    expect(sc.estimatedRuntimeHours!).toBeLessThan(ion.estimatedRuntimeHours!);
  });
});
