console.log('=== Profile Script Loading ===');

let isEditMode = false;
let pendingPostImage = null;
let currentUserId = null;
let pendingAnimalImages = [];
let pendingAnimalDocuments = [];

// Helper Functions
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `<span>${type === 'error' ? '❌' : '✅'}</span> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${type === 'error' ? 'linear-gradient(135deg, #ff6b6b, #ff4757)' : 'linear-gradient(135deg, #2e6b4e, #3c8d63)'};
        color: white;
        padding: 16px 28px;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 3000;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
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
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        }, 300);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#039;';
        return m;
    });
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

function previewPostImage(input, previewContainerId) {
    const container = document.getElementById(previewContainerId);
    if (!container) return;
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image too large! Max 5MB', 'error');
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';
        wrapper.style.marginTop = '12px';
        
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.maxHeight = '250px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '12px';
        img.style.border = '1px solid var(--border-light)';
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '8px';
        removeBtn.style.right = '8px';
        removeBtn.style.width = '30px';
        removeBtn.style.height = '30px';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.background = 'rgba(0,0,0,0.6)';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '20px';
        removeBtn.style.display = 'flex';
        removeBtn.style.alignItems = 'center';
        removeBtn.style.justifyContent = 'center';
        
        removeBtn.onclick = function(e) {
            e.stopPropagation();
            container.innerHTML = '';
            input.value = '';
            pendingPostImage = null;
            showToast('Image removed');
        };
        
        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        container.appendChild(wrapper);
        pendingPostImage = e.target.result;
        showToast('Image attached! Click + to post 📷');
    };
    reader.readAsDataURL(file);
}

function openLightbox(src) {
    const img = document.getElementById('lightboxImg');
    if (img) img.src = src;
    openModal('lightboxModal');
}

// Profile Data
let profileData = {
    id: null,
    name: '',
    bio: '',
    tags: [],
    contact: { email: '', phone: '', location: '' },
    stats: { connections: 0, litters: 0, rating: 0, followers: 0, following: 0 },
    profileImg: '',
    coverImg: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200'
};

let posts = [];
let animals = [];

// Messenger variables
let messengerContacts = [];
let messengerMessages = {};
let currentChatId = null;

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

async function loadProfile() {
    // --- FIX: always seed profileData from the authenticated user first ---
    const user = User.getUser();
    if (!user) return;

    currentUserId = user.id;

    // Immediately populate from the cached auth user so the name is never blank
    profileData.id         = user.id;
    profileData.name       = user.name || user.email || '';
    profileData.bio        = user.bio || '';
    profileData.tags       = user.tags || [];
    profileData.contact    = user.contact || { email: user.email || '', phone: '', location: '' };
    profileData.stats      = user.stats  || { connections: 0, litters: 0, rating: 0, followers: 0, following: 0 };
    profileData.profileImg = user.profilePicture || user.avatar || '';
    profileData.coverImg   = user.coverPhoto || 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200';

    // Render immediately with cached data so the page isn't blank
    updateProfileUI();
    updateContactDOM();

    // Then try to fetch fresher data from Supabase and overwrite
    try {
        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Profile fetch error:', error);
        }

        if (profile) {
            profileData.id         = profile.id;
            profileData.name       = profile.name       || user.name || user.email || '';
            profileData.bio        = profile.bio        || '';
            profileData.tags       = profile.tags       || [];
            profileData.contact    = profile.contact    || { email: user.email || '', phone: '', location: '' };
            profileData.stats      = profile.stats      || { connections: 0, litters: 0, rating: 0, followers: 0, following: 0 };
            profileData.profileImg = profile.profile_picture || user.profilePicture || user.avatar || '';
            profileData.coverImg   = profile.cover_photo || 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200';

            // Keep localStorage in sync
            if (typeof User !== 'undefined' && User.current) {
                User.current = { ...User.current, ...profileData };
                localStorage.setItem('breedlink_user', JSON.stringify(User.current));
            }

            updateProfileUI();
            updateContactDOM();
        }
    } catch (err) {
        console.error('loadProfile error:', err);
    }
}

function updateContactDOM() {
    const emailSpan = document.querySelector('#contactEmail span:last-child');
    const phoneSpan = document.querySelector('#contactPhone span:last-child');
    const locationSpan = document.querySelector('#contactLocation span:last-child');
    if (emailSpan) emailSpan.textContent = profileData.contact.email || '';
    if (phoneSpan) phoneSpan.textContent = profileData.contact.phone || '';
    if (locationSpan) locationSpan.textContent = profileData.contact.location || '';
}

async function loadPosts() {
    try {
        const { data, error } = await window.supabase
            .from('posts')
            .select(`
                *,
                profiles:user_id (name, profile_picture)
            `)
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        posts = (data || []).map(post => ({
            id: post.id,
            user_id: post.user_id,
            text: post.text,
            images: post.images || [],
            likes: post.likes || 0,
            liked: false,
            saved: false,
            comments: post.comments || [],
            created_at: post.created_at,
            author: post.profiles?.name || profileData.name,
            authorImg: post.profiles?.profile_picture || profileData.profileImg
        }));
        
        renderPosts();
    } catch (err) {
        console.error('loadPosts error:', err);
        posts = [];
        renderPosts();
    }
}

async function loadAnimals() {
    try {
        const { data, error } = await window.supabase
            .from('animals')
            .select('*')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        animals = data || [];
        renderAnimals();
        
        // Update litters count
        if (profileData.stats) {
            profileData.stats.litters = animals.length;
            updateProfileUI();
        }
    } catch (err) {
        console.error('loadAnimals error:', err);
        animals = [];
        renderAnimals();
    }
}

function updateProfileUI() {
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = profileData.name;
    
    const bioContent = document.getElementById('bioContent');
    if (bioContent) {
        if (profileData.bio) {
            bioContent.innerHTML = profileData.bio.split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('');
        } else {
            bioContent.innerHTML = '<p style="color:var(--text-muted);font-style:italic;">No bio yet.</p>';
        }
    }
    
    const connectionsCount = document.getElementById('connectionsCount');
    if (connectionsCount) connectionsCount.textContent = profileData.stats?.connections || 0;
    
    const littersCount = document.getElementById('littersCount');
    if (littersCount) littersCount.textContent = animals.length;
    
    const reviewsCount = document.getElementById('reviewsCount');
    if (reviewsCount) reviewsCount.textContent = profileData.stats?.rating || 0;
    
    const tagsContainer = document.getElementById('tagsContainer');
    if (tagsContainer) {
        tagsContainer.innerHTML = (profileData.tags || []).map(tag =>
            `<span class="tag">${escapeHtml(tag)} ${isEditMode ? '<span class="remove-tag" onclick="removeTag(this)">×</span>' : ''}</span>`
        ).join('') + (isEditMode ? '<button class="add-tag-btn" onclick="addNewTag()">➕ Add Tag</button>' : '');
    }
    
    document.querySelectorAll('.edit-name-btn, .edit-bio-btn, .edit-contact-btn, .add-animal-btn').forEach(btn => {
        if (btn) btn.style.display = isEditMode ? 'flex' : 'none';
    });
    
    const coverOverlay = document.querySelector('.cover-overlay');
    if (coverOverlay) coverOverlay.style.display = isEditMode ? 'flex' : 'none';
    
    const profileImgOverlay = document.querySelector('.profile-img-overlay');
    if (profileImgOverlay) profileImgOverlay.style.display = isEditMode ? 'flex' : 'none';
    
    const profileImg = document.getElementById('profileImg');
    if (profileImg) {
        profileImg.src = profileData.profileImg || 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png';
    }
    
    const coverPhoto = document.getElementById('coverPhoto');
    if (coverPhoto) coverPhoto.style.backgroundImage = `url('${profileData.coverImg}')`;
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 60px; text-align: center; color: var(--text-muted);">No posts yet. Share your first update! 🐾</div>';
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="post-card reveal" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${post.authorImg || profileData.profileImg}" alt="${escapeHtml(post.author)}" onerror="this.src='https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'">
                <div class="post-header-info">
                    <div class="post-author">${escapeHtml(post.author)}</div>
                    <div class="post-time">${formatDate(post.created_at)}</div>
                </div>
                ${isEditMode ? `<button class="post-menu" onclick="event.stopPropagation(); openPostMenu(${post.id})" style="display: flex !important;">⋮</button>` : ''}
            </div>
            <div class="post-text">${escapeHtml(post.text)}</div>
            ${post.images && post.images.length > 0 ? `
                <div class="post-images ${post.images.length === 1 ? 'single-image' : 'multiple-images'}">
                    ${post.images.map(img => `<img src="${img}" onclick="openLightbox('${img}')" loading="lazy">`).join('')}
                </div>
            ` : ''}
            <div class="post-meta">
                <span>${post.likes} likes • ${post.comments?.length || 0} comments</span>
            </div>
            <div class="post-actions">
                <button class="${post.liked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
                    <span>${post.liked ? '❤️' : '🤍'}</span> ${post.liked ? 'Liked' : 'Like'}
                </button>
                <button onclick="focusComment(${post.id})">💬 Comment</button>
                <button class="${post.saved ? 'saved' : ''}" onclick="toggleSave(${post.id})">
                    <span>${post.saved ? '🔖' : '📑'}</span> ${post.saved ? 'Saved' : 'Save'}
                </button>
                <button onclick="sharePost(${post.id})">🔗 Share</button>
            </div>
            <div class="comments-section">
                ${(post.comments || []).map(comment => `
                    <div class="comment" data-comment-id="${comment.id}">
                        <img src="${comment.authorImg || 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'}" onerror="this.src='https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'">
                        <div class="comment-content">
                            <span class="comment-author">${escapeHtml(comment.author)}</span>
                            <span class="comment-text">${escapeHtml(comment.text)}</span>
                        </div>
                        ${isEditMode ? `
                            <div class="comment-actions">
                                <button onclick="editComment(${post.id}, ${comment.id}, '${escapeHtml(comment.text).replace(/'/g, "\\'")}')">✏️</button>
                                <button onclick="deleteComment(${post.id}, ${comment.id})">🗑️</button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
                <div class="comment-box">
                    <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." onkeypress="if(event.key==='Enter') addComment(${post.id})">
                    <button onclick="addComment(${post.id})">Post</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAnimals() {
    const grid = document.getElementById('animalsGrid');
    if (!grid) return;
    
    if (animals.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No animals added yet. Click "Add Animal" to get started! 🐾</div>';
        return;
    }
    
    grid.innerHTML = animals.map(animal => `
        <div class="animal-card">
            <div class="animal-image-container" onclick="viewAnimal(${animal.id})">
                <img src="${animal.image_url || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'}" alt="${escapeHtml(animal.name)}" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'">
                <div class="view-overlay"><span class="view-text">👁️ View Profile</span></div>
            </div>
            ${isEditMode ? `
                <div class="animal-actions" onclick="event.stopPropagation()">
                    <button class="animal-btn view-btn" onclick="viewAnimal(${animal.id})">👁️</button>
                    <button class="animal-btn edit-btn" onclick="editAnimal(${animal.id})">✏️</button>
                    <button class="animal-btn delete-btn" onclick="deleteAnimal(${animal.id})">🗑️</button>
                </div>
            ` : ''}
            <div class="animal-info">
                <div class="animal-name">${escapeHtml(animal.name)}</div>
                <div class="animal-breed">${escapeHtml(animal.breed)}</div>
                <div class="animal-meta">
                    <span>${animal.gender === 'Male' ? '♂️' : '♀️'} ${escapeHtml(animal.age || 'Unknown')}</span>
                    <span class="animal-badge">${escapeHtml(animal.status || 'Available')}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================
// POST ACTIONS
// ============================================

async function addPost() {
    const statusInput = document.getElementById('statusInput');
    if (!statusInput) return;
    const text = statusInput.value.trim();
    
    if (text || pendingPostImage) {
        try {
            let imageUrl = null;
            if (pendingPostImage) {
                // Convert base64 to file and upload
                const blob = await (await fetch(pendingPostImage)).blob();
                const file = new File([blob], 'post-image.jpg', { type: 'image/jpeg' });
                imageUrl = await StorageAPI.uploadPostImage(file);
            }
            
            const images = imageUrl ? [imageUrl] : [];
            
            const { data, error } = await window.supabase
                .from('posts')
                .insert({
                    user_id: currentUserId,
                    text: text || '',
                    images: images,
                    likes: 0,
                    comments: []
                })
                .select();
            
            if (error) throw error;
            
            const newPost = {
                id: data[0].id,
                user_id: currentUserId,
                text: text || '',
                images: images,
                likes: 0,
                liked: false,
                saved: false,
                comments: [],
                created_at: new Date().toISOString(),
                author: profileData.name,
                authorImg: profileData.profileImg
            };
            
            posts.unshift(newPost);
            renderPosts();
            statusInput.value = '';
            pendingPostImage = null;
            const postImageInput = document.getElementById('postImageInput');
            if (postImageInput) postImageInput.value = '';
            const imagePreview = document.getElementById('postImagePreview');
            if (imagePreview) imagePreview.innerHTML = '';
            showToast('Post published! 📢');
            
            await User.logActivity('create_post', 'post', data[0].id, { text: text.substring(0, 100) });
        } catch (err) {
            console.error('addPost error:', err);
            showToast('Failed to create post', 'error');
        }
    } else {
        showToast('Please write something or attach an image', 'error');
    }
}

async function updatePostInSupabase(postId, updates) {
    const { error } = await window.supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .eq('user_id', currentUserId);
    
    if (error) throw error;
}

async function deletePostFromSupabase(postId) {
    const { error } = await window.supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', currentUserId);
    
    if (error) throw error;
}

async function toggleLike(postId) {
    const post = posts.find(p => p.id === postId);
    if (post) {
        const newLikes = (post.likes || 0) + (post.liked ? -1 : 1);
        try {
            await updatePostInSupabase(postId, { likes: newLikes });
            post.liked = !post.liked;
            post.likes = newLikes;
            renderPosts();
        } catch (err) {
            console.error('toggleLike error:', err);
        }
    }
}

async function toggleSave(postId) {
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.saved = !post.saved;
        renderPosts();
        showToast(post.saved ? 'Post saved! 🔖' : 'Post unsaved 📑');
        
        const savedPosts = JSON.parse(localStorage.getItem('saved_posts') || '[]');
        if (post.saved && !savedPosts.includes(postId)) {
            savedPosts.push(postId);
        } else if (!post.saved) {
            const index = savedPosts.indexOf(postId);
            if (index > -1) savedPosts.splice(index, 1);
        }
        localStorage.setItem('saved_posts', JSON.stringify(savedPosts));
    }
}

