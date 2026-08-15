// --- ESTADO GLOBAL DE LA APLICACIÓN ---
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
    prologue: '*Ajusta sus lentes y te observa fijamente* ¿Has venido a participar en mi nuevo experimento?'
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

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  renderPersonalityChips();
  renderExploreGrid();
  renderMessagesList();
  checkDriveAuthOnLoad();
});

// --- NAVEGACIÓN DE PESTAÑAS ---
function switchTab(tabName, element) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  
  document.getElementById(`tab-${tabName}`).classList.add('active');
  element.classList.add('active');
}

// --- CONFIGURACIÓN DE CHIPS Y GÉNERO ---
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

// --- CREACIÓN DE FOTO DE PERFIL (SUBIR O IA) ---
function switchAvatarMode(mode) {
  document.querySelectorAll('.tab-avatar-btn').forEach(b => b.classList.remove('active'));
  if (mode === 'upload') {
    event.target.classList.add('active');
    document.getElementById('avatar-mode-upload').classList.remove('hidden');
    document.getElementById('avatar-mode-ai').classList.add('hidden');
  } else {
    event.target.classList.add('active');
    document.getElementById('avatar-mode-upload').classList.add('hidden');
    document.getElementById('avatar-mode-ai').classList.remove('hidden');
  }
}

function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    currentAvatarUrl = e.target.result;
    const img = document.getElementById('image-preview');
    img.src = currentAvatarUrl;
    img.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function generateAIAvatar() {
  const prompt = document.getElementById('ai-image-prompt').value.trim();
  if (!prompt) return alert("Escribe una breve descripción para la foto.");

  const spinner = document.getElementById('ai-loading-spinner');
  spinner.classList.remove('hidden');

  // API gratuita de Pollinations.ai
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random()*1000)}`;

  const imgTester = new Image();
  imgTester.src = imageUrl;
  imgTester.onload = () => {
    currentAvatarUrl = imageUrl;
    alert("✨ ¡Imagen generada con éxito!");
    spinner.classList.add('hidden');
  };
}

// --- CREAR PERSONAJE ---
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

// --- RENDERIZADO DE VISTAS LOBBY ---
function renderExploreGrid() {
  const grid = document.getElementById('characters-grid');
  if (!grid) return;
  grid.innerHTML = '';

  characters.forEach(c => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--bg-card); border-radius: 12px; padding: 12px;
      display: flex; gap: 12px; align-items: center; cursor: pointer; margin-bottom: 10px;
    `;
    card.innerHTML = `
      <img src="${c.avatar}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
      <div>
        <h4 style="margin-bottom:2px;">${c.name}</h4>
        <p style="font-size:0.75rem; color: var(--text-muted);">${c.intro}</p>
      </div>
    `;
    card.onclick = () => openChat(c);
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
      card.style.cssText = `
        background: var(--bg-card); border-radius: 12px; padding: 12px;
        display: flex; gap: 12px; align-items: center; cursor: pointer; margin-bottom: 10px;
      `;
      card.innerHTML = `
        <img src="${c.avatar}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
        <div style="flex:1; overflow:hidden;">
          <h4 style="margin-bottom:2px;">${c.name}</h4>
          <p style="font-size:0.75rem; color: var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${lastMsg}</p>
        </div>
      `;
      card.onclick = () => openChat(c);
      list.appendChild(card);
    }
  });
}

// --- SISTEMA DE CHAT EN VIVO ---
function openChat(character) {
  activeCharacter = character;
  
  document.getElementById('chat-header-name').innerText = character.name;
  document.getElementById('chat-header-avatar').src = character.avatar;
  
  // Establecer fondo difuminado
  const bgOverlay = document.getElementById('chat-bg-overlay');
  bgOverlay.style.backgroundImage = `url('${character.avatar}')`;

  document.getElementById('chat-modal').classList.remove('hidden');
  renderChatMessages();
}

