console.log('=== Profile Script Loading ===');

let isEditMode = false;
let pendingPostImage = null;
let currentUserId = null;
let currentPostId = null;
let currentAnimalId = null;
let currentComment = null;
let pendingAnimalImages = [];
let pendingAnimalDocuments = [];

console.log('Profile script ready');

// Profile Data
let profileData = {
    id: null,
    name: '',
    bio: '',
    tags: [],
    contact: { email: '', phone: '', location: '' },
    stats: { connections: 0, litters: 0, rating: 0, followers: 0, following: 0 },
    profileImg: 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png',
    coverImg: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200'
};

let posts = [];
let animals = [];

// Messenger variables
let messengerContacts = [];
let messengerMessages = {};
let currentChatId = null;

// ============================================
// HELPER FUNCTIONS
// ============================================
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
        removeBtn.style.transition = 'all 0.2s';
        
        removeBtn.onmouseover = function() {
            this.style.background = 'rgba(255,0,0,0.8)';
            this.style.transform = 'scale(1.1)';
        };
        removeBtn.onmouseout = function() {
            this.style.background = 'rgba(0,0,0,0.6)';
            this.style.transform = 'scale(1)';
        };
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
                pendingAnimalImages = [file];
            }
        };
        reader.readAsDataURL(file);
    }
}

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

function previewMultipleFiles(input, containerId, type) {
    const container = document.getElementById(containerId);
    if (!container || !input.files) return;
    
    Array.from(input.files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'document-preview-item';
            
            if (type === 'image') {
                itemDiv.style.backgroundImage = `url('${e.target.result}')`;
                itemDiv.innerHTML = `<button class="remove-doc-btn" data-index="${index}">×</button>`;
            } else {
                itemDiv.innerHTML = `
                    <div class="doc-icon">📄</div>
                    <div class="doc-name">${escapeHtml(file.name)}</div>
                    <button class="remove-doc-btn" data-index="${index}">×</button>
                `;
            }
            container.appendChild(itemDiv);
        };
        reader.readAsDataURL(file);
    });
}

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

