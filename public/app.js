// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
let characters = JSON.parse(localStorage.getItem('talkie_characters')) || [
  {
    id: 'char_default_1',
    name: 'Agnes Tachyon',
    gender: 'Femenino',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    relationship: 'Compañera de laboratorio',
    tone: 'Científica curiosa',
    scenario: 'En el laboratorio probando un nuevo brebaje experimental.',
    personality: 'Extravagante, perspicaz, enfocada en la investigación.',
    config: 'Le apasiona la ciencia y habla con metáforas de experimentos.',
    intro: 'Científica atrevida apasionada por la investigación.',
    prologue: '*Ajusta sus lentes y te observa fijamente con una sonrisa curiosa* ¿Has venido a participar en mi nuevo experimento?'
  }
];

let activeCharacter = null;
let selectedGender = 'Hombre';
let selectedPersonalities = [];
let editingMsgIndex = null;
let currentAvatarUrl = '';

const PERSONALITY_OPTIONS = [
  'Coqueto', 'Frío', 'Tsundere', 'Protector', 'Misterioso', 
  'Divertido', 'Celoso', 'Intelectual', 'Cariñoso', 'Amigable',
  'Dominante', 'Tímido', 'Rebelde', 'Leal', 'Energético'
];

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  renderPersonalityChips();
  renderExploreGrid();
  renderMessagesList();
  checkDriveAuthOnLoad();
});

// ==========================================
// NAVEGACIÓN DE PESTAÑAS
// ==========================================
function switchTab(tabName, element) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  
  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (selectedTab) selectedTab.classList.add('active');
  if (element) element.classList.add('active');
}

// ==========================================
// CONFIGURACIÓN DE CHIPS Y GÉNERO
// ==========================================
function renderPersonalityChips() {
  const container = document.getElementById('personality-chips');
  if (!container) return;
  container.innerHTML = '';
  
  PERSONALITY_OPTIONS.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerText = p;
    chip.onclick = () => {
      if (selectedPersonalities.includes(p)) {
        selectedPersonalities = selectedPersonalities.filter(x => x !== p);
        chip.classList.remove('selected');
      } else {
        if (selectedPersonalities.length < 3) {
          selectedPersonalities.push(p);
          chip.classList.add('selected');
        } else {
          alert('Máximo 3 personalidades');
        }
      }
    };
    container.appendChild(chip);
  });
}

function selectGender(btn, gender) {
  document.querySelectorAll('.btn-gender').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedGender = gender;
}

// ==========================================
// CREACIÓN DE FOTO DE PERFIL (SUBIR O IA ANIME)
// ==========================================
function switchAvatarMode(mode, evt) {
  document.querySelectorAll('.tab-avatar-btn').forEach(b => b.classList.remove('active'));
  if (evt && evt.target) evt.target.classList.add('active');

  const uploadBox = document.getElementById('avatar-mode-upload');
  const aiBox = document.getElementById('avatar-mode-ai');

  if (mode === 'upload') {
    if (uploadBox) uploadBox.classList.remove('hidden');
    if (aiBox) aiBox.classList.add('hidden');
  } else {
    if (uploadBox) uploadBox.classList.add('hidden');
    if (aiBox) aiBox.classList.remove('hidden');
  }
}

