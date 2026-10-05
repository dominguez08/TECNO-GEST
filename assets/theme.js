'use strict';
(() => {
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
  } catch {}
  root.dataset.theme = theme;
  function updateButtons() {
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.textContent = theme === 'dark' ? '☀ Modo claro' : '☾ Modo oscuro';
    });
  }
  function mount() {
    document
      .querySelectorAll('.sidebar-account, .mobile-topbar, .login-form-content, .connection-error')
      .forEach((container) => {
        if (container.querySelector('[data-theme-toggle]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-light theme-switch';
        button.dataset.themeToggle = '';
        container.append(button);
      });
    updateButtons();
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-choice], [data-theme-toggle]');
    if (!button) return;
    theme = button.dataset.themeChoice || (theme === 'dark' ? 'light' : 'dark');
    root.dataset.theme = theme;
    updateButtons();
  });
  window.addEventListener('inventic:render', mount);
  document.addEventListener('DOMContentLoaded', mount);
})();
