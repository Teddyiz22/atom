// ML Diamonds Store - Enhanced JavaScript Functionality

// Myanmar language handling
function handleMyanmarLanguage() {
  const currentLang = document.documentElement.lang ||
    document.querySelector('html').getAttribute('lang') ||
    (document.querySelector('[data-lang]') && document.querySelector('[data-lang]').getAttribute('data-lang'));

  if (currentLang === 'mm') {
    // Apply Myanmar font to all text elements
    const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, .gradient-text');
    textElements.forEach(element => {
      if (!element.classList.contains('myanmar-text')) {
        element.classList.add('myanmar-text');
      }
      element.setAttribute('data-lang', 'mm');
    });

    // Fix gradient text visibility for Myanmar
    const gradientTexts = document.querySelectorAll('.gradient-text');
    gradientTexts.forEach(element => {
      element.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
      element.style.setProperty('color', '#ffffff', 'important');
      element.style.setProperty('background', 'none', 'important');
      element.style.setProperty(
        'font-family',
        "'MyanmarTagu', sans-serif",
        'important'
      );
      element.style.setProperty('font-weight', '800', 'important');
      element.style.setProperty('text-shadow', '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(139, 92, 246, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)', 'important');
    });
  }
}

// Mobile menu toggle functionality
function toggleMobileMenu() {
  const mobileMenu = document.getElementById('mobile-menu');
  const isHidden = mobileMenu.classList.contains('hidden');

  if (isHidden) {
    mobileMenu.classList.remove('hidden');
    mobileMenu.style.maxHeight = mobileMenu.scrollHeight + 'px';
    document.body.style.overflow = 'hidden';
  } else {
    mobileMenu.style.maxHeight = '0px';
    setTimeout(() => {
      mobileMenu.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }, 300);
  }
}

// Enhanced smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function () {
  // Handle Myanmar language on page load
  handleMyanmarLanguage();

  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);

      if (targetElement) {
        const mobileMenu = document.getElementById('mobile-menu');
        if (!mobileMenu.classList.contains('hidden')) {
          toggleMobileMenu();
        }

        const navbarHeight = document.querySelector('nav').offsetHeight;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navbarHeight - 20;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  observeElements();
  addButtonEffects();
  initializeOrderForm();
});

// Watch for language changes
function watchLanguageChanges() {
  // Watch for URL changes (language switching)
  let currentUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(handleMyanmarLanguage, 100); // Small delay to ensure DOM is updated
    }
  }, 500);

  // Watch for language switching links
  const languageLinks = document.querySelectorAll('a[href*="/language/change/"]');
  languageLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href.includes('/mm')) {
        // Myanmar language selected
        setTimeout(() => {
          handleMyanmarLanguage();
        }, 200);
      }
    });
  });

  // Watch for dynamic content changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        handleMyanmarLanguage();
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-lang', 'lang']
  });
}

// Initialize language watching
document.addEventListener('DOMContentLoaded', watchLanguageChanges);

// Force Myanmar language handling on page load if needed
window.addEventListener('load', function () {
  setTimeout(handleMyanmarLanguage, 500);
});

// Intersection Observer for scroll animations
function observeElements() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-up');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  const cards = document.querySelectorAll('.grid > div, section');
  cards.forEach(card => {
    observer.observe(card);
  });
}

// Enhanced button effects
function addButtonEffects() {
  const buttons = document.querySelectorAll('button');

  buttons.forEach(button => {
    button.addEventListener('click', function (e) {
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');

      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';

      this.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
}

// Navbar scroll effect
window.addEventListener('scroll', function () {
  const navbar = document.querySelector('nav');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Mobile menu close functionality
document.addEventListener('click', function (event) {
  const mobileMenu = document.getElementById('mobile-menu');
  const menuButton = event.target.closest('button[onclick="toggleMobileMenu()"]');
  const navbar = event.target.closest('nav');

  if (!navbar && !mobileMenu.classList.contains('hidden')) {
    toggleMobileMenu();
  }
});

// Order form initialization
function initializeOrderForm() {
  // Only target order forms, not user auth forms
  const form = document.querySelector('form:not([action*="/users/"])');
  if (!form) return;

  const userIdInput = form.querySelector('input[placeholder*="ML User ID"]');
  const serverIdInput = form.querySelector('input[placeholder*="Server ID"]');
  const whatsappInput = form.querySelector('input[type="tel"]');

  if (userIdInput) {
    userIdInput.addEventListener('input', function () {
      validateMLUserID(this);
    });
  }

  if (serverIdInput) {
    serverIdInput.addEventListener('input', function () {
      validateServerID(this);
    });
  }

  if (whatsappInput) {
    whatsappInput.addEventListener('input', function () {
      validateWhatsApp(this);
    });
  }

  // Only add submit handler to order forms (forms with ML User ID input)
  if (userIdInput) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleOrderSubmit(this);
    });
  }
}

// Validation functions
function validateMLUserID(input) {
  const value = input.value.trim();
  const isValid = /^\d{6,12}$/.test(value);

  if (value && !isValid) {
    showInputError(input, 'User ID should be 6-12 digits');
  } else {
    clearInputError(input);
  }

  return isValid;
}

function validateServerID(input) {
  const value = input.value.trim();
  const isValid = /^\d{4,6}$/.test(value);

  if (value && !isValid) {
    showInputError(input, 'Server ID should be 4-6 digits');
  } else {
    clearInputError(input);
  }

  return isValid;
}

function validateWhatsApp(input) {
  const value = input.value.trim();
  const isValid = /^\+?\d{10,15}$/.test(value.replace(/\s/g, ''));

  if (value && !isValid) {
    showInputError(input, 'Please enter a valid WhatsApp number');
  } else {
    clearInputError(input);
  }

  return isValid;
}

function showInputError(input, message) {
  clearInputError(input);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message text-red-500 text-sm mt-1';
  errorDiv.textContent = message;
  input.parentNode.appendChild(errorDiv);
  input.classList.add('border-red-500');
}

function clearInputError(input) {
  const errorMessage = input.parentNode.querySelector('.error-message');
  if (errorMessage) {
    errorMessage.remove();
  }
  input.classList.remove('border-red-500');
}

function handleOrderSubmit(form) {
  const formData = new FormData(form);
  const orderData = Object.fromEntries(formData);

  // Show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Processing...';
  submitBtn.disabled = true;

  // Simulate order processing
  setTimeout(() => {
    showSuccessMessage();
    form.reset();
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }, 2000);
}

function showSuccessMessage() {
  const message = document.createElement('div');
  message.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50';
  message.innerHTML = `
    <div class="flex items-center">
      <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      Order submitted successfully!
    </div>
  `;

  document.body.appendChild(message);

  setTimeout(() => {
    message.remove();
  }, 5000);
}