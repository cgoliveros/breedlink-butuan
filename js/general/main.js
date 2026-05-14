function checkAuthAndUpdateNav() {
  const isLoggedIn = User.isAuthenticated();
  const user = User.getUser();

  const messageBtn = document.getElementById('messageBtn');
  const profileMenu = document.getElementById('profileMenuContainer');
  const guestOptions = document.getElementById('guestOptions');
  const searchToggle = document.getElementById('searchToggle');
  const searchBoxContent = document.getElementById('searchBoxContent');

  if (isLoggedIn && user) {
    if (messageBtn) {
      messageBtn.style.display = 'flex';
      messageBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openMessengerGlobal === 'function') {
          window.openMessengerGlobal();
        } else if (typeof window.openMessenger === 'function') {
          window.openMessenger();
        } else if (typeof openMessenger === 'function') {
          openMessenger();
        }
      };
    }
    if (profileMenu) {
      profileMenu.style.display = 'block';
      const profileBtn = document.getElementById('profileBtn');
      if (profileBtn && user.avatar) {
        profileBtn.innerHTML = `<img src="${user.avatar}" alt="${user.name}">`;
      }
    }
    if (guestOptions) guestOptions.style.display = 'none';

    if (searchToggle) {
      searchToggle.disabled = false;
      searchToggle.title = "Search";
    }

  } else {
    if (messageBtn) messageBtn.style.display = 'none';
    if (profileMenu) profileMenu.style.display = 'none';
    if (guestOptions) guestOptions.style.display = 'flex';

    if (searchToggle) {
      searchToggle.disabled = true;
      searchToggle.title = "Sign in to search";
    }

    if (searchBoxContent) {
      searchBoxContent.innerHTML = `
        <div class="search-locked">
          <p>🔒 Please sign in to search</p>
          <a href="login.html">Sign In</a>
          <a href="sign_up.html">Sign Up</a>
        </div>
      `;
    }
  }
}

function initModalCloseOnOutsideClick() {
  window.addEventListener('click', function(event) {
    if (event.target.classList && event.target.classList.contains('modal')) {
      closeModal(event.target.id);
    }
  });
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeAllModals();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const statusInput = document.getElementById('statusInput');
      if (document.activeElement === statusInput && typeof window.addPost === 'function') {
        e.preventDefault();
        window.addPost();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('globalSearch');
      if (searchInput) {
        searchInput.focus();
      }
    }
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href && href !== '#' && href !== '#') {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          smoothScroll(target, 80);
        }
      }
    });
  });
}

function initPageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => {
        if (loader && loader.remove) loader.remove();
      }, 500);
    }, 500);
  }
}

function initBackgroundParallax() {
  const bgElements = document.querySelectorAll('.bg-animation, .hero-section');
  if (bgElements.length === 0) return;

  let ticking = false;

  function updateParallax() {
    const scrolled = window.pageYOffset;
    bgElements.forEach(el => {
      const speed = 0.3;
      const yPos = -(scrolled * speed);
      el.style.transform = `translateY(${yPos}px)`;
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  });
}

function trackPageView(pageName) {
  console.log(`📊 Page viewed: ${pageName} at ${new Date().toLocaleTimeString()}`);
}

document.addEventListener('DOMContentLoaded', function() {
  checkAuthAndUpdateNav();
  if (typeof initNavigation === 'function') {
    initNavigation();
  }
  if (typeof protectSwipePage === 'function') {
    protectSwipePage();
  }
  if (typeof initNavbarScroll === 'function') {
    initNavbarScroll();
  }
  if (typeof initScrollReveal === 'function') {
    initScrollReveal();
  }
  if (typeof initCounters === 'function') {
    initCounters();
  }
  initModalCloseOnOutsideClick();
  initKeyboardShortcuts();
  initSmoothScroll();
  initPageLoader();
  if (typeof initLazyLoad === 'function') {
    initLazyLoad();
  }
  if (typeof initScrollAnimations === 'function') {
    initScrollAnimations();
  }
  initBackgroundParallax();
  trackPageView(document.title);
});

window.addEventListener('popstate', function() {
  if (typeof initSwipe === 'function') {
    initSwipe();
  }
  if (typeof initProfile === 'function') {
    initProfile();
  }
  if (typeof initNavigation === 'function') {
    initNavigation();
  }
});

window.BreedLink = {
  showToast: typeof showToast !== 'undefined' ? showToast : function() {},
  openModal: typeof openModal !== 'undefined' ? openModal : function() {},
  closeModal: typeof closeModal !== 'undefined' ? closeModal : function() {},
  closeAllModals: typeof closeAllModals !== 'undefined' ? closeAllModals : function() {},
  previewImage: typeof previewImage !== 'undefined' ? previewImage : function() {},
  openLightbox: typeof openLightbox !== 'undefined' ? openLightbox : function() {},
  Storage: typeof Storage !== 'undefined' ? Storage : { get: function() {}, set: function() {} },
  Validators: typeof Validators !== 'undefined' ? Validators : {},
  formatDate: typeof formatDate !== 'undefined' ? formatDate : function() {},
  copyToClipboard: typeof copyToClipboard !== 'undefined' ? copyToClipboard : function() {},
  smoothScroll: typeof smoothScroll !== 'undefined' ? smoothScroll : function() {},
  isMobileDevice: typeof isMobileDevice !== 'undefined' ? isMobileDevice : function() {},
  truncateText: typeof truncateText !== 'undefined' ? truncateText : function() {},
  getUrlParams: typeof getUrlParams !== 'undefined' ? getUrlParams : function() {},
  setUrlParams: typeof setUrlParams !== 'undefined' ? setUrlParams : function() {},
  generateId: typeof generateId !== 'undefined' ? generateId : function() {},
  debounce: typeof debounce !== 'undefined' ? debounce : function() {},
  throttle: typeof throttle !== 'undefined' ? throttle : function() {},
  preloadImages: typeof preloadImages !== 'undefined' ? preloadImages : function() {}
};