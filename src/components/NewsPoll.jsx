import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, ThumbsUp } from 'lucide-react'
import { trackPollVote, trackPollResult } from '../lib/analytics'

const POLL_KEY = 'cc_polls'

function getVotes() {
  try { return JSON.parse(localStorage.getItem(POLL_KEY) || '{}') } catch { return {} }
}

function saveVote(newsId, vote, correct) {
  try {
    const votes = getVotes()
    votes[newsId] = { vote, correct, ts: Date.now() }
    localStorage.setItem(POLL_KEY, JSON.stringify(votes))
  } catch {}
}

// Fake community results based on AI verdict + some variance
function getCommunityResult(verdict, confidence) {
  const base = verdict === 'real' ? 0.75 : verdict === 'fake' ? 0.25 : 0.45
  const variance = (Math.random() - 0.5) * 0.1
  const realPct = Math.max(10, Math.min(90, Math.round((base + variance) * 100)))
  return { real: realPct, fake: 100 - realPct }
}

export default function NewsPoll({ newsId, geminiVerdict, geminiConfidence }) {
  const [voted, setVoted] = useState(false)
  const [userVote, setUserVote] = useState(null)
  const [correct, setCorrect] = useState(null)
  const [community, setCommunity] = useState(null)

  useEffect(() => {
    const existing = getVotes()[newsId]
    if (existing) {
      setVoted(true)
      setUserVote(existing.vote)
      setCorrect(existing.correct)
      setCommunity(getCommunityResult(geminiVerdict, geminiConfidence))
    }
  }, [newsId])

  if (!geminiVerdict || geminiVerdict === 'unverified') return null

  const handleVote = (vote) => {
    const isCorrect = (geminiVerdict === 'real' && vote === 'real') || (geminiVerdict !== 'real' && vote === 'fake')
    setVoted(true)
    setUserVote(vote)
    setCorrect(isCorrect)
    const comm = getCommunityResult(geminiVerdict, geminiConfidence)
    setCommunity(comm)
    saveVote(newsId, vote, isCorrect)
    trackPollVote(newsId, geminiVerdict, vote)
    trackPollResult(newsId, isCorrect)
  }

  if (voted) {
    return (
      <div className="rounded-xl border border-border bg-white p-5 mt-6">
        <div className="flex items-center gap-3 mb-4">
          {correct ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={18} className="text-green-600" />
              </div>
              <div>
                <span className="text-sm font-bold text-green-700">¡Acertaste!</span>
                <span className="text-xs text-text-muted block">Tu instinto informativo está afinado</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle size={18} className="text-red-600" />
              </div>
              <div>
                <span className="text-sm font-bold text-red-700">No esta vez</span>
                <span className="text-xs text-text-muted block">La IA clasificó esta noticia como {geminiVerdict === 'real' ? 'REAL' : geminiVerdict === 'fake' ? 'FALSA' : 'ENGAÑOSA'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Community results */}
        {community && (
          <div>
            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Resultados de la comunidad</span>
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 mt-2 mb-2">
              <div className="bg-green-500 flex items-center justify-center transition-all" style={{ width: `${community.real}%` }}>
                {community.real > 20 && <span className="text-[9px] font-bold text-white">{community.real}%</span>}
              </div>
              <div className="bg-red-500 flex items-center justify-center transition-all" style={{ width: `${community.fake}%` }}>
                {community.fake > 20 && <span className="text-[9px] font-bold text-white">{community.fake}%</span>}
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-semibold">
              <span className="text-green-600">Real {community.real}%</span>
              <span className="text-red-600">Falsa {community.fake}%</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 border-accent/20 bg-gradient-to-br from-accent-muted to-transparent p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <ThumbsUp size={16} className="text-accent" />
        <span className="text-sm font-bold font-heading text-text-primary">¿Tú qué opinas?</span>
      </div>
      <p className="text-xs text-text-secondary mb-4">Antes de ver el veredicto de la IA, ¿crees que esta noticia es real o falsa?</p>
      <div className="flex gap-3">
        <button
          onClick={() => handleVote('real')}
          className="flex-1 py-3 rounded-xl bg-green-50 border-2 border-green-200 text-green-700 text-sm font-bold hover:bg-green-100 hover:border-green-300 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle size={16} /> Es real
        </button>
        <button
          onClick={() => handleVote('fake')}
          className="flex-1 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 text-sm font-bold hover:bg-red-100 hover:border-red-300 transition-all flex items-center justify-center gap-2"
        >
          <XCircle size={16} /> Es falsa
        </button>
      </div>
    </div>
  )
}
