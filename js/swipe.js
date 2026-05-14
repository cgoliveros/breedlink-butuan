console.log('=== Swipe.js Loading ===');

let currentAnimals = [];
let liked = [];
let passed = [];
let cardStack, emptyState, indicatorNope, indicatorLike, matchesList, matchCount;
let isAnimating = false;
let dragData = null;
let currentUserId = null;
let currentUserProfile = null;

// Messenger variables
let messengerContacts = [];
let messengerMessages = {};
let currentChatId = null;

async function loadSwipeAnimals() {
    let user = User.getUser();
    if (!user || !user.id) {
        user = await User.getFreshUser();
    }
    if (!user || !user.id) return;
    
    currentUserId = user.id;
    currentUserProfile = user;
    
    try {
        // Get all animals from OTHER users (exclude current user's own animals by user_id)
        const { data, error } = await window.supabase
            .from('animals')
            .select(`
                *,
                profiles:user_id (id, name, profile_picture, location)
            `)
            .neq('user_id', currentUserId);
        
        if (error) throw error;
        
        currentAnimals = (data || []).map(animal => ({
            id: animal.id,
            user_id: animal.user_id,
            name: animal.name,
            breed: animal.breed,
            gender: animal.gender,
            age: animal.age,
            status: animal.status,
            image: animal.image_url,
            description: animal.description,
            owner: animal.profiles?.name || 'Unknown',
            ownerAvatar: animal.profiles?.profile_picture,
            location: animal.profiles?.location || 'Unknown'
        }));
        
        // Get swipe history to filter out already swiped animals
        const { data: swipeHistory } = await window.supabase
            .from('swipe_history')
            .select('animal_id, direction')
            .eq('user_id', currentUserId);
        
        // Build set of swiped IDs and populate passed[] from left-swipes
        const swipedIds = new Set();
        const passedIds = new Set();
        for (const s of (swipeHistory || [])) {
            swipedIds.add(String(s.animal_id));
            if (s.direction === 'left') passedIds.add(String(s.animal_id));
        }
        
        // All animals (before filtering) — used to re-hydrate passed[]
        const allFetchedAnimals = [...currentAnimals];
        passed = allFetchedAnimals.filter(a => passedIds.has(String(a.id)));
        
        currentAnimals = currentAnimals.filter(a => !swipedIds.has(String(a.id)));
        
        // Only filter pending matches (not matched ones — they go to sidebar)
        const { data: pendingMatches } = await window.supabase
            .from('matches')
            .select('animal_id')
            .eq('user_id', currentUserId)
            .eq('status', 'pending');
        
        const pendingIds = new Set((pendingMatches || []).map(m => String(m.animal_id)));
        currentAnimals = currentAnimals.filter(a => !pendingIds.has(String(a.id)));
        
        renderCards();
        await loadMatches();
        
        if (currentAnimals.length > 0 && currentAnimals[currentAnimals.length - 1]) {
            showPetDetails(currentAnimals[currentAnimals.length - 1].id);
        }
    } catch (err) {
        console.error('loadSwipeAnimals error:', err);
        showToast('Failed to load breeders', 'error');
    }
}

async function loadMatches() {
    try {
        // Fetch ALL right-swipes — both pending (one-sided like) and matched (mutual)
        const { data, error } = await window.supabase
            .from('matches')
            .select(`
                *,
                animal:animals (id, name, breed, image_url),
                matched_user:matched_user_id (id, name, profile_picture)
            `)
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        liked = (data || []).map(match => ({
            id: match.animal_id,
            user_id: match.matched_user_id,
            name: match.animal?.name,
            breed: match.animal?.breed,
            image: match.animal?.image_url,
            owner: match.matched_user?.name,
            ownerAvatar: match.matched_user?.profile_picture,
            match_id: match.id,
            isMatched: match.status === 'matched'
        }));
        
        updateMatches();
    } catch (err) {
        console.error('loadMatches error:', err);
        liked = [];
        updateMatches();
    }
}

