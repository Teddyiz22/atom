// Main JavaScript file for NMH Shop

document.addEventListener('DOMContentLoaded', function () {

  // Auto-hide alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 5000);
  });

  // Form validation enhancement
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  });

  // Password confirmation validation
  const passwordField = document.getElementById('password');
  const confirmPasswordField = document.getElementById('confirmPassword');

  if (passwordField && confirmPasswordField) {
    confirmPasswordField.addEventListener('input', function () {
      if (passwordField.value !== confirmPasswordField.value) {
        confirmPasswordField.setCustomValidity('Passwords do not match');
      } else {
        confirmPasswordField.setCustomValidity('');
      }
    });
  }

  // Smooth scrolling for anchor links
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Loading button states
  const submitButtons = document.querySelectorAll('button[type="submit"]');
  submitButtons.forEach(button => {
    button.addEventListener('click', function () {
      const originalText = this.innerHTML;
      this.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
      this.disabled = true;

      // Re-enable after 5 seconds as fallback
      setTimeout(() => {
        this.innerHTML = originalText;
        this.disabled = false;
      }, 5000);
    });
  });

  // Initialize tooltips if Bootstrap is available
  if (typeof bootstrap !== 'undefined') {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Promotional Banner Countdown Timer
  initializePromoBanner();

  console.log('NMH Shop - Application loaded successfully! 🚀');
});

// Promotional Banner Functions
function initializePromoBanner() {
  const countdownElement = document.getElementById('countdown');
  if (!countdownElement) return;

  // Set end time (24 hours from now)
  const endTime = new Date().getTime() + (24 * 60 * 60 * 1000);

  function updateCountdown() {
    const now = new Date().getTime();
    const distance = endTime - now;

    if (distance < 0) {
      countdownElement.innerHTML = "OFFER EXPIRED";
      return;
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownElement.innerHTML =
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Update countdown every second
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// Scroll to shop function (can be customized to scroll to products section)
function scrollToShop() {
  // Scroll to the main content area
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  // Optional: Add a small delay and show a toast notification
  setTimeout(() => {
    if (typeof bootstrap !== 'undefined') {
      // Create a simple toast notification
      const toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
      toastContainer.style.zIndex = '9999';

      const toast = document.createElement('div');
      toast.className = 'toast align-items-center text-white bg-success border-0';
      toast.setAttribute('role', 'alert');
      toast.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">
            <i class="bi bi-gift-fill me-2"></i>
            Don't forget your 10% Diamond Package discount!
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      `;

      toastContainer.appendChild(toast);
      document.body.appendChild(toastContainer);

      const bsToast = new bootstrap.Toast(toast);
      bsToast.show();

      // Remove toast container after it's hidden
      toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toastContainer);
      });
    }
  }, 1000);
} 