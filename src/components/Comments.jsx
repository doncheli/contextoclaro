import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  MessageCircle, Send, AlertCircle, ThumbsUp, ThumbsDown,
  CornerDownRight, ChevronDown, Clock, Share2, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ═══════════════ STORAGE KEYS ═══════════════ */
const KEY_NAME   = 'cc_comment_name'
const KEY_EMAIL  = 'cc_comment_email'
const KEY_TOKEN  = 'cc_voter_token'
const KEY_VOTES  = 'cc_my_votes_v1'

/* ═══════════════ UTILS ═══════════════ */
const URL_REGEX = /(https?:\/\/|www\.[a-z0-9]|\b[a-z0-9-]+\.(com|net|org|io|co|ru|cn|xyz|online|club|shop|site|bet|casino|me|tv|app)\b|t\.me\/|bit\.ly\/|wa\.me\/|tinyurl\.com)/i
const SPAM_REGEX = /\b(viagra|cialis|casino|porn|sex chat|escort|click here to buy|crypto giveaway|bitcoin double|free airdrop|earn \$\d|forex signals|trading bot|whatsapp gana|seo agency|buy followers)\b/i

function getOrCreateVoterToken() {
  let t = localStorage.getItem(KEY_TOKEN)
  if (!t) {
    t = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()
    localStorage.setItem(KEY_TOKEN, t)
  }
  return t
}

function loadMyVotes() {
  try { return JSON.parse(localStorage.getItem(KEY_VOTES) || '{}') } catch { return {} }
}

function saveMyVotes(votes) {
  try { localStorage.setItem(KEY_VOTES, JSON.stringify(votes)) } catch { /* quota */ }
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'hace unos segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function validateContent(text) {
  const c = (text || '').trim()
  if (c.length < 5) return 'El comentario debe tener al menos 5 caracteres.'
  if (c.length > 2000) return 'El comentario no puede exceder 2000 caracteres.'
  if (URL_REGEX.test(c)) return 'No se permiten enlaces (URLs) en los comentarios.'
  if (SPAM_REGEX.test(c)) return 'Tu comentario fue detectado como posible spam.'
  if (/(.)\1{9,}/.test(c)) return 'Evita caracteres repetidos.'
  const caps = c.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length
  const letters = c.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '').length
  if (letters > 20 && caps / letters > 0.7) return 'No grites — evita usar tanto mayúsculas.'
  return null
}