function renderCards() {
    if (!cardStack) return;
    cardStack.innerHTML = '';
    
    if (currentAnimals.length === 0) {
        if (emptyState) emptyState.classList.add('active');
        return;
    }
    
    if (emptyState) emptyState.classList.remove('active');
    
    const cardsToShow = currentAnimals.slice(-3);
    
    cardsToShow.forEach((animal) => {
        const card = createCard(animal);
        cardStack.appendChild(card);
    });
}

function createCard(animal) {
    const card = document.createElement('div');
    card.className = 'breed-card';
    card.setAttribute('data-id', animal.id);
    
    card.innerHTML = `
        <img class="card-image" src="${animal.image}" alt="${animal.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'">
        <button class="info-btn" onclick="event.stopPropagation(); showPetDetails(${animal.id})">ℹ️</button>
        <div class="card-content">
            <div class="card-header">
                <div class="card-name">${escapeHtml(animal.name)}</div>
                <span class="card-badge">${animal.gender === 'Male' ? '♂️' : '♀️'}</span>
            </div>
            <div class="card-meta">
                <span>📍 ${escapeHtml(animal.location)}</span>
                <span>🏷️ ${escapeHtml(animal.breed)}</span>
            </div>
            <div class="card-stats">
                <div class="stat"><span>⭐</span><strong>${escapeHtml(animal.owner)}</strong></div>
                <div class="stat"><span>🐾</span><strong>${escapeHtml(animal.age || 'Unknown')}</strong></div>
            </div>
        </div>
    `;
    
    card.addEventListener('mousedown', (e) => onDragStart(e, card, animal));
    card.addEventListener('touchstart', (e) => onDragStart(e, card, animal), { passive: false });
    card.style.cursor = 'grab';
    
    return card;
}

function onDragStart(e, card, animal) {
    if (isAnimating) return;
    e.preventDefault();
    
    dragData = {
        card, animal,
        startX: e.type.includes('mouse') ? e.clientX : e.touches[0].clientX,
        currentX: e.type.includes('mouse') ? e.clientX : e.touches[0].clientX
    };
    
    card.style.transition = 'none';
    card.style.cursor = 'grabbing';
    
    document.addEventListener('mousemove', onGlobalDragMove);
    document.addEventListener('mouseup', onGlobalDragEnd);
    document.addEventListener('touchmove', onGlobalDragMove, { passive: false });
    document.addEventListener('touchend', onGlobalDragEnd);
}

function onGlobalDragMove(e) {
    if (!dragData) return;
    e.preventDefault();
    
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    dragData.currentX = clientX;
    const diff = dragData.currentX - dragData.startX;
    const rotate = diff * 0.05;
    dragData.card.style.transform = `translateX(${diff}px) rotate(${rotate}deg)`;
    
    if (diff > 50) {
        if (indicatorLike) indicatorLike.style.opacity = Math.min(diff / 150, 1);
        if (indicatorNope) indicatorNope.style.opacity = 0;
    } else if (diff < -50) {
        if (indicatorNope) indicatorNope.style.opacity = Math.min(Math.abs(diff) / 150, 1);
        if (indicatorLike) indicatorLike.style.opacity = 0;
    } else {
        if (indicatorLike) indicatorLike.style.opacity = 0;
        if (indicatorNope) indicatorNope.style.opacity = 0;
    }
}

