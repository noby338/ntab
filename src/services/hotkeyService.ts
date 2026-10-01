import { ref } from 'vue';
import type { ShortcutBinding, ShortcutActionId, UserShortcuts } from '../types';
import { userSettings, saveSettings } from './storage';

export const DEFAULT_SHORTCUTS: UserShortcuts = {
  focusSearch: { key: '/', code: 'Slash' },
  cycleSearchEngine: { key: 'Tab', code: 'Tab' },
  switchEngine1: { key: '1', code: 'Digit1', alt: true },
  switchEngine2: { key: '2', code: 'Digit2', alt: true },
  switchEngine3: { key: '3', code: 'Digit3', alt: true },
  switchEngine4: { key: '4', code: 'Digit4', alt: true },
  switchEngine5: { key: '5', code: 'Digit5', alt: true },
  switchEngine6: { key: '6', code: 'Digit6', alt: true },
  newFolder: { key: 'n', code: 'KeyN', alt: true },
  toggleBatch: { key: 'b', code: 'KeyB', alt: true },
  healthCheck: { key: 'h', code: 'KeyH', alt: true },
  openSettings: { key: 's', code: 'KeyS', alt: true },
};

export function getActiveShortcut(action: ShortcutActionId): ShortcutBinding {
  const custom = userSettings.value.shortcuts?.[action];
  return custom || DEFAULT_SHORTCUTS[action];
}

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  if ((navigator as any).userAgentData?.platform) {
    return (navigator as any).userAgentData.platform.toLowerCase().includes('mac');
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || navigator.platform || '');
}

export function formatShortcut(binding: ShortcutBinding): string {
  const parts: string[] = [];
  const isMac = isApplePlatform();

  if (binding.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (binding.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (binding.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (binding.meta) parts.push(isMac ? '⌘' : 'Win');

  let keyDisplay = binding.key ? binding.key.toUpperCase() : '';
  if (binding.code.startsWith('Digit')) {
    keyDisplay = binding.code.replace('Digit', '');
  } else if (binding.code.startsWith('Key')) {
    keyDisplay = binding.code.replace('Key', '');
  } else if (binding.code === 'Slash') {
    keyDisplay = '/';
  } else if (binding.code === 'Tab') {
    keyDisplay = 'Tab';
  } else if (binding.code === 'Escape') {
    keyDisplay = 'Esc';
  }

  parts.push(keyDisplay);
  return isMac ? parts.join(' ') : parts.join(' + ');
}

export function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (event.altKey !== Boolean(binding.alt)) return false;
  if (event.ctrlKey !== Boolean(binding.ctrl)) return false;
  if (event.metaKey !== Boolean(binding.meta)) return false;
  if (event.shiftKey !== Boolean(binding.shift)) return false;

  if (binding.code && event.code === binding.code) {
    return true;
  }

  if (binding.code.startsWith('Digit')) {
    const digit = binding.code.replace('Digit', '');
    if (event.code === `Numpad${digit}`) return true;
  }

  if (binding.key && event.key && binding.key.toLowerCase() === event.key.toLowerCase()) {
    return true;
  }

  return false;
}

export function recordShortcutFromEvent(event: KeyboardEvent): ShortcutBinding | null {
  if (['Alt', 'Control', 'Meta', 'Shift', 'CapsLock'].includes(event.key)) {
    return null;
  }

  return {
    key: event.key,
    code: event.code,
    alt: event.altKey || undefined,
    ctrl: event.ctrlKey || undefined,
    meta: event.metaKey || undefined,
    shift: event.shiftKey || undefined,
  };
}

export function updateShortcutBinding(action: ShortcutActionId, binding: ShortcutBinding): void {
  const current = { ...(userSettings.value.shortcuts || {}) };
  current[action] = binding;
  saveSettings({ shortcuts: current });
}

export function resetShortcutBinding(action: ShortcutActionId): void {
  const current = { ...(userSettings.value.shortcuts || {}) };
  delete current[action];
  saveSettings({ shortcuts: current });
}

export function resetAllShortcuts(): void {
  saveSettings({ shortcuts: {} });
}
