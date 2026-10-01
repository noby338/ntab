import { computed } from 'vue';
import { userSettings } from '../services/storage';
import type { LanguageCode } from '../types';
import { en, type LocaleMessages } from './en';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';
import { ja } from './ja';
import { ko } from './ko';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { ru } from './ru';

export { type LocaleMessages };

export const LOCALES: Record<Exclude<LanguageCode, 'auto'>, any> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
  de,
  es,
  fr,
  ru,
};

export const LANGUAGE_OPTIONS: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: 'auto', name: 'Auto (System)', nativeName: 'Auto (System)' },
  { code: 'zh-CN', name: 'Simplified Chinese', nativeName: '简体中文' },
  { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '繁體中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
];

export function detectSystemLanguage(): Exclude<LanguageCode, 'auto'> {
  let lang = 'en';
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    lang = chrome.i18n.getUILanguage();
  } else if (typeof navigator !== 'undefined' && navigator.language) {
    lang = navigator.language;
  }

  const lower = lang.toLowerCase();
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower.startsWith('zh-hant')) {
    return 'zh-TW';
  }
  if (lower.startsWith('zh')) {
    return 'zh-CN';
  }
  if (lower.startsWith('ja')) {
    return 'ja';
  }
  if (lower.startsWith('ko')) {
    return 'ko';
  }
  if (lower.startsWith('de')) {
    return 'de';
  }
  if (lower.startsWith('es')) {
    return 'es';
  }
  if (lower.startsWith('fr')) {
    return 'fr';
  }
  if (lower.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

export const activeLanguage = computed<Exclude<LanguageCode, 'auto'>>(() => {
  const pref = userSettings.value.language;
  if (!pref || pref === 'auto') {
    return detectSystemLanguage();
  }
  return pref;
});

export const currentMessages = computed<LocaleMessages>(() => {
  return LOCALES[activeLanguage.value] || LOCALES.en;
});

export function t(path: string, params?: Record<string, string | number>): string {
  const parts = path.split('.');
  let current: any = currentMessages.value;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (typeof current !== 'string') {
    let fallback: any = LOCALES.en;
    for (const part of parts) {
      if (fallback && typeof fallback === 'object' && part in fallback) {
        fallback = fallback[part];
      } else {
        fallback = undefined;
        break;
      }
    }
    current = typeof fallback === 'string' ? fallback : path;
  }

  if (params && typeof current === 'string') {
    return current.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{${key}}`;
    });
  }

  return current;
}