async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;
    const text = input.value.trim();
    
    if (text) {
        const post = posts.find(p => p.id === postId);
        if (post) {
            const newComment = {
                id: Date.now(),
                author: profileData.name,
                authorImg: profileData.profileImg,
                text: text,
                time: new Date().toISOString()
            };
            
            const updatedComments = [...(post.comments || []), newComment];
            
            try {
                await updatePostInSupabase(postId, { comments: updatedComments });
                post.comments = updatedComments;
                renderPosts();
                showToast('Comment added! 💬');
                input.value = '';
            } catch (err) {
                console.error('addComment error:', err);
            }
        }
    }
}

function openPostMenu(postId) {
    window.currentPostId = postId;
    openModal('postMenuModal');
}

function editCurrentPost() {
    const post = posts.find(p => p.id === window.currentPostId);
    if (post) {
        const editText = document.getElementById('editPostText');
        if (editText) editText.value = post.text;
        closeModal('postMenuModal');
        openModal('editPostModal');
    }
}

async function savePostEdit() {
    const newText = document.getElementById('editPostText');
    if (window.currentPostId && newText) {
        const post = posts.find(p => p.id === window.currentPostId);
        if (post) {
            try {
                await updatePostInSupabase(window.currentPostId, { text: newText.value.trim() || '' });
                post.text = newText.value.trim() || '';
                renderPosts();
                showToast('Post updated! ✏️');
                closeModal('editPostModal');
            } catch (err) {
                console.error('savePostEdit error:', err);
            }
        }
    }
}

