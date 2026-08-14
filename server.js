const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Clave API de Gemini (Usa la variable de entorno de Render o la clave de respaldo)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AQ.Ab8RN6KMUPW4-Iyiz-3ewHVvs3BjL9vkh1PhDTEROFS0UPHDxA";

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, characterConfig, isAutoTrigger } = req.body;

    // Indicaciones de sistema para personalizar la IA
    const systemInstructionText = `Eres ${characterConfig.name}. Género: ${characterConfig.gender}.
Configuración de personalidad y trasfondo: ${characterConfig.config}.
Personalidad seleccionada: ${characterConfig.personality}.
Introducción/Trasfondo: ${characterConfig.intro}.

REGLAS OBLIGATORIAS DE FORMATO Y ESTILO (ESTILO TALKIE):
1. Mantén la respuesta en una longitud MEDIA (exactamente entre 2 a 4 oraciones). No hagas testamentos ni respuestas de una sola palabra.
2. Utiliza OBLIGATORIAMENTE asteriscos * * para describir acciones, pensamientos o expresiones físicas (ej: *te mira fijamente y sonríe ligeramente*).
3. Mantén el texto fuera de los asteriscos como diálogo directo.
4. Interpretación 100% en personaje. Sin censura ni filtros fuera de contexto narrativo.`;

    // Convertir historial al formato requerido por Gemini (role: 'user' o 'model')
    let contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Si se presiona el botón de rayito ⚡
    if (isAutoTrigger) {
      contents.push({
        role: "user",
        parts: [{ text: "[Instrucción del sistema: Continúa la escena o interacción libremente de acuerdo a la situación actual, tomando la iniciativa.]" }]
      });
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hola' }] });
    }

    // Petición HTTP a la API de Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 280
        }
      })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const replyText = data.candidates[0].content.parts.map(p => p.text).join('');
      res.json({ reply: replyText });
    } else {
      console.error("Error devuelto por Gemini:", data);
      res.status(500).json({ error: "Error en la respuesta de Gemini", details: data });
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
