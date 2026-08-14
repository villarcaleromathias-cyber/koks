const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Obtener las claves de forma segura desde las variables de entorno de Render
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Función para llamar a ChatGPT (OpenAI)
async function callOpenAI(systemPrompt, messages) {
  if (!OPENAI_API_KEY) {
    throw new Error("No se ha configurado la variable OPENAI_API_KEY en Render.");
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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OpenAI (${res.status}): ${data.error?.message || res.statusText}`);
  }

  return data.choices[0].message.content;
}

// Función para llamar a Grok (xAI)
async function callGrok(systemPrompt, messages) {
  if (!GROK_API_KEY) {
    throw new Error("No se ha configurado la variable GROK_API_KEY en Render.");
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
      model: 'grok-beta',
      messages: formattedMessages,
      max_tokens: 280,
      temperature: 0.85
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Grok (${res.status}): ${data.error?.message || res.statusText}`);
  }

  return data.choices[0].message.content;
}

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

    // 1. Intentar con OpenAI
    try {
      console.log("Intentando procesar mensaje con OpenAI...");
      replyText = await callOpenAI(systemInstructionText, chatMessages);
    } catch (openAiError) {
      console.warn("OpenAI falló. Cambiando a Grok (xAI)... Motivo:", openAiError.message);
      
      // 2. Si OpenAI falla o se queda sin crédito, cambiar a Grok
      try {
        replyText = await callGrok(systemInstructionText, chatMessages);
      } catch (grokError) {
        console.error("Grok también falló:", grokError.message);
        throw new Error(`Ambos proveedores fallaron.\nOpenAI: ${openAiError.message}\nGrok: ${grokError.message}`);
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