async function deleteCurrentPost() {
    if (confirm('Are you sure you want to delete this post?')) {
        try {
            await deletePostFromSupabase(window.currentPostId);
            posts = posts.filter(p => p.id !== window.currentPostId);
            renderPosts();
            showToast('Post deleted 🗑️');
            closeModal('postMenuModal');
        } catch (err) {
            console.error('deleteCurrentPost error:', err);
        }
    }
}

function focusComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (input) input.focus();
}

function sharePost(postId) {
    const postLink = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(postLink);
    showToast('Link copied to clipboard! 🔗');
}

function editComment(postId, commentId, currentText) {
    window.currentComment = { postId, commentId };
    const editText = document.getElementById('editCommentText');
    if (editText) editText.value = currentText;
    openModal('commentEditModal');
}

async function saveCommentEdit() {
    if (!window.currentComment) return;
    const newText = document.getElementById('editCommentText');
    if (newText && newText.value.trim()) {
        const post = posts.find(p => p.id === window.currentComment.postId);
        if (post) {
            const updatedComments = (post.comments || []).map(c => {
                if (c.id === window.currentComment.commentId) {
                    return { ...c, text: newText.value.trim() };
                }
                return c;
            });
            
            try {
                await updatePostInSupabase(window.currentComment.postId, { comments: updatedComments });
                post.comments = updatedComments;
                renderPosts();
                showToast('Comment updated ✏️');
            } catch (err) {
                console.error('saveCommentEdit error:', err);
            }
        }
    }
    closeModal('commentEditModal');
    window.currentComment = null;
}

