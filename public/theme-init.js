// Apply the saved appearance before the app mounts. External script complies with extension CSP.
(function () {
  try {
    var raw = localStorage.getItem('ntab_settings');
    var s = raw ? JSON.parse(raw) : null;
    var theme = s && s.theme ? s.theme : 'system';
    var isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
      theme === 'nord' ||
      theme === 'catppuccin' ||
      theme === 'tokyo-night' ||
      theme === 'sepia';
    var root = document.documentElement;
    if (isDark) root.classList.add('dark');
    if (theme && theme !== 'system' && theme !== 'light' && theme !== 'dark') {
      root.classList.add('theme-' + theme);
    }
    if (s) {
      if (s.fontSize) root.style.setProperty('--bookmark-font-size', s.fontSize + 'px');
      if (s.rowHeight) root.style.setProperty('--bookmark-row-height', s.rowHeight + 'px');
      if (s.columnWidth) root.style.setProperty('--column-width', s.columnWidth + 'px');
      if (s.columnGap) root.style.setProperty('--column-gap', s.columnGap + 'px');
      if (s.cardRadius) root.style.setProperty('--card-radius', s.cardRadius + 'px');
      if (s.backdropBlur) root.style.setProperty('--backdrop-blur', s.backdropBlur + 'px');
    }
  } catch (e) {}
})();
