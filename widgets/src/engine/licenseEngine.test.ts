import { describe, expect, it } from 'vitest';
import {
  buildLocalFullFpLicense,
  FP_DEMO_KEYS,
  FREE_FP_LICENSE,
  isLocalPreviewHost,
  parseStoredFpLicense,
  validateFpKeyLocally,
} from './licenseEngine';

describe('FirstPrinciples Tech Licensing Engine', () => {
  it('detects localhost hosts and builds Local Full Desk edition', () => {
    expect(isLocalPreviewHost('localhost')).toBe(true);
    expect(isLocalPreviewHost('127.0.0.1')).toBe(true);
    expect(isLocalPreviewHost('firstprinciplestech.pages.dev')).toBe(false);

    const local = buildLocalFullFpLicense('2026-11-24T00:00:00Z');
    expect(local.isPro).toBe(true);
    expect(local.mode).toBe('local_full');
  });

  it('validates Reader Pro & Institutional keys and rejects malformed inputs', () => {
    const pro = validateFpKeyLocally(FP_DEMO_KEYS.readerPro);
    expect(pro.valid).toBe(true);
    expect(pro.state?.planId).toBe('reader_pro');

    const inst = validateFpKeyLocally(FP_DEMO_KEYS.institutional);
    expect(inst.valid).toBe(true);
    expect(inst.state?.planId).toBe('institutional_desk');

    expect(validateFpKeyLocally('').valid).toBe(false);
    expect(validateFpKeyLocally('WRONG-1234').valid).toBe(false);
    expect(parseStoredFpLicense('{bad json')).toEqual(FREE_FP_LICENSE);
  });
});
