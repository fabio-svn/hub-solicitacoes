document.addEventListener('click', function(e) {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.target === '_blank') return;
  e.preventDefault();
  document.body.classList.add('page-leaving');
  setTimeout(() => { window.location.href = href; }, 200);
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    document.body.classList.remove('page-leaving');
    document.body.style.opacity = '1';
  }
});