async function deleteComment(postId, commentId) {
    if (confirm('Delete this comment?')) {
        const post = posts.find(p => p.id === postId);
        if (post) {
            const updatedComments = (post.comments || []).filter(c => c.id !== commentId);
            try {
                await updatePostInSupabase(postId, { comments: updatedComments });
                post.comments = updatedComments;
                renderPosts();
                showToast('Comment deleted 🗑️');
            } catch (err) {
                console.error('deleteComment error:', err);
            }
        }
    }
}

// ============================================
// ANIMAL ACTIONS (WITH IMAGE AND DOCUMENT UPLOADS)
// ============================================

// Preview animal image
function previewAnimalImage(input, previewId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.style.backgroundImage = `url('${e.target.result}')`;
                preview.classList.add('has-image');
                preview.innerHTML = '';
                // Store the file for upload
                pendingAnimalImages = [file];
            }
        };
        reader.readAsDataURL(file);
    }
}

// Preview animal documents
function previewAnimalDocuments(input, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    pendingAnimalDocuments = Array.from(input.files);
    container.innerHTML = '';
    
    pendingAnimalDocuments.forEach((file, index) => {
        const docDiv = document.createElement('div');
        docDiv.className = 'document-preview-item';
        docDiv.innerHTML = `
            <div class="doc-icon">${file.type.includes('image') ? '🖼️' : '📄'}</div>
            <div class="doc-name">${escapeHtml(file.name)}</div>
            <button class="remove-doc-btn" onclick="this.parentElement.remove(); pendingAnimalDocuments.splice(${index}, 1)">×</button>
        `;
        container.appendChild(docDiv);
    });
}

async function saveAnimal() {
    const name = document.getElementById('animalName')?.value.trim();
    const breed = document.getElementById('animalBreed')?.value.trim();
    const gender = document.getElementById('animalGender')?.value;
    const age = document.getElementById('animalAge')?.value.trim();
    const status = document.getElementById('animalStatus')?.value.trim();
    const description = document.getElementById('animalDescription')?.value.trim();
    
    if (!name || !breed) {
        showToast('Please fill in Name and Breed!', 'error');
        return;
    }
    
    showToast('Uploading animal information...');
    
    try {
        let imageUrl = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400';
        
        // Upload animal image if provided
        if (pendingAnimalImages.length > 0) {
            imageUrl = await StorageAPI.uploadAnimalImage(pendingAnimalImages[0]);
        }
        
        // Upload documents if provided
        const uploadedDocuments = [];
        for (const doc of pendingAnimalDocuments) {
            const docData = await StorageAPI.uploadAnimalDocument(doc);
            uploadedDocuments.push(docData);
        }
        
        const { data, error } = await window.supabase
            .from('animals')
            .insert({
                user_id: currentUserId,
                name: name,
                breed: breed,
                gender: gender || 'Unknown',
                age: age || 'Unknown',
                status: status || 'Available',
                image_url: imageUrl,
                description: description || '',
                health_documents: uploadedDocuments
            })
            .select();
        
        if (error) throw error;
        
        const newAnimal = {
            id: data[0].id,
            user_id: currentUserId,
            name: name,
            breed: breed,
            gender: gender || 'Unknown',
            age: age || 'Unknown',
            status: status || 'Available',
            image_url: imageUrl,
            description: description || '',
            health_documents: uploadedDocuments
        };
        
        animals.unshift(newAnimal);
        renderAnimals();
        
        // Clear form
        document.getElementById('animalName').value = '';
        document.getElementById('animalBreed').value = '';
        document.getElementById('animalGender').value = '';
        document.getElementById('animalAge').value = '';
        document.getElementById('animalStatus').value = '';
        if (document.getElementById('animalDescription')) document.getElementById('animalDescription').value = '';
        
        const preview = document.getElementById('animalPreview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.classList.remove('has-image');
            preview.innerHTML = '<span>📤 Click to upload animal photo</span>';
        }
        
        const docPreview = document.getElementById('animalDocumentsPreview');
        if (docPreview) docPreview.innerHTML = '';
        
        pendingAnimalImages = [];
        pendingAnimalDocuments = [];
        
        showToast('Animal added successfully! 🐾');
        closeModal('animalModal');
        
        await User.logActivity('add_animal', 'animal', data[0].id, { name: name, breed: breed });
    } catch (err) {
        console.error('saveAnimal error:', err);
        showToast('Failed to add animal', 'error');
    }
}