async function loadProfile() {
    let user = User.getUser();

    // If no valid user or user.id is missing, try refreshing from Supabase
    if (!user || !user.id) {
        user = await User.getFreshUser();
    }

    if (!user || !user.id) return;
    
    currentUserId = user.id;
    
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
            profileData.id = profile.id;
            profileData.name = profile.name || user.name;
            profileData.bio = profile.bio || '';
            profileData.tags = profile.tags || [];
            profileData.contact = profile.contact || { email: user.email, phone: '', location: '' };
            profileData.stats = profile.stats || { connections: 0, litters: 0, rating: 0, followers: 0, following: 0 };
            profileData.profileImg = profile.profile_picture || user.avatar;
            profileData.coverImg = profile.cover_photo || 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200';
        } else {
            profileData.name = user.name;
            profileData.contact.email = user.email;
            profileData.profileImg = user.avatar;
        }
        
        if (typeof User !== 'undefined' && User.current) {
            // Only merge profile display fields — NEVER overwrite id, email, or auth tokens
            User.current.name = profileData.name || User.current.name;
            User.current.bio = profileData.bio;
            User.current.tags = profileData.tags;
            User.current.contact = profileData.contact;
            User.current.stats = profileData.stats;
            User.current.avatar = profileData.profileImg || User.current.avatar;
            User.current.coverPhoto = profileData.coverImg || User.current.coverPhoto;
            // Preserve id — never let profileData.id (which defaults to null) overwrite it
            localStorage.setItem('breedlink_user', JSON.stringify(User.current));
        }
        
        updateProfileUI();
        updateContactDOM();
        
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn && profileData.profileImg) {
            profileBtn.innerHTML = `<img src="${profileData.profileImg}" alt="${profileData.name}">`;
        }
        
        // Re-sync nav — ensures login/signup buttons are hidden if user is authenticated
        if (typeof updateNavForAuthStatus === 'function') updateNavForAuthStatus();
        
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

        // Fetch which posts current user already liked — isolated so it never kills posts load
        const postIds = (data || []).map(p => String(p.id));
        let likedPostIds = new Set();
        try {
            if (postIds.length > 0) {
                const { data: likeRows } = await window.supabase
                    .from('likes')
                    .select('post_id')
                    .eq('user_id', currentUserId)
                    .in('post_id', postIds);
                likedPostIds = new Set((likeRows || []).map(l => String(l.post_id)));
            }
        } catch (likeErr) {
            console.warn('Could not load likes (non-fatal):', likeErr);
        }
        
        posts = (data || []).map(post => ({
            id: post.id,
            user_id: post.user_id,
            text: post.text,
            images: post.images || [],
            likes: post.likes || 0,
            liked: likedPostIds.has(String(post.id)),
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

// ============================================
// UI RENDERING FUNCTIONS
// ============================================

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
        bioContent.style.maxWidth = '100%';
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
    
    const editNameBtn = document.querySelector('.edit-name-btn');
    const editBioBtn = document.querySelector('.edit-bio-btn');
    const editContactBtn = document.querySelector('.edit-contact-btn');
    const addAnimalBtn = document.querySelector('.add-animal-btn');
    
    if (editNameBtn) editNameBtn.style.display = isEditMode ? 'inline-flex' : 'none';
    if (editBioBtn) editBioBtn.style.display = isEditMode ? 'inline-flex' : 'none';
    if (editContactBtn) editContactBtn.style.display = isEditMode ? 'inline-flex' : 'none';
    if (addAnimalBtn) addAnimalBtn.style.display = isEditMode ? 'inline-flex' : 'none';
    
    const coverOverlay = document.querySelector('.cover-overlay');
    if (coverOverlay) coverOverlay.style.display = isEditMode ? 'flex' : 'none';
    
    // Toggle edit-mode class on container — CSS handles overlay visibility
    const profileImgContainer = document.querySelector('.profile-img-container');
    if (profileImgContainer) {
        if (isEditMode) profileImgContainer.classList.add('edit-mode');
        else profileImgContainer.classList.remove('edit-mode');
    }
    
    const profileImg = document.getElementById('profileImg');
    if (profileImg && profileData.profileImg) {
        profileImg.src = profileData.profileImg;
        profileImg.onerror = function() {
            this.src = 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png';
        };
    }
    
    const coverPhoto = document.getElementById('coverPhoto');
    if (coverPhoto) coverPhoto.style.backgroundImage = `url('${profileData.coverImg}')`;
    
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn && profileData.profileImg) {
        profileBtn.innerHTML = `<img src="${profileData.profileImg}" alt="${profileData.name}">`;
    }
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
                <div style="font-size: 40px; margin-bottom: 12px;">🐾</div>
                <p style="font-size: 14px;">No posts yet. Share your first update!</p>
            </div>`;
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${post.authorImg || profileData.profileImg}" alt="${escapeHtml(post.author)}"
                     onerror="this.src='https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'"
                     onclick="openBreederProfile('${post.user_id}')" style="cursor:pointer;" title="View profile">
                <div class="post-header-info" onclick="openBreederProfile('${post.user_id}')" style="cursor:pointer;">
                    <div class="post-author">${escapeHtml(post.author)}</div>
                    <div class="post-time">${formatDate(post.created_at)}</div>
                </div>
                ${isEditMode ? `<button class="post-menu" onclick="event.stopPropagation(); openPostMenu(${post.id})" style="display: flex !important;">⋮</button>` : ''}
            </div>
            ${post.text ? `<div class="post-text">${escapeHtml(post.text)}</div>` : ''}
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
                        <img src="${comment.authorImg || profileData.profileImg}" onerror="this.src='https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'" onclick="openBreederProfile('${comment.user_id}')" style="cursor:pointer;" title="View profile">
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
        showToast('Publishing post...');
        
        try {
            // Recover currentUserId if it got lost
            if (!currentUserId) {
                const u = User.getUser() || await User.getFreshUser();
                if (u && u.id) currentUserId = u.id;
            }
            if (!currentUserId) {
                showToast('Please log in to post', 'error');
                return;
            }
            let imageUrl = null;
            if (pendingPostImage) {
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
            
            // Reload from DB to get the real persisted post with proper id
            await loadPosts();
            statusInput.value = '';
            pendingPostImage = null;
            const postImageInput = document.getElementById('postImageInput');
            if (postImageInput) postImageInput.value = '';
            const imagePreview = document.getElementById('postImagePreview');
            if (imagePreview) imagePreview.innerHTML = '';
            showToast('Post published! 📢');
        } catch (err) {
            console.error('addPost error:', err);
            showToast('Failed to create post: ' + err.message, 'error');
        }
    } else {
        showToast('Please write something or attach an image', 'error');
    }
}

// For owner-only edits (text, delete) — enforced by RLS on user_id
async function updatePostInSupabase(postId, updates) {
    const { error } = await window.supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .eq('user_id', currentUserId);
    
    if (error) throw error;
}

// For public interactions (likes, comments) — only filters by post id, RLS handles the rest
async function updatePostPublic(postId, updates) {
    const { error } = await window.supabase
        .from('posts')
        .update(updates)
        .eq('id', postId);
    
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
    if (!post) return;
    try {
        if (post.liked) {
            // Unlike: remove from likes table
            await window.supabase
                .from('likes')
                .delete()
                .eq('user_id', currentUserId)
                .eq('post_id', postId);
            await updatePostPublic(postId, { likes: Math.max(0, (post.likes || 1) - 1) });
            post.liked = false;
            post.likes = Math.max(0, (post.likes || 1) - 1);
        } else {
            // Like: insert (UNIQUE constraint blocks duplicates)
            const { error } = await window.supabase
                .from('likes')
                .insert({ user_id: currentUserId, post_id: postId });
            if (error) {
                if (error.code === '23505') { post.liked = true; renderPosts(); return; }
                throw error;
            }
            await updatePostPublic(postId, { likes: (post.likes || 0) + 1 });
            post.liked = true;
            post.likes = (post.likes || 0) + 1;
        }
        renderPosts();
    } catch (err) {
        console.error('toggleLike error:', err);
        showToast('Failed to update like', 'error');
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
                user_id: currentUserId,
                author: profileData.name,
                authorImg: profileData.profileImg,
                text: text,
                time: new Date().toISOString()
            };
            
            const updatedComments = [...(post.comments || []), newComment];
            
            try {
                await updatePostPublic(postId, { comments: updatedComments });
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
    currentPostId = postId;
    openModal('postMenuModal');
}

function editCurrentPost() {
    const post = posts.find(p => p.id === currentPostId);
    if (post) {
        const editText = document.getElementById('editPostText');
        if (editText) editText.value = post.text;
        closeModal('postMenuModal');
        openModal('editPostModal');
    }
}

async function savePostEdit() {
    const newText = document.getElementById('editPostText');
    if (currentPostId && newText) {
        const post = posts.find(p => p.id === currentPostId);
        if (post) {
            try {
                await updatePostInSupabase(currentPostId, { text: newText.value.trim() || '' });
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
            await deletePostFromSupabase(currentPostId);
            posts = posts.filter(p => p.id !== currentPostId);
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
    currentComment = { postId, commentId };
    const editText = document.getElementById('editCommentText');
    if (editText) editText.value = currentText;
    openModal('commentEditModal');
}

async function saveCommentEdit() {
    if (!currentComment) return;
    const newText = document.getElementById('editCommentText');
    if (newText && newText.value.trim()) {
        const post = posts.find(p => p.id === currentComment.postId);
        if (post) {
            const updatedComments = (post.comments || []).map(c => {
                if (c.id === currentComment.commentId) {
                    return { ...c, text: newText.value.trim() };
                }
                return c;
            });
            
            try {
                await updatePostInSupabase(currentComment.postId, { comments: updatedComments });
                post.comments = updatedComments;
                renderPosts();
                showToast('Comment updated ✏️');
            } catch (err) {
                console.error('saveCommentEdit error:', err);
            }
        }
    }
    closeModal('commentEditModal');
    currentComment = null;
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
// ANIMAL ACTIONS
// ============================================

async function saveAnimal() {
    const name = document.getElementById('animalName')?.value.trim();
    const breed = document.getElementById('animalBreed')?.value.trim();
    const gender = document.getElementById('animalGender')?.value;
    const age = document.getElementById('animalAge')?.value.trim();
    const status = document.getElementById('animalStatus')?.value.trim();
    const description = document.getElementById('animalDescription')?.value.trim();
    const animalImageInput = document.getElementById('animalInput');
    const animalDocsInput = document.getElementById('animalDocuments');
    
    if (!name || !breed) {
        showToast('Please fill in Name and Breed!', 'error');
        return;
    }
    
    showToast('Uploading animal information...');
    
    try {
        let imageUrl = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400';
        
        if (animalImageInput && animalImageInput.files && animalImageInput.files[0]) {
            imageUrl = await StorageAPI.uploadAnimalImage(animalImageInput.files[0]);
        }
        
        const uploadedDocuments = [];
        if (animalDocsInput && animalDocsInput.files) {
            for (const doc of animalDocsInput.files) {
                const docData = await StorageAPI.uploadAnimalDocument(doc);
                uploadedDocuments.push(docData);
            }
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
        
        // Reload animals from DB to get the real id
        await loadAnimals();
        
        document.getElementById('animalName').value = '';
        document.getElementById('animalBreed').value = '';
        document.getElementById('animalGender').value = '';
        document.getElementById('animalAge').value = '';
        document.getElementById('animalStatus').value = '';
        document.getElementById('animalDescription').value = '';
        
        const preview = document.getElementById('animalPreview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.classList.remove('has-image');
            preview.innerHTML = '<span>📤 Click to upload animal photo</span>';
        }
        
        const docPreview = document.getElementById('animalDocumentsPreview');
        if (docPreview) docPreview.innerHTML = '';
        
        if (animalImageInput) animalImageInput.value = '';
        if (animalDocsInput) animalDocsInput.value = '';
        
        pendingAnimalImages = [];
        pendingAnimalDocuments = [];
        
        showToast('Animal added successfully! 🐾');
        closeModal('animalModal');
    } catch (err) {
        console.error('saveAnimal error:', err);
        showToast('Failed to add animal: ' + err.message, 'error');
    }
}

async function deleteAnimal(id) {
    if (confirm('Are you sure you want to remove this animal?')) {
        try {
            const { error } = await window.supabase
                .from('animals')
                .delete()
                .eq('id', id)
                .eq('user_id', currentUserId);
            
            if (error) throw error;
            
            animals = animals.filter(a => a.id !== id);
            renderAnimals();
            showToast('Animal removed 🗑️');
        } catch (err) {
            console.error('deleteAnimal error:', err);
            showToast('Failed to delete animal', 'error');
        }
    }
}

function viewAnimal(animalId) {
    const animal = animals.find(a => a.id === animalId);
    if (!animal) return;
    
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
            ${animal.health_documents && animal.health_documents.length > 0 ? `
                <div class="detail-section">
                    <h4>📋 Health Documents</h4>
                    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                        ${animal.health_documents.map(doc => `
                            <a href="${doc.url || doc}" target="_blank" rel="noopener"
                               style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--green-light);color:var(--green-primary);border-radius:50px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid var(--green-primary);transition:all 0.2s;"
                               onmouseover="this.style.background='var(--green-primary)';this.style.color='white';"
                               onmouseout="this.style.background='var(--green-light)';this.style.color='var(--green-primary)';">
                                ${(doc.type && doc.type.includes('image')) ? '🖼️' : '📄'} ${escapeHtml(doc.name || 'Document')}
                            </a>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            ${animal.description ? `
                <div class="detail-section">
                    <h4>📝 Description</h4>
                    <p style="color: var(--text-secondary); line-height: 1.6;">${escapeHtml(animal.description)}</p>
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
    currentAnimalId = animalId;
    const animal = animals.find(a => a.id === animalId);
    if (!animal) return;
    
    const content = document.getElementById('animalDetailContent');
    const title = document.getElementById('animalDetailTitle');
    title.innerText = `✏️ Edit ${animal.name}`;
    
    content.innerHTML = `
        <div class="animal-detail-grid">
            <div class="animal-detail-item"><label>Name *</label><input type="text" id="edit_name" value="${escapeHtml(animal.name)}"></div>
            <div class="animal-detail-item"><label>Breed *</label><input type="text" id="edit_breed" value="${escapeHtml(animal.breed)}"></div>
            <div class="animal-detail-item"><label>Gender</label>
                <select id="edit_gender">
                    <option value="Male" ${animal.gender === 'Male' ? 'selected' : ''}>♂️ Male</option>
                    <option value="Female" ${animal.gender === 'Female' ? 'selected' : ''}>♀️ Female</option>
                </select>
            </div>
            <div class="animal-detail-item"><label>Age</label><input type="text" id="edit_age" value="${escapeHtml(animal.age)}"></div>
            <div class="animal-detail-item"><label>Status</label><input type="text" id="edit_status" value="${escapeHtml(animal.status)}"></div>
            <div class="animal-detail-item"><label>Description</label><textarea id="edit_description" rows="3">${escapeHtml(animal.description || '')}</textarea></div>
        </div>
        <div class="image-upload-group">
            <label>Animal Photo</label>
            <div class="image-preview-small" id="edit_imagePreview" style="background-image: url('${animal.image_url}');" onclick="document.getElementById('edit_imageInput').click()">
                <span>📷 Change</span>
            </div>
            <input type="file" id="edit_imageInput" accept="image/*" style="display: none;">
        </div>
    `;
    openModal('animalDetailModal');
}

async function saveAnimalDetails() {
    const animal = animals.find(a => a.id === currentAnimalId);
    if (!animal) return;
    
    const name = document.getElementById('edit_name')?.value.trim();
    const breed = document.getElementById('edit_breed')?.value.trim();
    
    if (!name || !breed) {
        showToast('Name and breed are required!', 'error');
        return;
    }
    
    animal.name = name;
    animal.breed = breed;
    animal.gender = document.getElementById('edit_gender')?.value || animal.gender;
    animal.age = document.getElementById('edit_age')?.value.trim() || animal.age;
    animal.status = document.getElementById('edit_status')?.value.trim() || animal.status;
    animal.description = document.getElementById('edit_description')?.value.trim() || '';
    
    const imgInput = document.getElementById('edit_imageInput');
    if (imgInput && imgInput.files && imgInput.files[0]) {
        const file = imgInput.files[0];
        const imageUrl = await StorageAPI.uploadAnimalImage(file);
        animal.image_url = imageUrl;
    }
    
    try {
        await window.supabase
            .from('animals')
            .update({
                name: animal.name,
                breed: animal.breed,
                gender: animal.gender,
                age: animal.age,
                status: animal.status,
                description: animal.description,
                image_url: animal.image_url
            })
            .eq('id', currentAnimalId)
            .eq('user_id', currentUserId);
        
        renderAnimals();
        showToast('Animal updated successfully! 🐾');
        closeModal('animalDetailModal');
    } catch (err) {
        console.error('saveAnimalDetails error:', err);
        showToast('Failed to update animal', 'error');
    }
}

// ============================================
// PROFILE EDIT FUNCTIONS
// ============================================

function enableEditMode() {
    isEditMode = true;
    updateProfileUI();
    renderPosts();
    renderAnimals();
    showToast('Edit mode enabled! You can now edit your profile ✏️');
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

function openContactModal() {
    if (!isEditMode) { showToast('Please click Customize Profile first to edit', 'error'); return; }
    openModal('contactModal');
}

async function saveCover() {
    const coverInput = document.getElementById('coverInput');
    if (coverInput && coverInput.files && coverInput.files[0]) {
        const file = coverInput.files[0];
        showToast('Uploading cover photo...');
        try {
            const imageUrl = await StorageAPI.uploadCoverPhoto(file);
            await User.updateUser({ coverPhoto: imageUrl });
            profileData.coverImg = imageUrl;
            updateProfileUI();
            showToast('Cover photo updated!');
            closeModal('coverModal');
        } catch (err) {
            console.error('saveCover error:', err);
            showToast('Failed to update cover: ' + err.message, 'error');
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
            profileData.profileImg = imageUrl;
            posts.forEach(post => {
                if (post.author === profileData.name) post.authorImg = imageUrl;
            });
            updateProfileUI();
            renderPosts();
            showToast('Profile photo updated!');
            closeModal('profileModal');
        } catch (err) {
            console.error('saveProfile error:', err);
            showToast('Failed to update profile photo: ' + err.message, 'error');
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
            profileData.name = input.value.trim();
            updateProfileUI();
            showToast('Name updated! ✏️');
            closeModal('nameModal');
        } catch (err) {
            showToast('Failed to update name: ' + err.message, 'error');
        }
    }
}

async function saveBio() {
    const input = document.getElementById('bioInput');
    if (input && input.value.trim()) {
        try {
            await User.updateUser({ bio: input.value.trim() });
            profileData.bio = input.value.trim();
            updateProfileUI();
            showToast('Bio updated! 📝');
            closeModal('bioModal');
        } catch (err) {
            showToast('Failed to update bio: ' + err.message, 'error');
        }
    }
}

async function saveTag() {
    const input = document.getElementById('tagInput');
    if (input && input.value.trim()) {
        const newTags = [...(profileData.tags || []), input.value.trim()];
        try {
            await User.updateUser({ tags: newTags });
            profileData.tags = newTags;
            updateProfileUI();
            input.value = '';
            showToast('Tag added! 🏷️');
            closeModal('tagModal');
        } catch (err) {
            showToast('Failed to add tag: ' + err.message, 'error');
        }
    }
}

async function removeTag(element) {
    if (element && element.parentElement) {
        const tagText = element.parentElement.textContent.replace('×', '').trim();
        const newTags = (profileData.tags || []).filter(t => t !== tagText);
        try {
            await User.updateUser({ tags: newTags });
            profileData.tags = newTags;
            element.parentElement.remove();
            showToast('Tag removed 🗑️');
        } catch (err) {
            showToast('Failed to remove tag: ' + err.message, 'error');
        }
    }
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
        profileData.contact = newContact;
        updateContactDOM();
        showToast('Contact info updated! ✉️');
        closeModal('contactModal');
    } catch (err) {
        showToast('Failed to update contact: ' + err.message, 'error');
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
        
        if (imageUrl) showToast('Image sent! 📷');
        
    } catch (err) {
        console.error('saveMessage error:', err);
        showToast('Failed to send message: ' + err.message, 'error');
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
    console.log('Profile page loaded - Edit mode:', isEditMode);
    
    if (!User.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    await loadProfile();
    await loadPosts();
    await loadAnimals();
    
    setupEventListeners();
    
    const pendingChat = sessionStorage.getItem('chatWith');
    if (pendingChat) {
        const chatData = JSON.parse(pendingChat);
        sessionStorage.removeItem('chatWith');
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
window.previewMultipleFiles = previewMultipleFiles;
window.openLightbox = openLightbox;
window.viewAnimal = viewAnimal;
window.editAnimal = editAnimal;
window.deleteAnimal = deleteAnimal;
window.saveAnimal = saveAnimal;
window.saveAnimalDetails = saveAnimalDetails;
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
window.loadProfile = loadProfile;

// ============================================
// VIEW ANY BREEDER PROFILE (from post header)
// ============================================

async function openBreederProfile(userId) {
    // If it's the current user's own profile, just scroll to top
    if (userId && String(userId) === String(currentUserId)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    let modal = document.getElementById('breederProfileModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'breederProfileModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:3000;align-items:center;justify-content:center;overflow-y:auto;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;width:90%;background:var(--surface-white);border-radius:24px;overflow:hidden;position:relative;margin:20px auto;">
                <button onclick="closeBreederProfile()" style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.4);border:none;font-size:22px;cursor:pointer;color:white;border-radius:50%;width:36px;height:36px;z-index:1;">×</button>
                <div id="breederProfileContent"></div>
            </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) closeBreederProfile(); });
        document.body.appendChild(modal);
    }

    const content = document.getElementById('breederProfileContent');
    content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted);">Loading profile...</div>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
        const [profileRes, animalsRes, ratingsRes] = await Promise.all([
            window.supabase.from('profiles').select('*').eq('id', userId).single(),
            window.supabase.from('animals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            window.supabase.from('ratings').select('*').eq('rated_user_id', userId)
        ]);

        const profile = profileRes.data;
        const animals = animalsRes.data || [];
        const ratings = ratingsRes.data || [];
        const avgRating = ratings.length > 0
            ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
            : '—';

        if (!profile) {
            content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted);">Profile not found</div>';
            return;
        }

        const coverImg = profile.cover_photo || 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200';
        const avatarImg = profile.profile_picture || 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png';
        const name = profile.name || 'Unknown Breeder';
        const bio = profile.bio || 'No bio available.';
        const tags = profile.tags || [];

        content.innerHTML = `
            <div style="background:url('${coverImg}') center/cover no-repeat;height:140px;width:100%;"></div>
            <div style="padding:0 24px 24px;">
                <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:-40px;margin-bottom:16px;">
                    <img src="${avatarImg}" onerror="this.src='https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'"
                        style="width:80px;height:80px;border-radius:50%;border:4px solid white;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                    <div style="display:flex;gap:8px;">
                        <button onclick="closeBreederProfile()" style="padding:8px 16px;background:var(--bg-secondary);color:var(--text-primary);border:none;border-radius:50px;font-weight:600;cursor:pointer;font-size:13px;">✕ Close</button>
                    </div>
                </div>
                <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${escapeHtml(name)}</div>
                <div style="display:flex;gap:16px;margin-bottom:12px;color:var(--text-muted);font-size:13px;">
                    <span>⭐ ${avgRating} rating</span>
                    <span>🐾 ${animals.length} animal${animals.length !== 1 ? 's' : ''}</span>
                    <span>📝 ${ratings.length} review${ratings.length !== 1 ? 's' : ''}</span>
                </div>
                ${tags.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">${tags.map(t => `<span style="background:var(--green-light);color:var(--green-primary);padding:4px 10px;border-radius:50px;font-size:12px;">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                <div style="color:var(--text-secondary);font-size:14px;line-height:1.7;margin-bottom:20px;word-wrap:break-word;">${escapeHtml(bio)}</div>
                ${animals.length > 0 ? `
                <div style="margin-bottom:20px;">
                    <div style="font-weight:700;color:var(--text-primary);margin-bottom:12px;">🐾 Animals</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;">
                        ${animals.map(a => `
                            <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border-light);">
                                <img src="${a.image_url || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'}"
                                    onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'"
                                    style="width:100%;height:80px;object-fit:cover;">
                                <div style="padding:6px;font-size:11px;font-weight:600;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(a.name)}</div>
                                <div style="padding:0 6px 6px;font-size:10px;text-align:center;color:var(--text-muted);">${escapeHtml(a.breed)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
                ${ratings.length > 0 ? `
                <div>
                    <div style="font-weight:700;color:var(--text-primary);margin-bottom:12px;">⭐ Reviews</div>
                    ${ratings.slice(0, 3).map(r => `
                        <div style="padding:12px;background:var(--bg-secondary);border-radius:12px;margin-bottom:8px;">
                            <div style="color:var(--text-muted);font-size:13px;margin-bottom:4px;">${'⭐'.repeat(r.rating)}</div>
                            ${r.comment ? `<div style="font-size:13px;color:var(--text-secondary);word-wrap:break-word;">${escapeHtml(r.comment)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>
        `;
    } catch (err) {
        console.error('openBreederProfile error:', err);
        content.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted);">Failed to load profile</div>';
    }
}

function closeBreederProfile() {
    const modal = document.getElementById('breederProfileModal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

window.openBreederProfile = openBreederProfile;
window.closeBreederProfile = closeBreederProfile;