/* ═══════════════ AVATAR ═══════════════ */
function Avatar({ name, size = 'md' }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  const colors = [
    'bg-accent/20 text-accent',
    'bg-success/20 text-success',
    'bg-warning/20 text-warning',
    'bg-danger/20 text-danger',
    'bg-purple-500/20 text-purple-500',
    'bg-pink-500/20 text-pink-500',
    'bg-cyan-500/20 text-cyan-500',
  ]
  const idx = (name || 'x').charCodeAt(0) % colors.length
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${dim} rounded-full shrink-0 flex items-center justify-center font-bold ${colors[idx]}`}>
      {letter}
    </div>
  )
}

/* ═══════════════ COMMENT FORM ═══════════════ */
function CommentForm({ parentId = null, onSubmit, onCancel, submitting, error, prefilledName }) {
  const [name, setName] = useState(() => prefilledName || localStorage.getItem(KEY_NAME) || '')
  const [email, setEmail] = useState(() => localStorage.getItem(KEY_EMAIL) || '')
  const [content, setContent] = useState('')
  const [localError, setLocalError] = useState(null)
  const honeypotRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (parentId && textareaRef.current) textareaRef.current.focus()
  }, [parentId])

  function handleSubmit(e) {
    e.preventDefault()
    setLocalError(null)
    if (honeypotRef.current?.value) return // bot

    const cleanName = name.trim()
    const cleanEmail = email.trim()
    if (cleanName.length < 2) {
      setLocalError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    const contentErr = validateContent(content)
    if (contentErr) {
      setLocalError(contentErr)
      return
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError('Email inválido.')
      return
    }

    onSubmit({
      author_name: cleanName,
      author_email: cleanEmail || null,
      content: content.trim(),
      parent_id: parentId,
    })
    setContent('')
  }

  const remaining = 2000 - content.length
  const displayError = localError || error

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${parentId ? 'mt-3 pl-12' : ''}`}>
      <input
        ref={honeypotRef}
        type="text"
        name="url"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />
      {!parentId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Tu nombre *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none transition-colors"
            aria-label="Nombre"
          />
          <input
            type="email"
            placeholder="Email (opcional, no se muestra)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none transition-colors"
            aria-label="Email opcional"
          />
        </div>
      )}
      <textarea
        ref={textareaRef}
        placeholder={parentId ? 'Escribe tu respuesta…' : 'Únete a la conversación. Sé respetuoso — no se permiten enlaces ni spam.'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        minLength={5}
        maxLength={2000}
        rows={parentId ? 3 : 4}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none transition-colors resize-y leading-relaxed"
        aria-label="Comentario"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-[11px] ${remaining < 100 ? 'text-warning' : 'text-text-muted'}`}>
          {remaining} restantes
        </span>
        <div className="flex items-center gap-2">
          {displayError && (
            <span className="text-xs text-danger font-medium flex items-center gap-1" role="alert">
              <AlertCircle size={12} /> {displayError}
            </span>
          )}
          {parentId && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || !name.trim() || content.trim().length < 5}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-light text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {submitting ? 'Publicando…' : parentId ? 'Responder' : 'Publicar'}
          </button>
        </div>
      </div>
    </form>
  )
}

/* ═══════════════ COMMENT ITEM ═══════════════ */
function CommentItem({ comment, replies = [], myVote, onVote, onReply, isReplying, onSubmitReply, submitting, error, depth = 0 }) {
  const score = (comment.likes_count || 0) - (comment.dislikes_count || 0)

  return (
    <article className={`${depth > 0 ? 'pl-3 sm:pl-6 border-l-2 border-border ml-3 sm:ml-5' : ''}`}>
      <div className="flex items-start gap-3 py-3">
        <Avatar name={comment.author_name} size={depth > 0 ? 'sm' : 'md'} />
        <div className="flex-1 min-w-0">
          <header className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-sm text-text-primary">{comment.author_name}</span>
            <span className="text-[11px] text-text-muted inline-flex items-center gap-1">
              <Clock size={10} /> {timeAgo(comment.created_at)}
            </span>
          </header>
          <p className="text-sm text-text-secondary leading-relaxed mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
          <div className="flex items-center gap-1 mt-2 -ml-2">
            <button
              onClick={() => onVote(comment.id, 1)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-card-hover transition-colors ${myVote === 1 ? 'text-success font-bold' : 'text-text-muted'}`}
              aria-label="Me gusta"
              aria-pressed={myVote === 1}
            >
              <ThumbsUp size={13} fill={myVote === 1 ? 'currentColor' : 'none'} />
              {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
            </button>
            <button
              onClick={() => onVote(comment.id, -1)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-card-hover transition-colors ${myVote === -1 ? 'text-danger font-bold' : 'text-text-muted'}`}
              aria-label="No me gusta"
              aria-pressed={myVote === -1}
            >
              <ThumbsDown size={13} fill={myVote === -1 ? 'currentColor' : 'none'} />
              {comment.dislikes_count > 0 && <span>{comment.dislikes_count}</span>}
            </button>
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-muted hover:bg-card-hover hover:text-accent transition-colors"
              >
                <CornerDownRight size={13} />
                Responder
              </button>
            )}
            {score >= 5 && (
              <span className="ml-auto text-[10px] text-success font-bold uppercase tracking-wider">
                ⭐ Top
              </span>
            )}
          </div>

          {isReplying && (
            <div className="mt-2">
              <CommentForm
                parentId={comment.id}
                onSubmit={onSubmitReply}
                onCancel={() => onReply(null)}
                submitting={submitting}
                error={error}
              />
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-3 sm:ml-5">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              myVote={myVote === reply.id ? null : undefined}
              onVote={onVote}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </article>
  )
}

/* ═══════════════ SORT DROPDOWN ═══════════════ */
function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const options = [
    { key: 'best', label: 'Mejores' },
    { key: 'newest', label: 'Más recientes' },
    { key: 'oldest', label: 'Más antiguos' },
  ]
  const current = options.find(o => o.key === value) || options[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-md hover:bg-card-hover"
      >
        Ordenar por: <span className="text-accent">{current.label}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-20 min-w-[160px] overflow-hidden">
            {options.map(opt => (
              <li key={opt.key}>
                <button
                  onClick={() => { onChange(opt.key); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-card-hover transition-colors ${opt.key === value ? 'text-accent font-bold' : 'text-text-secondary'}`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* ═══════════════ COMMENTS (root) ═══════════════ */
export default function Comments({ newsId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [sortBy, setSortBy] = useState('best')
  const [replyingTo, setReplyingTo] = useState(null)
  const [myVotes, setMyVotes] = useState(() => loadMyVotes())
  const voterToken = useMemo(() => getOrCreateVoterToken(), [])

  const load = useCallback(async () => {
    if (!newsId) return
    setLoading(true)
    const { data } = await supabase
      .from('comments')
      .select('id, news_id, parent_id, author_name, content, likes_count, dislikes_count, created_at')
      .eq('news_id', newsId)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(500)
    setComments(data || [])
    setLoading(false)
  }, [newsId])

  useEffect(() => { load() }, [load])

  // Realtime subscription para nuevos comentarios
  useEffect(() => {
    if (!newsId) return
    const channel = supabase
      .channel(`comments:${newsId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `news_id=eq.${newsId}` },
        (payload) => {
          if (payload.new?.approved) {
            setComments(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [newsId])

  // Estructura threaded: top-level + replies por parent_id
  const tree = useMemo(() => {
    const topLevel = comments.filter(c => !c.parent_id)
    const byParent = {}
    comments.filter(c => c.parent_id).forEach(c => {
      byParent[c.parent_id] = byParent[c.parent_id] || []
      byParent[c.parent_id].push(c)
    })

    // Sort top-level
    const sortFn = sortBy === 'newest'
      ? (a, b) => new Date(b.created_at) - new Date(a.created_at)
      : sortBy === 'oldest'
      ? (a, b) => new Date(a.created_at) - new Date(b.created_at)
      : (a, b) => {
          const sa = (a.likes_count || 0) - (a.dislikes_count || 0)
          const sb = (b.likes_count || 0) - (b.dislikes_count || 0)
          if (sb !== sa) return sb - sa
          return new Date(b.created_at) - new Date(a.created_at)
        }

    const sorted = [...topLevel].sort(sortFn)
    // Replies siempre cronológicos (más antiguos primero)
    Object.keys(byParent).forEach(k => {
      byParent[k].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })

    return sorted.map(t => ({ ...t, _replies: byParent[t.id] || [] }))
  }, [comments, sortBy])

  async function handleSubmit(payload) {
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    const { data, error: err } = await supabase
      .from('comments')
      .insert({
        news_id: newsId,
        author_name: payload.author_name,
        author_email: payload.author_email,
        content: payload.content,
        parent_id: payload.parent_id,
        user_agent: navigator.userAgent.slice(0, 200),
      })
      .select('id, news_id, parent_id, author_name, content, likes_count, dislikes_count, created_at')
      .single()
    setSubmitting(false)

    if (err) {
      const msg = err.message?.toLowerCase() || ''
      if (msg.includes('no_urls') || msg.includes('comments_no_urls')) setError('No se permiten enlaces.')
      else if (msg.includes('no_spam')) setError('Tu comentario contiene palabras bloqueadas.')
      else if (msg.includes('repetition')) setError('Evita caracteres repetidos.')
      else if (msg.includes('clean_author')) setError('Nombre con caracteres no permitidos.')
      else if (msg.includes('espera') || err.code === '42501') setError('Espera unos segundos antes de comentar de nuevo.')
      else if (msg.includes('duplicado') || msg.includes('ya fue publicado')) setError('Ya publicaste ese comentario.')
      else setError('No pudimos publicar tu comentario.')
      return
    }

    setComments(prev => prev.some(c => c.id === data.id) ? prev : [data, ...prev])
    setReplyingTo(null)
    setSuccess(true)
    localStorage.setItem(KEY_NAME, payload.author_name)
    if (payload.author_email) localStorage.setItem(KEY_EMAIL, payload.author_email)
    setTimeout(() => setSuccess(false), 3000)
  }

  async function handleVote(commentId, direction) {
    const current = myVotes[commentId]

    // Si ya votó lo mismo → toggle off
    if (current === direction) {
      await supabase.from('comment_votes').delete().match({ comment_id: commentId, voter_token: voterToken })
      const next = { ...myVotes }; delete next[commentId]
      setMyVotes(next); saveMyVotes(next)
      setComments(prev => prev.map(c => c.id === commentId
        ? { ...c, likes_count: direction === 1 ? Math.max(0, c.likes_count - 1) : c.likes_count, dislikes_count: direction === -1 ? Math.max(0, c.dislikes_count - 1) : c.dislikes_count }
        : c))
      return
    }

    // Si votó al contrario → cambia dirección (delete + insert)
    if (current && current !== direction) {
      await supabase.from('comment_votes').delete().match({ comment_id: commentId, voter_token: voterToken })
    }

    const { error: err } = await supabase
      .from('comment_votes')
      .insert({ comment_id: commentId, voter_token: voterToken, vote: direction })

    if (err) return

    const next = { ...myVotes, [commentId]: direction }
    setMyVotes(next); saveMyVotes(next)
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c
      let likes = c.likes_count || 0
      let dislikes = c.dislikes_count || 0
      if (current === 1) likes = Math.max(0, likes - 1)
      if (current === -1) dislikes = Math.max(0, dislikes - 1)
      if (direction === 1) likes += 1
      if (direction === -1) dislikes += 1
      return { ...c, likes_count: likes, dislikes_count: dislikes }
    }))
  }

  const total = comments.length

  return (
    <section className="mt-8" aria-label="Sección de comentarios">
      {/* Header — count + sort */}
      <header className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <h2 className="text-lg font-bold font-heading flex items-center gap-2">
          <MessageCircle size={20} className="text-accent" />
          {total === 0 ? 'Comentarios' : `${total} ${total === 1 ? 'comentario' : 'comentarios'}`}
        </h2>
        {total > 1 && <SortDropdown value={sortBy} onChange={setSortBy} />}
      </header>

      {/* Top-level form (siempre visible) */}
      <div className="card p-4 mb-6">
        <CommentForm
          onSubmit={handleSubmit}
          submitting={submitting && !replyingTo}
          error={replyingTo ? null : error}
        />
        {success && !replyingTo && (
          <p className="text-xs text-success font-medium mt-2 flex items-center gap-1" role="status">
            <span aria-hidden="true">✓</span> Comentario publicado
          </p>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-text-muted text-center py-8">Cargando comentarios…</p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          Sé el primero en comentar esta noticia.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {tree.map(c => (
            <div key={c.id} className="py-1">
              <CommentItem
                comment={c}
                replies={c._replies}
                myVote={myVotes[c.id]}
                onVote={handleVote}
                onReply={setReplyingTo}
                isReplying={replyingTo === c.id}
                onSubmitReply={handleSubmit}
                submitting={submitting}
                error={replyingTo === c.id ? error : null}
                depth={0}
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-[11px] text-text-muted text-center mt-6 pt-4 border-t border-border">
        Comentarios moderados · No se permiten enlaces ni spam · Powered by <span className="text-accent font-semibold">Contexto Claro</span>
      </p>
    </section>
  )
}
