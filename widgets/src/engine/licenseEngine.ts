import { z } from 'zod';

/**
 * Pure, framework-agnostic licensing engine for FirstPrinciples Tech.
 * Zero React or DOM imports.
 */
export type FirstPrinciplesPlanId = 'free' | 'reader_pro' | 'institutional_desk';

export const FpLicenseSchema = z.object({
  isPro: z.boolean().default(false),
  planId: z.enum(['free', 'reader_pro', 'institutional_desk']).default('free'),
  keyMasked: z.string().max(40).default(''),
  mode: z.enum(['none', 'local_full', 'offline_demo', 'remote_mor']).default('none'),
  activatedAtIso: z.string().max(40).default(''),
});

export type FpLicenseState = z.infer<typeof FpLicenseSchema>;

export const FREE_FP_LICENSE: FpLicenseState = {
  isPro: false,
  planId: 'free',
  keyMasked: '',
  mode: 'none',
  activatedAtIso: '',
};

export const FP_DEMO_KEYS = {
  readerPro: 'FPTH-DEMO-2026-PRO1',
  institutional: 'FPTH-INST-2026-DESK',
} as const;

const KEY_REGEX = /^FPTH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isLocalPreviewHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.endsWith('.local');
}

export function buildLocalFullFpLicense(nowIso: string = new Date().toISOString()): FpLicenseState {
  return {
    isPro: true,
    planId: 'institutional_desk',
    keyMasked: 'LOCAL-FULL-DESK',
    mode: 'local_full',
    activatedAtIso: nowIso,
  };
}

export function maskFpKey(normalized: string): string {
  const parts = normalized.split('-');
  if (parts.length !== 4) return normalized.slice(0, 8) + '••••';
  return `${parts[0]}-${parts[1]}-••••-${parts[3]}`;
}

export function validateFpKeyLocally(
  rawKey: string,
  nowIso: string = new Date().toISOString()
): { valid: boolean; reason: 'ok' | 'empty' | 'invalid_format'; state?: FpLicenseState } {
  const key = rawKey.trim().toUpperCase().replace(/\s+/g, '');
  if (!key) return { valid: false, reason: 'empty' };
  if (!KEY_REGEX.test(key)) return { valid: false, reason: 'invalid_format' };

  const isInst = key.includes('-INST-');
  const isDemo = key === FP_DEMO_KEYS.readerPro || key === FP_DEMO_KEYS.institutional;

  return {
    valid: true,
    reason: 'ok',
    state: FpLicenseSchema.parse({
      isPro: true,
      planId: isInst ? 'institutional_desk' : 'reader_pro',
      keyMasked: maskFpKey(key),
      mode: isDemo ? 'offline_demo' : 'remote_mor',
      activatedAtIso: nowIso,
    }),
  };
}

export function parseStoredFpLicense(rawJson: string | null): FpLicenseState {
  if (!rawJson) return FREE_FP_LICENSE;
  try {
    const res = FpLicenseSchema.safeParse(JSON.parse(rawJson));
    return res.success ? res.data : FREE_FP_LICENSE;
  } catch {
    return FREE_FP_LICENSE;
  }
}
