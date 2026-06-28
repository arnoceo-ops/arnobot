'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useIsTouch } from '@/hooks/useBreakpoint'
import { useClerk, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

function formatLastDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((nowDay.getTime() - dDay.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'vandaag'
  if (diffDays === 1) return 'gisteren'
  if (diffDays < 7) return `${diffDays} dagen geleden`
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function renderContent(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped
    .replace(/\[([^\]]+)\]\s*\((https?:\/\/[^\s)]+)\)/g, (_, linkText, url) => {
      const display = linkText.length > 52 ? linkText.slice(0, 49) + '...' : linkText
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#f59e0b;text-decoration:underline">${display}</a>`
    })
    .replace(/(?<!\()(https?:\/\/[^\s<"]+)/g, (url, _, offset, str) => str[offset - 1] === '"' ? url : `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#f59e0b;text-decoration:underline">${url}</a>`)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
}

interface Message {
  role: 'user' | 'arno'
  content: string
  hint?: string | null
}

interface Props {
  userId: string
  profiel: Record<string, unknown>
  tier: 'basis' | 'pro'
  taglineTitle: string
  taglineSub: string
  openers: string[]
  resumeSessionId?: string
}

const STRATEGISCH_ROLLEN = ['VP of Sales', 'CEO/DGA']
const ORGANISATORISCH_ROLLEN = ['Sales Manager/Director']
const SALES_ONLY_ROLLEN = ['AE Hunter', 'AM Farmer', 'Key AM', 'Inside Sales']

const VERKOPER_ROLLEN_SPAR = ['AE Hunter', 'AM Farmer', 'Key AM', 'Inside Sales']
const SALESBAAS_ROLLEN_SPAR = ['Sales Director', 'VP of Sales']
const EINDBAAS_ROLLEN_SPAR = ['CEO/DGA']
const SOLOPRENEUR_ROLLEN_SPAR = ['Solopreneur']

const PERSONAS: Record<string, { key: string; label: string }[]> = {
  verkoper: [
    { key: 'dga', label: 'DGA' },
    { key: 'cfo', label: 'CFO' },
    { key: 'inkoopmanager', label: 'Inkoopmanager' },
    { key: 'sales_director', label: 'Sales Director' },
    { key: 'anders', label: 'Anders' },
  ],
  salesbaas: [
    { key: 'underperformer', label: 'Underperformer' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'ceo', label: 'CEO' },
    { key: 'grote_klant', label: 'Grote Klant' },
    { key: 'anders', label: 'Anders' },
  ],
  eindbaas: [
    { key: 'investeerder', label: 'Investeerder' },
    { key: 'grote_klant', label: 'Grote klant' },
    { key: 'partner', label: 'Partner' },
    { key: 'mt_lid', label: 'MT-lid' },
    { key: 'anders', label: 'Anders' },
  ],
  solopreneur: [
    { key: 'prospect', label: 'Prospect' },
    { key: 'te_duur', label: 'Te Duur' },
    { key: 'grote_klant', label: 'Grote Klant' },
    { key: 'oud_klant', label: 'Oud Klant' },
    { key: 'anders', label: 'Anders' },
  ],
}

const VRAGEN_STRATEGISCH = [
  'Mijn salesteam haalt structureel de targets niet. Waar ligt het écht aan?',
  'Wat onderscheidt een winnende salesorganisatie van een gemiddelde?',
  'Wanneer is een salesstrategie echt een strategie en niet een wensenlijst?',
  'Hoe verkoop ik intern mijn strategie aan de board?',
  'Hoe bouw ik een commerciële strategie die de markt op z\'n kop zet?',
  'Mijn groei vlakt af. Is dat een markt-, model- of mezelf-probleem?',
  'Hoe weet ik of ik de juiste markt heb gekozen of kies ik zogenaamd voor veilig?',
  'Hoe weet ik of mijn strategie me ooit marktleider maakt of me alleen maar bezig houdt?',
  'Hoe bouw ik een commercieel model dat ook zonder mij blijft groeien?',
  'Mijn pipeline ziet er goed uit maar de conversie klopt niet. Waarom?',
  'Wat is de grootste mindset-fout aka mindfuck van salesbazen?',
  'Wat moet ik anders doen om over een jaar marktleider te zijn?',
]

const VRAGEN_OPERATIONEEL = [
  'Ik werk keihard maar mijn pipeline blijft leeg. Waar gaat mijn energie naartoe?',
  'Mijn prospect zegt "te duur". Maar is dat de echte reden of geef ik hem een excuus?',
  'Wanneer is een eerste gesprek een investering en wanneer is het gewoon tijdverspilling?',
  'Ik presenteer goed, mijn offerte klopt, en toch tekent niemand. Wat zie ik niet?',
  'Mijn prospect was enthousiast. Tot ik de offerte stuurde. Wat ging er mis?',
  'Hoe verkoop ik op waarde als mijn klant alleen wil praten over prijs?',
  'Hoe weet ik of ik een deal aan het closen ben of aan het redden?',
  'Wat is de grootste mindfuck van verkopers die structureel underperformen?',
  'Hoe onderscheid ik me als ik objectief gezien hetzelfde verkoop als mijn concurrent?',
  'Mijn deal is al drie maanden "bijna rond". Wat klopt er niet?',
  'Wanneer is cold outreach gewoon doorzetten en wanneer is het jezelf voor de gek houden?',
  'Wanneer stop ik met verkopen en begin ik echt te overtuigen. En wat is het verschil?',
]

const VRAGEN_ORGANISATORISCH = [
  'Al zes maanden een vacature open en niemand is goed genoeg. Terecht of excuus?',
  'Hoe weet ik tijdens een sollicitatiegesprek of iemand echt honger heeft of alleen maar zichzelf goed verkoopt?',
  'Mijn team presteert gemiddeld en ik doe alles om het beter te maken. Wat als ik het verkeerde team heb gebouwd?',
  'Ik coach mijn mensen al maanden maar er verandert niets. Wanneer is het hun probleem en wanneer is het het mijne?',
  'Wanneer is iemand een investering die tijd nodig heeft, en wanneer is hij gewoon een kostenpost die ik meesleep?',
  'Ik wil iemand ontslaan maar twijfel al weken. Wat zegt die twijfel eigenlijk over mij?',
  'Mijn beste mensen vertrekken naar concurrenten. Wat bied ik ze niet wat die concurrent wel biedt?',
  'Ik betaal mijn verkopers goed maar het zijn geen warriors. Hoe kom ik daar achter voordat ik ze een contract aanbied?',
  'Mijn team kan de huidige fase aan, maar niet de volgende. Bouw ik om ze heen of vervang ik ze?',
  'Mijn team accepteert middelmatigheid als norm. Hoe verander ik die norm zonder iedereen tegen me te krijgen?',
  'Wat is het verschil tussen iemand die loyaal is aan het bedrijf en iemand die gewoon nergens anders naartoe kan?',
  'Wanneer is een bonussysteem een motor en wanneer is het een pleister op een cultuurprobleem?',
]

export default function SparClient({ userId, profiel, tier, taglineTitle, taglineSub, openers, resumeSessionId }: Props) {
  const isMobile = useIsTouch()
  const { signOut } = useClerk()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{role: string, content: string}[]>([])
  const [started, setStarted] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [showSluiten, setShowSluiten] = useState(false)
  const [synthesisLoading, setSynthesisLoading] = useState(false)
  const [synthesisMessageCount, setSynthesisMessageCount] = useState(0)
  const [verfijnen, setVerfijnen] = useState(false)
  const [verfijndSuggestie, setVerfijndSuggestie] = useState('')
  const [verfijnFout, setVerfijnFout] = useState(false)
  const [inputIsVerfijnd, setInputIsVerfijnd] = useState(false)
  const [resizeInput, setResizeInput] = useState(false)
  const [suggestedBlogs, setSuggestedBlogs] = useState<{title: string, url: string}[]>([])
  const [voortgang, setVoortgang] = useState<{count: number, lastDate: string | null} | null>(null)
  const isStrategischProfiel = STRATEGISCH_ROLLEN.includes((profiel?.rol as string) ?? '')
  const isOrganisatorischProfiel = ORGANISATORISCH_ROLLEN.includes((profiel?.rol as string) ?? '')
  const isSalesOnlyProfiel = SALES_ONLY_ROLLEN.includes((profiel?.rol as string) ?? '')
  const rolCategorie = VERKOPER_ROLLEN_SPAR.includes((profiel?.rol as string) ?? '') ? 'verkoper' :
    SALESBAAS_ROLLEN_SPAR.includes((profiel?.rol as string) ?? '') ? 'salesbaas' :
    EINDBAAS_ROLLEN_SPAR.includes((profiel?.rol as string) ?? '') ? 'eindbaas' :
    SOLOPRENEUR_ROLLEN_SPAR.includes((profiel?.rol as string) ?? '') ? 'solopreneur' : null
  const [openerModus, setOpenerModus] = useState<'strategisch' | 'organisatorisch' | 'sales'>(
    isStrategischProfiel ? 'strategisch' : isOrganisatorischProfiel ? 'organisatorisch' : 'sales'
  )
  const [recording, setRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [ttsLoading, setTtsLoading] = useState<number | null>(null)
  const [ttsSpeed, setTtsSpeed] = useState(1.25)
  const [ttsSpeedOpenIdx, setTtsSpeedOpenIdx] = useState<number | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [dagelijksTeller, setDagelijksTeller] = useState<number | null>(null)
  const [dynamicOpeners, setDynamicOpeners] = useState<{ strategisch: string[]; organisatorisch: string[]; operationeel: string[] } | null>(null)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const [navGuardOpen, setNavGuardOpen] = useState(false)
  const [pendingNavDest, setPendingNavDest] = useState<string | null>(null)
  const { user, isLoaded } = useUser()
  const [isBouwer, setIsBouwer] = useState(false)
  useEffect(() => {
    if (isLoaded) setIsBouwer(user?.primaryEmailAddress?.emailAddress === 'linkedin@royaldutchsales.com')
  }, [isLoaded, user])
  const [teamPrompt, setTeamPrompt] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [sparModus, setSparModus] = useState<'coaching' | 'sparren'>('coaching')
  const [sparPersona, setSparPersona] = useState('')
  const [sparWeerstand, setSparWeerstand] = useState<'licht' | 'stevig' | 'zwaar'>('stevig')
  const [sparContext, setSparContext] = useState('')
  const [antwoordLengte, setAntwoordLengte] = useState<'kort' | 'normaal' | 'uitgebreid'>('normaal')
  const [debriefVraag, setDebriefVraag] = useState('')
  const [debriefAntwoord, setDebriefAntwoord] = useState<string | null>(null)
  const [debriefLoading, setDebriefLoading] = useState(false)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const synthesisRef = useRef<HTMLDivElement>(null)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  const debriefVraagRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef(sessionId)

  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) setSpeechSupported(true)
    const saved = localStorage.getItem('arnobot_tts_speed')
    setTtsSpeed(saved ? parseFloat(saved) : 1.25)
  }, [])

  function toggleRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    const rec = new SR()
    rec.lang = 'nl-NL'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join('')
      setInput(transcript)
      setResizeInput(true)
    }
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }

  function handleNavAttempt(dest: string) {
    if (started && messages.length > 0 && !showSluiten) {
      setPendingNavDest(dest)
      setNavGuardOpen(true)
    } else {
      if (dest === 'logout') signOut(() => router.push('/'))
      else router.push(dest)
    }
  }

  useEffect(() => {
    if (showSluiten && pendingNavDest) {
      const dest = pendingNavDest
      setPendingNavDest(null)
      setTimeout(() => {
        if (dest === 'logout') signOut(() => router.push('/'))
        else router.push(dest)
      }, 1800)
    }
  }, [showSluiten])

  async function sendFeedback() {
    if (!feedbackText.trim()) return
    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackText }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setFeedbackText(feedbackText)
        alert(data.error || 'Er ging iets mis. Probeer opnieuw.')
        return
      }
      setFeedbackSent(true)
      setFeedbackText('')
      setTimeout(() => { setFeedbackOpen(false); setFeedbackSent(false) }, 2000)
    } catch {
      alert('Er ging iets mis. Probeer opnieuw.')
    } finally { setFeedbackLoading(false) }
  }

  useEffect(() => {
    if (resumeSessionId) {
      sessionStorage.setItem('arnobot_session', resumeSessionId)
      setSessionId(resumeSessionId)
      fetch(`/api/bot/session?sessionId=${resumeSessionId}`)
        .then(r => r.json())
        .then(data => {
          if (data.messages?.length > 0) {
            setMessages(data.messages)
            setHistory(data.history)
            setStarted(true)
          }
        })
        .catch(() => {})
    } else {
      const existing = sessionStorage.getItem('arnobot_session')
      const id = existing || crypto.randomUUID()
      if (!existing) sessionStorage.setItem('arnobot_session', id)
      setSessionId(id)

      if (existing) {
        fetch(`/api/bot/session?sessionId=${existing}`)
          .then(r => r.json())
          .then(data => {
            if (data.messages?.length > 0) {
              setMessages(data.messages)
              setHistory(data.history)
              setStarted(true)
            }
          })
          .catch(() => {})
      }
    }

    fetch('/api/bot/openers')
      .then(r => r.json())
      .then(data => { if (data.openers) setDynamicOpeners(data.openers) })
      .catch(() => {})

    // Verwerk referral code uit localStorage na OAuth
    const referralCode = localStorage.getItem('arnobot_referral')
    if (referralCode) {
      localStorage.removeItem('arnobot_referral')
      fetch('/api/bot/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: referralCode }),
      }).catch(() => {})
    }

    if (userId) {
      fetch('/api/bot/sessions')
        .then(r => r.json())
        .then(data => {
          const sessions = data.sessions ?? []
          if (sessions.length > 0) {
            setVoortgang({ count: sessions.length, lastDate: sessions[0]?.created_at ?? null })
          }
        })
        .catch(() => {})

      const HEEFT_TEAM_ROLLEN = ['Sales Director', 'VP of Sales', 'CEO/DGA']
      const heeftManagerRol = HEEFT_TEAM_ROLLEN.includes((profiel?.rol as string) ?? '')
      const gebruik = (profiel?.gebruik as string) ?? ''
      // Toon prompt als: manager-rol + (wil team OF nog geen keuze gemaakt), maar niet als expliciet individueel
      if (heeftManagerRol && gebruik !== 'individueel') {
        const cached = localStorage.getItem('arnobot_is_manager') === '1'
        if (cached) setIsManager(true)
        fetch('/api/bot/team/status')
          .then(r => r.json())
          .then(d => {
            if (d.isManager) setIsManager(true)
            if (!d.hasTeam && !d.promptDismissed) setTeamPrompt(true)
          })
          .catch(() => {})
      }

      // Pre-fill vanuit coaching pagina
      const prefill = localStorage.getItem('arnobot_prefill')
      if (prefill) {
        pickTopic(prefill)
        localStorage.removeItem('arnobot_prefill')
      }
    }
  }, [])

  function scrollToRef(ref: React.RefObject<HTMLDivElement | null>) {
    const el = ref.current
    if (!el) return
    const navHeight = (isMobile ? 56 : 64) + 16
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight
    window.scrollTo({ top, behavior: 'smooth' })
  }

  useEffect(() => {
    if (showSluiten && synthesisRef.current) {
      scrollToRef(synthesisRef)
    } else if (loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (messages.length > 0) {
      scrollToRef(lastMessageRef)
    }
  }, [messages, loading, showSluiten])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '0px'
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
    }
  }, [input])

  useEffect(() => {
    function handleUnload(e: BeforeUnloadEvent) {
      const sid = sessionIdRef.current
      if (!sid || messages.length === 0) return
      if (started && !showSluiten) {
        e.preventDefault()
        e.returnValue = ''
      }
      const blob = new Blob(
        [JSON.stringify({ sessionId: sid, messages })],
        { type: 'application/json' }
      )
      navigator.sendBeacon('/api/bot/session-end', blob)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [messages, started, showSluiten])

  useEffect(() => {
    if (resizeInput && inputRef.current) {
      inputRef.current.style.height = '0px'
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
      inputRef.current.focus()
      setResizeInput(false)
    }
  }, [resizeInput, input])

  function pickTopic(text: string) {
    setInput(text)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.style.height = '0px'
        inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
      }
    }, 0)
  }

  function reset() {
    const newId = crypto.randomUUID()
    sessionStorage.setItem('arnobot_session', newId)
    setSessionId(newId)
    setStarted(false)
    setMessages([])
    setHistory([])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = '55px'
    setLoading(false)
    setBlocked(false)
    setShowSluiten(false)
    setSynthesisLoading(false)
    setSynthesisMessageCount(0)
    setSuggestedBlogs([])
    setPendingNavDest(null)
    setAntwoordLengte('normaal')
    setDebriefVraag('')
    setDebriefAntwoord(null)
    setSparContext('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => inputRef.current?.focus(), 150)
  }

  async function speak(text: string, idx: number) {
    if (speakingIdx === idx) {
      audioRef.current?.pause()
      audioRef.current = null
      setSpeakingIdx(null)
      return
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setSpeakingIdx(null)
    setTtsLoading(idx)
    try {
      const clean = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, speed: ttsSpeed })
      })
      if (!res.ok) throw new Error('TTS mislukt')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setSpeakingIdx(null); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeakingIdx(null) }
      setSpeakingIdx(idx)
      audio.play()
    } catch {
      setSpeakingIdx(null)
    } finally {
      setTtsLoading(null)
    }
  }

  async function handleNieuw() {
    if (synthesisLoading) return
    if (synthesisMessageCount > 0 && messages.length <= synthesisMessageCount) {
      reset()
      return
    }
    if (messages.length === 0) {
      reset()
      return
    }
    if (showSluiten) setShowSluiten(false)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = '55px'
    setSynthesisLoading(true)

    if (sparModus === 'sparren') {
      try {
        const res = await fetch('/api/sparring/debrief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, profiel, persona: sparPersona, weerstand: sparWeerstand, rolCategorie })
        })
        const data = await res.json()
        if (data.debrief) {
          const newCount = messages.length + 1
          setMessages(prev => [...prev, {
            role: 'arno',
            content: `**Debrief**\n\n${data.debrief}`,
            hint: null
          }])
          setSynthesisMessageCount(newCount)
          const newId = crypto.randomUUID()
          sessionStorage.setItem('arnobot_session', newId)
          setSessionId(newId)
          setShowSluiten(true)
        } else {
          reset()
        }
      } catch {
        reset()
      } finally {
        setSynthesisLoading(false)
      }
      return
    }

    try {
      const res = await fetch('/api/bot/session-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages })
      })
      const data = await res.json()
      if (data.summary) {
        const newCount = messages.length + 1
        setMessages(prev => [...prev, {
          role: 'arno',
          content: `**Terugblik op dit gesprek**\n\n${data.summary}`,
          hint: null
        }])
        if (data.blogs?.length) setSuggestedBlogs(data.blogs)
        setSynthesisMessageCount(newCount)
        const newId = crypto.randomUUID()
        sessionStorage.setItem('arnobot_session', newId)
        setSessionId(newId)
        setShowSluiten(true)
        if (userId) {
          setVoortgang(prev => prev
            ? { count: prev.count + 1, lastDate: new Date().toISOString() }
            : { count: 1, lastDate: new Date().toISOString() }
          )
        }
      } else {
        reset()
      }
    } catch {
      reset()
    } finally {
      setSynthesisLoading(false)
    }
  }

  async function askDebrief() {
    if (!debriefVraag.trim() || debriefLoading) return
    const debriefMsg = messages.find(m => m.content?.startsWith('**Debrief'))
    if (!debriefMsg) return
    setDebriefLoading(true)
    try {
      const res = await fetch('/api/sparring/doorvraag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: debriefVraag, debrief: debriefMsg.content })
      })
      const data = await res.json()
      setDebriefAntwoord(data.answer || '')
      setDebriefVraag('')
      setTimeout(() => debriefVraagRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch {
      setDebriefAntwoord('Er ging iets mis. Probeer opnieuw.')
    } finally {
      setDebriefLoading(false)
    }
  }

  async function ask(question: string) {
    if (!question.trim() || loading || blocked) return
    setStarted(true)
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setInput('')
    if (inputRef.current) { inputRef.current.style.height = '55px' }
    setLoading(true)

    try {
      if (sparModus === 'sparren') {
        const res = await fetch('/api/sparring/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question, history, rolCategorie, persona: sparPersona, weerstand: sparWeerstand, context: sparContext })
        })
        const data = await res.json()
        const answer = data.answer || 'Er ging iets mis.'
        setMessages(prev => [...prev, { role: 'arno', content: answer, hint: null }])
        setHistory(prev => [
          ...prev,
          { role: 'user', content: question },
          { role: 'assistant', content: answer }
        ])
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, history, userId, profiel, sessionId, antwoordLengte })
        })
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 429 && data.error === 'dagelijks_limiet') {
            setBlocked(true)
            setDagelijksTeller(25)
            setMessages(prev => [...prev, { role: 'arno', content: 'Je dagelijkse limiet van 25 vragen is bereikt. Kom morgen terug.' }])
          } else {
            setMessages(prev => [...prev, { role: 'arno', content: `Fout: ${data.error || res.status}` }])
          }
          return
        }

        if (data.dagelijks_gebruikt != null) setDagelijksTeller(data.dagelijks_gebruikt)

        if (data.blocked) {
          setBlocked(true)
          setMessages(prev => [...prev, { role: 'arno', content: '', hint: 'blocked' }])
          return
        }

        const answer = data.answer || 'Geen antwoord ontvangen.'
        setMessages(prev => [...prev, { role: 'arno', content: answer, hint: data.hint ?? null }])
        setHistory(prev => [
          ...prev,
          { role: 'user', content: question },
          { role: 'assistant', content: answer }
        ])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'arno', content: 'Er ging iets mis. Probeer opnieuw.' }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow:wght@400;700&family=Barlow+Condensed:wght@300;600;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }

                /* NAV */
        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 clamp(20px,5vw,60px); height: 64px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.95); backdrop-filter: blur(12px);
        }
        .nav-spacer { flex: 1; }
        .nav-links { display: flex; gap: 48px; align-items: center; }
        .nav-links a, .nav-links button {
          color: #9ca3af; text-decoration: none; font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
          background: none; border: none; cursor: pointer; padding: 0;
        }
        .nav-links a:hover, .nav-links button:hover { color: #f1f5f9; }
        .nav-active { color: #f59e0b !important; }
        .nav-cta { color: #f59e0b !important; }

        /* MOBILE NAV */
        .mob-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 56px; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.97); backdrop-filter: blur(12px);
        }
        .mob-nav-logo {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
          color: #f1f5f9; text-decoration: none;
        }
        .mob-nav-logo span { color: #f59e0b; }
        .mob-hamburger {
          background: none; border: none; cursor: pointer;
          display: flex; flex-direction: column; gap: 5px; padding: 8px;
        }
        .mob-hamburger span { display: block; width: 22px; height: 2px; background: #f1f5f9; transition: all 0.2s; }
        .mob-menu {
          position: fixed; top: 56px; left: 0; right: 0; z-index: 99;
          background: #111827; border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 24px 20px; display: flex; flex-direction: column; gap: 24px;
        }
        .mob-menu a, .mob-menu span {
          font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px;
          text-decoration: none;
        }
        .mob-menu a { color: #9ca3af; }
        .mob-menu a:hover { color: #f1f5f9; }
        .mob-menu .active { color: #f59e0b; }

        /* SPAR LAYOUT */
        .spar-page {
          min-height: 100vh; padding-top: 64px;
          display: flex; flex-direction: column;
        }

        /* HERO — 2 kolommen, schaalt van nature mee, geen harde grenzen */
        .spar-hero {
          border-bottom: 3px solid #f59e0b;
          display: grid;
          grid-template-columns: auto auto;
          gap: clamp(24px, 4vw, 80px);
          justify-content: center;
          align-items: flex-end;
          padding: clamp(20px,3vw,36px) clamp(20px,5vw,60px) clamp(28px,4vw,48px);
          overflow: hidden;
        }
        .hero-photo img {
          height: clamp(200px, 24vw, 340px);
          width: auto;
          display: block;
        }
        .hero-text {
          display: flex; flex-direction: column; justify-content: flex-end;
          gap: clamp(10px, 1.5vw, 20px);
        }
        .spar-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(64px, 10vw, 120px);
          line-height: 0.9; letter-spacing: -2px;
        }
        .spar-title span { color: #f59e0b; }
        .hero-subtitle {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(20px, 2.5vw, 40px);
          letter-spacing: 2px; color: #9ca3af; line-height: 1.2;
        }
        /* Touch (telefoon / tablet): één kolom, gecentreerd — geen pixel-grens */
        @media (pointer: coarse) {
          .spar-hero {
            grid-template-columns: 1fr;
            text-align: center; align-items: center;
            padding: clamp(48px,8vw,80px) clamp(20px,5vw,60px) clamp(40px,6vw,64px);
          }
          .hero-photo { display: none; }
          .hero-text { align-items: center; }
          .spar-title { font-size: clamp(72px, 14vw, 140px); }
        }
        @media (max-width: 700px) {
          .spar-input-row { flex-direction: column; }
          .spar-textarea { flex: none; width: 100%; }
          .spar-buttons { align-self: stretch; border-top: 1px solid #374151; }
          .spar-mic { height: 48px; width: 52px; flex-shrink: 0; border-left: none; border-right: 1px solid #374151; }
          .spar-send { flex: 1; min-width: 0; height: 48px; font-size: 17px; padding: 0 20px; }
          .spar-reset { height: 48px; padding: 0 16px; font-size: 15px; }
          .spar-openers { overflow-x: hidden; }
          .opener-toggle { display: grid; grid-template-columns: repeat(2, 1fr); width: 100%; max-width: 812px; }
          .toggle-btn { font-size: 11px; letter-spacing: 0px; padding: 7px 4px; border-radius: 4px; }
          .toggle-btn:last-child { grid-column: 1 / -1; justify-self: center; width: 50%; }
          .verfijn-btn { display: none; }
        }

        /* INPUT — BOVEN BIJ NIEUW GESPREK, STICKY-ONDER BIJ ACTIEF */
        .spar-input-area {
          background: #111827;
          padding: clamp(24px,4vw,40px) clamp(20px,5vw,60px) clamp(32px,5vw,56px);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .spar-input-area.active {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: rgba(17,24,39,0.97);
          border-top: 2px solid #f59e0b;
          padding: 20px 16px 28px;
          z-index: 50;
        }
        .spar-input-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 14px; letter-spacing: 3px; text-transform: uppercase;
          color: #4b5563; margin-bottom: 10px; display: block; line-height: 1;
          width: 100%; max-width: 812px;
        }
        .spar-input-row {
          display: flex; gap: 0;
          border: 2px solid #f59e0b;
          width: 100%; max-width: 812px;
          margin: 0 auto;
        }
        .spar-textarea {
          flex: 1;
          background: #1f2937;
          border: none;
          color: #f1f5f9;
          font-family: 'Space Mono', monospace;
          font-size: 15px; font-weight: 400;
          padding: 13px 18px; outline: none;
          resize: none; overflow: hidden;
          min-height: 55px;
          line-height: 29px;
          display: block;
          field-sizing: content;
        }
        .spar-textarea::placeholder { color: #4b5563; font-style: normal; font-size: 15px; font-weight: 400; }
        .spar-context-textarea::placeholder { color: #4b5563; }
        .spar-textarea:focus { background: #1f2937; }
        .spar-buttons {
          display: flex; align-self: flex-end;
        }
        .spar-mic {
          background: #1f2937; color: #6b7280;
          font-size: 20px; border: none; border-left: 1px solid #374151;
          padding: 0 18px; cursor: pointer; transition: all 0.2s;
          height: 55px; display: flex; align-items: center; justify-content: center;
        }
        .spar-mic:hover { color: #f1f5f9; background: #374151; }
        .spar-mic.recording {
          color: #f59e0b; background: #374151;
          animation: micpulse 1s ease-in-out infinite;
        }
        @keyframes micpulse {
          0%, 100% { color: #f59e0b; }
          50% { color: #f59e0b; }
        }

        .spar-send {
          background: #f59e0b; color: #111827;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px; letter-spacing: 3px;
          padding: 0 32px; border: none; cursor: pointer;
          transition: background 0.2s; white-space: nowrap; min-width: 120px;
          height: 55px; align-self: flex-end;
        }
        .spar-send:hover { background: #d97706; }
        .spar-send:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
        .spar-reset {
          background: #1f2937; color: #f1f5f9;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px; letter-spacing: 3px;
          padding: 0 32px; border: none; border-left: 1px solid #374151; cursor: pointer;
          transition: all 0.2s; white-space: nowrap; min-width: 120px;
          height: 55px; align-self: flex-end;
        }
        .spar-reset:hover { background: #374151; }
        .spar-reset.accented { border: 1px solid #6b7280; border-left: 1px solid #6b7280; }
        .spar-reset.accented:hover { border-color: #9ca3af; }
        .spar-reset.sluiten { background: #f59e0b; color: #111827; border-left-color: #f59e0b; }
        .spar-reset.sluiten:hover { background: #d97706; }
        .spar-input-intro {
          font-family: 'Space Mono', monospace;
          font-size: 13px; font-weight: 400; letter-spacing: 4px; color: #f59e0b;
          text-transform: uppercase;
          width: 100%; max-width: 812px;
          display: block; margin-bottom: 20px; text-align: center;
        }
        .spar-discipline-label {
          font-family: 'Space Mono', monospace;
          font-size: 13px; font-weight: 400; letter-spacing: 4px; color: #f59e0b;
          display: block; margin-bottom: 20px; text-align: center; width: 100%;
          text-transform: uppercase;
        }
        .spar-questions-label {
          font-family: 'Space Mono', monospace;
          font-size: 13px; font-weight: 400; letter-spacing: 4px; color: #f59e0b;
          display: block; margin-top: clamp(56px,8vw,80px); margin-bottom: 12px; text-align: center; width: 100%;
          text-transform: uppercase;
        }
        .spar-questions-sub {
          font-family: 'Space Mono', monospace;
          font-size: 15px; font-weight: 400; color: #9ca3af;
          display: block; margin-bottom: 40px; text-align: center; width: 100%;
        }
        .verfijn-btn {
          background: none; border: none; cursor: pointer;
          font-family: 'Space Mono', monospace;
          font-size: 15px; letter-spacing: 0px; line-height: 29px;
          color: #f59e0b; padding: 6px 0 0; text-align: center;
          width: 100%; max-width: 812px;
          transition: opacity 0.15s;
        }
        .verfijn-btn:hover { opacity: 0.75; }
        .verfijn-btn:disabled { color: #6b7280; cursor: not-allowed; }

        /* OPENERS */
        .spar-openers {
          padding: clamp(56px,8vw,96px) 20px 0;
          background: #111827;
          border-bottom: 1px solid #374151;
          display: flex; flex-direction: column; align-items: center;
        }
        .opener-toggle {
          display: flex; gap: 8px; justify-content: center; margin: 0 auto 2px;
        }
        .toggle-btn {
          background: #1f2937; border: none; color: #6b7280;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px; letter-spacing: 3px;
          padding: 12px 0; min-width: 170px; cursor: pointer;
          border-radius: 999px; text-align: center;
          transition: all 0.15s;
        }
        .toggle-btn:hover { color: #9ca3af; }
        .toggle-btn.active { background: #f59e0b; color: #111827; }
        .openers-label {
          font-size: 10px; letter-spacing: 4px; text-transform: uppercase;
          color: #4b5563; padding: 32px 0 20px; display: block;
        }
        .openers-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          width: 100%; max-width: 1218px;
          gap: 2px;
          margin-bottom: 2px;
        }
        .openers-grid-line {
          width: 100%; max-width: 1218px;
          border-top: 2px solid #f59e0b;
          margin-bottom: 0;
        }
        @media (max-width: 560px) { .openers-grid { grid-template-columns: 1fr; } }
        .opener-btn {
          background: #1f2937; border: none; color: #9ca3af;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 1px;
          padding: 24px 28px; cursor: pointer; text-align: left;
          line-height: 1.3; transition: all 0.15s;
        }
        .opener-btn:hover {
          background: #f59e0b; color: #111827;
        }

        /* GESPREK */
        .spar-conversation {
          flex: 1;
          display: flex; flex-direction: column; gap: 0;
          max-width: 812px;
          width: 100%;
          margin: 0 auto;
        }

        .msg-user {
          padding: clamp(20px,3vw,32px) clamp(20px,3vw,32px); border-bottom: 1px solid #1f2937;
          display: flex; gap: clamp(16px,3vw,40px); align-items: flex-start;
        }
        .msg-user-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px; letter-spacing: 3px;
          color: #6b7280; white-space: nowrap; padding-top: 2px; min-width: 48px;
        }
        .msg-user-text {
          font-size: clamp(18px,3vw,26px); line-height: 1.5; color: #f1f5f9;
          font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px;
        }

        .msg-arno {
          padding: clamp(20px,3vw,32px) clamp(20px,3vw,32px); border-bottom: 1px solid #374151;
          display: flex; gap: clamp(16px,3vw,40px); align-items: flex-start;
          background: #1f2937;
        }
        .msg-arno-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px; letter-spacing: 3px;
          color: #f59e0b; white-space: nowrap; padding-top: 2px; min-width: 48px; text-align: center;
        }
        .msg-arno-text {
          font-size: 15px; line-height: 1.9; color: #9ca3af;
          max-width: 680px; white-space: pre-wrap;
        }

        .msg-loading {
          padding: clamp(24px,4vw,40px) 0 clamp(24px,4vw,40px) 64px;
          display: flex; align-items: center; gap: 16px;
        }
        .loading-dots { display: flex; gap: 6px; }
        .loading-dot {
          width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;
          animation: pulse 1.2s ease-in-out infinite;
        }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        .loading-text {
          font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #374151;
        }

        /* GLOW op invoerveld na gesprek */
        .spar-input-row.active-glow {
          border-color: #f59e0b;
          box-shadow: inset 0 0 0 3px rgba(245,158,11,0.25);
          animation: glowpulse 2s ease-in-out infinite;
        }
        @media (min-width: 701px) {
          .spar-input-row.active-glow { flex-direction: column; }
          .spar-input-row.active-glow .spar-buttons {
            align-self: stretch; justify-content: flex-start;
            border-top: 1px solid #374151;
          }
        }
        .spar-input-row.blink-glow {
          animation: blinkglow 0.4s ease-in-out 4;
        }
        @keyframes glowpulse {
          0%, 100% { box-shadow: inset 0 0 0 3px rgba(245,158,11,0.2); }
          50% { box-shadow: inset 0 0 0 3px rgba(245,158,11,0.5); }
        }
        @keyframes blinkglow {
          0%, 100% { box-shadow: inset 0 0 0 3px rgba(245,158,11,0.15); }
          50% { box-shadow: inset 0 0 0 6px rgba(245,158,11,0.7); border-color: #ff9900; }
        }

        /* ACTIE KNOPPEN onder antwoord */
        .msg-actions {
          padding: 20px 0 20px 120px;
          display: flex; gap: 12px; align-items: center;
          border-bottom: 1px solid #1f2937;
          animation: fadein 0.4s ease;
        }
        @keyframes fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .msg-action-btn {
          background: none; border: 1px solid #374151;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 15px; letter-spacing: 2px;
          padding: 10px 20px; cursor: pointer; transition: all 0.15s;
          border-radius: 999px;
        }
        .msg-action-btn.primary {
          color: #f59e0b; border-color: #f59e0b;
        }
        .msg-action-btn.primary:hover {
          background: #f59e0b; color: #111827;
        }
        .msg-action-btn.secondary {
          color: #6b7280; border-color: #374151;
        }
        .msg-action-btn.secondary:hover {
          border-color: #6b7280; color: #9ca3af;
        }

        /* HINT / CTA BLOKKEN */
        .msg-hint {
          padding: 16px 0 16px 120px;
          font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
          color: #f59e0b; border-bottom: 1px solid #1f2937;
          animation: fadein 0.4s ease;
        }
        .msg-cta {
          padding: 24px 0 24px 120px;
          border-bottom: 1px solid #1f2937;
          animation: fadein 0.4s ease;
        }
        .msg-cta p {
          font-size: 13px; letter-spacing: 1px; color: #9ca3af; margin-bottom: 14px;
        }
        .msg-cta-btn {
          display: inline-block;
          background: #f59e0b; color: #111827;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px; letter-spacing: 3px;
          padding: 12px 28px; text-decoration: none;
          border-radius: 999px;
          transition: background 0.2s;
        }
        .msg-cta-btn:hover { background: #d97706; }

        /* EMPTY STATE */
        .empty-state {
          display: flex; flex-direction: column;
          padding: 0;
          animation: fadein 0.5s ease;
        }
        .empty-label {
          font-size: 10px; letter-spacing: 4px; text-transform: uppercase;
          color: #374151; padding: 32px 0 20px; display: block;
        }
        .empty-topics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          width: 100%;
          gap: 2px;
          margin-bottom: 2px;
        }
        @media (max-width: 700px) { .empty-topics { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .empty-topics { grid-template-columns: 1fr; } }
        .topic-btn {
          background: #1f2937; border: none; color: #9ca3af;
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(20px, 1.8vw, 28px); letter-spacing: 1.5px;
          padding: 32px 28px; cursor: pointer; text-align: left;
          line-height: 1.25; transition: all 0.15s;
        }
        .topic-btn:hover {
          background: #f59e0b; color: #111827;
        }

        /* BLOG SUGGESTIES NA GESPREK */
        .blog-suggestions {
          padding: 32px 0 48px;
          border-top: 1px solid #374151;
          animation: fadein 0.5s ease;
        }
        .blog-suggestions-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 12px; letter-spacing: 4px; text-transform: uppercase;
          color: #6b7280; display: block; margin-bottom: 20px;
        }
        .blog-suggestion-item {
          display: block; color: #9ca3af; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 1.5px;
          line-height: 1; padding: 14px 20px;
          border-left: 3px solid #374151;
          margin-bottom: 2px;
          transition: all 0.15s;
        }
        .blog-suggestion-item:hover {
          color: #f1f5f9;
          border-left-color: #f59e0b;
          background: #1f2937;
        }

        /* VOORTGANG BAR */
        .voortgang-bar {
          text-align: center; padding: 48px 0 16px;
          color: #f1f5f9; font-family: 'Bebas Neue', sans-serif;
          font-size: 15px; letter-spacing: 3px;
        }
        .archief-btn {
          background: none; border: 1px solid #374151; color: #9ca3af;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 3px;
          padding: 10px 24px; cursor: pointer;
          transition: all 0.2s; text-decoration: none;
          display: inline-block; margin-bottom: 40px;
          border-radius: 999px;
        }
        .archief-btn:hover { background: #f59e0b; border-color: #f59e0b; color: #111827; }
      `}</style>

      {isMobile ? (
        <>
          <nav className="mob-nav">
            <Link href="/" className="mob-nav-logo">ARNO<span>BOT.</span></Link>
            <button className="mob-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
              {menuOpen
                ? <span style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", color: '#f59e0b', lineHeight: 1 }}>✕</span>
                : <><span /><span /><span /></>
              }
            </button>
          </nav>
          {menuOpen && (
            <div className="mob-menu" onClick={() => setMenuOpen(false)}>
              <span className="active">ARNOBOT</span>
              <button style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', borderBottom: '2px solid #f59e0b', cursor: 'pointer', textAlign: 'left', padding: 0, paddingBottom: 2 }} onClick={() => handleNavAttempt('/bot/bieb')}>BIEB</button>
              <button style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', borderBottom: '2px solid #f59e0b', cursor: 'pointer', textAlign: 'left', padding: 0, paddingBottom: 2 }} onClick={() => handleNavAttempt('/bot/coaching')}>COACHING</button>
              {isBouwer && <button style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => handleNavAttempt('/bot/team')}>TEAM</button>}
              <button style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => handleNavAttempt('/bot/qa')}>Q&A</button>
              <button style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => handleNavAttempt('/bot/account')}>ACCOUNT</button>
              <span style={{ color: '#9ca3af', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setMenuOpen(false); setFeedbackOpen(true) }}>FEEDBACK</span>
            </div>
          )}
        </>
      ) : (
        <nav className="site-nav">
          <div className="nav-spacer" />
          <div className="nav-links">
            <span style={{ color: '#f59e0b', fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3 }}>ARNOBOT</span>
            <button onClick={() => handleNavAttempt('/bot/bieb')} style={{ borderBottom: '2px solid #f59e0b', paddingBottom: 2 }}>BIEB</button>
            <button onClick={() => handleNavAttempt('/bot/coaching')} style={{ borderBottom: '2px solid #f59e0b', paddingBottom: 2 }}>COACHING</button>
            {isBouwer && <button onClick={() => handleNavAttempt('/bot/team')}>TEAM</button>}
            <button onClick={() => handleNavAttempt('/bot/qa')}>Q&A</button>
            <button onClick={() => handleNavAttempt('/bot/account')}>ACCOUNT</button>
          </div>
          <div className="nav-spacer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, alignItems: 'center' }}>
            <button
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#f1f5f9' }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#9ca3af' }}
              onClick={() => setFeedbackOpen(true)}
            >FEEDBACK</button>
            <button
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#f1f5f9' }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#9ca3af' }}
              onClick={() => handleNavAttempt('logout')}
            >UITLOGGEN</button>
          </div>
        </nav>
      )}

      <div className="spar-page" style={started ? { paddingBottom: isMobile ? 280 : 240 } : {}}>

        <div className="spar-hero">
          <div className="hero-photo">
            {(() => {
              const idx = Math.floor(Date.now() / (48 * 60 * 60 * 1000)) % 17 + 1
              return <img src={`/header-fotos/foto-${idx}.jpg`} alt="" />
            })()}
          </div>
          <div className="hero-text">
            <h1 className="spar-title">ARNO<span>BOT.</span></h1>
            <p className="hero-subtitle">JOUW 24/7 NO EXCUSES<br />SALES COACH</p>
          </div>
        </div>

        {teamPrompt && !started && (
          <div style={{ background: '#1f2937', borderTop: '1px solid #374151', borderBottom: '1px solid #374151', padding: '16px clamp(20px,5vw,60px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#9ca3af', margin: 0 }}>
              Je coacht een team. Wil je ArnoBot ook voor je hele team inzetten?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { window.location.href = '/bot/team' }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, padding: '10px 24px', background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer' }}
              >TEAM STARTEN</button>
              <button
                onClick={() => {
                  setTeamPrompt(false)
                  fetch('/api/bot/team/dismiss-prompt', { method: 'POST' }).catch(() => {})
                }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, padding: '10px 24px', background: 'none', color: '#6b7280', border: 'none', cursor: 'pointer' }}
              >LATER</button>
            </div>
          </div>
        )}

        {!started && rolCategorie && (
          <div style={{ background: '#111827', padding: 'clamp(24px,4vw,40px) clamp(20px,5vw,60px) 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: sparModus === 'sparren' ? 'clamp(24px,4vw,40px)' : 0 }}>
              <button
                onClick={() => setSparModus('coaching')}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: sparModus === 'coaching' ? '12px 0' : '11px 0', minWidth: 170, borderRadius: 999, background: sparModus === 'coaching' ? '#f59e0b' : 'none', color: sparModus === 'coaching' ? '#111827' : '#9ca3af', border: sparModus === 'coaching' ? 'none' : '1px solid #374151', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}
              >COACHING</button>
              <button
                onClick={() => { setSparModus('sparren'); if (!sparPersona) setSparPersona(PERSONAS[rolCategorie][0].key) }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: sparModus === 'sparren' ? '12px 0' : '11px 0', minWidth: 170, borderRadius: 999, background: sparModus === 'sparren' ? '#f59e0b' : 'none', color: sparModus === 'sparren' ? '#111827' : '#9ca3af', border: sparModus === 'sparren' ? 'none' : '1px solid #374151', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}
              >SPARREN</button>
            </div>

            {sparModus === 'sparren' && (
              <div style={{ width: '100%', maxWidth: 812, display: 'flex', flexDirection: 'column', gap: 40, paddingBottom: 32 }}>
                <div>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>WIE IS JE GESPREKSPARTNER?</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8, marginBottom: PERSONAS[rolCategorie].some(p => p.key === 'anders') ? 8 : 0 }}>
                    {PERSONAS[rolCategorie].filter(p => p.key !== 'anders').map(p => (
                      <button key={p.key} onClick={() => setSparPersona(p.key)} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: sparPersona === p.key ? '12px 8px' : '11px 8px', borderRadius: 999, background: sparPersona === p.key ? '#f59e0b' : 'none', color: sparPersona === p.key ? '#111827' : '#9ca3af', border: sparPersona === p.key ? 'none' : '1px solid #374151', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {PERSONAS[rolCategorie].some(p => p.key === 'anders') && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8 }}>
                      <button onClick={() => setSparPersona('anders')} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: sparPersona === 'anders' ? '12px 8px' : '11px 8px', borderRadius: 999, background: sparPersona === 'anders' ? '#f59e0b' : 'none', color: sparPersona === 'anders' ? '#111827' : '#9ca3af', border: sparPersona === 'anders' ? 'none' : '1px solid #374151', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
                        Anders
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>WEERSTAND</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['licht', 'stevig', 'zwaar'] as const).map(w => (
                      <button key={w} onClick={() => setSparWeerstand(w)} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: isMobile ? 1 : 3, flex: isMobile ? 1 : undefined, width: isMobile ? undefined : 122, padding: sparWeerstand === w ? '12px 0' : '11px 0', borderRadius: 999, background: sparWeerstand === w ? '#f59e0b' : 'none', color: sparWeerstand === w ? '#111827' : '#9ca3af', border: sparWeerstand === w ? 'none' : '1px solid #374151', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
                        {w.charAt(0).toUpperCase() + w.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 16 }}>
                    {sparPersona === 'anders' ? 'SITUATIESCHETS' : 'SITUATIE (OPTIONEEL)'}
                  </p>
                  <textarea
                    value={sparContext}
                    onChange={e => setSparContext(e.target.value)}
                    onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#374151' }}
                    placeholder={sparPersona === 'anders' ? 'Beschrijf wie ArnoBot speelt en de context van het gesprek.' : 'Wat is de context van het gesprek?'}
                    rows={2}
                    className="spar-context-textarea"
                    style={{ width: '100%', background: '#1f2937', border: `1.5px solid ${sparPersona === 'anders' && !sparContext.trim() ? '#f59e0b' : '#374151'}`, color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 400, padding: '12px 16px', resize: 'none', outline: 'none', borderRadius: 4, caretColor: '#f59e0b' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {!blocked && <div className={`spar-input-area${started ? ' active' : ''}`}>
          {!started && !loading && (
            <>
              <span className="spar-input-intro">{sparModus === 'sparren' ? 'begin het gesprek' : 'begin een gesprek'}</span>
              {sparModus === 'coaching' && <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#f1f5f9', display: 'block', textAlign: 'center', width: '100%', maxWidth: 812, marginBottom: 28 }}>hoe concreter jouw info, hoe beter mijn output</span>}
            </>
          )}
          {sparModus === 'coaching' && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, width: '100%', maxWidth: 812 }}>
              {(['kort', 'normaal', 'uitgebreid'] as const).map(optie => (
                <button
                  key={optie}
                  onClick={() => setAntwoordLengte(optie)}
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 13, letterSpacing: 2,
                    padding: '4px 14px', borderRadius: 999,
                    background: antwoordLengte === optie ? '#374151' : 'none',
                    color: antwoordLengte === optie ? '#f1f5f9' : '#4b5563',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {optie.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <div className={`spar-input-row${started ? ' active-glow' : ''}`}>
            <textarea
              ref={inputRef}
              className="spar-textarea"
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = '0px'
                e.target.style.height = e.target.scrollHeight + 'px'
                if (showSluiten) setShowSluiten(false)
                if (inputIsVerfijnd) setInputIsVerfijnd(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ask(input)
                }
              }}
              placeholder={sparModus === 'sparren' ? (started ? "jouw reactie" : "What's up?") : started ? "vervolg het gesprek" : isMobile ? "beschrijf je casus" : "beschrijf je casus of stel je vraag"}
              disabled={loading || blocked}
              rows={1}
            />
            <div className="spar-buttons">
              {speechSupported && (
                <button
                  className={`spar-mic${recording ? ' recording' : ''}`}
                  onClick={toggleRecording}
                  disabled={loading || blocked}
                  title={recording ? 'Stop opname' : 'Spreek je vraag in'}
                >
                  {recording ? '⏹' : '🎤'}
                </button>
              )}
              <button
                className="spar-send"
                onClick={() => ask(input)}
                disabled={loading || blocked || !input.trim() || (sparModus === 'sparren' && sparPersona === 'anders' && !sparContext.trim())}
              >
                {loading ? '...' : 'VRAAG →'}
              </button>
              {started && (
                <button
                  className={`spar-reset${(showSluiten && messages.length <= synthesisMessageCount) || (messages.length >= 2 && !input.trim()) ? ' sluiten' : messages.length >= 2 ? ' accented' : ''}`}
                  onClick={handleNieuw}
                  disabled={synthesisLoading}
                >
                  {synthesisLoading ? '...' : (showSluiten && messages.length <= synthesisMessageCount) ? 'SLUITEN' : 'SLUIT →'}
                </button>
              )}
            </div>
          </div>
          {tier === 'basis' && dagelijksTeller !== null && (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: dagelijksTeller >= 20 ? '#f59e0b' : '#4b5563', letterSpacing: 2, textAlign: 'center', marginTop: 10, width: '100%', maxWidth: 812 }}>
              {dagelijksTeller} / 25 vragen gebruikt vandaag
            </p>
          )}
          {input.trim().length > 5 && !inputIsVerfijnd && (
            <button
              className="verfijn-btn"
              disabled={verfijnen || loading}
              onClick={async () => {
                setVerfijnen(true)
                try {
                  const res = await fetch('/api/bot/verfijn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vraag: input, profiel, context: messages.filter(m => m.role === 'arno').slice(-1)[0]?.content ?? null })
                  })
                  const data = await res.json()
                  if (data.onbegrijpelijk) {
                    setVerfijnFout(true)
                    setTimeout(() => setVerfijnFout(false), 4000)
                  } else if (data.verfijnd) {
                    setVerfijnFout(false)
                    setVerfijndSuggestie(data.verfijnd)
                  }
                } catch {}
                finally { setVerfijnen(false) }
              }}
            >
              {verfijnen ? '...' : '→ verbeter mijn prompt'}
            </button>
          )}
          {verfijnFout && (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc4444', textAlign: 'center', marginTop: 8 }}>
              Dit snap ik niet. Typ een echte vraag en ik maak hem scherper.
            </p>
          )}
          {verfijndSuggestie && (
            <div style={{ width: '100%', maxWidth: 812, background: '#1f2937', border: '1px solid #f59e0b', padding: '16px 20px', marginTop: 8 }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#f59e0b', letterSpacing: 2, marginBottom: 10 }}>VERFIJNDE VERSIE</p>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 16 }}>{verfijndSuggestie}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setInput(verfijndSuggestie); setVerfijndSuggestie(''); setResizeInput(true); setInputIsVerfijnd(true) }}
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 3, padding: '8px 20px', background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer', borderRadius: 999 }}
                >GEBRUIK DIT</button>
                <button
                  onClick={() => setVerfijndSuggestie('')}
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 3, padding: '8px 20px', background: 'none', color: '#6b7280', border: '1px solid #374151', cursor: 'pointer', borderRadius: 999 }}
                >NEGEER</button>
              </div>
            </div>
          )}
        </div>}

        {!started && !loading && sparModus !== 'sparren' && (
          <div className="spar-openers" style={isSalesOnlyProfiel ? { paddingTop: 20 } : undefined}>
            {!isSalesOnlyProfiel && (
              <>
                <span className="spar-discipline-label">of kies een discipline</span>
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className={`toggle-btn${openerModus === 'strategisch' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => setOpenerModus('strategisch')}>STRATEGIE</button>
                      <button className={`toggle-btn${openerModus === 'organisatorisch' ? ' active' : ''}`} style={{ flex: 1 }} onClick={() => setOpenerModus('organisatorisch')}>ORGANISATIE</button>
                    </div>
                    <button className={`toggle-btn${openerModus === 'sales' ? ' active' : ''}`} style={{ width: 'calc(50% - 1px)', alignSelf: 'center' }} onClick={() => setOpenerModus('sales')}>SALES</button>
                  </div>
                ) : (
                  <div className="opener-toggle">
                    <button className={`toggle-btn${openerModus === 'strategisch' ? ' active' : ''}`} onClick={() => setOpenerModus('strategisch')}>STRATEGIE</button>
                    <button className={`toggle-btn${openerModus === 'organisatorisch' ? ' active' : ''}`} onClick={() => setOpenerModus('organisatorisch')}>ORGANISATIE</button>
                    <button className={`toggle-btn${openerModus === 'sales' ? ' active' : ''}`} onClick={() => setOpenerModus('sales')}>SALES</button>
                  </div>
                )}
              </>
            )}
            <span className="spar-questions-label">{isSalesOnlyProfiel ? 'of selecteer een van de onderstaande vragen' : 'en selecteer een van de onderstaande vragen'}</span>
            <span className="spar-questions-sub">als het je bezighoudt, dan hè? waarom zou je er anders antwoord op willen hebben?</span>
            <div className="openers-grid-line" />
            <div className="openers-grid">
              {(openerModus === 'strategisch'
                ? (dynamicOpeners?.strategisch?.length ? dynamicOpeners.strategisch : VRAGEN_STRATEGISCH)
                : openerModus === 'organisatorisch'
                  ? (dynamicOpeners?.organisatorisch?.length ? dynamicOpeners.organisatorisch : VRAGEN_ORGANISATORISCH)
                  : (dynamicOpeners?.operationeel?.length ? dynamicOpeners.operationeel : VRAGEN_OPERATIONEEL)
              ).map((q, i) => (
                <button key={i} className="opener-btn" onClick={() => ask(q)}>{q}</button>
              ))}
            </div>
            {voortgang && (
              <>
                <div className="voortgang-bar">
                  {voortgang.count} {voortgang.count === 1 ? 'GESPREK' : 'GESPREKKEN'}
                  {voortgang.lastDate ? ` · LAATSTE: ${formatLastDate(voortgang.lastDate).toUpperCase()}` : ''}
                </div>
                <Link href="/bot/bieb" className="archief-btn">NAAR ARCHIEF</Link>
              </>
            )}
          </div>
        )}

        <div className="spar-conversation">
          {messages.map((msg, i) => (
            msg.role === 'user' ? (
              <div key={i} ref={i === messages.length - 1 ? lastMessageRef : undefined} className="msg-user" style={isMobile ? { flexDirection: 'column', gap: 4 } : {}}>
                <span className="msg-user-label">JIJ</span>
                <span className="msg-user-text">{msg.content}</span>
              </div>
            ) : (
              <div key={i} ref={(msg.content?.startsWith('**Terugblik') || msg.content?.startsWith('**Debrief')) ? synthesisRef : i === messages.length - 1 ? lastMessageRef : undefined}>
                {msg.content && (
                  <div className="msg-arno" style={isMobile ? { flexDirection: 'column', gap: 4 } : {}}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 48, paddingTop: 2, flexShrink: 0, position: 'relative' }}>
                      <span className="msg-arno-label">
                        {sparModus === 'sparren' && rolCategorie && sparPersona && !msg.content?.startsWith('**Debrief')
                          ? (PERSONAS[rolCategorie].find(p => p.key === sparPersona)?.label ?? 'ARNO').toUpperCase()
                          : 'ARNO'}
                      </span>
                      <button
                        onClick={() => speak(msg.content, i)}
                        title={speakingIdx === i ? 'Stop' : 'Beluister'}
                        disabled={ttsLoading !== null && ttsLoading !== i}
                        style={{ background: 'none', border: 'none', cursor: ttsLoading === i ? 'wait' : 'pointer', color: speakingIdx === i ? '#f59e0b' : ttsLoading === i ? '#f59e0b' : '#6b7280', fontSize: 18, padding: 0, transition: 'color 0.15s', lineHeight: 1 }}
                        onMouseEnter={e => { if (speakingIdx !== i && ttsLoading !== i) (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af' }}
                        onMouseLeave={e => { if (speakingIdx !== i && ttsLoading !== i) (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}
                      >
                        {ttsLoading === i ? '⏳' : speakingIdx === i ? '⏹' : '▶'}
                      </button>
                      <button
                        onClick={() => setTtsSpeedOpenIdx(ttsSpeedOpenIdx === i ? null : i)}
                        title="Snelheid"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: ttsSpeedOpenIdx === i ? '#f59e0b' : '#6b7280', fontSize: 11, padding: 0, lineHeight: 1, fontFamily: "'Space Mono', monospace", transition: 'color 0.15s' }}
                        onMouseEnter={e => { if (ttsSpeedOpenIdx !== i) (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af' }}
                        onMouseLeave={e => { if (ttsSpeedOpenIdx !== i) (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}
                      >⚙</button>
                      {ttsSpeedOpenIdx === i && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#1f2937', border: '1px solid #374151', padding: '6px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                          {[0.75, 1.0, 1.25].map(s => (
                            <button
                              key={s}
                              onClick={() => { setTtsSpeed(s); localStorage.setItem('arnobot_tts_speed', String(s)); setTtsSpeedOpenIdx(null) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', background: ttsSpeed === s ? '#374151' : 'none', border: 'none', cursor: 'pointer', padding: '7px 14px', fontFamily: "'Space Mono', monospace", fontSize: 11, color: ttsSpeed === s ? '#f59e0b' : '#9ca3af', letterSpacing: 1, whiteSpace: 'nowrap' }}
                            >
                              {s === 0.75 ? '0.75× langzamer' : s === 1.0 ? '1.0× normaal' : '1.25× sneller'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="msg-arno-text" dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
                  </div>
                )}
                {msg.hint === 'last_chance' && (
                  <div className="msg-hint">
                    Lekker bezig. Je hebt nog één kans om echt tot de kern te komen.
                  </div>
                )}
                {(msg.hint === 'salescanvas' || msg.hint === 'blocked') && (
                  <div className="msg-cta">
                    <p>{msg.hint === 'blocked' ? 'Toch proberen, hè? 😂' : <>Als je echt de diepte in wilt, doe dan een free trial op <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer" style={{color:'#f59e0b'}}>salescanvas.app</a></>}</p>
                    <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer" className="msg-cta-btn">
                      SALESCANVAS
                    </a>
                  </div>
                )}
              </div>
            )
          ))}
          {showSluiten && sparModus === 'sparren' && !loading && (
            <div ref={debriefVraagRef} style={{ padding: 'clamp(20px,3vw,32px)', borderTop: '1px solid #374151', background: '#111827' }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: debriefAntwoord ? 20 : 16 }}>
                HEB JE NOG EEN VRAAG OVER DE DEBRIEF?
              </p>
              {debriefLoading && (
                <div className="msg-loading" style={{ marginBottom: 16 }}>
                  <div className="loading-dots">
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                  </div>
                  <span className="loading-text">Arno denkt na</span>
                </div>
              )}
              {debriefAntwoord && !debriefLoading && (
                <div style={{ background: '#1f2937', padding: 'clamp(16px,2vw,24px)', marginBottom: 16, borderLeft: '3px solid #f59e0b' }}>
                  <span className="msg-arno-text" dangerouslySetInnerHTML={{ __html: renderContent(debriefAntwoord) }} />
                </div>
              )}
              <div className="spar-input-row" style={{ border: '1.5px solid #374151', background: '#1f2937' }}>
                <textarea
                  value={debriefVraag}
                  onChange={e => setDebriefVraag(e.target.value)}
                  onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                    const t = e.currentTarget
                    t.style.height = '0px'
                    t.style.height = t.scrollHeight + 'px'
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askDebrief() } }}
                  placeholder="Stel een vervolgvraag over de debrief..."
                  rows={1}
                  className="spar-textarea"
                  style={{ background: '#1f2937', border: 'none', color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 400, resize: 'none', outline: 'none', caretColor: '#f59e0b', overflow: 'hidden' }}
                />
                <div className="spar-buttons">
                  {speechSupported && (
                    <button
                      className={`spar-mic${recording ? ' recording' : ''}`}
                      onClick={toggleRecording}
                      disabled={debriefLoading}
                      title={recording ? 'Stop opname' : 'Spreek je vraag in'}
                    >
                      {recording ? '⏹' : '🎤'}
                    </button>
                  )}
                  <button
                    className="spar-send"
                    onClick={askDebrief}
                    disabled={debriefLoading || !debriefVraag.trim()}
                  >
                    {debriefLoading ? '...' : 'VRAAG →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(loading || synthesisLoading) && (
            <div className="msg-loading">
              <div className="loading-dots">
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
              <span className="loading-text">Arno denkt na</span>
            </div>
          )}
          {showSluiten && messages.length <= synthesisMessageCount && suggestedBlogs.length > 0 && (
            <div className="blog-suggestions">
              <span className="blog-suggestions-label">Verder lezen</span>
              {suggestedBlogs.slice(0, 3).map((b, i) => (
                <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className="blog-suggestion-item">
                  {b.title.replace(/\s*\([^)]+\)\s*$/, '')}
                </a>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {navGuardOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid #374151', maxWidth: 440, width: '100%', padding: 40 }}>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 1, color: '#f1f5f9', marginBottom: 12 }}>WACHT EVEN</h2>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 28 }}>Je hebt een gesprek open. Wil je het sluiten voordat je verdergaat?</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setNavGuardOpen(false); handleNieuw() }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 28px', background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer', borderRadius: 999 }}
              >SLUIT GESPREK</button>
              <button
                onClick={() => { setNavGuardOpen(false); setPendingNavDest(null) }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '11px 28px', background: 'none', color: '#6b7280', border: '1px solid #374151', cursor: 'pointer', borderRadius: 999 }}
              >DOORGAAN</button>
            </div>
          </div>
        </div>
      )}

      {feedbackOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            style={{ background: '#1f2937', border: '1px solid #374151', maxWidth: 480, width: '100%', padding: 32 }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 1, color: '#f1f5f9', marginBottom: 20 }}>FEEDBACK</h2>
            {feedbackSent ? (
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#f59e0b', letterSpacing: 1 }}>Bedankt. Je feedback is verzonden.</p>
            ) : (
              <>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Wat kan er beter? Wat werkt goed? Alles is welkom."
                  style={{ width: '100%', minHeight: 120, background: '#111827', border: '1px solid #374151', color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 13, padding: '12px 16px', resize: 'vertical', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={sendFeedback}
                    disabled={feedbackLoading || !feedbackText.trim()}
                    style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 28px', background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer', borderRadius: 999, opacity: feedbackLoading || !feedbackText.trim() ? 0.5 : 1 }}
                  >{feedbackLoading ? '...' : 'VERSTUUR'}</button>
                  <button
                    onClick={() => setFeedbackOpen(false)}
                    style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '11px 28px', background: 'none', color: '#6b7280', border: '1px solid #374151', cursor: 'pointer', borderRadius: 999 }}
                  >ANNULEER</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
