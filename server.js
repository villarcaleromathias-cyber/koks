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

// 1. Proveedor: Google Gemini (Doble verificación v1beta / v1)
async function callGemini(systemPrompt, messages) {
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

  // Intento A: Gemini 2.0 Flash (Endpoint v1beta)
  try {
    const url20 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY.trim()}`;
    const res = await fetch(url20, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const rawText = await res.text();
    let data = {};
    try { data = JSON.parse(rawText); } catch (e) {}

    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
  } catch (e) {
    console.warn("Gemini 2.0 Flash falló, probando Gemini 1.5 Flash...");
  }

  // Intento B: Gemini 1.5 Flash (Endpoint v1)
  const url15 = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY.trim()}`;
  const res = await fetch(url15, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();
  let data = {};
  try { data = JSON.parse(rawText); } catch (e) {}

  if (!res.ok) {
    const detail = data.error?.message || rawText || res.statusText;
    throw new Error(`Gemini (${res.status}): ${detail}`);
  }

  return data.candidates[0].content.parts[0].text;
}

// 2. Proveedor: xAI Grok (Requiere créditos en console.x.ai)
async function callGrok(systemPrompt, messages) {
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

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY.trim()}`
    },
    body: JSON.stringify({
      model: 'grok-2-1212',
      messages: formattedMessages,
      max_tokens: 280,
      temperature: 0.85
    })
  });

  const rawText = await res.text();
  let data = {};
  try { data = JSON.parse(rawText); } catch (e) {}

  if (!res.ok) {
    const errorMsg = data.error?.message || data.error || rawText || res.statusText;
    throw new Error(`Grok (${res.status}): ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
  }

  return data.choices[0].message.content;
}

// 3. Proveedor: OpenAI (Requiere saldo en platform.openai.com)
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

// Endpoint principal del Chat
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

    // Intento 1: Gemini (Gratuito y con doble ruta v1beta / v1)
    try {
      console.log("Intentando con Gemini...");
      replyText = await callGemini(systemInstructionText, chatMessages);
    } catch (geminiError) {
      console.warn("Gemini falló. Cambiando a Grok... Motivo:", geminiError.message);
      errors.push(`Gemini: ${geminiError.message}`);

      // Intento 2: Grok
      try {
        console.log("Intentando con Grok...");
        replyText = await callGrok(systemInstructionText, chatMessages);
      } catch (grokError) {
        console.warn("Grok falló. Cambiando a OpenAI... Motivo:", grokError.message);
        errors.push(`Grok: ${grokError.message}`);

        // Intento 3: OpenAI
        try {
          console.log("Intentando con OpenAI...");
          replyText = await callOpenAI(systemInstructionText, chatMessages);
        } catch (openAiError) {
          console.error("OpenAI también falló:", openAiError.message);
          errors.push(`OpenAI: ${openAiError.message}`);
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
