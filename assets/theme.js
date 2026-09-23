'use strict';

(() => {
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    const saved = localStorage.getItem('inventic-theme');
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch {}

  function apply(value) {
    theme = value;
    root.dataset.theme = theme;
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.textContent = theme === 'dark' ? '☀ Modo claro' : '☾ Modo oscuro';
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'theme-toolbar';
  toolbar.innerHTML = '<button id="theme-toggle" class="btn btn-light" type="button"></button>';
  document.body.prepend(toolbar);
  apply(theme);
  document.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-theme-choice], #theme-toggle');
    if (!choice) return;
    apply(choice.dataset.themeChoice || (theme === 'dark' ? 'light' : 'dark'));
    try {
      localStorage.setItem('inventic-theme', theme);
    } catch {}
  });
  new MutationObserver(() => apply(theme)).observe(document.getElementById('app'), {
    childList: true,
    subtree: true
  });
})();