function onGlobalDragEnd() {
    if (!dragData) return;
    
    const diff = dragData.currentX - dragData.startX;
    const card = dragData.card;
    const animal = dragData.animal;
    
    card.style.transition = 'transform 0.3s ease';
    
    if (diff > 100) {
        card.style.transform = 'translateX(1000px) rotate(30deg)';
        setTimeout(() => handleSwipe('right', animal), 300);
    } else if (diff < -100) {
        card.style.transform = 'translateX(-1000px) rotate(-30deg)';
        setTimeout(() => handleSwipe('left', animal), 300);
    } else {
        card.style.transform = '';
    }
    
    if (indicatorLike) indicatorLike.style.opacity = 0;
    if (indicatorNope) indicatorNope.style.opacity = 0;
    
    dragData = null;
    document.removeEventListener('mousemove', onGlobalDragMove);
    document.removeEventListener('mouseup', onGlobalDragEnd);
    document.removeEventListener('touchmove', onGlobalDragMove);
    document.removeEventListener('touchend', onGlobalDragEnd);
}

function swipe(direction) {
    if (isAnimating) return;
    if (!cardStack) return;
    
    const topCard = cardStack.lastElementChild;
    if (!topCard) return;
    
    const animalId = parseInt(topCard.getAttribute('data-id'));
    const animal = currentAnimals.find(a => a.id === animalId);
    if (!animal) return;
    
    isAnimating = true;
    topCard.style.transition = 'transform 0.3s ease';
    topCard.style.transform = direction === 'right' ? 'translateX(1000px) rotate(30deg)' : 'translateX(-1000px) rotate(-30deg)';
    
    setTimeout(() => handleSwipe(direction, animal), 300);
}

