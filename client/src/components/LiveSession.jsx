// LiveSession.jsx (continuous listening with auto-start after greeting TTS)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate, useLocation } from 'react-router-dom';

const LiveSession = () => {
  const { state } = useLocation();
  const { level, topic, googleId } = state || {};
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [listenHint, setListenHint] = useState('');
  const [sessionId] = useState(uuidv4());
  const [timeLeft, setTimeLeft] = useState(300);
  const [conversationOver, setConversationOver] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [stats, setStats] = useState(null);

  const hasWelcomedRef = useRef(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const manualStopRef = useRef(false);

  const timerRef = useRef(null);
  const watchdogRef = useRef(null);

  // Continuous STT buffers y timers
  const continuousMode = true;               // 👈 modo continuo habilitado
  const SILENCE_MS = 1000;                   // umbral de silencio para "enviar"
  const silenceTimerRef = useRef(null);
  const partialRef = useRef('');             // última transcripción parcial
  const finalRef = useRef('');               // acumulado final de la frase actual
  const lastSentRef = useRef('');            // para deduplicar
  const sendingRef = useRef(false);          // evita overlaps de requests

  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  // --- Auto-start después del TTS de bienvenida ---
  const autoStartAfterGreetingRef = useRef(false);

  // --- Audio (cola simple para evitar solapes) ---
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const pausedByTTSRef = useRef(false);      // si pausamos el mic por TTS

  const durations = { A1: 300, A2: 360, B1: 420, B2: 480, C1: 600 };
  const totalDuration = durations[level] || 300;

  // ======= TTS por /api/tts (pausa/reanuda mic para evitar eco) =======
  const pauseRecognitionForTTS = useCallback(() => {
    if (!recognitionRef.current) return;
    if (!isListeningRef.current) return;
    try {
      pausedByTTSRef.current = true;
      recognitionRef.current.stop();
    } catch {}
  }, []);

  const resumeRecognitionAfterTTS = useCallback(() => {
    if (!continuousMode || conversationOver) return;
    if (!recognitionRef.current) return;
    if (manualStopRef.current) return;
    try {
      setTimeout(() => {
        try { recognitionRef.current.start(); } catch {}
      }, 200);
    } catch {}
  }, [conversationOver]);

  const stopAllAudio = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load?.();
      }
      queueRef.current.forEach((url) => URL.revokeObjectURL(url));
      queueRef.current = [];
      isPlayingRef.current = false;
    } catch (e) {
      console.warn('stopAllAudio error:', e);
    }
  }, []);

  // ======= START continuo (función reutilizable) =======
  const ensureMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.warn('Microphone permission denied or failed:', e);
      return false;
    }
  };

  const initializeSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Try Chrome.');
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;    // parciales activos
    recognition.maxAlternatives = 1;
    recognition.continuous = true;        // modo continuo

    recognition.onstart = () => {
      setListenHint('Listening…');
      setIsListening(true);
      isListeningRef.current = true;
      manualStopRef.current = false;
      clearTimeout(watchdogRef.current);
      // watchdog de 20s sin eventos para reiniciar
      watchdogRef.current = setTimeout(() => {
        try { recognition.stop(); } catch {}
      }, 20000);
    };

    recognition.onresult = (event) => {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        try { recognition.stop(); } catch {}
      }, 20000);

      let gotSomething = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = (res[0]?.transcript || '').trim();
        if (!txt) continue;
        gotSomething = true;

        if (res.isFinal) {
          finalRef.current = `${finalRef.current ? finalRef.current + ' ' : ''}${txt}`.trim();
        } else {
          partialRef.current = txt;
        }
      }

      if (gotSomething) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          commitUtterance();
        }, SILENCE_MS);
      }
    };

    recognition.onerror = (ev) => {
      clearTimeout(watchdogRef.current);
      if (continuousMode && ev?.error === 'no-speech' && !manualStopRef.current && !conversationOver) {
        setTimeout(() => { try { recognition.start(); } catch {} }, 300);
        return;
      }
      setListenHint(ev?.error === 'not-allowed'
        ? 'Mic blocked. Enable permissions.'
        : 'Mic error. Tap again.');
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      clearTimeout(watchdogRef.current);
      setIsListening(false);
      isListeningRef.current = false;
      if (continuousMode && !manualStopRef.current && !conversationOver) {
        try { recognition.start(); } catch {}
      }
    };

    return recognition;
  }, [conversationOver, continuousMode]);

  const startContinuousListening = useCallback(async () => {
    if (conversationOver) return;
    if (listenHint === 'Processing…') return;
    if (isListeningRef.current) return;

    stopAllAudio();
    const ok = await ensureMicPermission();
    if (!ok) {
      alert('We need microphone access to practice speaking.');
      return;
    }

    const rec = initializeSpeechRecognition();
    recognitionRef.current = rec;
    if (!rec) return;

    try {
      setListenHint('Starting microphone…');
      rec.start();
    } catch (e) {
      console.warn('rec.start() error:', e);
      setListenHint('Failed to start mic. Try again.');
    }
  }, [conversationOver, listenHint, stopAllAudio, initializeSpeechRecognition]);

  // ======= Reproducción de audio (con auto-start tras bienvenida) =======
  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;

    isPlayingRef.current = true;
    // pausa el mic antes de reproducir para evitar eco
    pauseRecognitionForTTS();

    audioRef.current = new Audio(next);
    const onDone = () => {
      URL.revokeObjectURL(next);
      isPlayingRef.current = false;

      // Si venimos del saludo inicial y aún no hay mic, arráncalo
      if (autoStartAfterGreetingRef.current) {
        autoStartAfterGreetingRef.current = false;
        startContinuousListening();
      } else {
        // si ya estaba el mic y lo pausamos, reanudar
        resumeRecognitionAfterTTS();
      }

      playNextInQueue();
    };

    audioRef.current.onended = onDone;
    audioRef.current.onerror = onDone;

    audioRef.current.play().catch(() => {
      isPlayingRef.current = false;
      if (autoStartAfterGreetingRef.current) {
        autoStartAfterGreetingRef.current = false;
        startContinuousListening();
      } else {
        resumeRecognitionAfterTTS();
      }
    });
  }, [pauseRecognitionForTTS, resumeRecognitionAfterTTS, startContinuousListening]);

  const speakText = useCallback(async (text, voice = 'en-US-Neural2-C') => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });
      if (!res.ok) throw new Error('TTS request failed');
      const arrayBuf = await res.arrayBuffer();
      const blobUrl = URL.createObjectURL(new Blob([arrayBuf], { type: 'audio/mpeg' }));
      queueRef.current.push(blobUrl);
      playNextInQueue();
    } catch (e) {
      console.error('TTS error:', e);
      // aunque falle TTS, si esperábamos auto-start, lánzalo
      if (autoStartAfterGreetingRef.current) {
        autoStartAfterGreetingRef.current = false;
        startContinuousListening();
      } else {
        resumeRecognitionAfterTTS();
      }
    }
  }, [playNextInQueue, resumeRecognitionAfterTTS, startContinuousListening]);

  // ======= Mensaje inicial (StrictMode-safe) + auto-start tras TTS =======
  useEffect(() => {
    if (!level || !topic) return;
    if (hasWelcomedRef.current) return;

    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            message: '',
            level,
            topic,
            sessionId,
            googleId,
            isFirstMessage: true
          })
        });
        if (!res.ok) {
          console.error('Initial chat request failed', await res.text());
          return;
        }

        const data = await res.json();
        const aiText = data?.response || `Let's talk about ${topic}.`;
        if (cancelled) return;

        setMessages(prev => (prev.length ? prev : [{ sender: 'ai', text: aiText }]));
        // marcar que, al terminar este TTS, auto-arranque el mic continuo
        autoStartAfterGreetingRef.current = true;
        speakText(aiText);
        setTimeLeft(totalDuration);
        hasWelcomedRef.current = true;
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') console.error('Fetch error (welcome):', err);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [level, topic, totalDuration, sessionId, googleId, speakText]);

  // ======= Timer =======
  useEffect(() => {
    if (conversationOver) return;
    if (isListening) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            endConversation();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isListening, conversationOver]);

  // ======= Commit de la frase cuando hay silencio =======
  const commitUtterance = useCallback(async () => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    const raw = (finalRef.current || partialRef.current || '').trim();
    const norm = normalize(raw);

    if (!norm) return;
    if (norm === lastSentRef.current) return;
    if (sendingRef.current) return;

    lastSentRef.current = norm;
    sendingRef.current = true;
    setListenHint('Processing…');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: raw,
          level,
          topic,
          googleId,
          sessionId,
          isFirstMessage: false
        })
      });
      const data = await res.json();
      const highlightedText = highlightErrors(raw, data.corrected || '');
      const aiText = data.response || '';

      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: highlightedText },
        { sender: 'ai', text: aiText }
      ]);

      finalRef.current = '';
      partialRef.current = '';

      // Reproduce TTS (pausa/reanuda mic según corresponda)
      speakText(aiText);
      setListenHint('');
    } catch (e) {
      console.error('Chat fetch error:', e);
      setListenHint('Network error. Try again.');
    } finally {
      sendingRef.current = false;
    }
  }, [googleId, level, topic, sessionId, speakText]);

  // ======= Toggle botón (inicia/termina modo continuo) =======
  const toggleListening = async () => {
    if (conversationOver) return;
    if (listenHint === 'Processing…') return;

    if (isListening) {
      manualStopRef.current = true;
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      try { recognitionRef.current?.stop(); } catch {}
      setListenHint('');
      return;
    }

    startContinuousListening();
  };

  // ======= Helpers =======
  const highlightErrors = (_original, corrected) =>
    String(corrected || '').replace(/\*\*(.*?)\*\*/g, '<span class="text-red-500 font-semibold">$1</span>');

  const generateFeedback = () => {
    const userMessages = messages.filter((m) => m.sender === 'user');
    const allCorrected = userMessages.map((m) => m.text).join(' ');
    setFeedback(allCorrected);
    const errors = [];
    const regex = /<span.*?>(.*?)<\/span>/g;
    let match;
    while ((match = regex.exec(allCorrected))) errors.push(match[1]);
    setStats({
      totalMessages: userMessages.length,
      totalErrors: errors.length,
      errors
    });
  };

  const endConversation = () => {
    setConversationOver(true);
    manualStopRef.current = true;
    setIsListening(false);
    isListeningRef.current = false;
    clearTimeout(watchdogRef.current);
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    try { recognitionRef.current?.stop(); } catch {}
    const goodbye = { sender: 'ai', text: 'Time is up! Let’s continue next time.' };
    setMessages((prev) => [...prev, goodbye]);
    speakText(goodbye.text);
    generateFeedback();
  };

  const navigate = useNavigate();
  const handleStartExercises = () => {
    if (stats?.errors?.length) {
      navigate('/exercises', { state: { errors: stats.errors, level, topic } });
    }
  };

  if (!level || !topic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 bg-white shadow rounded-xl px-6 py-4">
          Missing level or topic. Please return to Start Menu.
        </div>
      </div>
    );
  }

  // ======= UI =======
  return (
    <div className="min-h-screen bg-gradient-to-tr from-blue-100 to-blue-200 py-8 px-4">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-5 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-blue-900">Live Conversation</h2>
              <p className="text-sm text-gray-500">
                Level <span className="font-semibold">{level}</span> · Topic{' '}
                <span className="font-semibold capitalize">{topic}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-900 font-bold px-4 py-1 rounded-lg text-sm">
                {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
              </div>
              {!conversationOver && (
                <button
                  onClick={endConversation}
                  className="text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                >
                  End
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-2 bg-blue-500 transition-all"
              style={{ width: `${((totalDuration - timeLeft) / totalDuration) * 100}%` }}
            />
          </div>
        </div>

        {/* Conversation Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-5 border border-gray-200">
          <div className="space-y-3 text-sm max-h-[48vh] overflow-y-auto pr-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-xl px-4 py-3 ${
                  msg.sender === 'ai'
                    ? 'bg-blue-50 border border-blue-100'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="block font-medium mb-1">
                  {msg.sender === 'ai' ? 'AI:' : 'You:'}
                </span>
                <span dangerouslySetInnerHTML={{ __html: msg.text }} />
              </div>
            ))}
          </div>

          {!conversationOver && (
            <div className="flex flex-col items-center justify-center pt-4 gap-1">
              <button
                onClick={toggleListening}
                disabled={listenHint === 'Processing…'}
                className={`p-4 rounded-full shadow-md border transition
                  ${isListening ? 'bg-blue-600 text-white' : 'bg-blue-100 hover:bg-blue-200'}
                  ${listenHint === 'Processing…' ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                aria-label="Microphone"
                title={isListening ? 'Listening (continuous)…' : 'Start continuous listening'}
              >
                {isListening ? '🎙️' : '🎤'}
              </button>
              {listenHint && (
                <p className="text-xs text-gray-500 mt-1">{listenHint}</p>
              )}
              {isListening && (
                <p className="text-[11px] text-blue-500 mt-1">Continuous mode: silence sends your message</p>
              )}
            </div>
          )}

          {!conversationOver && !listenHint && !isListening && (
            <p className="text-center text-xs text-gray-500 mt-2">
              Tap the mic to start continuous listening
            </p>
          )}
        </div>

        {/* Feedback Card */}
        {conversationOver && (
          <div className="bg-white rounded-2xl shadow-2xl p-5 border border-gray-200 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Feedback</h3>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <p>
                <strong className="text-gray-700">Messages:</strong>{' '}
                <span className="text-blue-700">{stats?.totalMessages ?? 0}</span>
              </p>
              <p>
                <strong className="text-gray-700">Detected Errors:</strong>{' '}
                <span className="text-blue-700">{stats?.totalErrors ?? 0}</span>
              </p>
            </div>
            <p className="text-sm font-medium text-gray-700">Grammatical Errors</p>
            <div
              className="bg-blue-50 p-3 rounded-lg text-sm text-gray-800 max-h-40 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: feedback }}
            />
            <button
              onClick={handleStartExercises}
              className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Start Exercises
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveSession;
