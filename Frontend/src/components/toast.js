/**
 * Toast / live-region notifications
 */
let toastContainer;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
  }
  return toastContainer;
}

/**
 * Show a toast message
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms (0 = no auto-dismiss)
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = getContainer();
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'toast-out 0.2s ease forwards';
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }

  return toast;
}

/**
 * Announce to the aria-live assertive region (for screen readers)
 */
export function announce(message) {
  const region = document.getElementById('live-region');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
