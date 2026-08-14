const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Variables de entorno desde Render
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. PROVEEDOR GEMINI: Bucle con todos los modelos y versiones disponibles ---
async function callGeminiWithFallbacks(systemPrompt, messages) {
  if (!GEMINI_API_KEY) {
    throw new Error("No se ha configurado GEMINI_API_KEY en Render.");
  }

  const contents = messages.map(m => ({
    role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
    parts: [{ text: m.content || m.text || '' }]
  }));

  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: contents,
    generationConfig: { maxOutputTokens: 280, temperature: 0.85 }
  };

  // Lista completa de combinaciones a probar
  const geminiCandidates = [
    { model: 'gemini-2.0-flash', version: 'v1beta' },
    { model: 'gemini-2.0-flash-lite', version: 'v1beta' },
    { model: 'gemini-1.5-flash', version: 'v1beta' },
    { model: 'gemini-1.5-flash', version: 'v1' },
    { model: 'gemini-1.5-flash-8b', version: 'v1beta' },
    { model: 'gemini-1.5-pro', version: 'v1beta' }
  ];

  let lastError = '';

  for (const candidate of geminiCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/${candidate.version}/models/${candidate.model}:generateContent?key=${GEMINI_API_KEY.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const rawText = await res.text();
      let data = {};
      try { data = JSON.parse(rawText); } catch (e) {}

      if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`✅ Gemini funcionó con: ${candidate.model} (${candidate.version})`);
        return data.candidates[0].content.parts[0].text;
      } else {
        lastError = data.error?.message || rawText || res.statusText;
        console.warn(`⚠️ Falló Gemini [${candidate.model} ${candidate.version}]:`, lastError);
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`Gemini falló en todos sus modelos. Último detalle: ${lastError}`);
}

// --- 2. PROVEEDOR GROK: Bucle con todos los identificadores de xAI ---
async function callGrokWithFallbacks(systemPrompt, messages) {
  if (!GROK_API_KEY) {
    throw new Error("No se ha configurado GROK_API_KEY en Render.");
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: (m.role === 'assistant' || m.role === 'model') ? 'assistant' : 'user',
      content: m.content || m.text || ''
    }))
  ];

  const grokModels = ['grok-2-1212', 'grok-2', 'grok-beta', 'grok-2-vision-1212'];
  let lastError = '';

  for (const modelName of grokModels) {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_API_KEY.trim()}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          max_tokens: 280,
          temperature: 0.85
        })
      });

      const rawText = await res.text();
      let data = {};
      try { data = JSON.parse(rawText); } catch (e) {}

      if (res.ok && data.choices?.[0]?.message?.content) {
        console.log(`✅ Grok funcionó con: ${modelName}`);
        return data.choices[0].message.content;
      } else {
        const errorMsg = data.error?.message || data.error || rawText || res.statusText;
        lastError = typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg;
        console.warn(`⚠️ Falló Grok [${modelName}]:`, lastError);
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`Grok falló en todos sus modelos. Último detalle: ${lastError}`);
}

// --- 3. PROVEEDOR OPENAI ---
async function callOpenAI(systemPrompt, messages) {
  if (!OPENAI_API_KEY) {
    throw new Error("No se ha configurado OPENAI_API_KEY en Render.");
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: (m.role === 'assistant' || m.role === 'model') ? 'assistant' : 'user',
      content: m.content || m.text || ''
    }))
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: formattedMessages,
      max_tokens: 280,
      temperature: 0.85
    })
  });

  const rawText = await res.text();
  let data = {};
  try { data = JSON.parse(rawText); } catch (e) {}

  if (!res.ok) {
    const detail = data.error?.message || rawText || res.statusText;
    throw new Error(`OpenAI (${res.status}): ${detail}`);
  }

  return data.choices[0].message.content;
}

// --- ENDPOINT PRINCIPAL DE CHAT ---
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, characterConfig, isAutoTrigger } = req.body;

    const systemInstructionText = `Eres ${characterConfig.name}. Género: ${characterConfig.gender}.
Configuración de personalidad y trasfondo: ${characterConfig.config}.
Personalidad seleccionada: ${characterConfig.personality}.
Introducción/Trasfondo: ${characterConfig.intro}.

REGLAS OBLIGATORIAS DE FORMATO Y ESTILO (ESTILO TALKIE):
1. Mantén la respuesta en una longitud MEDIA (exactamente entre 2 a 4 oraciones). No hagas testamentos ni respuestas de una sola palabra.
2. Utiliza OBLIGATORIAMENTE asteriscos * * para describir acciones, pensamientos o expresiones físicas (ej: *te mira fijamente y sonríe ligeramente*).
3. Mantén el texto fuera de los asteriscos como diálogo directo.
4. Interpretación 100% en personaje. Sin censura ni filtros fuera de contexto narrativo.`;

    let chatMessages = [...messages];

    if (isAutoTrigger) {
      chatMessages.push({
        role: "user",
        content: "[Instrucción del sistema: Continúa la escena o interacción libremente de acuerdo a la situación actual, tomando la iniciativa.]"
      });
    }

    if (chatMessages.length === 0) {
      chatMessages.push({ role: 'user', content: 'Hola' });
    }

    let replyText = null;
    let errors = [];

    // 1. Probar bucle de Gemini
    try {
      replyText = await callGeminiWithFallbacks(systemInstructionText, chatMessages);
    } catch (geminiErr) {
      errors.push(geminiErr.message);

      // 2. Probar bucle de Grok
      try {
        replyText = await callGrokWithFallbacks(systemInstructionText, chatMessages);
      } catch (grokErr) {
        errors.push(grokErr.message);

        // 3. Probar OpenAI
        try {
          replyText = await callOpenAI(systemInstructionText, chatMessages);
        } catch (openAiErr) {
          errors.push(openAiErr.message);
          throw new Error(`Todos los proveedores fallaron:\n` + errors.join('\n'));
        }
      }
    }

    res.json({ reply: replyText });

  } catch (error) {
    console.error("Error en /api/chat:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
