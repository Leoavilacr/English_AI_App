// LiveSession.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate, useLocation } from 'react-router-dom';

const LiveSession = () => {
  const { state } = useLocation();
  const { level, topic } = state || {};
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [listenHint, setListenHint] = useState(''); // estado de depuración visible
  const [sessionId] = useState(uuidv4());
  const [timeLeft, setTimeLeft] = useState(300);
  const [conversationOver, setConversationOver] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [stats, setStats] = useState(null);

  const hasWelcomedRef = useRef(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const watchdogRef = useRef(null); // timeout para detectar silencio sin onresult

  // --- Audio (cola simple para evitar solapes) ---
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);

  const durations = { A1: 300, A2: 360, B1: 420, B2: 480, C1: 600 };
  const totalDuration = durations[level] || 300;

  // ======= TTS por /api/tts (reemplazo de speechSynthesis) =======
  const stopAllAudio = useCallback(() => {
    try {
      // Pausa audio actual
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load?.();
      }
      // Vacía cola
      queueRef.current.forEach((url) => URL.revokeObjectURL(url));
      queueRef.current = [];
      isPlayingRef.current = false;
    } catch (e) {
      console.warn('stopAllAudio error:', e);
    }
  }, []);

  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;

    isPlayingRef.current = true;
    audioRef.current = new Audio(next);
    audioRef.current.onended = () => {
      URL.revokeObjectURL(next);
      isPlayingRef.current = false;
      playNextInQueue();
    };
    audioRef.current.onerror = () => {
      URL.revokeObjectURL(next);
      isPlayingRef.current = false;
      playNextInQueue();
    };
    audioRef.current.play().catch(() => {
      // Autoplay policies o similar
      isPlayingRef.current = false;
    });
  }, []);

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
    }
  }, [playNextInQueue]);

  // ======= Mensaje inicial (StrictMode-safe) =======
  useEffect(() => {
    if (!level || !topic) return;
    if (hasWelcomedRef.current) return;

    hasWelcomedRef.current = true;

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
            isFirstMessage: true,
            sessionId
          })
        });
        if (!res.ok) throw new Error('Initial chat request failed');

        const data = await res.json();
        const aiText = data.response || `Let's talk about ${topic}.`;

        if (cancelled) return;

        setMessages(prev => (prev.length ? prev : [{ sender: 'ai', text: aiText }]));
        speakText(aiText);
        setTimeLeft(totalDuration);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Fetch error:', err);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [level, topic, totalDuration, sessionId, speakText]);

  // ======= Timer (solo corre cuando realmente se está escuchando) =======
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

  // ======= Permiso mic =======
  const ensureMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // cerramos inmediatamente (solo era para conceder permiso)
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.warn('Microphone permission denied or failed:', e);
      return false;
    }
  };

  // ======= STT =======
  const initializeSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Try Chrome.');
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;   // ayuda a disparar eventos antes
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log('[STT] onstart');
      setListenHint('Listening…');
      setIsListening(true);

      // Watchdog: si en 8s no llega ningún result, paramos y avisamos
      clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        console.warn('[STT] No result within timeout');
        setListenHint('No voice detected. Try again closer to the mic.');
        recognition.stop();
      }, 8000);
    };

    recognition.onresult = async (event) => {
      console.log('[STT] onresult');
      clearTimeout(watchdogRef.current);
      // Tomamos la última alternativa con isFinal si existe
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          transcript = res[0]?.transcript || transcript;
        }
      }
      if (!transcript) {
        // si no hubo final, tomamos la última parcial
        const last = event.results[event.results.length - 1];
        transcript = last && last[0] ? last[0].transcript : '';
      }

      if (!transcript.trim()) {
        setListenHint('Heard nothing. Try again.');
        return;
      }

      try {
        setListenHint('Processing…');
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: transcript,
            level,
            topic,
            sessionId,
            isFirstMessage: false
          })
        });
        const data = await res.json();
        const highlightedText = highlightErrors(transcript, data.corrected);
        const aiText = data.response;

        setMessages((prev) => [
          ...prev,
          { sender: 'user', text: highlightedText },
          { sender: 'ai', text: aiText }
        ]);
        speakText(aiText);
        setListenHint('');
      } catch (e) {
        console.error('Chat fetch error:', e);
        setListenHint('Network error. Try again.');
      }
    };

    recognition.onspeechend = () => {
      console.log('[STT] onspeechend');
      // dejamos que onend cierre estado
    };

    recognition.onnomatch = () => {
      console.log('[STT] onnomatch');
      setListenHint('Couldn’t understand. Try again.');
    };

    recognition.onerror = (ev) => {
      console.warn('[STT] onerror', ev?.error);
      clearTimeout(watchdogRef.current);
      setListenHint(ev?.error === 'not-allowed'
        ? 'Mic blocked. Enable permissions.'
        : 'Mic error. Try again.');
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[STT] onend');
      clearTimeout(watchdogRef.current);
      setIsListening(false);
    };

    return recognition;
  };

  const toggleListening = async () => {
    if (conversationOver) return;

    // Si ya está escuchando, paramos
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    // 1) cortar cualquier TTS antes de escuchar (evita auto-eco)
    stopAllAudio();

    // 2) pedir permiso primero
    const ok = await ensureMicPermission();
    if (!ok) {
      alert('We need microphone access to practice speaking.');
      return;
    }

    // 3) iniciar STT
    const rec = initializeSpeechRecognition();
    recognitionRef.current = rec;
    if (!rec) return;

    try {
      setListenHint('Starting microphone…');
      rec.start(); // isListening se pone true en onstart
    } catch (e) {
      console.warn('rec.start() error:', e);
      setListenHint('Failed to start mic. Try again.');
    }
  };

  // ======= Helpers =======
  const highlightErrors = (_original, corrected) =>
    corrected.replace(/\*\*(.*?)\*\*/g, '<span class="text-red-500 font-semibold">$1</span>');

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
    setIsListening(false);
    clearTimeout(watchdogRef.current);
    recognitionRef.current?.stop();

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

          {/* Progress bar */}
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
                className={`p-4 rounded-full shadow-md border transition
                  ${isListening ? 'bg-blue-600 text-white' : 'bg-blue-100 hover:bg-blue-200'}
                `}
                aria-label="Microphone"
                title={isListening ? 'Listening...' : 'Tap to speak'}
              >
                {isListening ? '🎙️' : '🎤'}
              </button>
              {/* pista visual del estado del mic */}
              {listenHint && (
                <p className="text-xs text-gray-500 mt-1">{listenHint}</p>
              )}
            </div>
          )}

          {!conversationOver && !listenHint && (
            <p className="text-center text-xs text-gray-500 mt-2">
              {isListening ? 'Listening… speak now' : 'Tap the mic to start speaking'}
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