async function deleteAnimal(id) {
    if (confirm('Are you sure you want to remove this animal?')) {
        try {
            // Get animal data first to delete images from storage
            const animal = animals.find(a => a.id === id);
            if (animal && animal.image_url && !animal.image_url.includes('unsplash.com')) {
                await StorageAPI.deleteFile(animal.image_url);
            }
            
            const { error } = await window.supabase
                .from('animals')
                .delete()
                .eq('id', id)
                .eq('user_id', currentUserId);
            
            if (error) throw error;
            
            animals = animals.filter(a => a.id !== id);
            renderAnimals();
            showToast('Animal removed 🗑️');
            
            await User.logActivity('delete_animal', 'animal', id, {});
        } catch (err) {
            console.error('deleteAnimal error:', err);
            showToast('Failed to delete animal', 'error');
        }
    }
}

function viewAnimal(animalId) {
    const animal = animals.find(a => a.id === animalId);
    if (!animal) return;
    
    const hasDocuments = animal.health_documents && animal.health_documents.length > 0;
    
    const content = document.getElementById('viewAnimalContent');
    content.innerHTML = `
        <div class="view-animal-content">
            <img src="${animal.image_url}" alt="${escapeHtml(animal.name)}" class="view-animal-image" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'">
            <div class="view-animal-name">${escapeHtml(animal.name)} ${animal.gender === 'Male' ? '♂️' : '♀️'}</div>
            <div class="view-animal-breed">${escapeHtml(animal.breed)}</div>
            <div class="view-animal-details">
                <div class="view-detail-item"><div class="view-detail-label">Age</div><div class="view-detail-value">${escapeHtml(animal.age)}</div></div>
                <div class="view-detail-item"><div class="view-detail-label">Status</div><div class="view-detail-value">${escapeHtml(animal.status)}</div></div>
                <div class="view-detail-item"><div class="view-detail-label">Owner</div><div class="view-detail-value">${escapeHtml(profileData.name)}</div></div>
            </div>
            ${animal.description ? `
                <div class="detail-section">
                    <h4>📝 Description</h4>
                    <p style="color: var(--text-secondary); line-height: 1.6;">${escapeHtml(animal.description)}</p>
                </div>
            ` : ''}
            ${hasDocuments ? `
                <div class="detail-section">
                    <h4>📋 Documents & Certificates</h4>
                    <div class="documents-list">
                        ${animal.health_documents.map(doc => `
                            <div class="document-item" onclick="window.open('${doc.url}', '_blank')">
                                <div class="document-icon">📄</div>
                                <div class="document-name">${escapeHtml(doc.name)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="view-modal-actions">
                <button class="btn-close-view" onclick="closeModal('viewAnimalModal')">Close</button>
                <button class="btn-edit" onclick="messageAboutAnimal(${animal.id})">💬 Message Owner</button>
            </div>
        </div>
    `;
    openModal('viewAnimalModal');
}

function messageAboutAnimal(animalId) {
    const animal = animals.find(a => a.id === animalId);
    if (animal && typeof window.openMessenger === 'function') {
        window.openMessenger();
    }
}

function editAnimal(animalId) {
    if (!isEditMode) {
        showToast('Please click Customize Profile first to edit', 'error');
        return;
    }
    showToast('Edit feature coming soon!', 'info');
}

// ============================================
// PROFILE EDIT FUNCTIONS
// ============================================

function enableEditMode() {
    isEditMode = true;
    updateProfileUI();
    renderPosts();
    renderAnimals();
    showToast('Edit mode enabled! You can now edit your posts and profile ✏️');
}

function openCoverModal() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    openModal('coverModal');
}

function openProfileModal() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    openModal('profileModal');
}

function editName() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    const nameInput = document.getElementById('nameInput');
    if (nameInput) nameInput.value = profileData.name;
    openModal('nameModal');
}

function editBio() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    const bioInput = document.getElementById('bioInput');
    if (bioInput) bioInput.value = profileData.bio;
    openModal('bioModal');
}

function addNewTag() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    openModal('tagModal');
}

function openAddAnimalModal() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    openModal('animalModal');
}

