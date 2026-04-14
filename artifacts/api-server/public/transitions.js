document.addEventListener('click', function(e) {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.target === '_blank') return;
  e.preventDefault();
  document.body.style.transition = 'opacity 0.15s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { window.location.href = href; }, 150);
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    document.body.style.opacity = '1';
  }
});
