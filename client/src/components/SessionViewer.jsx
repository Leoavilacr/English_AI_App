// SessionViewer.jsx — lista con resúmenes + vista de detalle única
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 10;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export default function SessionViewer() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');

  // Paginación
  const [page, setPage] = useState(1);

  // Vista de detalle
  const [selectedId, setSelectedId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    fetch('/api/sessionViewer', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isActive) return;
        const normalized = Array.isArray(data)
          ? data.map((s) => ({
              id: s.id ?? s.sessionId ?? `${s.googleId ?? ''}-${s.createdAt ?? ''}`,
              sessionId: s.sessionId ?? s.id ?? '',
              level: s.level ?? '',
              topic: s.topic ?? '',
              messages: s.messages ?? '[]',
              feedback: s.feedback ?? '',
              reinforcement: s.reinforcement ?? '',
              createdAt: s.createdAt ?? s.startedAt ?? s.updatedAt ?? null,
              correct: s.correct ?? null,
              mistakes: s.mistakes ?? null,
              googleId: s.googleId ?? null,
            }))
          : [];
        setSessions(normalized);
        setError('');
      })
      .catch((err) => setError(`Error loading sessions: ${err.message}`))
      .finally(() => isActive && setLoading(false));
    return () => { isActive = false; };
  }, []);

  // Filtrado + orden
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byLevel = level ? (s) => s.level === level : () => true;
    const bySearch = term
      ? (s) =>
          (s.topic && s.topic.toLowerCase().includes(term)) ||
          (s.feedback && s.feedback.toLowerCase().includes(term)) ||
          (s.reinforcement && s.reinforcement.toLowerCase().includes(term))
      : () => true;

    const copy = sessions.filter((s) => byLevel(s) && bySearch(s));
    copy.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    return copy;
  }, [sessions, level, search]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const current = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  // Reinicia página al cambiar filtros/búsqueda
  useEffect(() => setPage(1), [level, search]);

  // Item seleccionado (detalle)
  const selected = useMemo(
    () => (selectedId ? sessions.find((x) => (x.id ?? x.sessionId) === selectedId) : null),
    [selectedId, sessions]
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <button
          onClick={() => navigate('/menu')}
          className="w-full md:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow"
        >
          ← Back to Start
        </button>

        {!selected && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topic, feedback, exercises..."
              className="flex-1 sm:w-64 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">All levels</option>
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>{lv}</option>
              ))}
            </select>
          </div>
        )}

        {selected && (
          <div className="w-full md:w-auto flex gap-2 justify-end">
            <button
              onClick={() => setSelectedId(null)}
              className="bg-white border px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>

      <h1 className="text-3xl font-bold text-blue-700 text-center mb-4">
        {selected ? 'Session Detail' : 'Your Conversation Sessions'}
      </h1>

      {/* Estados base (solo en modo lista) */}
      {!selected && loading && (
        <div className="max-w-7xl mx-auto">
          <SkeletonList />
        </div>
      )}
      {!selected && !loading && error && (
        <div className="max-w-7xl mx-auto mb-4 p-4 rounded-lg border border-red-300 bg-red-50 text-red-700">
          {error}
        </div>
      )}
      {!selected && !loading && !error && filtered.length === 0 && (
        <p className="text-center text-gray-500">No sessions match your filters.</p>
      )}

      {/* Vista LISTA (resúmenes) */}
      {!selected && !loading && !error && filtered.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-2 max-w-7xl mx-auto">
            {current.map((s) => (
              <SessionCardSummary
                key={s.id ?? s.sessionId}
                session={s}
                onOpen={(id) => setSelectedId(id)}
              />
            ))}
          </div>

          {/* Paginación */}
          <div className="max-w-7xl mx-auto mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
              disabled={safePage === 1}
            >
              Prev
            </button>
            <span className="text-sm text-gray-600">Page {safePage} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
              disabled={safePage === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Vista DETALLE (solo una sesión visible) */}
      {selected && (
        <div className="max-w-5xl mx-auto">
          <SessionDetail session={selected} />
        </div>
      )}
    </div>
  );
}

/* ---------- Componentes ---------- */

function SessionCardSummary({ session: s, onOpen }) {
  const parsedMessages = useMemo(() => safeParseMessages(s.messages), [s.messages]);

  const dateLabel = useMemo(() => {
    if (!s.createdAt) return '—';
    try {
      const d = new Date(s.createdAt);
      return d.toLocaleString();
    } catch {
      return String(s.createdAt);
    }
  }, [s.createdAt]);

  // Resumen: primeras 2 líneas (assistant y user si existen)
  const summary = useMemo(() => {
    if (!parsedMessages.ok || parsedMessages.data.length === 0) return 'No messages.';
    const firstAssistant = parsedMessages.data.find((m) => (m.role || '').toLowerCase() === 'assistant');
    const firstUser = parsedMessages.data.find((m) => (m.role || '').toLowerCase() === 'user');
    const a = firstAssistant ? `AI: ${truncate(formatContent(firstAssistant.content), 120)}` : '';
    const u = firstUser ? `You: ${truncate(formatContent(firstUser.content), 120)}` : '';
    if (a && u) return `${a}\n${u}`;
    return a || u || truncate(formatContent(parsedMessages.data[0].content), 200);
  }, [parsedMessages]);

  const id = s.id ?? s.sessionId;

  return (
    <article className="bg-white shadow-lg rounded-xl border border-gray-200">
      <button
        onClick={() => onOpen(id)}
        className="w-full text-left p-6 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div>
            <h2 className="text-lg font-semibold text-blue-800">{s.topic || 'Untitled topic'}</h2>
            <p className="text-xs text-gray-500">{dateLabel}</p>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">
              Level: {s.level || '—'}
            </span>
            {typeof s.correct === 'number' && typeof s.mistakes === 'number' && (
              <div className="text-xs text-gray-500 mt-1">✔ {s.correct} · ✖ {s.mistakes}</div>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">{summary}</p>

        <div className="mt-4 text-xs text-blue-600">Open details →</div>
      </button>
    </article>
  );
}

function SessionDetail({ session: s }) {
  const parsedMessages = useMemo(() => safeParseMessages(s.messages), [s.messages]);

  const dateLabel = useMemo(() => {
    if (!s.createdAt) return '—';
    try {
      const d = new Date(s.createdAt);
      return d.toLocaleString();
    } catch {
      return String(s.createdAt);
    }
  }, [s.createdAt]);

  return (
    <article className="bg-white shadow-lg rounded-xl border border-blue-300 p-6 space-y-5">
      <header className="flex flex-wrap justify-between items-start gap-2">
        <div>
          <h2 className="text-xl font-semibold text-blue-800">{s.topic || 'Untitled topic'}</h2>
          <p className="text-xs text-gray-500">{dateLabel}</p>
        </div>
        <div className="text-right">
          <span className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">
            Level: {s.level || '—'}
          </span>
          {typeof s.correct === 'number' && typeof s.mistakes === 'number' && (
            <div className="text-xs text-gray-500 mt-1">✔ {s.correct} · ✖ {s.mistakes}</div>
          )}
        </div>
      </header>

      {/* Conversación completa */}
      <section className="text-sm bg-gray-50 border border-gray-200 rounded-md">
        <div className="px-3 py-2 font-medium text-gray-700 border-b">Conversation</div>
        <div className="px-3 py-3 space-y-2">
          {parsedMessages.ok ? (
            parsedMessages.data.length > 0 ? (
              parsedMessages.data.map((m, i) => (
                <p key={i} className="leading-relaxed">
                  <strong className={m.role === 'assistant' ? 'text-blue-700' : 'text-gray-800'}>
                    {String(m.role || '').toUpperCase() || 'ROLE'}:
                  </strong>{' '}
                  <span>{formatContent(m.content)}</span>
                </p>
              ))
            ) : (
              <p className="italic text-gray-500">No messages.</p>
            )
          ) : (
            <p className="text-red-600 italic">❌ Invalid or missing conversation data.</p>
          )}
        </div>
      </section>

      {/* Feedback */}
      <section className="text-sm bg-green-50 border border-green-200 rounded-md p-3">
        <strong className="text-green-700 block mb-1">Feedback:</strong>
        <p className="text-green-900 whitespace-pre-wrap">{s.feedback || '—'}</p>
      </section>

      {/* Ejercicios */}
      <section className="text-sm bg-purple-50 border border-purple-200 rounded-md p-3">
        <strong className="text-purple-700 block mb-1">Reinforcement Exercises:</strong>
        <p className="text-purple-900 whitespace-pre-wrap">{s.reinforcement || '—'}</p>
      </section>
    </article>
  );
}

/* ---------- Utils ---------- */

function safeParseMessages(raw) {
  if (!raw) return { ok: true, data: [] };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
    const norm = Array.isArray(parsed)
      ? parsed.map((m) => ({
          role: m.role ?? m.speaker ?? 'user',
          content: extractContent(m.content ?? m.text ?? ''),
        }))
      : [];
    return { ok: true, data: norm };
  } catch {
    return { ok: false, data: [] };
  }
}

function extractContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join(' ');
  if (content && typeof content === 'object') return content.text ?? content.value ?? '';
  return '';
}

function formatContent(content) {
  if (typeof content !== 'string') return String(content ?? '');
  return content;
}

function truncate(str, max = 140) {
  if (!str || typeof str !== 'string') return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function SkeletonList() {
  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-7xl mx-auto">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse space-y-4">
          <div className="h-5 w-2/3 bg-gray-200 rounded" />
          <div className="h-3 w-1/3 bg-gray-200 rounded" />
          <div className="h-14 w-full bg-gray-200 rounded" />
          <div className="h-12 w-full bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}
