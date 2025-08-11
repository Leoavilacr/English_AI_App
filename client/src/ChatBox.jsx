import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

const ChatBox = ({ level, topic }) => {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [sessionId] = useState(uuidv4());

  const durations = {
    A1: 5 * 60,
    A2: 6 * 60,
    B1: 7 * 60,
    B2: 8 * 60,
    C1: 10 * 60
  };

  const totalDuration = durations[level] || 5 * 60;
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const [conversationOver, setConversationOver] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [stats, setStats] = useState(null);

  const hasSpokenWelcomeRef = useRef(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  const navigate = useNavigate();

  const useNativeVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find(v => v.name === 'Google US English') ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en'))
    );
  };

  const speakText = (text) => {
    const synth = window.speechSynthesis;
    const voice = useNativeVoice();
    if (!voice) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    synth.speak(utterance);
  };

  useEffect(() => {
    const speakWelcome = () => {
      if (hasSpokenWelcomeRef.current) return;
      const welcomeMessage = `Let's practice your ${level} English talking about ${topic}.`;
      setMessages([{ sender: 'ai', text: welcomeMessage }]);
      speakText(welcomeMessage);
      hasSpokenWelcomeRef.current = true;
      setTimeLeft(totalDuration);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speakWelcome();
    } else {
      const handleVoicesChanged = () => {
        speakWelcome();
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, [level, topic, totalDuration]);

  useEffect(() => {
    if (conversationOver) return;

    if (isListening) {
      timerRef.current = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            clearInterval(timerRef.current);
            endConversation();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isListening, conversationOver]);

  const initializeSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition API not supported in this browser');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;

      fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          level,
          topic,
          sessionId,
          isFirstMessage: messages.length === 1
        })
      })
        .then(res => res.json())
        .then(data => {
          const corrected = data.corrected;
          const highlightedText = highlightErrors(transcript, corrected);

          const userMessage = { sender: 'user', text: highlightedText };
          const aiMessage = { sender: 'ai', text: data.response };

          setMessages(prev => [...prev, userMessage, aiMessage]);
          speakText(data.response);
        });

      setIsListening(false);
    };

    recognition.onerror = event => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  };

  const toggleListening = () => {
    if (conversationOver) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current = initializeSpeechRecognition();
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const highlightErrors = (original, corrected) => {
    return corrected.replace(/\*\*(.*?)\*\*/g, '<span class="highlight-error">$1</span>');
  };

  const generateFeedback = () => {
    const userMessages = messages.filter(m => m.sender === 'user');
    const allCorrected = userMessages.map(m => m.text).join(' ');

    setFeedback(allCorrected);

    const errorRegex = /<span class="highlight-error">(.*?)<\/span>/g;
    const errors = [];
    let match;
    while ((match = errorRegex.exec(allCorrected)) !== null) {
      errors.push(match[1]);
    }

    setStats({
      totalMessages: userMessages.length,
      totalErrors: errors.length,
      errors
    });
  };

  const endConversation = () => {
    setConversationOver(true);
    setIsListening(false);

    const aiMessage = { sender: 'ai', text: 'Time is up! Let’s continue next time.' };
    setMessages((prev) => [...prev, aiMessage]);
    speakText(aiMessage.text);

    generateFeedback();
  };

  const handleStartExercises = () => {
    if (!stats || !stats.errors) return;
    navigate('/exercises', { state: { errors: stats.errors, level, topic } });
  };

  return (
    <div className="container">
      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={msg.sender === 'user' ? 'user-message' : 'ai-message'}
            style={{ marginBottom: '8px' }}
          >
            <strong>{msg.sender === 'user' ? 'You' : 'AI'}:</strong>{' '}
            <span dangerouslySetInnerHTML={{ __html: msg.text }} />
          </div>
        ))}
      </div>

      {!conversationOver ? (
        <div style={{ marginTop: '10px' }}>
          <button onClick={toggleListening} disabled={conversationOver}>
            {isListening ? '🎙️ Listening...' : '🎤 Speak'}
          </button>
          <span style={{ marginLeft: '15px' }}>
            Time left: {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
          </span>
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <h3>Conversation ended. Here is your feedback:</h3>
          <div
            style={{
              border: '1px solid #ddd',
              padding: '10px',
              backgroundColor: '#f9f9f9',
              maxHeight: '200px',
              overflowY: 'auto'
            }}
            dangerouslySetInnerHTML={{ __html: feedback }}
          />
          {stats && (
            <div style={{ marginTop: '10px' }}>
              <p>Total messages: {stats.totalMessages}</p>
              <p>Total errors detected: {stats.totalErrors}</p>
            </div>
          )}
          <button onClick={handleStartExercises} style={{ marginTop: '15px' }}>
            Start Reinforcement Exercises
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
