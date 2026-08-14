const PERSONALITIES = [
  "Cariñosa", "Tsundere", "Yandere", "Fría / Distante", "Dominante", 
  "Sumisa", "Celosa", "Divertida", "Misteriosa", "Gamer / Otaku", 
  "Protectora", "Coqueta", "Inteligente", "Rebelde", "Energética"
];

// Coloca aquí tu Client ID de Google Cloud OAuth
const GOOGLE_CLIENT_ID = "52700461638-j9sqlt044m6t14krnkmlfiq0trfe2ct3.apps.googleusercontent.com";

let currentSelectedGender = "Hombre";
let selectedPersonalities = [];
let currentImageBase64 = "https://via.placeholder.com/150";
let currentActiveCharId = null;

let driveAccessToken = null;
let driveFileId = null;

let appData = {
  characters: [],
  chats: {}
};

document.addEventListener('DOMContentLoaded', () => {
  renderPersonalitiesChips();
  loadLocalData();
  renderCharactersGrid();
  renderMessagesList();
});

function switchTab(tabName, element) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`tab-${tabName}`).classList.add('active');
  element.classList.add('active');
}

function renderPersonalitiesChips() {
  const container = document.getElementById('personality-chips');
  container.innerHTML = '';
  PERSONALITIES.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerText = p;
    chip.onclick = () => {
      chip.classList.toggle('active');
      if (selectedPersonalities.includes(p)) {
        selectedPersonalities = selectedPersonalities.filter(item => item !== p);
      } else {
        selectedPersonalities.push(p);
      }
    };
    container.appendChild(chip);
  });
}

function selectGender(btn, gender) {
  document.querySelectorAll('.btn-gender').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentSelectedGender = gender;
}

function previewImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentImageBase64 = e.target.result;
      const img = document.getElementById('image-preview');
      img.src = currentImageBase64;
      img.style.display = 'block';
    }
    reader.readAsDataURL(file);
  }
}

function parseAsterisks(text) {
  if (!text) return '';
  let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return safeText.replace(/\*([^*]+)\*/g, '<span class="action-text">* $1 *</span>');
}

function createNewCharacter() {
  const name = document.getElementById('char-name').value.trim();
  const config = document.getElementById('char-config').value.trim();
  const intro = document.getElementById('char-intro').value.trim();
  const prologue = document.getElementById('char-prologue').value.trim();

  if (!name || !config || !intro || !prologue) {
    alert("Por favor completa todos los campos marcados con (*)");
    return;
  }

  const newChar = {
    id: "char_" + Date.now(),
    name,
    gender: currentSelectedGender,
    personality: selectedPersonalities.join(", ") || "Normal",
    config,
    intro,
    prologue,
    image: currentImageBase64
  };

  appData.characters.push(newChar);
  appData.chats[newChar.id] = [
    { sender: 'char', text: prologue }
  ];

  saveData();
  alert("¡Personaje creado exitosamente!");
  
  document.getElementById('char-name').value = '';
  document.getElementById('char-config').value = '';
  document.getElementById('char-intro').value = '';
  document.getElementById('char-prologue').value = '';
  
  renderCharactersGrid();
  renderMessagesList();
  switchTab('explore', document.querySelectorAll('.nav-item')[1]);
}

