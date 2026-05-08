console.log('=== Swipe.js Loading ===');

function protectSwipePage() {
  if (typeof User === 'undefined' || !User.isAuthenticated) { redirectToLogin(); return false; }
  if (!User.isAuthenticated()) { showToast('Please sign in to access BreedMatch', 'error'); setTimeout(() => redirectToLogin(), 1500); return false; }
  return true;
}
function redirectToLogin() { window.location.href = '../html/login.html'; }
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span> ${message}`;
  toast.style.cssText = `position: fixed; bottom: 30px; right: 30px; background: ${type === 'error' ? 'linear-gradient(135deg, #ff6b6b, #ff4757)' : 'linear-gradient(135deg, #2e6b4e, #3c8d63)'}; color: white; padding: 16px 28px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 3000; font-weight: 500; display: flex; align-items: center; gap: 10px;`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 400); }, 3000);
}

const API = {
  base: window.API_BASE,
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('breedlink_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${this.base}${endpoint}`, { ...options, headers });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Request failed'); }
    return res.json();
  },
  get(endpoint) { return this.request(endpoint); },
  post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
};

let currentBreeders = [];
let liked = [];
let passed = [];
let cardStack, emptyState, indicatorNope, indicatorLike, matchesList, matchCount;
let isAnimating = false;
let dragData = null;
let currentSelectedBreederId = null;

// Messenger data (populated by API)
let mockContacts = [];
let mockMessages = {};
let currentChatId = null;

async function loadSwipeQueue() {
  try {
    const pets = await API.get('/pets/swipe-queue');
    currentBreeders = pets;
    renderCards();
    updateMatches();
    if (currentBreeders.length > 0) showPetDetails(currentBreeders[currentBreeders.length - 1].id);
  } catch (err) { showToast('Failed to load breeders', 'error'); }
}

function renderCards() {
  if (!cardStack) return;
  cardStack.innerHTML = '';
  if (currentBreeders.length === 0) { if (emptyState) emptyState.classList.add('active'); return; }
  if (emptyState) emptyState.classList.remove('active');
  const cardsToShow = currentBreeders.slice(-3);
  cardsToShow.forEach(breeder => { const card = createCard(breeder); cardStack.appendChild(card); });
}

function createCard(breeder) {
  const card = document.createElement('div');
  card.className = 'breed-card';
  card.setAttribute('data-id', breeder.id);
  card.innerHTML = `
    <img class="card-image" src="${breeder.image}" alt="${breeder.name}" loading="lazy">
    <button class="info-btn" onclick="event.stopPropagation(); showPetDetails(${breeder.id})">ℹ️</button>
    <div class="card-content">
      <div class="card-header"><div class="card-name">${breeder.name}</div>${breeder.verified ? '<span class="card-badge">✓ Verified</span>' : ''}</div>
      <div class="card-meta"><span>📍 ${breeder.location}</span><span>🏷️ ${breeder.breed}</span></div>
      <div class="card-stats"><div class="stat"><span>⭐</span><strong>${breeder.rating}</strong></div><div class="stat"><span>🐾</span><strong>${breeder.litters}</strong> litters</div></div>
    </div>
  `;
  card.addEventListener('mousedown', (e) => onDragStart(e, card, breeder));
  card.addEventListener('touchstart', (e) => onDragStart(e, card, breeder), { passive: false });
  card.style.cursor = 'grab';
  return card;
}