async function saveCover() {
    const coverInput = document.getElementById('coverInput');
    if (coverInput && coverInput.files && coverInput.files[0]) {
        const file = coverInput.files[0];
        showToast('Uploading cover photo...');
        
        try {
            const imageUrl = await StorageAPI.uploadCoverPhoto(file);
            
            await User.updateUser({ coverPhoto: imageUrl });
            await window.supabase
                .from('profiles')
                .update({ cover_photo: imageUrl })
                .eq('id', currentUserId);
            
            profileData.coverImg = imageUrl;
            updateProfileUI();
            showToast('Cover photo updated! 📸');
            closeModal('coverModal');
        } catch (err) {
            console.error('saveCover error:', err);
            showToast('Failed to update cover', 'error');
        }
    } else {
        showToast('Please select an image first', 'error');
    }
}

async function saveProfile() {
    const profileInput = document.getElementById('profileInput');
    if (profileInput && profileInput.files && profileInput.files[0]) {
        const file = profileInput.files[0];
        showToast('Uploading profile photo...');
        
        try {
            const imageUrl = await StorageAPI.uploadProfilePicture(file);
            
            await User.updateUser({ profilePicture: imageUrl });
            await window.supabase
                .from('profiles')
                .update({ profile_picture: imageUrl })
                .eq('id', currentUserId);
            
            profileData.profileImg = imageUrl;
            
            // Update posts author images
            posts.forEach(post => {
                if (post.author === profileData.name) {
                    post.authorImg = imageUrl;
                }
            });
            
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn) profileBtn.innerHTML = `<img src="${imageUrl}" alt="Profile">`;
            
            updateProfileUI();
            renderPosts();
            showToast('Profile photo updated! 👤');
            closeModal('profileModal');
        } catch (err) {
            console.error('saveProfile error:', err);
            showToast('Failed to update profile photo', 'error');
        }
    } else {
        showToast('Please select an image first', 'error');
    }
}

async function saveName() {
    const input = document.getElementById('nameInput');
    if (input && input.value.trim()) {
        try {
            await User.updateUser({ name: input.value.trim() });
            await window.supabase
                .from('profiles')
                .update({ name: input.value.trim() })
                .eq('id', currentUserId);
            
            profileData.name = input.value.trim();
            updateProfileUI();
            showToast('Name updated! ✏️');
            closeModal('nameModal');
        } catch (err) {
            showToast('Failed to update name', 'error');
        }
    }
}

async function saveBio() {
    const input = document.getElementById('bioInput');
    if (input && input.value.trim()) {
        try {
            await User.updateUser({ bio: input.value.trim() });
            await window.supabase
                .from('profiles')
                .update({ bio: input.value.trim() })
                .eq('id', currentUserId);
            
            profileData.bio = input.value.trim();
            updateProfileUI();
            showToast('Bio updated! 📝');
            closeModal('bioModal');
        } catch (err) {
            showToast('Failed to update bio', 'error');
        }
    }
}

async function saveTag() {
    const input = document.getElementById('tagInput');
    if (input && input.value.trim()) {
        const newTags = [...(profileData.tags || []), input.value.trim()];
        try {
            await User.updateUser({ tags: newTags });
            await window.supabase
                .from('profiles')
                .update({ tags: newTags })
                .eq('id', currentUserId);
            
            profileData.tags = newTags;
            updateProfileUI();
            input.value = '';
            showToast('Tag added! 🏷️');
            closeModal('tagModal');
        } catch (err) {
            showToast('Failed to add tag', 'error');
        }
    }
}

async function removeTag(element) {
    if (element && element.parentElement) {
        const tagText = element.parentElement.textContent.replace('×', '').trim();
        const newTags = (profileData.tags || []).filter(t => t !== tagText);
        try {
            await User.updateUser({ tags: newTags });
            await window.supabase
                .from('profiles')
                .update({ tags: newTags })
                .eq('id', currentUserId);
            
            profileData.tags = newTags;
            element.parentElement.remove();
            showToast('Tag removed 🗑️');
        } catch (err) {
            showToast('Failed to remove tag', 'error');
        }
    }
}

function openContactModal() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    const emailInput = document.getElementById('contactEmailInput');
    const phoneInput = document.getElementById('contactPhoneInput');
    const locationInput = document.getElementById('contactLocationInput');
    if (emailInput) emailInput.value = profileData.contact.email || '';
    if (phoneInput) phoneInput.value = profileData.contact.phone || '';
    if (locationInput) locationInput.value = profileData.contact.location || '';
    openModal('contactModal');
}

async function saveContact() {
    const email = document.getElementById('contactEmailInput')?.value.trim();
    const phone = document.getElementById('contactPhoneInput')?.value.trim();
    const location = document.getElementById('contactLocationInput')?.value.trim();
    
    if (!email || !phone || !location) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    const newContact = { email, phone, location };
    try {
        await User.updateUser({ contact: newContact });
        await window.supabase
            .from('profiles')
            .update({ contact: newContact })
            .eq('id', currentUserId);
        
        profileData.contact = newContact;
        updateContactDOM();
        showToast('Contact info updated! ✉️');
        closeModal('contactModal');
    } catch (err) {
        showToast('Failed to update contact', 'error');
    }
}

function showConnections() { showToast(`You have ${profileData.stats?.connections || 0} connections! 🤝`); }
function showLitters() { showToast(`Total animals: ${animals.length} 🐾`); }
function showReviews() { showToast(`Rating: ${profileData.stats?.rating || 0} ⭐ from verified breeders`); }

function showBioModal() {
    const bioContent = document.getElementById('bioContent');
    if (bioContent) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <button class="modal-close" onclick="this.closest('.modal').remove(); document.body.style.overflow = '';">×</button>
                <h3>📝 About Me</h3>
                <div style="line-height: 1.8; color: var(--text-primary);">${bioContent.innerHTML}</div>
                <div class="modal-buttons" style="margin-top: 20px;">
                    <button class="cancel-btn" onclick="this.closest('.modal').remove(); document.body.style.overflow = '';">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }
}