function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    currentAvatarUrl = e.target.result;
    const img = document.getElementById('image-preview');
    if (img) {
      img.src = currentAvatarUrl;
      img.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

function generateAIAvatar() {
  const userPrompt = document.getElementById('ai-image-prompt').value.trim();
  if (!userPrompt) return alert("Escribe una breve descripción para la foto.");

  const spinner = document.getElementById('ai-loading-spinner');
  if (spinner) spinner.classList.remove('hidden');

  // MODIFICACIÓN: Forzar estilo Anime 2D / No Realista
  const animePrompt = `${userPrompt}, anime style, 2D illustration, cel shaded, anime character design, digital art, vibrant colors, non-realistic`;
  const encodedPrompt = encodeURIComponent(animePrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

  const imgTester = new Image();
  imgTester.src = imageUrl;
  imgTester.onload = () => {
    currentAvatarUrl = imageUrl;
    const img = document.getElementById('image-preview');
    if (img) {
      img.src = currentAvatarUrl;
      img.style.display = 'block';
    }
    alert("✨ ¡Foto de perfil estilo anime generada con éxito!");
    if (spinner) spinner.classList.add('hidden');
  };
  imgTester.onerror = () => {
    alert("Error al generar la imagen. Inténtalo de nuevo.");
    if (spinner) spinner.classList.add('hidden');
  };
}

// ==========================================
// CREAR PERSONAJE
// ==========================================
function createNewCharacter() {
  const name = document.getElementById('char-name').value.trim();
  const config = document.getElementById('char-config').value.trim();
  const intro = document.getElementById('char-intro').value.trim();
  const prologue = document.getElementById('char-prologue').value.trim();

  if (!name || !config || !intro || !prologue) {
    return alert("Por favor completa todos los campos obligatorios (*)");
  }

  const newChar = {
    id: 'char_' + Date.now(),
    name,
    gender: selectedGender,
    avatar: currentAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    relationship: document.getElementById('char-relationship').value.trim() || 'Amigos',
    tone: document.getElementById('char-tone').value.trim() || 'Neutral',
    scenario: document.getElementById('char-scenario').value.trim() || '',
    personality: selectedPersonalities.join(', '),
    config,
    intro,
    prologue
  };

  characters.unshift(newChar);
  localStorage.setItem('talkie_characters', JSON.stringify(characters));

  // Inicializar historial con el prólogo
  saveChatHistory(newChar.id, [{ role: 'assistant', content: newChar.prologue }]);

  renderExploreGrid();
  renderMessagesList();
  openChat(newChar);
  autoSyncDrive();
}

// ==========================================
// RENDERIZADO DE VISTAS LOBBY
// ==========================================
function renderExploreGrid() {
  const grid = document.getElementById('characters-grid');
  if (!grid) return;
  grid.innerHTML = '';

  characters.forEach(c => {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.onclick = () => openChat(c);

    card.innerHTML = `
      <img src="${c.avatar}" alt="${c.name}" class="chat-avatar" style="width:100%; height:140px; border-radius:12px 12px 0 0; object-fit:cover;">
      <div class="char-card-body" style="padding:10px;">
        <h4 class="char-card-title">${c.name}</h4>
        <p class="char-card-intro">${c.intro}</p>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderMessagesList() {
  const list = document.getElementById('chats-list');
  if (!list) return;
  list.innerHTML = '';

  characters.forEach(c => {
    const history = getChatHistory(c.id);
    if (history.length > 0) {
      const lastMsg = history[history.length - 1].content;
      const card = document.createElement('div');
      card.className = 'chat-item';
      card.onclick = () => openChat(c);

      card.innerHTML = `
        <img src="${c.avatar}" class="chat-avatar" alt="${c.name}">
        <div class="chat-info">
          <div class="chat-name">${c.name}</div>
          <div class="chat-last-msg">${formatMessageText(lastMsg)}</div>
        </div>
      `;
      list.appendChild(card);
    }
  });
}

// ==========================================
// FORMATEADOR DE ACCIONES (*acción*)
// ==========================================
function formatMessageText(text) {
  if (!text) return '';
  // Escapar HTML básico para evitar inyecciones
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Reemplazar *texto* con la clase CSS .action-text
  return escaped.replace(/\*(.*?)\*/g, '<span class="action-text">*$1*</span>');
}

// ==========================================
// SISTEMA DE CHAT EN VIVO
// ==========================================
function openChat(character) {
  activeCharacter = character;
  
  const nameElem = document.getElementById('chat-header-name');
  const avatarElem = document.getElementById('chat-header-avatar');
  if (nameElem) nameElem.innerText = character.name;
  if (avatarElem) avatarElem.src = character.avatar;
  
  const bgOverlay = document.getElementById('chat-bg-overlay');
  if (bgOverlay) bgOverlay.style.backgroundImage = `url('${character.avatar}')`;

  const chatModal = document.getElementById('chat-modal');
  if (chatModal) chatModal.classList.remove('hidden');
  
  renderChatMessages();
}

function closeChat() {
  const chatModal = document.getElementById('chat-modal');
  if (chatModal) chatModal.classList.add('hidden');
  activeCharacter = null;
  renderMessagesList();
}

function getChatHistory(charId) {
  return JSON.parse(localStorage.getItem(`talkie_chat_${charId}`)) || [];
}

function saveChatHistory(charId, history) {
  localStorage.setItem(`talkie_chat_${charId}`, JSON.stringify(history));
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;
  container.innerHTML = '';

  if (!activeCharacter) return;
  const history = getChatHistory(activeCharacter.id);

  history.forEach((msg, index) => {
    const bubble = document.createElement('div');
    const isUser = msg.role === 'user';
    bubble.className = `msg-bubble ${isUser ? 'msg-user' : 'msg-bot'}`;
    
    // Aplicar formateo para texto y acciones (*acción*)
    bubble.innerHTML = formatMessageText(msg.content);

    if (isUser) {
      bubble.title = "Haz clic para editar este mensaje";
      bubble.onclick = () => openEditMessageModal(index, msg.content);
    }

    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

// ==========================================
// ENVIAR MENSAJE A LA IA
// ==========================================
async function sendMessage() {
  const input = document.getElementById('user-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !activeCharacter) return;

  input.value = '';
  let history = getChatHistory(activeCharacter.id);
  history.push({ role: 'user', content: text });
  
  saveChatHistory(activeCharacter.id, history);
  renderChatMessages();

  await requestAIResponse(history);
}

async function requestAIResponse(history) {
  showTypingIndicator(true);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        characterConfig: activeCharacter,
        isAutoTrigger: false
      })
    });

    const data = await res.json();
    showTypingIndicator(false);

    if (data.reply) {
      history.push({ role: 'assistant', content: data.reply });
      saveChatHistory(activeCharacter.id, history);
      renderChatMessages();
      autoSyncDrive();
    } else {
      alert("Error: " + (data.error || "No hubo respuesta"));
    }
  } catch (err) {
    showTypingIndicator(false);
    console.error(err);
    alert("Error conectando con el servidor");
  }
}

function showTypingIndicator(show) {
  let indicator = document.getElementById('typing-indicator');
  const container = document.getElementById('chat-messages-container');
  
  if (show) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'typing-indicator';
      indicator.className = 'typing-indicator';
      indicator.innerText = `${activeCharacter ? activeCharacter.name : 'IA'} está escribiendo...`;
      if (container) container.appendChild(indicator);
    }
    if (container) container.scrollTop = container.scrollHeight;
  } else if (indicator) {
    indicator.remove();
  }
}

// ==========================================
// HERRAMIENTAS TALKIE (RAYITO Y RE-INTENTAR)
// ==========================================
async function triggerLightningAuto() {
  if (!activeCharacter) return;
  let history = getChatHistory(activeCharacter.id);
  
  showTypingIndicator(true);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        characterConfig: activeCharacter,
        isAutoTrigger: true
      })
    });
    const data = await res.json();
    showTypingIndicator(false);

    if (data.reply) {
      history.push({ role: 'assistant', content: data.reply });
      saveChatHistory(activeCharacter.id, history);
      renderChatMessages();
      autoSyncDrive();
    }
  } catch (e) {
    showTypingIndicator(false);
    alert("Falló la acción automática.");
  }
}

async function regenerateLastMessage() {
  if (!activeCharacter) return;
  let history = getChatHistory(activeCharacter.id);
  
  if (history.length > 0 && history[history.length - 1].role === 'assistant') {
    history.pop(); // Eliminar la última respuesta de la IA
    saveChatHistory(activeCharacter.id, history);
    renderChatMessages();
    await requestAIResponse(history);
  }
}

// ==========================================
// EDICIÓN DE MENSAJES DE USUARIO
// ==========================================
function openEditMessageModal(index, text) {
  editingMsgIndex = index;
  const editInput = document.getElementById('edit-message-text');
  if (editInput) editInput.value = text;
  
  const modal = document.getElementById('edit-message-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeEditMessageModal() {
  const modal = document.getElementById('edit-message-modal');
  if (modal) modal.classList.add('hidden');
  editingMsgIndex = null;
}

async function confirmMessageEdit() {
  const editInput = document.getElementById('edit-message-text');
  if (!editInput) return;
  const newText = editInput.value.trim();
  if (!newText || editingMsgIndex === null) return;

  let history = getChatHistory(activeCharacter.id);
  
  // Recortar historial hasta el mensaje editado
  history = history.slice(0, editingMsgIndex);
  history.push({ role: 'user', content: newText });

  saveChatHistory(activeCharacter.id, history);
  closeEditMessageModal();
  renderChatMessages();

  await requestAIResponse(history);
}

// ==========================================
// MENÚ DROPDOWN, LIMPIAR Y ELIMINAR CHAT
// ==========================================
function toggleChatDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('chat-dropdown-menu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

document.addEventListener('click', () => {
  const dropdown = document.getElementById('chat-dropdown-menu');
  if (dropdown) dropdown.classList.add('hidden');
});

function clearChatHistory() {
  if (!activeCharacter) return;
  if (confirm(`¿Reiniciar conversación con ${activeCharacter.name}?`)) {
    saveChatHistory(activeCharacter.id, [{ role: 'assistant', content: activeCharacter.prologue }]);
    renderChatMessages();
    autoSyncDrive();
  }
}

function deleteCurrentCharacter() {
  if (!activeCharacter) return;
  if (confirm(`¿Estás seguro de eliminar a "${activeCharacter.name}" y toda su conversación?`)) {
    const charId = activeCharacter.id;
    
    // Eliminar de la lista de personajes
    characters = characters.filter(c => c.id !== charId);
    localStorage.setItem('talkie_characters', JSON.stringify(characters));
    
    // Eliminar historial
    localStorage.removeItem(`talkie_chat_${charId}`);
    
    closeChat();
    renderExploreGrid();
    renderMessagesList();
    autoSyncDrive();
  }
}

function openCharacterCard() {
  if (!activeCharacter) return;
  document.getElementById('card-avatar').src = activeCharacter.avatar;
  document.getElementById('card-name').innerText = activeCharacter.name;
  document.getElementById('card-relationship-tag').innerText = `Relación: ${activeCharacter.relationship}`;
  document.getElementById('card-tone-tag').innerText = `Tono: ${activeCharacter.tone}`;
  document.getElementById('card-intro').innerText = activeCharacter.intro;
  document.getElementById('card-scenario').innerText = activeCharacter.scenario || 'Sin escenario definido.';

  const cardModal = document.getElementById('character-card-modal');
  if (cardModal) cardModal.classList.remove('hidden');
}

function closeCharacterCard() {
  const cardModal = document.getElementById('character-card-modal');
  if (cardModal) cardModal.classList.add('hidden');
}

function handleKeyPress(e) {
  if (e.key === 'Enter') sendMessage();
}

// ==========================================
// GOOGLE DRIVE INTEGRACIÓN PERSISTENTE
// ==========================================
function checkDriveAuthOnLoad() {
  const token = localStorage.getItem('gdrive_token');
  const statusElem = document.getElementById('drive-status');
  if (token && statusElem) {
    statusElem.innerText = 'Drive Conectado';
  }
}

function handleDriveAuth() {
  if (typeof google === 'undefined' || !google.accounts) {
    return alert("SDK de Google Drive no cargado.");
  }
  
  google.accounts.oauth2.initTokenClient({
    client_id: 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Reemplaza con tu Client ID
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.access_token) {
        localStorage.setItem('gdrive_token', response.access_token);
        const statusElem = document.getElementById('drive-status');
        if (statusElem) statusElem.innerText = 'Drive Conectado';
        alert("¡Conectado exitosamente con Google Drive!");
        autoSyncDrive();
      }
    }
  }).requestAccessToken();
}

function triggerManualSync() {
  autoSyncDrive(true);
}

async function autoSyncDrive(isManual = false) {
  const token = localStorage.getItem('gdrive_token');
  if (!token) return;

  const backupData = JSON.stringify(localStorage);

  try {
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: backupData
    });

    if (res.ok && isManual) {
      alert("☁️ ¡Copia guardada en Google Drive correctamente!");
    }
  } catch (err) {
    console.warn("Auto-sync Drive falló:", err);
  }
}