function onDragStart(e, card, breeder) {
  if (isAnimating) return;
  e.preventDefault();
  dragData = { card, breeder, startX: e.type.includes('mouse') ? e.clientX : e.touches[0].clientX, currentX: e.type.includes('mouse') ? e.clientX : e.touches[0].clientX };
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
  if (diff > 50) { if (indicatorLike) indicatorLike.style.opacity = Math.min(diff / 150, 1); if (indicatorNope) indicatorNope.style.opacity = 0; }
  else if (diff < -50) { if (indicatorNope) indicatorNope.style.opacity = Math.min(Math.abs(diff) / 150, 1); if (indicatorLike) indicatorLike.style.opacity = 0; }
  else { if (indicatorLike) indicatorLike.style.opacity = 0; if (indicatorNope) indicatorNope.style.opacity = 0; }
}
function onGlobalDragEnd() {
  if (!dragData) return;
  const diff = dragData.currentX - dragData.startX;
  const card = dragData.card;
  const breeder = dragData.breeder;
  card.style.transition = 'transform 0.3s ease';
  if (diff > 100) { card.style.transform = 'translateX(1000px) rotate(30deg)'; setTimeout(() => handleSwipe('right', breeder), 300); }
  else if (diff < -100) { card.style.transform = 'translateX(-1000px) rotate(-30deg)'; setTimeout(() => handleSwipe('left', breeder), 300); }
  else { card.style.transform = ''; }
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
  const breederId = parseInt(topCard.getAttribute('data-id'));
  const breeder = currentBreeders.find(b => b.id === breederId);
  if (!breeder) return;
  isAnimating = true;
  topCard.style.transition = 'transform 0.3s ease';
  topCard.style.transform = direction === 'right' ? 'translateX(1000px) rotate(30deg)' : 'translateX(-1000px) rotate(-30deg)';
  setTimeout(() => handleSwipe(direction, breeder), 300);
}
async function handleSwipe(direction, breeder) {
  try {
    const result = await API.post('/matches/swipe', { petId: breeder.id, direction: direction === 'right' ? 'like' : 'dislike' });
    if (direction === 'right') { liked.push(breeder); updateMatches(); if (result.match) showMatchAnimation(breeder); }
    else { passed.push(breeder); }
    currentBreeders = currentBreeders.filter(b => b.id !== breeder.id);
    renderCards();
    isAnimating = false;
    if (currentBreeders.length > 0) showPetDetails(currentBreeders[currentBreeders.length - 1].id);
    else { const panel = document.getElementById('petDetailsPanel'); const content = document.getElementById('petDetailsContent'); if (panel && content) content.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><div style="font-size: 48px; margin-bottom: 16px;">🐾</div><p>No more breeders to show</p></div>`; }
  } catch (err) { showToast('Swipe failed', 'error'); isAnimating = false; }
}
function updateMatches() {
  if (matchCount) matchCount.textContent = liked.length;
  if (!matchesList) return;
  if (liked.length === 0) matchesList.innerHTML = '<div class="empty-matches">Start swiping to find matches!</div>';
  else matchesList.innerHTML = liked.map(b => `<div class="match-item" onclick="viewMatchProfile(${b.id})"><img src="${b.image}" alt="${b.name}" loading="lazy"><span>${b.name}</span><button class="match-message-btn" onclick="event.stopPropagation(); messageMatchBreeder(${b.id})">💬</button></div>`).join('');
}
function viewMatchProfile(breederId) { showPetDetails(breederId); document.getElementById('petDetailsPanel').scrollIntoView({ behavior: 'smooth' }); }
function messageMatchBreeder(breederId) {
  const breeder = currentBreeders.find(b => b.id === breederId) || liked.find(b => b.id === breederId);
  if (!breeder) return;
  addContactIfNotExists(breeder);
  setTimeout(() => { openMessenger(); setTimeout(() => startChat(breeder.id), 300); }, 300);
}
function showMatchAnimation(breeder) {
  const matchImage = document.getElementById('matchImage');
  const matchName = document.getElementById('matchName');
  const matchOverlay = document.getElementById('matchOverlay');
  if (matchImage) matchImage.src = breeder.image;
  if (matchName) matchName.textContent = breeder.name;
  if (matchOverlay) { matchOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeMatch() { const matchOverlay = document.getElementById('matchOverlay'); if (matchOverlay) { matchOverlay.classList.remove('active'); document.body.style.overflow = ''; } }
function messageMatch() {
  const matchName = document.getElementById('matchName')?.textContent;
  const breeder = liked.find(b => b.name === matchName);
  if (!breeder) return;
  closeMatch();
  addContactIfNotExists(breeder);
  setTimeout(() => { openMessenger(); setTimeout(() => startChat(breeder.id), 300); }, 300);
}
function showPetDetails(breederId) {
  currentSelectedBreederId = breederId;
  const breeder = currentBreeders.find(b => b.id === breederId) || liked.find(b => b.id === breederId) || passed.find(b => b.id === breederId);
  if (!breeder) return;
  const panel = document.getElementById('petDetailsPanel');
  const content = document.getElementById('petDetailsContent');
  if (!panel || !content) return;
  content.innerHTML = `
    <div class="pet-details-header"><img src="${breeder.image}" alt="${breeder.name}" class="pet-details-img"><div class="pet-details-name">${breeder.name}</div><div class="pet-details-breed">${breeder.breed} • ${breeder.location}</div></div>
    <button class="documents-btn" onclick="showDocuments(${breeder.id})">📋 View Health Records (${breeder.documents?.length || 0})</button>
    <button class="message-owner-btn" onclick="messageOwner(${breeder.id})">💬 Message Owner</button>
    <div class="detail-section"><h4>📊 Statistics</h4><div class="detail-row"><span class="detail-label">Rating</span><span class="detail-value">⭐ ${breeder.rating}</span></div><div class="detail-row"><span class="detail-label">Successful Litters</span><span class="detail-value">${breeder.litters}</span></div><div class="detail-row"><span class="detail-label">Verified Breeder</span><span class="detail-value">${breeder.verified ? '✅ Yes' : '⚠️ No'}</span></div></div>
    <div class="detail-section"><h4>👤 Owner Information</h4><div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${breeder.owner || 'Not available'}</span></div><div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${breeder.phone || 'Hidden'}</span></div><div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${breeder.email || 'Hidden'}</span></div></div>
    <div class="detail-section"><h4>📝 About</h4><p style="color: var(--text-secondary); line-height: 1.6;">${breeder.description || 'No description available.'}</p></div>
  `;
  panel.classList.add('active');
}
function closePetDetails() { const panel = document.getElementById('petDetailsPanel'); if (panel) panel.classList.remove('active'); }
function showDocuments(breederId) {
  const breeder = currentBreeders.find(b => b.id === breederId) || liked.find(b => b.id === breederId);
  if (!breeder || !breeder.documents) return;
  const modal = document.getElementById('documentModal');
  const grid = document.getElementById('documentsGrid');
  if (!modal || !grid) return;
  grid.innerHTML = breeder.documents.map(doc => `<div class="document-item" onclick="viewDocument('${doc.name}')"><div class="document-icon">${doc.icon}</div><div class="document-name">${doc.name}</div><div class="document-date">${doc.date}</div></div>`).join('');
  modal.classList.add('active');
}
function closeDocumentModal() { const modal = document.getElementById('documentModal'); if (modal) modal.classList.remove('active'); }
function viewDocument(name) { showToast(`Opening ${name}...`); }
function messageOwner(breederId) {
  const breeder = currentBreeders.find(b => b.id === breederId) || liked.find(b => b.id === breederId);
  if (!breeder) return;
  closePetDetails();
  addContactIfNotExists(breeder);
  setTimeout(() => { openMessenger(); setTimeout(() => startChat(breeder.id), 300); }, 300);
}
function toggleFilters() { document.getElementById('filterToggle')?.classList.toggle('active'); document.getElementById('filterPanel')?.classList.toggle('active'); }
function updateBreeds() {
  const category = document.getElementById('categorySelect')?.value;
  const breedSelect = document.getElementById('breedSelect');
  if (!breedSelect) return;
  breedSelect.innerHTML = '<option value="">All Breeds</option>';
  const breeds = [...new Set(currentBreeders.filter(b => !category || b.category === category).map(b => b.breed))];
  breeds.forEach(breed => { const option = document.createElement('option'); option.value = breed; option.textContent = breed; breedSelect.appendChild(option); });
  applyFilters();
}
function applyFilters() {
  const category = document.getElementById('categorySelect')?.value;
  const breed = document.getElementById('breedSelect')?.value;
  let filtered = currentBreeders;
  if (category) filtered = filtered.filter(b => b.category === category);
  if (breed) filtered = filtered.filter(b => b.breed === breed);
  currentBreeders = filtered;
  renderCards();
  if (currentBreeders.length > 0) showPetDetails(currentBreeders[currentBreeders.length - 1].id);
}
function resetFilters() { const categorySelect = document.getElementById('categorySelect'); if (categorySelect) categorySelect.value = ''; updateBreeds(); }
function showPassed() { currentBreeders = [...passed]; passed = []; renderCards(); showToast('Showing previously passed breeders 🔄'); }

// ------------------------- Messenger (Real API) -------------------------
async function loadConversations() {
  try {
    const convs = await API.get('/conversations');
    mockContacts = convs.map(c => ({
      id: c.userId,
      name: c.userName,
      avatar: c.userAvatar,
      lastMessage: c.lastMessage,
      time: formatDate(c.lastMessageTime),
      unread: c.unreadCount
    }));
    renderContactsList();
  } catch (err) { console.error('Failed to load conversations', err); }
}
async function loadMessages(contactId) {
  try {
    const msgs = await API.get(`/messages/${contactId}`);
    mockMessages[contactId] = msgs.map(m => ({
      id: m.id,
      sender: m.senderId === User.getUser().id ? 'me' : 'them',
      text: m.text,
      image: m.image,
      time: formatDate(m.createdAt, true)
    }));
    renderMessages(contactId);
    await API.post(`/messages/${contactId}/read`);
  } catch (err) { console.error('Failed to load messages', err); }
}
async function sendMessageToApi(contactId, text, imageData) {
  let imageUrl = null;
  if (imageData) {
    const formData = new FormData();
    formData.append('image', imageData);
    const uploadRes = await fetch(`${API.base}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('breedlink_token')}` },
      body: formData
    });
    if (uploadRes.ok) {
      const uploadJson = await uploadRes.json();
      imageUrl = uploadJson.url;
    }
  }
  const payload = { to: contactId, text: text || '', image: imageUrl };
  const newMsg = await API.post('/messages', payload);
  if (!mockMessages[contactId]) mockMessages[contactId] = [];
  mockMessages[contactId].push({
    id: newMsg.id,
    sender: 'me',
    text: newMsg.text,
    image: newMsg.image,
    time: formatDate(newMsg.createdAt, true)
  });
  renderMessages(contactId);
  await loadConversations();
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
  if (!mockContacts.length) {
    list.innerHTML = '<div style="text-align: center; padding: 40px;">No conversations yet. Start swiping to find matches!</div>';
    return;
  }
  list.innerHTML = mockContacts.map(contact => `
    <div class="contact-item" onclick="startChat(${contact.id})">
      <img src="${contact.avatar}" alt="${contact.name}">
      <div class="contact-info">
        <div class="contact-name">${contact.name}</div>
        <div class="contact-preview">${contact.lastMessage}</div>
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
  const contact = mockContacts.find(c => c.id === contactId);
  if (!contact) return;
  document.getElementById('messengerContacts').classList.remove('active');
  document.getElementById('messengerEmpty').classList.add('hidden');
  document.getElementById('messengerChat').classList.add('active');
  document.getElementById('chatAvatar').src = contact.avatar;
  document.getElementById('chatName').textContent = contact.name;
  await loadMessages(contactId);
  contact.unread = 0;
  renderContactsList();
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
  const messages = mockMessages[contactId] || [];
  if (!messages.length) {
    container.innerHTML = '<div style="text-align: center; padding: 40px;">Start a conversation! Say hello 👋</div>';
  } else {
    container.innerHTML = messages.map(msg => {
      if (msg.image) {
        return `<div class="${msg.sender === 'me' ? 'message-sent' : 'message-received'}"><div class="message-bubble"><img src="${msg.image}" style="max-width:200px; border-radius:12px;"></div></div>`;
      }
      return `<div class="${msg.sender === 'me' ? 'message-sent' : 'message-received'}"><div class="message-bubble">${escapeHtml(msg.text)}</div></div>`;
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
  if (!query.trim()) {
    renderContactsList();
    return;
  }
  const filtered = mockContacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
  const list = document.getElementById('contactsList');
  if (!list) return;
  if (!filtered.length) {
    list.innerHTML = '<div style="text-align: center; padding: 20px;">No contacts found</div>';
    return;
  }
  list.innerHTML = filtered.map(contact => `
    <div class="contact-item" onclick="startChat(${contact.id})">
      <img src="${contact.avatar}" alt="${contact.name}">
      <div class="contact-info">
        <div class="contact-name">${contact.name}</div>
        <div class="contact-preview">${contact.lastMessage}</div>
      </div>
      <div class="contact-meta">
        <div class="contact-time">${contact.time}</div>
        ${contact.unread > 0 ? `<div class="unread-badge">${contact.unread}</div>` : ''}
      </div>
    </div>
  `).join('');
}
function addContactIfNotExists(breeder) {
  // No need to add manually – conversations will appear when a match is created or message is sent
}
function checkForPendingChat() {
  const pendingChat = sessionStorage.getItem('pendingChat');
  if (pendingChat) {
    const breeder = JSON.parse(pendingChat);
    sessionStorage.removeItem('pendingChat');
    setTimeout(() => { openMessenger(); }, 500);
  }
}
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; if (m === '"') return '&quot;'; if (m === "'") return '&#039;'; return m; });
}
function init() {
  if (!protectSwipePage()) return;
  cardStack = document.getElementById('cardStack');
  emptyState = document.getElementById('emptyState');
  indicatorNope = document.getElementById('indicatorNope');
  indicatorLike = document.getElementById('indicatorLike');
  matchesList = document.getElementById('matchesList');
  matchCount = document.getElementById('matchCount');
  if (!cardStack) { console.error('cardStack element not found'); return; }
  liked = [];
  passed = [];
  loadSwipeQueue();
  updateBreeds();
  checkForPendingChat();
}
document.addEventListener('DOMContentLoaded', function() { init(); });
document.getElementById('matchOverlay')?.addEventListener('click', function(e) { if (e.target === this) closeMatch(); });

window.swipe = swipe;
window.toggleFilters = toggleFilters;
window.updateBreeds = updateBreeds;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.showPassed = showPassed;
window.closeMatch = closeMatch;
window.messageMatch = messageMatch;
window.viewMatchProfile = viewMatchProfile;
window.messageMatchBreeder = messageMatchBreeder;
window.showPetDetails = showPetDetails;
window.closePetDetails = closePetDetails;
window.showDocuments = showDocuments;
window.closeDocumentModal = closeDocumentModal;
window.viewDocument = viewDocument;
window.messageOwner = messageOwner;
window.openMessenger = openMessenger;
window.closeMessenger = closeMessenger;
window.startChat = startChat;
window.backToContacts = backToContacts;
window.sendMessage = sendMessage;
window.sendImage = sendImage;
window.searchContacts = searchContacts;