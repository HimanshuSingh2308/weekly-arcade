/**
 * Page Transitions — smooth fade between pages in Capacitor WebView.
 * Intercepts <a> clicks, shows a brief fade overlay, then navigates.
 * Only active in Capacitor (no-op on web).
 */
(function() {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;

  // Create fade overlay
  var overlay = document.createElement('div');
  overlay.id = 'pageTransitionOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#0f0f1a;opacity:0;pointer-events:none;transition:opacity 0.15s ease-out;';
  document.body.appendChild(overlay);

  // Intercept all internal link clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href) return;

    // Skip external links, anchors, javascript:, mailto:
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto')) return;

    // Internal link — do a smooth transition
    e.preventDefault();

    // Fade to dark
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';

    // Navigate after fade
    setTimeout(function() {
      window.location.href = href;
    }, 150);
  });

  // Fade in on page load
  window.addEventListener('DOMContentLoaded', function() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
  });
})();