async function handleSwipe(direction, animal) {
    // Record swipe in swipe_history
    try {
        await window.supabase
            .from('swipe_history')
            .upsert({
                user_id: currentUserId,
                animal_id: animal.id,
                direction: direction === 'right' ? 'right' : 'left'
            }, { onConflict: 'user_id,animal_id' });
    } catch (err) {
        console.error('Save swipe error:', err);
    }
    
    if (direction === 'right') {
        // Check if the other user already liked this animal
        const { data: existingMatch } = await window.supabase
            .from('matches')
            .select('*')
            .eq('user_id', animal.user_id)
            .eq('matched_user_id', currentUserId)
            .eq('animal_id', animal.id)
            .single();
        
        if (existingMatch) {
            // It's a match! Update both matches
            await window.supabase
                .from('matches')
                .update({ status: 'matched', viewed: false })
                .eq('id', existingMatch.id);
            
            await window.supabase
                .from('matches')
                .upsert({
                    user_id: currentUserId,
                    matched_user_id: animal.user_id,
                    animal_id: animal.id,
                    status: 'matched'
                });
            
            // Create notifications
            await window.supabase
                .from('notifications')
                .insert([
                    {
                        user_id: currentUserId,
                        type: 'match',
                        reference_id: animal.id,
                        title: 'New Match! 🎉',
                        message: `You matched with ${animal.owner}'s ${animal.name}!`
                    },
                    {
                        user_id: animal.user_id,
                        type: 'match',
                        reference_id: animal.id,
                        title: 'New Match! 🎉',
                        message: `${currentUserProfile?.name} matched with your ${animal.name}!`
                    }
                ]);
            
            showMatchAnimation(animal);
            await loadMatches();
        } else {
            // One-sided like — create pending match
            await window.supabase
                .from('matches')
                .insert({
                    user_id: currentUserId,
                    matched_user_id: animal.user_id,
                    animal_id: animal.id,
                    status: 'pending'
                });
            // Refresh liked tab immediately so user sees their like
            await loadMatches();
        }
        
        // Log activity
        await User.logActivity('swipe_right', 'animal', animal.id, { name: animal.name });
        
    } else {
        // Track passed animals locally for the session
        if (!passed.find(a => a.id === animal.id)) {
            passed.push(animal);
        }
        // Log activity for left swipe
        await User.logActivity('swipe_left', 'animal', animal.id, { name: animal.name });
    }
    
    currentAnimals = currentAnimals.filter(a => a.id !== animal.id);
    renderCards();
    isAnimating = false;
    
    if (currentAnimals.length > 0 && currentAnimals[currentAnimals.length - 1]) {
        showPetDetails(currentAnimals[currentAnimals.length - 1].id);
    } else {
        const panel = document.getElementById('petDetailsPanel');
        const content = document.getElementById('petDetailsContent');
        if (panel && content) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <div style="font-size: 48px; margin-bottom: 16px;">🐾</div>
                    <p>No more animals to show</p>
                    <button class="empty-btn primary" onclick="resetFilters()" style="margin-top: 20px;">Reset Filters</button>
                </div>
            `;
        }
    }
}

function updateMatches() {
    if (matchCount) matchCount.textContent = liked.length;
    if (!matchesList) return;
    renderBreedersTab('liked');
}

let _currentBreedersTab = 'liked';

function renderBreedersTab(tab) {
    _currentBreedersTab = tab;
    if (!matchesList) return;

    // Update tab buttons
    const likedTab = document.getElementById('tabLiked');
    const passedTab = document.getElementById('tabPassed');
    if (likedTab) likedTab.classList.toggle('active', tab === 'liked');
    if (passedTab) passedTab.classList.toggle('active', tab === 'passed');

    const list = tab === 'liked' ? liked : passed;
    if (matchCount) matchCount.textContent = liked.length;

    if (list.length === 0) {
        matchesList.innerHTML = tab === 'liked'
            ? '<div class="empty-matches">Start swiping to find matches!</div>'
            : '<div class="empty-matches">No passed animals yet.</div>';
        return;
    }

    matchesList.innerHTML = list.map(animal => {
        const isLiked = tab === 'liked';
        const imgSrc = animal.image || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400';
        const ownerSafe = escapeHtml(animal.owner || 'Unknown');
        const avatarSafe = escapeHtml(animal.ownerAvatar || '');
        return `
        <div class="match-item" onclick="viewMatchProfile(${animal.id})">
            <div style="position:relative;flex-shrink:0;">
                <img src="${imgSrc}" alt="${escapeHtml(animal.name)}" loading="lazy"
                     style="width:52px;height:52px;border-radius:12px;object-fit:cover;"
                     onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'">
                <span style="position:absolute;bottom:-4px;right:-4px;font-size:14px;">${isLiked ? (animal.isMatched ? '💚' : '❤️') : '✕'}</span>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(animal.name)}</div>
                <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ownerSafe} · ${escapeHtml(animal.breed || '')}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end;">
                <button class="match-message-btn" title="View details" onclick="event.stopPropagation(); viewMatchProfile(${animal.id})" style="background:#f0f8f0;color:var(--green-primary);padding:4px 8px;font-size:11px;">🐾 Details</button>
                <button class="match-message-btn" title="Message owner" onclick="event.stopPropagation(); messageMatchBreeder('${animal.user_id}', '${ownerSafe}', '${avatarSafe}')" style="padding:4px 8px;font-size:11px;">💬 Message</button>
                ${isLiked ? `<button class="match-message-btn" title="View profile" onclick="event.stopPropagation(); openBreederProfile('${animal.user_id}')" style="background:#f0f4ff;color:#5b7dd8;padding:4px 8px;font-size:11px;">👤 Profile</button>` : `<button class="match-message-btn" title="View profile" onclick="event.stopPropagation(); openBreederProfile('${animal.user_id}')" style="background:#fff5f5;color:#d64242;padding:4px 8px;font-size:11px;">👤 Profile</button>`}
            </div>
        </div>
        `;
    }).join('');
}

function viewMatchProfile(animalId) {
    showPetDetails(animalId);
    document.getElementById('petDetailsPanel').scrollIntoView({ behavior: 'smooth' });
}

function messageMatchBreeder(userId, userName, userAvatar) {
    sessionStorage.setItem('chatWith', JSON.stringify({
        id: userId,
        name: userName,
        avatar: userAvatar
    }));
    
    if (typeof window.openMessenger === 'function') {
        window.openMessenger();
    }
}

let currentMatchUserId = null;
let currentMatchUserName = null;

function showMatchAnimation(animal) {
    const matchImage = document.getElementById('matchImage');
    const matchName = document.getElementById('matchName');
    const matchOverlay = document.getElementById('matchOverlay');
    
    currentMatchUserId = animal.user_id;
    currentMatchUserName = animal.owner;
    
    if (matchImage) matchImage.src = animal.image;
    if (matchName) matchName.textContent = animal.name;
    if (matchOverlay) {
        matchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Auto-close after 5 seconds (slightly longer to let user rate)
        setTimeout(() => {
            closeMatch();
        }, 5000);
    }
}

function rateMatchBreeder() {
    if (currentMatchUserId && currentMatchUserName) {
        closeMatch();
        setTimeout(() => openRateModal(currentMatchUserId, currentMatchUserName), 200);
    }
}

function closeMatch() {
    const matchOverlay = document.getElementById('matchOverlay');
    if (matchOverlay) {
        matchOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function messageMatch() {
    const matchName = document.getElementById('matchName')?.textContent;
    const animal = liked.find(a => a.name === matchName);
    if (animal) {
        closeMatch();
        messageMatchBreeder(animal.user_id, animal.owner, animal.ownerAvatar);
    }
}

function showPetDetails(animalId) {
    const animal = [...currentAnimals, ...liked, ...passed].find(a => a.id === animalId);
    if (!animal) return;
    
    const panel = document.getElementById('petDetailsPanel');
    const content = document.getElementById('petDetailsContent');
    if (!panel || !content) return;
    
    content.innerHTML = `
        <div class="pet-details-header">
            <img src="${animal.image}" alt="${animal.name}" class="pet-details-img" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'">
            <div class="pet-details-name">${escapeHtml(animal.name)}</div>
            <div class="pet-details-breed">${escapeHtml(animal.breed)} • ${escapeHtml(animal.location)}</div>
        </div>
        
        <button class="documents-btn" onclick="showDocuments(${animal.id})">
            📋 View Health Records
        </button>
        
        <button class="message-owner-btn" onclick="messageOwner(${animal.user_id}, '${escapeHtml(animal.owner)}', '${escapeHtml(animal.ownerAvatar || '')}')">
            💬 Message Owner
        </button>

        <button class="message-owner-btn" onclick="openBreederProfile('${animal.user_id}')" style="background:var(--bg-secondary);color:var(--text-primary);margin-top:8px;">
            👤 View Breeder Profile
        </button>
        
        <div class="detail-section">
            <h4>📊 Information</h4>
            <div class="detail-row"><span class="detail-label">Gender</span><span class="detail-value">${animal.gender === 'Male' ? '♂️ Male' : '♀️ Female'}</span></div>
            <div class="detail-row"><span class="detail-label">Age</span><span class="detail-value">${escapeHtml(animal.age || 'Unknown')}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${escapeHtml(animal.status || 'Available')}</span></div>
        </div>
        
        <div class="detail-section">
            <h4>👤 Owner Information</h4>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <img src="${animal.ownerAvatar || 'https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'}" 
                     onerror="this.src='https://raw.githubusercontent.com/himeh-pers/Breed-Link/refs/heads/main/doge.png'"
                     style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--border-light);">
                <div>
                    <div style="font-weight:600;color:var(--text-primary);">${escapeHtml(animal.owner)}</div>
                    <div style="font-size:12px;color:var(--text-muted);">📍 ${escapeHtml(animal.location)}</div>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>📝 About</h4>
            <p style="color: var(--text-secondary); line-height: 1.6;">${escapeHtml(animal.description) || 'No description available.'}</p>
        </div>
    `;
    
    panel.classList.add('active');
}

function closePetDetails() {
    const panel = document.getElementById('petDetailsPanel');
    if (panel) panel.classList.remove('active');
}

async function showDocuments(animalId) {
    const animal = [...currentAnimals, ...liked, ...passed].find(a => a.id === animalId);
    if (!animal) { showToast('Animal not found', 'error'); return; }

    // Fetch fresh animal data to get health_documents
    try {
        const { data, error } = await window.supabase
            .from('animals')
            .select('health_documents, name')
            .eq('id', animalId)
            .single();

        if (error) throw error;

        const docs = data?.health_documents || [];
        if (!docs.length) { showToast('No health documents uploaded for this animal.'); return; }

        // Build a quick modal
        const existing = document.getElementById('docsQuickModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'docsQuickModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:4000;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:var(--surface-white);border-radius:24px;padding:28px;max-width:440px;width:90%;position:relative;">
                <button onclick="document.getElementById('docsQuickModal').remove();document.body.style.overflow='';"
                    style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">×</button>
                <h3 style="margin-bottom:16px;">📋 Health Documents — ${escapeHtml(data.name)}</h3>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${docs.map(doc => `
                        <a href="${doc.url || doc}" target="_blank" rel="noopener"
                           style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--bg-secondary);border-radius:12px;text-decoration:none;color:var(--text-primary);font-weight:500;font-size:14px;border:1px solid var(--border-light);">
                            <span style="font-size:24px;">${(doc.type && doc.type.includes('image')) ? '🖼️' : '📄'}</span>
                            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(doc.name || 'Document')}</span>
                            <span style="color:var(--green-primary);font-size:13px;">View →</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
        modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; } });
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    } catch (err) {
        console.error('showDocuments error:', err);
        showToast('Failed to load documents', 'error');
    }
}

