'use strict';
const toggle = document.getElementById('menu-toggle');
toggle?.addEventListener('click', () => {
    const open = document.getElementById('sidebar-wrapper').classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { toggle.click(); toggle.focus(); }
});
document.querySelectorAll('form[data-confirm]').forEach(form => form.addEventListener('submit', event => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
}));
document.querySelectorAll('.table-responsive table').forEach(table => {
    const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => [...row.cells].forEach((cell, index) => {
        if (!cell.hasAttribute('colspan')) cell.dataset.label = headers[index] || '';
    }));
});