// ============================================
// MESSENGER FUNCTIONS
// ============================================

async function loadConversations() {
    if (!currentUserId) return;
    
    try {
        const { data: matches, error } = await window.supabase
            .from('matches')
            .select(`
                *,
                matched_user:matched_user_id (id, name, profile_picture)
            `)
            .eq('user_id', currentUserId)
            .eq('status', 'matched')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const contactMap = new Map();
        
        for (const match of matches || []) {
            const otherUser = match.matched_user;
            if (otherUser && otherUser.id !== currentUserId) {
                if (!contactMap.has(otherUser.id)) {
                    contactMap.set(otherUser.id, {
                        id: otherUser.id,
                        name: otherUser.name || 'User',
                        avatar: otherUser.profile_picture || 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png',
                        lastMessage: '',
                        time: '',
                        unread: 0
                    });
                }
            }
        }
        
        messengerContacts = Array.from(contactMap.values());
        renderContactsList();
    } catch (err) {
        console.error('loadConversations error:', err);
    }
}

async function loadMessages(contactId) {
    try {
        const { data, error } = await window.supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${currentUserId})`)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        messengerMessages[contactId] = (data || []).map(msg => ({
            id: msg.id,
            sender: msg.sender_id === currentUserId ? 'me' : 'them',
            text: msg.text,
            image: msg.image_url,
            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        
        renderMessages(contactId);
        
        // Mark as read
        await window.supabase
            .from('messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('receiver_id', currentUserId)
            .eq('sender_id', contactId);
        
    } catch (err) {
        console.error('loadMessages error:', err);
    }
}

async function sendMessageToApi(contactId, text, file) {
    let imageUrl = null;
    
    if (file) {
        showToast('Uploading image...');
        imageUrl = await StorageAPI.uploadMessageImage(file);
    }
    
    await saveMessage(contactId, text, imageUrl);
}

async function saveMessage(contactId, text, imageUrl) {
    try {
        const { data, error } = await window.supabase
            .from('messages')
            .insert({
                sender_id: currentUserId,
                receiver_id: contactId,
                text: text || '',
                image_url: imageUrl,
                is_read: false
            })
            .select();
        
        if (error) throw error;
        
        if (!messengerMessages[contactId]) messengerMessages[contactId] = [];
        
        messengerMessages[contactId].push({
            id: data[0].id,
            sender: 'me',
            text: text || '',
            image: imageUrl,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        
        renderMessages(contactId);
        
        // Create notification for receiver
        await window.supabase
            .from('notifications')
            .insert({
                user_id: contactId,
                type: 'message',
                reference_id: data[0].id,
                title: 'New Message',
                message: `${profileData.name} sent you a message`
            });
        
        if (imageUrl) showToast('Image sent! 📷');
        
    } catch (err) {
        console.error('saveMessage error:', err);
        showToast('Failed to send message', 'error');
    }
}

function openMessenger() {
    const overlay = document.getElementById('messengerOverlay');
    if (overlay) {
        overlay.classList.add('active');
        document.getElementById('messengerContacts').classList.add('active');
        document.getElementById('messengerEmpty').classList.remove('hidden');
        document.getElementById('messengerChat').classList.remove('active');
        loadConversations();
    }
}

function closeMessenger() {
    const overlay = document.getElementById('messengerOverlay');
    if (overlay) overlay.classList.remove('active');
    currentChatId = null;
}

function renderContactsList() {
    const container = document.getElementById('contactsListContainer');
    if (!container) return;
    
    if (messengerContacts.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px;">No conversations yet. Start swiping to find matches!</div>';
        return;
    }
    
    container.innerHTML = messengerContacts.map(contact => `
        <div class="contact-item" onclick="startChat(${contact.id})">
            <img src="${contact.avatar}" alt="${contact.name}" onerror="this.src='https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'">
            <div class="contact-info">
                <div class="contact-name">${escapeHtml(contact.name)}</div>
                <div class="contact-preview">${escapeHtml(contact.lastMessage) || 'Start a conversation'}</div>
            </div>
            <div class="contact-meta">
                <div class="contact-time">${contact.time}</div>
                ${contact.unread > 0 ? `<div class="unread-badge">${contact.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

async function startChat(contactId) {
    currentChatId = contactId;
    const contact = messengerContacts.find(c => c.id === contactId);
    if (!contact) return;
    
    document.getElementById('messengerContacts').classList.remove('active');
    document.getElementById('messengerEmpty').classList.add('hidden');
    document.getElementById('messengerChat').classList.add('active');
    document.getElementById('chatHeaderAvatar').src = contact.avatar;
    document.getElementById('chatHeaderName').textContent = contact.name;
    
    await loadMessages(contactId);
    contact.unread = 0;
    renderContactsList();
}

function closeChat() {
    document.getElementById('messengerContacts').classList.add('active');
    document.getElementById('messengerEmpty').classList.remove('hidden');
    document.getElementById('messengerChat').classList.remove('active');
    currentChatId = null;
    renderContactsList();
}

function renderMessages(contactId) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const messages = messengerMessages[contactId] || [];
    
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px;">Start a conversation! Say hello 👋</div>';
    } else {
        container.innerHTML = messages.map(msg => {
            if (msg.image) {
                return `
                    <div class="message ${msg.sender === 'me' ? 'sent' : 'received'}">
                        <div class="message-bubble"><img src="${msg.image}" style="max-width: 200px; border-radius: 12px;" onclick="openLightbox('${msg.image}')"></div>
                    </div>
                `;
            }
            return `
                <div class="message ${msg.sender === 'me' ? 'sent' : 'received'}">
                    <div class="message-bubble">${escapeHtml(msg.text)}</div>
                </div>
            `;
        }).join('');
    }
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input || !currentChatId) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    await sendMessageToApi(currentChatId, text, null);
}

function handleMessageInput(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

async function sendImage(fileInput) {
    const file = fileInput.files[0];
    if (!file || !currentChatId) return;
    await sendMessageToApi(currentChatId, null, file);
    fileInput.value = '';
}

function searchContacts(query) {
    const container = document.getElementById('contactsListContainer');
    if (!container) return;
    
    const filtered = messengerContacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">No contacts found</div>';
        return;
    }
    
    container.innerHTML = filtered.map(contact => `
        <div class="contact-item" onclick="startChat(${contact.id})">
            <img src="${contact.avatar}" alt="${contact.name}">
            <div class="contact-info">
                <div class="contact-name">${escapeHtml(contact.name)}</div>
                <div class="contact-preview">${escapeHtml(contact.lastMessage)}</div>
            </div>
            <div class="contact-meta">
                <div class="contact-time">${contact.time}</div>
                ${contact.unread > 0 ? `<div class="unread-badge">${contact.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

// ============================================
// INITIALIZATION
// ============================================

function setupEventListeners() {
    const postImageInput = document.getElementById('postImageInput');
    if (postImageInput) {
        postImageInput.addEventListener('change', function(e) {
            previewPostImage(e.target, 'postImagePreview');
        });
    }
    
    const animalImageInput = document.getElementById('animalInput');
    if (animalImageInput) {
        animalImageInput.addEventListener('change', function(e) {
            previewAnimalImage(e.target, 'animalPreview');
        });
    }
    
    const animalDocsInput = document.getElementById('animalDocuments');
    if (animalDocsInput) {
        animalDocsInput.addEventListener('change', function(e) {
            previewAnimalDocuments(e.target, 'animalDocumentsPreview');
        });
    }
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeModal(this.id);
        });
    });
    
    const lightboxModal = document.getElementById('lightboxModal');
    if (lightboxModal) {
        lightboxModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal('lightboxModal');
                document.body.style.overflow = '';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    if (!User.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    await loadProfile();
    await loadPosts();
    await loadAnimals();
    
    const urlParams = new URLSearchParams(window.location.search);
    const enableEdit = urlParams.get('edit') === 'true' || sessionStorage.getItem('enableEdit') === 'true';
    if (enableEdit) {
        enableEditMode();
        sessionStorage.removeItem('enableEdit');
    }
    
    setupEventListeners();
    
    // Check for pending chat
    const pendingChat = sessionStorage.getItem('chatWith');
    if (pendingChat) {
        const chatData = JSON.parse(pendingChat);
        sessionStorage.removeItem('pendingChat');
        setTimeout(() => {
            openMessenger();
            setTimeout(() => {
                startChat(chatData.id);
            }, 500);
        }, 500);
    }
});

// ============================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================

window.openModal = openModal;
window.closeModal = closeModal;
window.previewImage = previewImage;
window.previewPostImage = previewPostImage;
window.previewAnimalImage = previewAnimalImage;
window.previewAnimalDocuments = previewAnimalDocuments;
window.openLightbox = openLightbox;
window.viewAnimal = viewAnimal;
window.editAnimal = editAnimal;
window.deleteAnimal = deleteAnimal;
window.saveAnimal = saveAnimal;
window.openAddAnimalModal = openAddAnimalModal;
window.openCoverModal = openCoverModal;
window.openProfileModal = openProfileModal;
window.editName = editName;
window.editBio = editBio;
window.addNewTag = addNewTag;
window.saveCover = saveCover;
window.saveProfile = saveProfile;
window.saveName = saveName;
window.saveBio = saveBio;
window.saveTag = saveTag;
window.removeTag = removeTag;
window.saveContact = saveContact;
window.openContactModal = openContactModal;
window.addPost = addPost;
window.openPostMenu = openPostMenu;
window.editCurrentPost = editCurrentPost;
window.savePostEdit = savePostEdit;
window.deleteCurrentPost = deleteCurrentPost;
window.toggleLike = toggleLike;
window.toggleSave = toggleSave;
window.addComment = addComment;
window.focusComment = focusComment;
window.sharePost = sharePost;
window.editComment = editComment;
window.saveCommentEdit = saveCommentEdit;
window.deleteComment = deleteComment;
window.enableEditMode = enableEditMode;
window.showConnections = showConnections;
window.showBioModal = showBioModal;
window.showLitters = showLitters;
window.showReviews = showReviews;
window.messageAboutAnimal = messageAboutAnimal;
window.openMessenger = openMessenger;
window.closeMessenger = closeMessenger;
window.startChat = startChat;
window.closeChat = closeChat;
window.sendMessage = sendMessage;
window.handleMessageInput = handleMessageInput;
window.sendImage = sendImage;
window.searchContacts = searchContacts;