function messageOwner(userId, userName, userAvatar) {
    closePetDetails();
    messageMatchBreeder(userId, userName, userAvatar);
}

// Filter functions
function toggleFilters() {
    const toggle = document.getElementById('filterToggle');
    const panel = document.getElementById('filterPanel');
    if (toggle) toggle.classList.toggle('active');
    if (panel) panel.classList.toggle('active');
}

function updateBreeds() {
    const category = document.getElementById('categorySelect')?.value;
    const breedSelect = document.getElementById('breedSelect');
    if (!breedSelect) return;
    
    breedSelect.innerHTML = '<option value="">All Breeds</option>';
    const breeds = [...new Set(currentAnimals.map(a => a.breed))];
    
    breeds.forEach(breed => {
        const option = document.createElement('option');
        option.value = breed;
        option.textContent = breed;
        breedSelect.appendChild(option);
    });
}

function applyFilters() {
    const breed = document.getElementById('breedSelect')?.value;
    
    if (breed) {
        const filtered = currentAnimals.filter(a => a.breed === breed);
        if (filtered.length > 0) {
            currentAnimals = filtered;
            renderCards();
        }
    }
}

async function resetFilters() {
    showToast('Resetting swipe deck...');
    try {
        await window.supabase
            .from('swipe_history')
            .delete()
            .eq('user_id', currentUserId);
    } catch (err) {
        console.error('resetFilters error:', err);
    }
    const breedSelect = document.getElementById('breedSelect');
    if (breedSelect) breedSelect.value = '';
    await loadSwipeAnimals();
    showToast('Swipe deck reset! 🔄');
}

