(function () {
  try {
    var t = localStorage.getItem('lf_erp_theme');
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