function renderCharactersGrid() {
  const grid = document.getElementById('characters-grid');
  grid.innerHTML = '';

  if (appData.characters.length === 0) {
    grid.innerHTML = '<p style="grid-column: span 2; color: #666;">No hay personajes aún.</p>';
    return;
  }

  appData.characters.forEach(char => {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.onclick = () => openChat(char.id);
    card.innerHTML = `
      <img src="${char.image}" alt="${char.name}">
      <div class="char-card-body">
        <div class="char-card-title">${char.name}</div>
        <div class="char-card-intro">${char.intro}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderMessagesList() {
  const list = document.getElementById('chats-list');
  list.innerHTML = '';

  const activeChats = Object.keys(appData.chats);
  if (activeChats.length === 0) {
    list.innerHTML = '<p style="color: #666;">No hay chats activos.</p>';
    return;
  }

  activeChats.forEach(charId => {
    const char = appData.characters.find(c => c.id === charId);
    if (!char) return;

    const msgs = appData.chats[charId];
    const lastMsg = msgs[msgs.length - 1]?.text || "...";

    const item = document.createElement('div');
    item.className = 'chat-item';
    item.onclick = () => openChat(char.id);
    item.innerHTML = `
      <img src="${char.image}" class="chat-avatar">
      <div class="chat-info">
        <div class="chat-name">${char.name}</div>
        <div class="chat-last-msg">${lastMsg.replace(/\*/g, '')}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

function openChat(charId) {
  currentActiveCharId = charId;
  const char = appData.characters.find(c => c.id === charId);
  
  document.getElementById('chat-header-avatar').src = char.image;
  document.getElementById('chat-header-name').innerText = char.name;
  
  renderChatMessages();
  document.getElementById('chat-modal').classList.remove('hidden');
}

function closeChat() {
  document.getElementById('chat-modal').classList.add('hidden');
  renderMessagesList();
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages-container');
  container.innerHTML = '';

  const msgs = appData.chats[currentActiveCharId] || [];
  msgs.forEach(m => {
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${m.sender === 'user' ? 'msg-user' : 'msg-char'}`;
    bubble.innerHTML = parseAsterisks(m.text);
    container.appendChild(bubble);
  });
  
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text || !currentActiveCharId) return;

  input.value = '';
  appData.chats[currentActiveCharId].push({ sender: 'user', text });
  renderChatMessages();
  saveData();

  await requestAIReply(false);
}

async function triggerLightningAuto() {
  if (!currentActiveCharId) return;
  await requestAIReply(true);
}

async function regenerateLastMessage() {
  if (!currentActiveCharId) return;
  const msgs = appData.chats[currentActiveCharId];
  if (msgs.length > 0 && msgs[msgs.length - 1].sender === 'char') {
    msgs.pop();
    renderChatMessages();
    await requestAIReply(false);
  }
}

async function requestAIReply(isAutoTrigger) {
  const char = appData.characters.find(c => c.id === currentActiveCharId);
  const container = document.getElementById('chat-messages-container');

  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.id = 'typing-indicator';
  typing.innerText = `${char.name} está respondiendo...`;
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  const apiMessages = appData.chats[currentActiveCharId].map(m => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text
  }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        characterConfig: char,
        isAutoTrigger
      })
    });

    const data = await res.json();
    document.getElementById('typing-indicator')?.remove();

    if (data.reply) {
      appData.chats[currentActiveCharId].push({ sender: 'char', text: data.reply });
      renderChatMessages();
      saveData();
    } else {
      alert("Error en la IA: " + (data.error || "No hubo respuesta"));
    }
  } catch (e) {
    document.getElementById('typing-indicator')?.remove();
    console.error("Error enviando mensaje:", e);
  }
}

function handleKeyPress(e) {
  if (e.key === 'Enter') sendMessage();
}

// GUARDA LOCALMENTE Y EN GOOGLE DRIVE
function saveData() {
  localStorage.setItem('talkie_app_data', JSON.stringify(appData));
  if (driveAccessToken) {
    syncToGoogleDrive();
  }
}

function loadLocalData() {
  const saved = localStorage.getItem('talkie_app_data');
  if (saved) {
    try { appData = JSON.parse(saved); } catch(e){}
  }
}

// -------------------------------------------------------------
// LOGICA DE AUTENTICACION Y SINCRONIZACIÓN CON GOOGLE DRIVE
// -------------------------------------------------------------

function handleDriveAuth() {
  if (GOOGLE_CLIENT_ID.includes("TU_GOOGLE_CLIENT_ID")) {
    alert("Por favor configura tu GOOGLE_CLIENT_ID en app.js");
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.access_token) {
        driveAccessToken = response.access_token;
        document.getElementById('drive-status').innerText = 'Conectado ✓';
        document.getElementById('btn-drive').style.borderColor = '#2ec4b6';
        
        // Cargar copia de seguridad desde Google Drive
        await loadFromGoogleDrive();
      }
    }
  });
  client.requestAccessToken();
}

async function syncToGoogleDrive() {
  if (!driveAccessToken) return;

  const fileContent = JSON.stringify(appData);
  const metadata = {
    name: 'talkie_backup.json',
    mimeType: 'application/json'
  };

  try {
    if (!driveFileId) {
      // Buscar si el archivo ya existe en Google Drive
      const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='talkie_backup.json' and trashed=false", {
        headers: { Authorization: `Bearer ${driveAccessToken}` }
      });
      const searchData = await searchRes.json();
      
      if (searchData.files && searchData.files.length > 0) {
        driveFileId = searchData.files[0].id;
      }
    }

    if (driveFileId) {
      // Actualizar archivo existente
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${driveAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: fileContent
      });
    } else {
      // Crear nuevo archivo si no existe
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([fileContent], { type: 'application/json' }));

      const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${driveAccessToken}` },
        body: form
      });
      const createData = await createRes.json();
      driveFileId = createData.id;
    }
    console.log("Datos sincronizados en Google Drive correctamente.");
  } catch (err) {
    console.error("Error al sincronizar con Google Drive:", err);
  }
}

async function loadFromGoogleDrive() {
  try {
    const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=name='talkie_backup.json' and trashed=false", {
      headers: { Authorization: `Bearer ${driveAccessToken}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      driveFileId = searchData.files[0].id;
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${driveAccessToken}` }
      });
      const driveData = await fileRes.json();

      if (driveData && driveData.characters) {
        appData = driveData;
        saveData();
        renderCharactersGrid();
        renderMessagesList();
        alert("¡Datos cargados con éxito desde tu Google Drive!");
      }
    } else {
      // Si el archivo no existe, lo crea por primera vez
      await syncToGoogleDrive();
    }
  } catch (err) {
    console.error("Error al cargar datos desde Google Drive:", err);
  }
}
