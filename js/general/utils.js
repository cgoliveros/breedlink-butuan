function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span> ${message}`;
  document.body.appendChild(toast);
  
  toast.offsetHeight;
  
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.4s var(--transition-bounce) reverse';
    setTimeout(() => {
      if (toast && toast.remove) toast.remove();
    }, 400);
  }, 3000);
}

function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length === 0) return;
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  
  revealElements.forEach(el => revealObserver.observe(el));
}

function initNavbarScroll() {
  const navbar = document.querySelector('.navigation');
  if (!navbar) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

function animateCounter(element, target) {
  let current = 0;
  const duration = 2000;
  const stepTime = 20;
  const steps = duration / stepTime;
  const increment = target / steps;
  let currentStep = 0;
  
  const timer = setInterval(() => {
    currentStep++;
    current += increment;
    
    if (currentStep >= steps || current >= target) {
      element.textContent = target.toLocaleString() + (target < 100 ? '' : '+');
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, stepTime);
}

function initCounters() {
  const counters = document.querySelectorAll('.stat-number');
  if (counters.length === 0) return;
  
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.getAttribute('data-target'));
        if (!isNaN(target)) {
          animateCounter(entry.target, target);
        }
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  counters.forEach(counter => counterObserver.observe(counter));
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal.active').forEach(modal => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  });
  document.body.style.overflow = '';
}

function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.style.backgroundImage = `url(${e.target.result})`;
      preview.classList.add('has-image');
      preview.innerHTML = '';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function previewMultipleImages(input, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !input.files) return;
  
  container.innerHTML = '';
  
  Array.from(input.files).forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'image-preview-thumb';
      imgDiv.style.backgroundImage = `url(${e.target.result})`;
      imgDiv.setAttribute('data-index', index);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-preview-btn';
      removeBtn.innerHTML = '×';
      removeBtn.onclick = function() {
        imgDiv.remove();
      };
      
      imgDiv.appendChild(removeBtn);
      container.appendChild(imgDiv);
    };
    reader.readAsDataURL(file);
  });
}

function openLightbox(src) {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImg');
  if (modal && img) {
    img.src = src;
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

const Storage = {
  get: (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error writing to localStorage:', e);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Error removing from localStorage:', e);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.error('Error clearing localStorage:', e);
      return false;
    }
  }
};

const Validators = {
  email: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  password: (password) => {
    return password.length >= 8;
  },
  
  phone: (phone) => {
    const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return re.test(phone);
  },
  
  name: (name) => {
    return name.trim().length >= 2;
  },
  
  url: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function formatDate(date, timeOnly = false) {
  const d = new Date(date);
  if (timeOnly) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const now = new Date();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString();
}

function smoothScroll(target, offset = 0) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard! 📋');
    return true;
  } catch (err) {
    showToast('Failed to copy', 'error');
    return false;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
}

function getUrlParams() {
  const params = {};
  const queryString = window.location.search.substring(1);
  const pairs = queryString.split('&');
  
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split('=');
    if (pair[0]) {
      params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
  }
  
  return params;
}

function setUrlParams(params) {
  const url = new URL(window.location.href);
  Object.keys(params).forEach(key => {
    if (params[key]) {
      url.searchParams.set(key, params[key]);
    } else {
      url.searchParams.delete(key);
    }
  });
  window.history.pushState({}, '', url);
}

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function initLazyLoad() {
  const images = document.querySelectorAll('img[data-src]');
  if (images.length === 0) return;
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.getAttribute('data-src');
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });
  
  images.forEach(img => imageObserver.observe(img));
}

function preloadImages(images) {
  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('[data-animate]');
  if (animatedElements.length === 0) return;
  
  let ticking = false;
  
  function checkAnimations() {
    animatedElements.forEach(el => {
      if (isInViewport(el) && !el.classList.contains('animated')) {
        const animation = el.getAttribute('data-animate');
        el.style.animation = `${animation} 0.6s var(--transition-smooth) forwards`;
        el.classList.add('animated');
      }
    });
    ticking = false;
  }
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(checkAnimations);
      ticking = true;
    }
  });
  
  checkAnimations();
}

window.openModal = openModal;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.showToast = showToast;
window.Storage = Storage;
window.Validators = Validators;
window.formatDate = formatDate;
window.copyToClipboard = copyToClipboard;
window.smoothScroll = smoothScroll;
window.isMobileDevice = isMobileDevice;
window.truncateText = truncateText;
window.getUrlParams = getUrlParams;
window.setUrlParams = setUrlParams;
window.generateId = generateId;
window.debounce = debounce;
window.throttle = throttle;
window.preloadImages = preloadImages;
window.previewImage = previewImage;
window.previewMultipleImages = previewMultipleImages;
window.openLightbox = openLightbox;