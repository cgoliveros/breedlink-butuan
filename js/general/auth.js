const User = {
  current: null,

  async login(email, password) {
    const res = await fetch(`${window.API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    this.current = data.user;
    localStorage.setItem('breedlink_token', data.token);
    localStorage.setItem('breedlink_user', JSON.stringify(data.user));
    return this.current;
  },

  async signup(userData) {
    const res = await fetch(`${window.API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Signup failed');
    }
    const data = await res.json();
    this.current = data.user;
    localStorage.setItem('breedlink_token', data.token);
    localStorage.setItem('breedlink_user', JSON.stringify(data.user));
    return this.current;
  },

  logout() {
    this.current = null;
    localStorage.removeItem('breedlink_token');
    localStorage.removeItem('breedlink_user');
    if (typeof showToast === 'function') showToast('Logged out successfully 👋');
    setTimeout(() => window.location.href = '../html/home.html', 500);
  },

  isAuthenticated() {
    if (!this.current) {
      const stored = localStorage.getItem('breedlink_user');
      if (stored) this.current = JSON.parse(stored);
    }
    return this.current !== null;
  },

  getToken() {
    return localStorage.getItem('breedlink_token');
  },

  getUser() {
    if (!this.current) {
      const stored = localStorage.getItem('breedlink_user');
      if (stored) this.current = JSON.parse(stored);
    }
    return this.current;
  },

  async updateUser(updates) {
    const token = this.getToken();
    const res = await fetch(`${window.API_BASE}/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Update failed');
    const updated = await res.json();
    this.current = updated;
    localStorage.setItem('breedlink_user', JSON.stringify(updated));
    return updated;
  }
};

function checkPasswordStrength(password) {
  let strength = 0;
  let feedback = [];
  if (password.length >= 8) strength++; else feedback.push('At least 8 characters');
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++; else feedback.push('Include both uppercase and lowercase letters');
  if (password.match(/[0-9]/) && password.match(/[^a-zA-Z0-9]/)) strength++; else feedback.push('Include numbers and special characters');
  const strengthLevels = ['Very Weak', 'Weak', 'Fair', 'Strong'];
  const strengthColors = ['#FF6B6B', '#FFA06B', '#FFD93D', '#4CAF50'];
  return { score: strength, text: strengthLevels[strength], color: strengthColors[strength], feedback };
}

function updatePasswordStrength(passwordInput, strengthContainerId) {
  if (!passwordInput) return;
  const container = document.getElementById(strengthContainerId);
  if (!container) return;
  const password = passwordInput.value;
  const strength = checkPasswordStrength(password);
  const segments = container.querySelectorAll('.strength-segment');
  segments.forEach((segment, index) => {
    segment.className = 'strength-segment';
    if (index < strength.score) {
      if (strength.score === 1) segment.classList.add('weak');
      else if (strength.score === 2) segment.classList.add('medium');
      else if (strength.score === 3) segment.classList.add('strong');
    }
  });
  const strengthText = container.querySelector('.strength-text');
  if (strengthText) strengthText.innerHTML = `<span style="color: ${strength.color}">${strength.text}</span>`;
  const feedbackDiv = container.querySelector('.strength-feedback');
  if (feedbackDiv) {
    if (strength.score < 3 && password.length > 0) {
      feedbackDiv.innerHTML = strength.feedback.map(f => `• ${f}`).join('<br>');
      feedbackDiv.style.display = 'block';
    } else {
      feedbackDiv.style.display = 'none';
    }
  }
}

function togglePassword(inputId, buttonElement) {
  const input = document.getElementById(inputId);
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      buttonElement.textContent = '🙈';
    } else {
      input.type = 'password';
      buttonElement.textContent = '👁️';
    }
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  const submitBtn = document.getElementById('submitBtn');
  const rememberMe = document.getElementById('rememberMe')?.checked;
  if (!email || !password) return showToast('Please fill in all fields', 'error');
  if (!Validators.email(email)) return showToast('Please enter a valid email', 'error');
  if (!Validators.password(password)) return showToast('Password must be at least 8 characters', 'error');
  if (submitBtn) {
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Signing in...';
  }
  try {
    const user = await User.login(email, password);
    if (rememberMe) localStorage.setItem('breedlink_remember', email);
    else localStorage.removeItem('breedlink_remember');
    showToast(`Welcome back, ${user.name}! 🎉`);
    setTimeout(() => window.location.href = '../html/profile.html', 800);
  } catch (error) {
    showToast(error.message, 'error');
    if (submitBtn) {
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'Sign In →';
    }
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const name = document.getElementById('fullName')?.value;
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  const confirmPassword = document.getElementById('confirmPassword')?.value;
  const terms = document.getElementById('terms')?.checked;
  const selected = document.querySelector('.account-type.selected');
  const accountType = selected?.getAttribute('data-type') || 'breeder';
  if (!name || !email || !password) return showToast('Please fill in all fields', 'error');
  if (!Validators.name(name)) return showToast('Please enter a valid name (≥2 characters)', 'error');
  if (!Validators.email(email)) return showToast('Please enter a valid email', 'error');
  if (!Validators.password(password)) return showToast('Password must be at least 8 characters', 'error');
  if (password !== confirmPassword) return showToast('Passwords do not match', 'error');
  if (!terms) return showToast('Please accept the Terms of Service', 'error');
  try {
    const user = await User.signup({ name, email, password, accountType });
    showToast(`Welcome to BreedLink, ${user.name}! 🎉`);
    setTimeout(() => window.location.href = '../html/profile.html', 800);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function checkAuth() {
  if (User.isAuthenticated()) {
    const loginLink = document.querySelector('a[href="../html/login.html"]');
    const signupLink = document.querySelector('a[href="../html/sign_up.html"]');
    const profileLink = document.querySelector('a[href="../html/profile.html"]');
    if (loginLink) loginLink.style.display = 'none';
    if (signupLink) signupLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'inline-block';
  }
}

function autoFillRememberedEmail() {
  const rememberedEmail = localStorage.getItem('breedlink_remember');
  const emailInput = document.getElementById('email');
  const rememberCheckbox = document.getElementById('rememberMe');
  if (rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }
}

function initNavigation() {
  updateNavForAuthStatus();
  if (typeof initCollapsibleSearch === 'function') initCollapsibleSearch();
}

function updateNavForAuthStatus() {
  const isLoggedIn = User.isAuthenticated();
  const user = User.getUser();
  const messageBtn = document.getElementById('messageBtn');
  const profileMenu = document.getElementById('profileMenuContainer');
  const guestOptions = document.getElementById('guestOptions');
  const searchToggle = document.getElementById('searchToggle');
  const searchBoxContent = document.getElementById('searchBoxContent');
  if (isLoggedIn && user) {
    if (messageBtn) messageBtn.style.display = 'flex';
    if (profileMenu) {
      profileMenu.style.display = 'block';
      const profileBtn = document.getElementById('profileBtn');
      if (profileBtn && user.avatar) profileBtn.innerHTML = `<img src="${user.avatar}" alt="${user.name}">`;
    }
    if (guestOptions) guestOptions.style.display = 'none';
    if (searchToggle) {
      searchToggle.disabled = false;
      searchToggle.title = 'Search';
    }
  } else {
    if (messageBtn) messageBtn.style.display = 'none';
    if (profileMenu) profileMenu.style.display = 'none';
    if (guestOptions) guestOptions.style.display = 'flex';
    if (searchToggle) {
      searchToggle.disabled = true;
      searchToggle.title = 'Sign in to search';
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
  const currentPage = window.location.pathname.split('/').pop() || 'home.html';
  const pageMap = { 'home.html': 'nav-home', 'about.html': 'nav-about', 'swipe.html': 'nav-breeders' };
  document.querySelectorAll('.menu a').forEach(link => link.classList.remove('active'));
  const activeId = pageMap[currentPage];
  if (activeId) {
    const activeLink = document.getElementById(activeId);
    if (activeLink) activeLink.classList.add('active');
  }
}

function toggleProfileDropdown() {
  document.getElementById('profileDropdown')?.classList.toggle('active');
}

function handleLogout() {
  if (confirm('Are you sure you want to logout? 👋')) User.logout();
}

function protectSwipePage() {
  if (!window.location.pathname.includes('swipe.html')) return;
  if (!User.isAuthenticated()) {
    sessionStorage.setItem('redirectAfterLogin', '../html/swipe.html');
    window.location.href = '../html/login.html';
  }
}

function openMessengerGlobal() {
  if (typeof window.openMessenger === 'function') window.openMessenger();
  else setTimeout(() => openMessengerGlobal(), 500);
}

window.User = User;
window.checkPasswordStrength = checkPasswordStrength;
window.updatePasswordStrength = updatePasswordStrength;
window.togglePassword = togglePassword;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.checkAuth = checkAuth;
window.autoFillRememberedEmail = autoFillRememberedEmail;
window.initNavigation = initNavigation;
window.updateNavForAuthStatus = updateNavForAuthStatus;
window.toggleProfileDropdown = toggleProfileDropdown;
window.handleLogout = handleLogout;
window.protectSwipePage = protectSwipePage;
window.openMessengerGlobal = openMessengerGlobal;