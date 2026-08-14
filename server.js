const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Claves configuradas directamente con respaldo de variables de entorno
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 1. Proveedor Principal: Groq (Llama 3.3 70B Versatile)
async function callGroq(systemPrompt, messages) {
  if (!GROQ_API_KEY) {
    throw new Error("No se ha configurado la variable GROQ_API_KEY.");
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: (m.role === 'assistant' || m.role === 'model') ? 'assistant' : 'user',
      content: m.content || m.text || ''
    }))
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY.trim()}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
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
    throw new Error(`Groq (${res.status}): ${detail}`);
  }

  return data.choices[0].message.content;
}

// 2. Proveedor Respaldo: OpenRouter (Llama 3.1 8B Free)
async function callOpenRouter(systemPrompt, messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("No se ha configurado la variable OPENROUTER_API_KEY.");
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: (m.role === 'assistant' || m.role === 'model') ? 'assistant' : 'user',
      content: m.content || m.text || ''
    }))
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
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
    throw new Error(`OpenRouter (${res.status}): ${detail}`);
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

    // Intento 1: Groq
    try {
      console.log("Intentando procesar mensaje con Groq...");
      replyText = await callGroq(systemInstructionText, chatMessages);
    } catch (groqError) {
      console.warn("Groq falló. Cambiando a OpenRouter... Motivo:", groqError.message);
      errors.push(groqError.message);

      // Intento 2: OpenRouter
      try {
        console.log("Intentando procesar mensaje con OpenRouter...");
        replyText = await callOpenRouter(systemInstructionText, chatMessages);
      } catch (openRouterError) {
        console.error("OpenRouter también falló:", openRouterError.message);
        errors.push(openRouterError.message);
        throw new Error(`Todos los proveedores fallaron:\n` + errors.join('\n'));
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
