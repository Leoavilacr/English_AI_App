const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const sequelize = require('../sequelize');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Instrucciones adaptadas según nivel
const getDifficultyInstruction = (level) => {
  switch (level) {
    case 'A1':
      return 'Use very simple sentences and basic vocabulary. Short replies only.';
    case 'A2':
      return 'Use simple vocabulary and clear, short sentences.';
    case 'B1':
      return 'Use intermediate vocabulary and common grammar. Be concise.';
    case 'B2':
      return 'Use upper-intermediate vocabulary and full, natural sentences.';
    case 'C1':
      return 'Use fluent, advanced vocabulary and natural conversational flow.';
    default:
      return 'Speak naturally and clearly.';
  }
};

// Store session data in-memory (consider DB or Redis in prod)
const sessionStore = new Map();

router.post('/', async (req, res) => {
  const { message, level, topic, sessionId, isFirstMessage } = req.body;

  try {
    let aiResponse;

    const difficultyInstruction = getDifficultyInstruction(level);

    if (isFirstMessage) {
      // Primera interacción: saludo y primera pregunta
      const introCompletion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You're a friendly English tutor. Start a conversation with a question related to the topic "${topic}" in ${level} English. Be natural and engaging. ${difficultyInstruction}`
          },
          {
            role: 'user',
            content: `The student selected topic: ${topic}. Their level is ${level}.`
          }
        ]
      });

      aiResponse = introCompletion.choices[0].message.content;

      return res.json({
        response: aiResponse,
        corrected: ''
      });
    }

    // Conversación normal
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're a helpful English partner. Hold a friendly, natural conversation in ${level} English about ${topic}. ${difficultyInstruction}`
        },
        {
          role: 'user',
          content: message
        }
      ]
    });

    aiResponse = chatCompletion.choices[0].message.content;

    // Corrección gramatical
    const feedbackCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're an English teacher. Highlight grammar or vocabulary mistakes using **like this**, and explain briefly. If none, say 'No errors found.'`
        },
        {
          role: 'user',
          content: message
        }
      ]
    });

    const feedbackText = feedbackCompletion.choices[0].message.content;

    // Ejercicios de refuerzo
    const reinforcementCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're an English teacher. Create 2 short grammar correction exercises based on the following feedback. Include a prompt and correct answer.`
        },
        {
          role: 'user',
          content: feedbackText
        }
      ]
    });

    const reinforcementExercises = reinforcementCompletion.choices[0].message.content;

    // Guardar en DB
    await Session.sync();
    await Session.create({
      sessionId,
      level,
      topic,
      messages: JSON.stringify([
        { role: 'user', content: message },
        { role: 'assistant', content: aiResponse }
      ]),
      feedback: feedbackText,
      reinforcement: reinforcementExercises
    });

    // Guardar en memoria
    if (!sessionStore.has(sessionId)) {
      sessionStore.set(sessionId, []);
    }
    if (!feedbackText.includes('No errors')) {
      sessionStore.get(sessionId).push(feedbackText);
    }

    res.json({
      response: aiResponse,
      corrected: feedbackText
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong with OpenAI' });
  }
});

// Endpoint para terminar sesión (opcional si lo usas en el frontend)
router.post('/end-session', async (req, res) => {
  const { sessionId } = req.body;
  const sessionErrors = sessionStore.get(sessionId) || [];

  if (sessionErrors.length === 0) {
    return res.json({
      summary: '✅ Great job! No errors detected.',
      exercise: '🎉 Keep practicing by starting another session!'
    });
  }

  try {
    const exerciseCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You're a language coach. Based on these corrections, create a short practice activity (e.g. fill in the blank or sentence corrections) in beginner-friendly English.`
        },
        {
          role: 'user',
          content: sessionErrors.join('\n')
        }
      ]
    });

    const exercise = exerciseCompletion.choices[0].message.content;
    const summary = sessionErrors.join('\n');
    sessionStore.delete(sessionId); // Reset

    res.json({ summary, exercise });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong generating the exercise.' });
  }
});

module.exports = router;
