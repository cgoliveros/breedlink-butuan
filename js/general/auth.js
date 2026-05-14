// auth.js - BreedLink Authentication System
// Supabase client is initialized in supabase-init.js

function getToken() {
    return localStorage.getItem('breedlink_token') || '';
}

// USER OBJECT (Complete)
// ============================================
const User = {
    current: null,

    async fetchFromSupabase(userId) {
        try {
            const { data: profile, error } = await window.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            // PGRST116 = row not found, that is not an error worth throwing
            if (error && error.code !== 'PGRST116') throw error;
            if (!profile) return null;
            
            return {
                id: userId,
                name: profile?.name || 'User',
                email: profile?.contact?.email || '',
                avatar: profile?.profile_picture || 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png',
                coverPhoto: profile?.cover_photo || 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200',
                bio: profile?.bio || '',
                tags: profile?.tags || [],
                accountType: profile?.account_type || 'breeder',
                contact: profile?.contact || { email: '', phone: '', location: '' },
                stats: profile?.stats || { connections: 0, litters: 0, rating: 0, followers: 0, following: 0 },
                location: profile?.location || 'Butuan City, Philippines'
            };
        } catch (error) {
            console.error('Fetch from Supabase error:', error);
            return null;
        }
    },

    async getFreshUser() {
        try {
            const token = localStorage.getItem('breedlink_token');
            if (!token) return null;

            let userId = null;

            if (this.current && this.current.id) {
                userId = this.current.id;
            } else {
                const storedUser = localStorage.getItem('breedlink_user');
                if (storedUser) {
                    try {
                        const parsed = JSON.parse(storedUser);
                        userId = parsed.id;
                    } catch(e) {}
                }
            }

            // If still no userId, get it from Supabase auth endpoint
            if (!userId) {
                try {
                    const { data } = await window.supabase.auth.getUser();
                    userId = data?.user?.id || null;
                } catch (e) {}
            }

            if (!userId) return null;

            const freshUser = await this.fetchFromSupabase(userId);
            if (freshUser) {
                this.current = freshUser;
                localStorage.setItem('breedlink_user', JSON.stringify(freshUser));
                return freshUser;
            }

            return this.current;
        } catch(e) {
            console.warn('getFreshUser() error (non-fatal):', e);
            return this.current;
        }
    },

    async login(email, password) {
        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
            
            if (error) throw new Error(error.message);
            if (!data || !data.user) throw new Error('Login failed');
            
            const freshUser = await this.fetchFromSupabase(data.user.id);
            
            if (freshUser) {
                this.current = freshUser;
            } else {
                // Profile row missing — create a fallback and upsert it so it exists going forward
                const fallback = {
                    id: data.user.id,
                    name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
                    email: data.user.email,
                    avatar: 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png',
                    coverPhoto: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200',
                    bio: '',
                    tags: [],
                    accountType: data.user.user_metadata?.account_type || 'breeder',
                    contact: { email: data.user.email, phone: '', location: '' },
                    stats: { connections: 0, litters: 0, rating: 0, followers: 0, following: 0 },
                    location: data.user.user_metadata?.location || 'Butuan City, Philippines'
                };
                // Upsert so future logins will find this row
                try {
                    await window.supabase.from('profiles').upsert({
                        id: data.user.id,
                        name: fallback.name,
                        account_type: fallback.accountType,
                        profile_picture: fallback.avatar,
                        cover_photo: fallback.coverPhoto,
                        bio: '',
                        tags: [],
                        contact: fallback.contact,
                        stats: fallback.stats,
                        location: fallback.location
                    }, { onConflict: 'id' });
                } catch(e) { console.warn('Profile upsert on login failed:', e); }
                this.current = fallback;
            }
            
            localStorage.setItem('breedlink_user', JSON.stringify(this.current));
            return this.current;
            
        } catch (error) {
            throw new Error(error.message || 'Login failed');
        }
    },

    async signup(userData) {
        try {
            const { data, error } = await window.supabase.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        name: userData.name,
                        account_type: userData.accountType,
                        location: userData.location || 'Butuan City, Philippines'
                    }
                }
            });
            
            if (error) throw new Error(error.message);
            if (!data || !data.user) throw new Error('Signup failed');
            
            const defaultContact = {
                email: userData.email,
                phone: userData.phone || '',
                location: userData.location || 'Butuan City, Philippines'
            };
            
            const defaultStats = {
                connections: 0,
                litters: 0,
                rating: 0,
                followers: 0,
                following: 0
            };
            
            await window.supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    name: userData.name,
                    account_type: userData.accountType,
                    profile_picture: 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png',
                    cover_photo: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200',
                    bio: '',
                    tags: [],
                    contact: defaultContact,
                    stats: defaultStats,
                    location: userData.location || 'Butuan City, Philippines'
                });
            
            this.current = {
                id: data.user.id,
                name: userData.name,
                email: userData.email,
                avatar: 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png',
                coverPhoto: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200',
                bio: '',
                tags: [],
                accountType: userData.accountType,
                contact: defaultContact,
                stats: defaultStats,
                location: userData.location || 'Butuan City, Philippines'
            };
            
            localStorage.setItem('breedlink_user', JSON.stringify(this.current));
            return this.current;
            
        } catch (error) {
            throw new Error(error.message || 'Signup failed');
        }
    },

    async logout() {
        try { await window.supabase.auth.signOut(); } catch(e) {}
        this.current = null;
        localStorage.removeItem('breedlink_token');
        localStorage.removeItem('breedlink_refresh_token');
        localStorage.removeItem('breedlink_user');
        localStorage.removeItem('breedlink_remember');
        sessionStorage.clear();

        // Show toast if available, otherwise just redirect
        if (typeof showToast === 'function') showToast('Logged out successfully! 👋');

        // Build the correct path to index.html regardless of current folder depth
        const pathParts = window.location.pathname.split('/');
        const htmlIndex = pathParts.indexOf('html');
        let indexPath;
        if (htmlIndex !== -1) {
            // We're inside /html/ — go up one level
            indexPath = pathParts.slice(0, htmlIndex).join('/') + '/index.html';
        } else {
            indexPath = window.location.pathname.replace(/\/[^\/]*$/, '/index.html');
        }

        setTimeout(() => {
            window.location.href = indexPath || '/index.html';
        }, 300);
    },

    isAuthenticated() {
        const token = localStorage.getItem('breedlink_token');
        if (!token) return false;
        // If we have a token, trust it. If it's expired, authedFetch will auto-refresh it.
        // Never reject a session here — that causes redirect loops right after login.
        return true;
    },

    getUser() {
        if (this.current && this.current.id) return this.current;
        const stored = localStorage.getItem('breedlink_user');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Guard against stored user with null/undefined id (corrupted state)
                if (parsed && parsed.id && parsed.id !== 'null' && parsed.id !== 'undefined') {
                    this.current = parsed;
                    return this.current;
                } else {
                    // Corrupted — clear it
                    localStorage.removeItem('breedlink_user');
                    return null;
                }
            } catch (e) {
                return null;
            }
        }
        return null;
    },

    async updateUser(updates) {
        let user = this.getUser();
        // If getUser() returned null or no id, try a live recovery from Supabase
        if (!user || !user.id || user.id === 'null') {
            try {
                const { data } = await window.supabase.auth.getUser();
                if (data?.user?.id) {
                    const freshUser = await this.fetchFromSupabase(data.user.id);
                    if (freshUser) {
                        this.current = freshUser;
                        localStorage.setItem('breedlink_user', JSON.stringify(freshUser));
                        user = freshUser;
                    }
                }
            } catch(e) {}
        }
        if (!user) throw new Error('Not authenticated');
        if (!user.id || user.id === 'null') throw new Error('User ID is missing — please log out and log back in');

        try {
            const updateData = {};
            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.bio !== undefined) updateData.bio = updates.bio;
            if (updates.tags !== undefined) updateData.tags = updates.tags;
            if (updates.contact !== undefined) updateData.contact = updates.contact;
            if (updates.stats !== undefined) updateData.stats = updates.stats;
            if (updates.profilePicture !== undefined) updateData.profile_picture = updates.profilePicture;
            if (updates.coverPhoto !== undefined) updateData.cover_photo = updates.coverPhoto;
            if (updates.location !== undefined) updateData.location = updates.location;

            if (Object.keys(updateData).length > 0) {
                // Use upsert so data is never lost even if profile row doesn't exist yet
                const upsertPayload = { id: user.id, ...updateData };
                const { error } = await window.supabase
                    .from('profiles')
                    .upsert(upsertPayload, { onConflict: 'id' });
                if (error) throw error;
            }

            // Merge updates into current, normalizing profilePicture -> avatar
            const merged = { ...user, ...updates };
            if (updates.profilePicture !== undefined) {
                merged.avatar = updates.profilePicture;
            }
            this.current = merged;
            localStorage.setItem('breedlink_user', JSON.stringify(this.current));

            // Update navbar avatar immediately
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn && this.current.avatar) {
                profileBtn.innerHTML = `<img src="${this.current.avatar}" alt="${this.current.name}">`;
            }

            return this.current;
        } catch (error) {
            throw new Error(error.message);
        }
    },

    async refresh() {
        try {
            const freshUser = await this.getFreshUser();
            if (freshUser) {
                this.current = freshUser;
                localStorage.setItem('breedlink_user', JSON.stringify(freshUser));
                
                // Update profile button
                const profileBtn = document.getElementById('profileBtn');
                if (profileBtn && this.current.avatar) {
                    profileBtn.innerHTML = `<img src="${this.current.avatar}" alt="${this.current.name}">`;
                }
            }
            return this.current;
        } catch(e) {
            console.warn('User.refresh() failed (non-fatal):', e);
            return this.current;
        }
    },

    async getProfile(userId) {
        try {
            const { data, error } = await window.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            return null;
        }
    },

    async logActivity(action, entityType, entityId, details = {}) {
        const user = this.getUser();
        if (!user) return;
        
        try {
            await window.supabase
                .from('activity_log')
                .insert({
                    user_id: user.id,
                    action: action,
                    entity_type: entityType,
                    entity_id: entityId,
                    details: details,
                    user_agent: navigator.userAgent
                });
        } catch (e) {
            console.error('Activity log error:', e);
        }
    },

    async getNotifications(limit = 20) {
        const user = this.getUser();
        if (!user) return [];
        
        try {
            const { data, error } = await window.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get notifications error:', error);
            return [];
        }
    },

    async createNotification(userId, type, referenceId, title, message) {
        try {
            await window.supabase
                .from('notifications')
                .insert({
                    user_id: userId,
                    type: type,
                    reference_id: referenceId,
                    title: title,
                    message: message
                });
        } catch (e) {
            console.error('Notification error:', e);
        }
    },

    async followUser(userIdToFollow) {
        const user = this.getUser();
        if (!user) throw new Error('Not authenticated');
        
        try {
            await window.supabase
                .from('follows')
                .insert({
                    follower_id: user.id,
                    following_id: userIdToFollow,
                    status: 'accepted'
                });
            
            await this.updateUser({ 
                stats: { ...user.stats, following: (user.stats?.following || 0) + 1 }
            });
            
            return true;
        } catch (error) {
            console.error('Follow user error:', error);
            return false;
        }
    },

    async unfollowUser(userIdToUnfollow) {
        const user = this.getUser();
        if (!user) throw new Error('Not authenticated');
        
        try {
            await window.supabase
                .from('follows')
                .delete()
                .eq('follower_id', user.id)
                .eq('following_id', userIdToUnfollow);
            
            await this.updateUser({ 
                stats: { ...user.stats, following: Math.max(0, (user.stats?.following || 0) - 1) }
            });
            
            return true;
        } catch (error) {
            console.error('Unfollow user error:', error);
            return false;
        }
    },

    async getFollowers() {
        const user = this.getUser();
        if (!user) return [];
        
        try {
            const { data, error } = await window.supabase
                .from('follows')
                .select('follower_id, profiles:follower_id (id, name, profile_picture)')
                .eq('following_id', user.id);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get followers error:', error);
            return [];
        }
    },

    async getFollowing() {
        const user = this.getUser();
        if (!user) return [];
        
        try {
            const { data, error } = await window.supabase
                .from('follows')
                .select('following_id, profiles:following_id (id, name, profile_picture)')
                .eq('follower_id', user.id);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get following error:', error);
            return [];
        }
    }
};

