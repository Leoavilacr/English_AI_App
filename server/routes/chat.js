// server/routes/chat.js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { PracticeSession } = require('../models'); // tu modelo de negocio

// Cliente de OpenAI
const client = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim()
});

router.post('/chat', async (req, res) => {
  try {
    const { message, level, topic, isFirstMessage, sessionId, googleId } = req.body || {};

    if (!level || !topic) {
      return res.status(400).json({ error: 'Missing level or topic' });
    }

    // Prompt base
    const systemPrompt = [
      `You are an expert English conversation tutor.`,
      `Strictly adapt your language to the student's level: ${level}.`,
      `Topic focus: ${topic}.`,
      `Keep responses concise, natural, and with a clear, neutral accent.`,
      `Never switch to Spanish.`,
      `When correcting the student's last message, output a "corrected" string where mistakes are wrapped in **double asterisks**. If no mistakes, return the same text.`
    ].join(' ');

    // Instrucción del usuario
    const userInstruction = isFirstMessage
      ? `Start the conversation about "${topic}" for level ${level}. Reply JSON: {"response":"<short friendly opening>","corrected":""}`
      : `Student said: """${message || ''}""". Reply JSON: {"response":"<short natural reply>","corrected":"<student text with mistakes in **bold**>"}`;

    // Llamada a OpenAI
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini', // o el modelo que uses
      temperature: 0.6,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInstruction }
      ]
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}$/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    let responseText = '';
    let correctedText = '';

    if (parsed && typeof parsed === 'object') {
      responseText = String(parsed.response || '').trim();
      correctedText = String(parsed.corrected || '').trim();
    }

    if (!responseText) {
      responseText = isFirstMessage
        ? `Let's talk about ${topic}.`
        : `Thanks! Tell me more.`;
    }
    if (!correctedText && !isFirstMessage) {
      correctedText = (message || '').trim();
    }

    // Guardar registro de práctica si no es primer mensaje
    if (googleId && !isFirstMessage) {
      await PracticeSession.create({
        googleId,
        level,
        topic,
        correct: 0,
        mistakes: 0
      });
    }

    return res.json({ response: responseText, corrected: correctedText, sessionId });
  } catch (err) {
    console.error('[chat] Error:', err?.message || err);
    return res.status(500).json({ error: 'Something went wrong with OpenAI', detail: err?.message });
  }
});

module.exports = router;