function closeChat() {
  document.getElementById('chat-modal').classList.add('hidden');
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
  container.innerHTML = '';

  const history = getChatHistory(activeCharacter.id);

  history.forEach((msg, index) => {
    const bubble = document.createElement('div');
    const isUser = msg.role === 'user';
    bubble.className = `msg-bubble ${isUser ? 'msg-user' : 'msg-bot'}`;
    bubble.innerText = msg.content;

    // Permitir editar mensajes de usuario al hacer clic
    if (isUser) {
      bubble.title = "Haz clic para editar este mensaje";
      bubble.onclick = () => openEditMessageModal(index, msg.content);
    }

    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

// --- ENVIAR MENSAJE A LA IA ---
async function sendMessage() {
  const input = document.getElementById('user-input');
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
    if (data.reply) {
      history.push({ role: 'assistant', content: data.reply });
      saveChatHistory(activeCharacter.id, history);
      renderChatMessages();
      autoSyncDrive();
    } else {
      alert("Error: " + (data.error || "No hubo respuesta"));
    }
  } catch (err) {
    console.error(err);
    alert("Error conectando con el servidor");
  }
}

// --- HERRAMIENTAS TALKIE (RAYITO Y RE-INTENTAR) ---
async function triggerLightningAuto() {
  if (!activeCharacter) return;
  let history = getChatHistory(activeCharacter.id);
  
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
    if (data.reply) {
      history.push({ role: 'assistant', content: data.reply });
      saveChatHistory(activeCharacter.id, history);
      renderChatMessages();
      autoSyncDrive();
    }
  } catch (e) {
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

// --- EDICIÓN DE MENSAJES DE USUARIO ---
function openEditMessageModal(index, text) {
  editingMsgIndex = index;
  document.getElementById('edit-message-text').value = text;
  document.getElementById('edit-message-modal').classList.remove('hidden');
}

function closeEditMessageModal() {
  document.getElementById('edit-message-modal').classList.add('hidden');
  editingMsgIndex = null;
}

async function confirmMessageEdit() {
  const newText = document.getElementById('edit-message-text').value.trim();
  if (!newText || editingMsgIndex === null) return;

  let history = getChatHistory(activeCharacter.id);
  
  // Cortar el historial hasta antes del mensaje editado y agregar el nuevo
  history = history.slice(0, editingMsgIndex);
  history.push({ role: 'user', content: newText });

  saveChatHistory(activeCharacter.id, history);
  closeEditMessageModal();
  renderChatMessages();

  await requestAIResponse(history);
}

// --- MENÚ 3 PUNTOS & FICHA ---
function toggleChatDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('chat-dropdown-menu');
  dropdown.classList.toggle('hidden');
}

document.addEventListener('click', () => {
  const dropdown = document.getElementById('chat-dropdown-menu');
  if (dropdown) dropdown.classList.add('hidden');
});

function clearChatHistory() {
  if (!activeCharacter) return;
  if (confirm(`¿Eliminar la conversación con ${activeCharacter.name}?`)) {
    saveChatHistory(activeCharacter.id, [{ role: 'assistant', content: activeCharacter.prologue }]);
    renderChatMessages();
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

  document.getElementById('character-card-modal').classList.remove('hidden');
}

function closeCharacterCard() {
  document.getElementById('character-card-modal').classList.add('hidden');
}

function handleKeyPress(e) {
  if (e.key === 'Enter') sendMessage();
}

// --- GOOGLE DRIVE INTEGRACIÓN PERSISTENTE ---
function checkDriveAuthOnLoad() {
  const token = localStorage.getItem('gdrive_token');
  if (token) {
    document.getElementById('drive-status').innerText = 'Drive Conectado';
  }
}

function handleDriveAuth() {
  google.accounts.oauth2.initTokenClient({
    client_id: 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Reemplaza con tu Client ID
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.access_token) {
        localStorage.setItem('gdrive_token', response.access_token);
        document.getElementById('drive-status').innerText = 'Drive Conectado';
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