// ============================================
// PASSWORD STRENGTH CHECKER
// ============================================
function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = [];
    
    if (password.length >= 8) {
        strength++;
    } else {
        feedback.push('At least 8 characters');
    }
    
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) {
        strength++;
    } else {
        feedback.push('Include both uppercase and lowercase letters');
    }
    
    if (password.match(/[0-9]/) && password.match(/[^a-zA-Z0-9]/)) {
        strength++;
    } else {
        feedback.push('Include numbers and special characters');
    }
    
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
    if (strengthText) {
        strengthText.innerHTML = `<span style="color: ${strength.color}">${strength.text}</span>`;
    }
    
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

// ============================================
// PASSWORD TOGGLE
// ============================================
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

// ============================================
// LOGIN/SIGNUP HANDLERS
// ============================================
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const submitBtn = document.getElementById('submitBtn');
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
    }
    
    try {
        const user = await User.login(email, password);
        
        if (rememberMe) {
            localStorage.setItem('breedlink_remember', email);
        } else {
            localStorage.removeItem('breedlink_remember');
        }
        
        showToast(`Welcome back, ${user.name}! 🎉`);
        
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 800);
    } catch (error) {
        showToast(error.message, 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In →';
        }
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const name = document.getElementById('fullName')?.value;
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const confirm = document.getElementById('confirmPassword')?.value;
    const terms = document.getElementById('terms')?.checked;
    const phone = document.getElementById('phone')?.value;
    
    const selected = document.querySelector('.account-type.selected');
    const accountType = selected?.getAttribute('data-type') || 'breeder';
    
    if (!name || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (!terms) {
        showToast('Please accept the Terms of Service', 'error');
        return;
    }
    
    const btn = document.getElementById('createBtn');
    if (btn) {
        btn.textContent = 'Creating...';
        btn.disabled = true;
    }
    
    try {
        const user = await User.signup({ name, email, password, accountType, phone });
        showToast(`Welcome to BreedLink, ${user.name}! 🎉`);
        
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 800);
    } catch (error) {
        showToast(error.message, 'error');
        if (btn) {
            btn.textContent = 'Create Account';
            btn.disabled = false;
        }
    }
}

