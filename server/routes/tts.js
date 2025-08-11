// server/routes/tts.js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim()
});

// Mapeo opcional de voces (tu frontend manda 'en-US-Neural2-C'; aquí lo traducimos)
function mapVoice(v) {
  if (!v) return 'alloy';               // voz por defecto de OpenAI
  // cualquier voz tipo "Neural2" la mandamos a alloy
  if (/neural/i.test(v)) return 'alloy';
  return 'alloy';
}

// POST /api/tts  -> body: { text: string, voice?: string }
router.post('/tts', async (req, res) => {
  try {
    const { text = '', voice } = req.body || {};
    const input = String(text || '').trim();
    if (!input) return res.status(400).json({ error: 'Missing text' });

    const voiceName = mapVoice(voice);

    // OpenAI TTS (MP3)
    const speech = await client.audio.speech.create({
      model: 'gpt-4o-mini-tts', // también podrías usar 'tts-1' si la tienes habilitada
      voice: voiceName,
      input
    });

    const arrayBuf = await speech.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (err) {
    console.error('[tts] error:', err?.message || err);
    return res.status(500).json({ error: 'TTS failed' });
  }
});

module.exports = router;
