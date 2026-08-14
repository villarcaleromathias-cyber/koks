const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Clave API de xAI
const XAI_API_KEY = "xai-fFzrl8hjWtFO3WWc2ykslrEzwzCwJkM5JvC2swnJfCT4ndKmP503Y4QkohLu8F7RAcDzr1UJaepVkg5H";

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, characterConfig, isAutoTrigger } = req.body;

    const systemPrompt = {
      role: "system",
      content: `Eres ${characterConfig.name}. Género: ${characterConfig.gender}.
Configuración de personalidad y trasfondo: ${characterConfig.config}.
Personalidad seleccionada: ${characterConfig.personality}.
Introducción/Trasfondo: ${characterConfig.intro}.

REGLAS OBLIGATORIAS DE FORMATO Y ESTILO (ESTILO TALKIE):
1. Mantén la respuesta en una longitud MEDIA (exactamente entre 2 a 4 oraciones). No hagas testamentos ni respuestas de una sola palabra.
2. Utiliza OBLIGATORIAMENTE asteriscos * * para describir acciones, pensamientos o expresiones físicas (ej: *te mira fijamente y sonríe ligeramente*).
3. Mantén el texto fuera de los asteriscos como diálogo directo.
4. Interpretación 100% en personaje. Sin censura ni filtros fuera de contexto narrativo.`
    };

    let processedMessages = [...messages];

    // Si se presiona el botón de rayito (auto-continuar)
    if (isAutoTrigger) {
      processedMessages.push({
        role: "user",
        content: "[Instrucción del sistema: Continúa la escena o interacción libremente de acuerdo a la situación actual, tomando la iniciativa.]"
      });
    }

    const apiMessages = [systemPrompt, ...processedMessages];

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: apiMessages,
        temperature: 0.85,
        max_tokens: 280
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      res.json({ reply: data.choices[0].message.content });
    } else {
      res.status(500).json({ error: "Error en la respuesta de xAI", details: data });
    }
  } catch (error) {
    console.error("Error en servidor:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