function autoFillRememberedEmail() {
    const remembered = localStorage.getItem('breedlink_remember');
    const emailInput = document.getElementById('email');
    if (remembered && emailInput) {
        emailInput.value = remembered;
    }
}

// ============================================
// NAVIGATION (Runs on EVERY page)
// ============================================
async function initNavigation() {
    // Refresh user data from server on every page load — but NEVER let this cause a logout
    if (User.isAuthenticated()) {
        try {
            await User.refresh();
        } catch(e) {
            // Network error or Supabase down — keep the user logged in, just use cached data
            console.warn('User refresh failed (non-fatal):', e);
        }
    }
    updateNavForAuthStatus();
    highlightActiveNavLink();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('profileDropdown');
        const btn = document.getElementById('profileBtn');
        if (dropdown && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function updateNavForAuthStatus() {
    const isLoggedIn = User.isAuthenticated();
    const user = User.getUser();
    const messageBtn = document.getElementById('messageBtn');
    const profileMenu = document.getElementById('profileMenuContainer');
    const guestOptions = document.getElementById('guestOptions');

    if (isLoggedIn && user) {
        if (messageBtn) {
            messageBtn.style.display = 'flex';
            messageBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.openMessenger === 'function') {
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
                profileBtn.onclick = () => toggleProfileDropdown();
            }
        }
        if (guestOptions) guestOptions.style.display = 'none';
    } else {
        if (messageBtn) messageBtn.style.display = 'none';
        if (profileMenu) profileMenu.style.display = 'none';
        if (guestOptions) guestOptions.style.display = 'flex';
    }
}

function highlightActiveNavLink() {
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop() || 'home.html';
    
    const navLinks = {
        'home.html': 'nav-home',
        'about.html': 'nav-about',
        'swipe.html': 'nav-breeders'
    };
    
    document.querySelectorAll('.menu a').forEach(link => link.classList.remove('active'));
    
    if (navLinks[currentFile]) {
        const activeLink = document.getElementById(navLinks[currentFile]);
        if (activeLink) activeLink.classList.add('active');
    }
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

function handleLogout() {
    // No confirm() — it gets swallowed by dropdown close events.
    // Just log out immediately.
    User.logout();
}

function protectSwipePage() {
    if (!window.location.pathname.includes('swipe.html')) return true;
    if (!User.isAuthenticated()) {
        sessionStorage.setItem('redirectAfterLogin', 'swipe.html');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ============================================
// MODAL FUNCTIONS
// ============================================
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
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        }, 300);
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
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.style.backgroundImage = `url('${e.target.result}')`;
                preview.classList.add('has-image');
                preview.innerHTML = '';
            }
        };
        reader.readAsDataURL(file);
    }
}

