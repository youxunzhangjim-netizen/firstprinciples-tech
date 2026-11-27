export type FpLang = 'zh-TW' | 'en';

const FP_LANG_KEY = 'fpth_lang_v1';

export function loadInitialFpLang(): FpLang {
  try {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('lang');
      if (q === 'en' || q === 'zh-TW') return q;
      const saved = window.localStorage.getItem(FP_LANG_KEY);
      if (saved === 'en' || saved === 'zh-TW') return saved;
    }
  } catch (err) {
    console.warn('Language load fallback:', err);
  }
  return 'zh-TW';
}

export function saveFpLang(lang: FpLang): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FP_LANG_KEY, lang);
    }
  } catch (err) {
    console.warn('Language save fallback:', err);
  }
}

export function tr(lang: FpLang, zh: string, en: string): string {
  return lang === 'zh-TW' ? zh : en;
}
