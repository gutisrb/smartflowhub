import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  MessageSquare, 
  Search, 
  Sparkles, 
  BookOpen, 
  Type, 
  Send, 
  Copy, 
  Check, 
  Settings, 
  Database,
  Terminal,
  Zap,
  User,
  ShieldCheck
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function ChatterAssistantModule({ clientId }: { clientId: string }) {
  const [customerMessage, setCustomerMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [obsidianStatus, setObsidianStatus] = useState<'connected' | 'disconnected' | 'configuring'>('disconnected')
  const [activeTab, setActiveTab] = useState<'chat' | 'library' | 'theory'>('chat')
  const [searchQuery, setSearchQuery] = useState("")
  
  // Mock scripts for demonstration until Obsidian is connected
  const mockScripts = [
    { title: "Initial Greet", content: "Hey baby, so glad you messaged me back... I was just thinking about you." },
    { title: "The Hook", content: "I've been feeling a bit naughty today, want to see what I'm wearing?" },
    { title: "Price Objection", content: "I know it seems like a lot, but I put so much work into this one just for you." }
  ]

  const handleGenerate = async () => {
    if (!customerMessage) return
    setIsGenerating(true)
    setSuggestion(null)
    
    try {
      const res = await fetch('/api/chatter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: customerMessage, clientId })
      })
      
      const data = await res.json()
      if (data.suggestion) {
        setSuggestion(data.suggestion)
        setObsidianStatus('connected')
      } else {
        throw new Error(data.error || 'Failed to generate response')
      }
    } catch (err) {
      console.error(err)
      setObsidianStatus('disconnected')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col h-full gap-6 p-1">
      {/* Top Navigation / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center gap-4 group hover:border-emerald/30 transition-all duration-500">
          <div className="w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Earnings Potential</p>
            <p className="text-xl font-outfit text-silver">High +24%</p>
          </div>
        </div>
        
        <div className="glass-card p-4 rounded-2xl border border-white/5 flex items-center gap-4 group hover:border-blue-500/30 transition-all duration-500">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Obsidian Nodes</p>
            <p className="text-xl font-outfit text-silver">142 loaded</p>
          </div>
        </div>

        <div className="md:col-span-2 glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-purple-500/30 transition-all duration-500 px-8">
           <div className="flex items-center gap-4">
            <div className={cn(
              "w-3 h-3 rounded-full animate-pulse",
              obsidianStatus === 'connected' ? "bg-emerald" : "bg-zinc-600"
            )} />
            <p className="text-sm font-outfit text-silver tracking-tight">
              {obsidianStatus === 'connected' ? "Vault Synchronized" : "Obsidian Node Offline"}
            </p>
           </div>
           <Button size="sm" variant="ghost" className="rounded-xl border border-white/10 hover:bg-white/5 h-8">
             <Settings className="w-4 h-4 mr-2" />
             Configure
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Panel: Chat & Assistant */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-card rounded-[2rem] border border-white/5 flex flex-col overflow-hidden bg-white/[0.01]">
            <div className="h-14 border-b border-white/5 flex items-center px-6 gap-6">
              <button 
                onClick={() => setActiveTab('chat')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-all relative h-full",
                  activeTab === 'chat' ? "text-emerald" : "text-zinc-500 hover:text-silver"
                )}
              >
                Intelligent Assistant
                {activeTab === 'chat' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald" />}
              </button>
              <button 
                onClick={() => setActiveTab('library')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-all relative h-full",
                  activeTab === 'library' ? "text-emerald" : "text-zinc-500 hover:text-silver"
                )}
              >
                Script Library
                {activeTab === 'library' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald" />}
              </button>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
              {activeTab === 'chat' ? (
                <>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black ml-1">Paste Customer Message</label>
                    <div className="relative group">
                      <textarea 
                        value={customerMessage}
                        onChange={(e) => setCustomerMessage(e.target.value)}
                        placeholder="What did the fan say? Paste it here..."
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-silver focus:outline-none focus:border-emerald/50 transition-all placeholder:text-zinc-700 resize-none font-sans text-sm leading-relaxed"
                      />
                      <div className="absolute bottom-4 right-4 flex items-center gap-2">
                        <Button 
                          onClick={handleGenerate}
                          disabled={!customerMessage || isGenerating}
                          className="bg-emerald text-obsidian hover:bg-emerald/90 rounded-xl px-6 h-10 font-bold transition-all disabled:opacity-50 group shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                          {isGenerating ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-obsidian/30 border-t-obsidian rounded-full animate-spin" />
                              <span className="text-xs uppercase tracking-tighter">Consulting KB...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              <span className="text-xs uppercase tracking-tighter">Generate Response</span>
                            </div>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {suggestion && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-emerald font-black flex items-center gap-2">
                            <ShieldCheck className="w-3 h-3" />
                            Optimized AI Response
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-zinc-600 font-bold">TONE: PLAYFUL • SCRIPT: ENTICING</span>
                          </div>
                        </div>
                        <div className="relative group">
                          <div className="w-full bg-emerald/5 border border-emerald/20 rounded-2xl p-6 text-silver font-sans text-lg italic leading-relaxed shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
                            "{suggestion}"
                          </div>
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              onClick={handleCopy}
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-emerald"
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="space-y-6">
                   <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text"
                      placeholder="Search your Obsidian scripts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-silver focus:outline-none focus:border-emerald/50 transition-all font-light"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mockScripts.map((script, i) => (
                      <div key={i} className="glass-card p-4 rounded-xl border border-white/5 hover:border-emerald/30 transition-all group cursor-pointer bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-silver group-hover:text-emerald transition-colors">{script.title}</h4>
                          <BookOpen className="w-3 h-3 text-zinc-600" />
                        </div>
                        <p className="text-xs text-zinc-500 line-clamp-2 italic">"{script.content}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Context & Theory */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-[2rem] border border-white/5 flex flex-col flex-1 overflow-hidden bg-white/[0.01]">
            <div className="h-14 border-b border-white/5 flex items-center px-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Retrieval Context</span>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-3 h-3" /> Active Theory
                </h3>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <p className="text-[11px] text-silver leading-relaxed font-light">
                    Currently utilizing <span className="text-emerald font-bold">The GFE Loop v2.1</span>. Focused on emotional connection before upselling content nodes.
                  </p>
                  <div className="h-px bg-white/5" />
                  <p className="text-[11px] text-silver leading-relaxed font-light">
                    Target User Segment: <span className="text-blue-400 font-bold">High Spender / Lapsed</span>
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <User className="w-3 h-3" /> Related Obsidian Notes
                </h3>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-400 hover:text-silver hover:bg-emerald/5 transition-all cursor-pointer">
                    Chatting_Frameworks/GFE_Strategy.md
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-400 hover:text-silver hover:bg-emerald/5 transition-all cursor-pointer">
                    Scripts/Casual_Hooks.md
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-400 hover:text-silver hover:bg-emerald/5 transition-all cursor-pointer">
                    Psychology/Urgency_Triggers.md
                  </div>
                </div>
              </section>
              
              <div className="mt-auto p-4 rounded-2xl bg-emerald/5 border border-emerald/10">
                <p className="text-[10px] text-emerald font-black uppercase tracking-widest mb-1 italic">Pro Tip</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Mentioning their name twice in the first three sentences increases tipping probability by 14% based on your historical data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