function showPassed() {
    renderBreedersTab('passed');
    const passedTab = document.getElementById('tabPassed');
    if (passedTab) passedTab.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Messenger Functions
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

async function sendMessageToApi(contactId, text, imageData) {
    let imageUrl = null;
    
    if (imageData) {
        const reader = new FileReader();
        return new Promise((resolve) => {
            reader.onload = async function(e) {
                imageUrl = e.target.result;
                await saveMessage(contactId, text, imageUrl);
                resolve();
            };
            reader.readAsDataURL(imageData);
        });
    } else {
        await saveMessage(contactId, text, null);
    }
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
                message: `${currentUserProfile?.name} sent you a message`
            });
        
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
    const list = document.getElementById('contactsList');
    if (!list) return;
    
    if (messengerContacts.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 40px;">No conversations yet. Start swiping to find matches!</div>';
        return;
    }
    
    list.innerHTML = messengerContacts.map(contact => `
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
    document.getElementById('chatAvatar').src = contact.avatar;
    document.getElementById('chatName').textContent = contact.name;
    
    await loadMessages(contactId);
    contact.unread = 0;
}

function backToContacts() {
    document.getElementById('messengerContacts').classList.add('active');
    document.getElementById('messengerEmpty').classList.remove('hidden');
    document.getElementById('messengerChat').classList.remove('active');
    currentChatId = null;
    renderContactsList();
}

function renderMessages(contactId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const messages = messengerMessages[contactId] || [];
    
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px;">Start a conversation! Say hello 👋</div>';
    } else {
        container.innerHTML = messages.map(msg => {
            if (msg.image) {
                return `
                    <div class="${msg.sender === 'me' ? 'message-sent' : 'message-received'}">
                        <div class="message-bubble"><img src="${msg.image}" style="max-width: 200px; border-radius: 12px;"></div>
                    </div>
                `;
            }
            return `
                <div class="${msg.sender === 'me' ? 'message-sent' : 'message-received'}">
                    <div class="message-bubble">${escapeHtml(msg.text)}</div>
                </div>
            `;
        }).join('');
    }
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('messengerInput');
    if (!input || !currentChatId) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    await sendMessageToApi(currentChatId, text, null);
}

async function sendImage(fileInput) {
    const file = fileInput.files[0];
    if (!file || !currentChatId) return;
    await sendMessageToApi(currentChatId, null, file);
    fileInput.value = '';
}

function searchContacts(query) {
    const list = document.getElementById('contactsList');
    if (!list) return;
    
    const filtered = messengerContacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    
    if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 20px;">No contacts found</div>';
        return;
    }
    
    list.innerHTML = filtered.map(contact => `
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
// RATE BREEDER
// ============================================

let currentRating = 0;
let currentRateUserId = null;

function openRateModal(userId, userName) {
    currentRateUserId = userId;
    currentRating = 0;
    const modal = document.getElementById('rateModal');
    const nameEl = document.getElementById('rateBreederName');
    const comment = document.getElementById('rateComment');
    const selectedText = document.getElementById('rateSelectedText');
    if (nameEl) nameEl.textContent = `How was your experience with ${userName}?`;
    if (comment) comment.value = '';
    if (selectedText) selectedText.textContent = 'Select a rating';
    updateStarDisplay(0);
    if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeRateModal() {
    const modal = document.getElementById('rateModal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function setRating(val) {
    currentRating = val;
    updateStarDisplay(val);
    const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];
    const el = document.getElementById('rateSelectedText');
    if (el) el.textContent = `${val} star${val > 1 ? 's' : ''} — ${labels[val]}`;
}

function updateStarDisplay(val) {
    document.querySelectorAll('.star-btn').forEach(star => {
        const starVal = parseInt(star.getAttribute('data-val'));
        star.style.opacity = starVal <= val ? '1' : '0.3';
        star.style.transform = starVal <= val ? 'scale(1.1)' : 'scale(1)';
    });
}

async function submitRating() {
    if (!currentRating) { showToast('Please select a rating', 'error'); return; }
    if (!currentRateUserId || !currentUserId) return;
    const comment = document.getElementById('rateComment')?.value.trim() || '';
    try {
        // Upsert rating (one rating per pair)
        await window.supabase.from('ratings').upsert({
            rater_id: currentUserId,
            rated_user_id: currentRateUserId,
            rating: currentRating,
            comment: comment,
            created_at: new Date().toISOString()
        }, { onConflict: 'rater_id,rated_user_id' });
        
        // Update the rated user's average rating in profiles
        const { data: ratingData } = await window.supabase
            .from('ratings')
            .select('rating')
            .eq('rated_user_id', currentRateUserId);
        
        if (ratingData && ratingData.length > 0) {
            const avg = (ratingData.reduce((s, r) => s + r.rating, 0) / ratingData.length).toFixed(1);
            // Fetch existing stats first so we don't wipe connections/litters/etc
            const { data: profileData } = await window.supabase.from('profiles').select('stats').eq('id', currentRateUserId).single();
            const existingStats = profileData?.stats || {};
            await window.supabase.from('profiles').update({
                stats: { ...existingStats, rating: parseFloat(avg) }
            }).eq('id', currentRateUserId);
        }
        
        showToast(`Rating submitted! ${currentRating} ⭐`);
        closeRateModal();
    } catch (err) {
        console.error('submitRating error:', err);
        showToast('Failed to submit rating: ' + err.message, 'error');
    }
}

// ============================================
// VIEW BREEDER PROFILE
// ============================================

async function openBreederProfile(userId) {
    const modal = document.getElementById('breederProfileModal');
    const content = document.getElementById('breederProfileContent');
    if (!modal || !content) return;
    
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
                        <button onclick="openRateModal('${userId}', '${escapeHtml(name)}')" style="padding:8px 16px;background:var(--green-light);color:var(--green-primary);border:none;border-radius:50px;font-weight:600;cursor:pointer;font-size:13px;">⭐ Rate</button>
                        <button onclick="closeBreederProfile(); messageMatchBreeder('${userId}', '${escapeHtml(name)}', '${avatarImg}')" style="padding:8px 16px;background:var(--green-primary);color:white;border:none;border-radius:50px;font-weight:600;cursor:pointer;font-size:13px;">💬 Message</button>
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
                                <div style="padding:6px;font-size:11px;font-weight:600;text-align:center;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(a.name)}</div>
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
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                                <span style="color:var(--text-muted);font-size:13px;">${'⭐'.repeat(r.rating)}</span>
                            </div>
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

// Initialize
function init() {
    if (!protectSwipePage()) return;
    
    cardStack = document.getElementById('cardStack');
    emptyState = document.getElementById('emptyState');
    indicatorNope = document.getElementById('indicatorNope');
    indicatorLike = document.getElementById('indicatorLike');
    matchesList = document.getElementById('matchesList');
    matchCount = document.getElementById('matchCount');
    
    if (!cardStack) {
        console.error('cardStack element not found');
        return;
    }
    
    liked = [];
    passed = [];
    loadSwipeAnimals();
    
    // Check for pending chat
    const pendingChat = sessionStorage.getItem('chatWith');
    if (pendingChat) {
        setTimeout(() => {
            openMessenger();
        }, 500);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    init();
});

document.getElementById('matchOverlay')?.addEventListener('click', function(e) {
    if (e.target === this) closeMatch();
});

// Expose functions to window
window.swipe = swipe;
window.toggleFilters = toggleFilters;
window.updateBreeds = updateBreeds;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.showPassed = showPassed;
window.renderBreedersTab = renderBreedersTab;
window.closeMatch = closeMatch;
window.messageMatch = messageMatch;
window.viewMatchProfile = viewMatchProfile;
window.messageMatchBreeder = messageMatchBreeder;
window.showPetDetails = showPetDetails;
window.closePetDetails = closePetDetails;
window.showDocuments = showDocuments;
window.messageOwner = messageOwner;
window.openMessenger = openMessenger;
window.closeMessenger = closeMessenger;
window.startChat = startChat;
window.backToContacts = backToContacts;
window.sendMessage = sendMessage;
window.sendImage = sendImage;
window.searchContacts = searchContacts;
window.openRateModal = openRateModal;
window.closeRateModal = closeRateModal;
window.setRating = setRating;
window.submitRating = submitRating;
window.openBreederProfile = openBreederProfile;
window.closeBreederProfile = closeBreederProfile;
window.rateMatchBreeder = rateMatchBreeder;