function openLightbox(src) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    if (modal && img) {
        img.src = src;
        openModal('lightboxModal');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'Just now';
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return 'Just now';
        const now = new Date();
        const diff = now - d;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString();
    } catch (e) {
        return 'Just now';
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard! 📋');
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    await initNavigation();
    
    if (window.location.pathname.includes('login.html')) {
        autoFillRememberedEmail();
    }
    
    if (window.location.pathname.includes('swipe.html')) {
        protectSwipePage();
    }
});

// ============================================
// EXPOSE TO WINDOW
// ============================================
window.User = User;
window.showToast = showToast;
window.checkPasswordStrength = checkPasswordStrength;
window.updatePasswordStrength = updatePasswordStrength;
window.togglePassword = togglePassword;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.autoFillRememberedEmail = autoFillRememberedEmail;
window.initNavigation = initNavigation;
window.updateNavForAuthStatus = updateNavForAuthStatus;
window.toggleProfileDropdown = toggleProfileDropdown;
window.handleLogout = handleLogout;
window.protectSwipePage = protectSwipePage;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.previewImage = previewImage;
window.openLightbox = openLightbox;
window.formatDate = formatDate;
window.copyToClipboard = copyToClipboard;

console.log('✅ auth.js loaded successfully - Full version with all features')

;