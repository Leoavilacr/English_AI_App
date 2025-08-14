// LiveSession.jsx (continuous listening + auto-start after greeting TTS)
// UI: iMessage-like bubbles, improved feedback, back-to-menu after session
// Update: dynamic mic equalizer (RMS), removed mic button & "Try Again"
// Added: listening border pulse (animate-pulse-soft)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate, useLocation } from 'react-router-dom';

const ListeningIndicator = ({ active, bars }) => {
  // bars: array de valores 0..1
  return (
    <div className="flex flex-col items-center justify-center pt-3 select-none" aria-live="polite">
      <span className={`text-xs ${active ? 'text-blue-600' : 'text-gray-400'}`}>
        {active ? 'Listening' : 'Paused'}
      </span>
      <div className="flex items-end gap-1.5 h-7 mt-1">
        {bars.map((v, i) => (
          <span
            key={i}
            className={`${active ? 'bg-blue-600' : 'bg-gray-300'} w-1.5 rounded-sm origin-bottom transition-[height] duration-100`}
            style={{ height: `${10 + Math.round(v * 18)}px` }} // 10–28px
          />
        ))}
      </div>
    </div>
  );
};

const ProcessingDots = ({ show, label = 'Processing' }) => {
  return (
    <div className={`flex items-center justify-center gap-2 pt-2 ${show ? '' : 'hidden'}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex gap-1">
        {[0,1,2].map((i)=>(
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400"
            style={{ animation: `dot 1.2s ${i*0.15}s infinite` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes dot {
          0%{opacity:.2; transform: translateY(0)}
          50%{opacity:1; transform: translateY(-3px)}
          100%{opacity:.2; transform: translateY(0)}
        }
      `}</style>
    </div>
  );
};

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

  // ====== Equalizer (RMS) ======
  const [bars, setBars] = useState([0.3, 0.5, 0.7, 0.55, 0.35]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef(0);

  const startAudioMeter = useCallback(async () => {
    try {
      // Evita duplicados
      if (audioCtxRef.current || micStreamRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      micStreamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      source.connect(analyser);

      const animate = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

        // RMS 0..1 (aprox)
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const v = (dataArrayRef.current[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArrayRef.current.length); // ~0-0.35 hablando normal
        const level = Math.min(1, rms * 3.2); // escala

        // Genera 5 barras con fase para que no sean iguales
        phaseRef.current += 0.12;
        const base = [0, 1, 2, 3, 4].map(i => {
          const wobble = (Math.sin(phaseRef.current + i * 0.9) + 1) / 2; // 0..1
          const val = 0.15 + (level * 0.75 + wobble * 0.35) / 1.6;        // mezcla
          return Math.max(0, Math.min(1, val));
        });
        setBars(base);

        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    } catch (e) {
      console.warn('Audio meter error:', e);
      // Si falla, mantenemos barras pasivas
    }
  }, []);

  const stopAudioMeter = useCallback(async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    try {
      if (audioCtxRef.current) {
        await audioCtxRef.current.close();
      }
    } catch {}
    audioCtxRef.current = null;

    try {
      micStreamRef.current?.getTracks()?.forEach(t => t.stop());
    } catch {}
    micStreamRef.current = null;

    analyserRef.current = null;
    dataArrayRef.current = null;

    // Barras en estado "reposo"
    setBars([0.25, 0.35, 0.45, 0.33, 0.22]);
  }, []);

  // Continuous STT buffers y timers
  const continuousMode = true;
  const SILENCE_MS = 2000;
  const silenceTimerRef = useRef(null);
  const partialRef = useRef('');
  const finalRef = useRef('');
  const lastSentRef = useRef('');
  const sendingRef = useRef(false);

  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  // Auto-start mic tras TTS de bienvenida
  const autoStartAfterGreetingRef = useRef(false);

  // Audio (cola)
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const pausedByTTSRef = useRef(false);

  const durations = { A1: 300, A2: 360, B1: 420, B2: 480, C1: 600 };
  const totalDuration = durations[level] || 300;

  // ======= TTS por /api/tts (pausa/reanuda mic para evitar eco) =======
  const pauseRecognitionForTTS = useCallback(() => {
    if (!recognitionRef.current) return;
    if (!isListeningRef.current) return;
    try {
      pausedByTTSRef.current = true;
      recognitionRef.current.stop(); // onend -> isListening=false -> detiene meter por efecto
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

  // ======= START continuo (sin botón) =======
  const ensureMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      // cerramos porque solo era para permiso; el meter abrirá su propio stream
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
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      setListenHint('Listening…');
      setIsListening(true);          // <- activa equalizer por efecto
      isListeningRef.current = true;
      manualStopRef.current = false;
      clearTimeout(watchdogRef.current);
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
        : 'Mic error.');
      setIsListening(false);         // <- pausa equalizer
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      clearTimeout(watchdogRef.current);
      setIsListening(false);         // <- pausa equalizer
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
      setListenHint('Failed to start mic.');
    }
  }, [conversationOver, listenHint, stopAllAudio, initializeSpeechRecognition]);

  // ======= Reproducción de audio =======
  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;

    isPlayingRef.current = true;
    pauseRecognitionForTTS();

    audioRef.current = new Audio(next);
    const onDone = () => {
      URL.revokeObjectURL(next);
      isPlayingRef.current = false;

      if (autoStartAfterGreetingRef.current) {
        autoStartAfterGreetingRef.current = false;
        startContinuousListening();
      } else {
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
      if (autoStartAfterGreetingRef.current) {
        autoStartAfterGreetingRef.current = false;
        startContinuousListening();
      } else {
        resumeRecognitionAfterTTS();
      }
    }
  }, [playNextInQueue, resumeRecognitionAfterTTS, startContinuousListening]);

  // ======= Mensaje inicial + auto-start mic =======
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

  // ======= Equalizer lifecycle ligado a isListening =======
  useEffect(() => {
    if (isListening) {
      startAudioMeter();
    } else {
      stopAudioMeter();
    }
    return () => { stopAudioMeter(); };
  }, [isListening, startAudioMeter, stopAudioMeter]);

  // ======= Commit de la frase =======
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

      speakText(aiText);
      setListenHint('');
    } catch (e) {
      console.error('Chat fetch error:', e);
      setListenHint('Network error.');
    } finally {
      sendingRef.current = false;
    }
  }, [googleId, level, topic, sessionId, speakText]);

  // ======= Helpers =======
  const highlightErrors = (_original, corrected) =>
    String(corrected || '').replace(/\*\*(.*?)\*\*/g, '<span class="text-red-500 font-semibold">$1</span>');

  const analyzeErrors = (htmlJoined) => {
    const regex = /<span.*?>(.*?)<\/span>/g;
    const freq = new Map();
    let match;
    while ((match = regex.exec(htmlJoined))) {
      const key = match[1].trim().toLowerCase();
      if (!key) continue;
      freq.set(key, (freq.get(key) || 0) + 1);
    }

    const patterns = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));

    const tips = getTipsFromPatterns(patterns);

    return {
      totalErrors: Array.from(freq.values()).reduce((a, b) => a + b, 0),
      patterns,
      tips
    };
  };

  const getTipsFromPatterns = (patterns) => {
    const tips = [];
    const hasArticleIssues = patterns.some(p => /\b(a|an|the)\b/.test(p.text));
    const hasVerb3rd = patterns.some(p => /\b(go|do|want|like|need|have|be)\b/.test(p.text));
    const hasPreps = patterns.some(p => /\b(in|on|at|to|for|with|from|of)\b/.test(p.text));
    const hasPlural = patterns.some(p => /s$/.test(p.text) || /\b(is|are)\b/.test(p.text));
    const hasPast = patterns.some(p => /\b(did|was|were|went|had|said|made|took)\b/.test(p.text));

    if (hasArticleIssues) tips.push('Articles (a/an/the): usa **a** antes de consonante sonora, **an** antes de sonido vocal, y **the** para algo específico ya conocido.');
    if (hasVerb3rd) tips.push('3rd person singular: en presente simple con **he/she/it**, agrega **-s** al verbo (e.g., *she likes*, *he goes*).');
    if (hasPreps) tips.push('Preposiciones comunes: **in** (meses/años/lugares cerrados), **on** (días/fechas/superficie), **at** (horas/lugar exacto).');
    if (hasPlural) tips.push('Plural y concordancia: revisa **is/are** y termina en **-s** cuando el sustantivo es plural.');
    if (hasPast) tips.push('Pasado simple: verbos regulares en **-ed**; irregulares memorizados (*go → went*, *have → had*).');

    if (tips.length === 0) tips.push('¡Buen trabajo! Tus errores son variados y menores. Enfócate en pronunciación clara y frases cortas y correctas.');
    return tips.slice(0, 3);
  };

  const generateFeedback = () => {
    const userMessages = messages.filter((m) => m.sender === 'user');
    const allCorrected = userMessages.map((m) => m.text).join(' ');
    setFeedback(allCorrected);

    const analysis = analyzeErrors(allCorrected);
    setStats({
      totalMessages: userMessages.length,
      totalErrors: analysis.totalErrors,
      patterns: analysis.patterns,
      tips: analysis.tips
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
    if (stats?.totalErrors > 0) {
      const errorsOnly = (stats.patterns || []).map(p => p.text);
      navigate('/exercises', { state: { errors: errorsOnly, level, topic } });
    }
  };
  const handleBackToMenu = () => {
    navigate('/menu'); // o '/start-menu' si aplica
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
  const listeningActive = isListening && listenHint !== 'Processing…';

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

        {/* Conversation Card (con latido cuando escucha) */}
        <div className={`bg-white rounded-2xl shadow-2xl p-5 border ${listeningActive ? 'border-blue-400 animate-pulse-soft' : 'border-gray-200'}`}>
          {/* keyframes para el pulso */}
          <style>{`
            @keyframes pulse-soft {
              0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.40); }
              50%      { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.00); }
            }
            .animate-pulse-soft { animation: pulse-soft 1.8s ease-in-out infinite; }
          `}</style>

          <div className="space-y-2 text-sm max-h-[48vh] overflow-y-auto pr-1">
            {messages.map((msg, idx) => {
              const isAI = msg.sender === 'ai';
              return (
                <div
                  key={idx}
                  className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={[
                      'relative px-4 py-3 shadow-sm',
                      'max-w-[80%]',
                      isAI
                        ? 'bg-green-100 text-green-900 border border-green-200 rounded-2xl rounded-bl-sm'
                        : 'bg-blue-100 text-blue-900 border border-blue-200 rounded-2xl rounded-br-sm'
                    ].join(' ')}
                  >
                    <span className="block text-[11px] font-semibold mb-1 opacity-70">
                      {isAI ? 'AI' : 'You'}
                    </span>
                    <span
                      className="leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: msg.text }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Indicadores (sin botón) */}
          {!conversationOver && (
            <>
              <ListeningIndicator
                active={listeningActive}
                bars={bars}
              />
              <ProcessingDots show={listenHint === 'Processing…'} />
            </>
          )}
        </div>

        {/* Feedback Card */}
        {conversationOver && (
          <div className="bg-white rounded-2xl shadow-2xl p-5 border border-gray-200 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Session Feedback</h3>
              <span className="text-xs text-gray-500">
                Level {level} · Topic <span className="capitalize">{topic}</span>
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">Messages</div>
                <div className="text-xl font-bold text-blue-800">{stats?.totalMessages ?? 0}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">Detected Errors</div>
                <div className="text-xl font-bold text-blue-800">{stats?.totalErrors ?? 0}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">Accuracy (est.)</div>
                <div className="text-xl font-bold text-blue-800">
                  {stats?.totalMessages
                    ? Math.max(0, Math.round(100 - (100 * (stats?.totalErrors || 0)) / (stats?.totalMessages * 4)))
                    : 100}%{/* estimación simple */}
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">Focus Next</div>
                <div className="text-sm font-semibold text-blue-800">
                  {stats?.patterns?.[0]?.text || 'Fluency'}
                </div>
              </div>
            </div>

            {/* Top errores */}
            {stats?.patterns?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Top mistakes to review</p>
                <ul className="space-y-2">
                  {stats.patterns.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <span className="text-gray-800">
                        <span className="font-semibold text-blue-800">{p.text}</span>
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                        {p.count}×
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tips accionables */}
            {stats?.tips?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Actionable tips</p>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-800">
                  {stats.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Texto con correcciones in-line */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Your sentences with corrections</p>
              <div
                className="bg-blue-50 p-3 rounded-lg text-sm text-gray-800 max-h-40 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: feedback }}
              />
            </div>

            {/* Acciones finales */}
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={handleStartExercises}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Start Exercises
              </button>
              <button
                onClick={handleBackToMenu}
                className="w-full bg-white text-gray-700 border border-gray-200 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveSession;
