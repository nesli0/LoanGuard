import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, PlusCircle, Bot, User as UserIcon, Loader2, Trash2, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse } from '@/types'

interface ChatSession {
  id: string
  title: string
  created_at: string
}

interface ChatMessage {
  id: string
  session_id?: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export function ChatPage() {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Sohbet Oturumlarını Getir
  const { data: sessionsRes, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChatSession[]>>('/chat/sessions')
      return res.data.data
    },
  })

  // 2. Seçili Oturumun Mesajlarını Getir
  const { data: historyRes, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['chat-messages', selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return []
      const res = await api.get<ApiResponse<ChatMessage[]>>(`/chat/messages?session_id=${selectedSessionId}`)
      return res.data.data
    },
    enabled: !!selectedSessionId
  })

  // 3. Mesaj Gönder
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post<ApiResponse<ChatMessage>>('/chat/', { 
        message, 
        session_id: selectedSessionId 
      })
      return res.data.data
    },
    onSuccess: (newMsg) => {
      // Eğer yeni bir session oluştuysa (ilk mesajsa)
      if (!selectedSessionId) {
        setSelectedSessionId(newMsg.session_id || null)
        queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
      }
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedSessionId || newMsg.session_id] })
      if (newMsg.session_id) {
        // Oturum başlığı güncellenmiş olabilir
        queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
      }
    }
  })

  // 4. Oturumu Sil
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/chat/sessions/${sessionId}`)
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null)
        setLocalMessages([])
      }
    }
  })

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (historyRes) {
      setLocalMessages(historyRes)
    } else if (!selectedSessionId) {
      setLocalMessages([])
    }
  }, [historyRes, selectedSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages, sendMutation.isPending])

  const handleNewChat = () => {
    setSelectedSessionId(null)
    setLocalMessages([])
    setInput('')
  }

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return
    const text = input.trim()
    setInput('')
    
    // Optimistic update
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    }
    setLocalMessages(prev => [...prev, tempUserMsg])
    
    sendMutation.mutate(text)
  }

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (confirm('Bu sohbeti silmek istediğinize emin misiniz?')) {
      deleteSessionMutation.mutate(sessionId)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  if (isLoadingSessions) return <LoadingSkeleton type="cards" cards={1} />

  const sessions = sessionsRes || []

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] -mt-6 -mx-6 lg:-mx-8 overflow-hidden bg-[#F8FAFC]">
      
      {/* Sol Kolon - Oturum Listesi */}
      <div className="hidden md:flex flex-col w-72 bg-white border-r border-[#E2E8F0] z-10 shadow-sm">
        <div className="p-4 border-b border-[#E2E8F0]">
          <Button 
            onClick={handleNewChat}
            className="w-full justify-start bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] font-medium shadow-none"
          >
            <PlusCircle className="w-4 h-4 mr-2 text-[#2D9CDB]" /> Yeni Sohbet
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-xs text-[#94A3B8] text-center mt-8 px-4">
              Henüz geçmiş sohbetiniz yok. AI ile konuşmaya başlayın!
            </div>
          ) : (
            sessions.map((session) => (
              <div 
                key={session.id} 
                onClick={() => setSelectedSessionId(session.id)}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                  selectedSessionId === session.id 
                    ? 'bg-[#F1F5F9] border-[#E2E8F0] shadow-sm' 
                    : 'border-transparent hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className={`w-4 h-4 shrink-0 ${selectedSessionId === session.id ? 'text-[#0A2540]' : 'text-[#94A3B8]'}`} />
                  <div className="overflow-hidden">
                    <p className={`text-sm truncate ${selectedSessionId === session.id ? 'font-semibold text-[#0F172A]' : 'text-[#64748B]'}`}>
                      {session.title}
                    </p>
                    <span className="text-[10px] text-[#94A3B8] block">
                      {new Date(session.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-all"
                  title="Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sağ Kolon - Chat Alanı */}
      <div className="flex-1 flex flex-col relative bg-white">
        
        {/* Banner */}
        <div className="bg-[#EFF8FF] border-b border-[#BFDFEF] px-6 py-2.5 flex items-center justify-between gap-2 text-xs text-[#1B4F8A] font-medium shadow-sm z-10">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" /> 
            <span>Yanıtlar finansal profilinize göre kişiselleştirilir.</span>
          </div>
          {selectedSessionId && (
            <span className="bg-white/50 px-2 py-0.5 rounded border border-[#BFDFEF]">
              Oturum Aktif
            </span>
          )}
        </div>

        {/* Mesaj Listesi */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth bg-gradient-to-b from-[#F8FAFC] to-white">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-[#2D9CDB] animate-spin" />
            </div>
          ) : localMessages.length === 0 && !sendMutation.isPending ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-[#64748B] animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-[#F1F5F9] rounded-2xl flex items-center justify-center shadow-inner">
                <Bot className="w-10 h-10 text-[#2D9CDB]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] text-xl">Nasıl yardımcı olabilirim?</h3>
                <p className="text-sm max-w-sm mt-2 leading-relaxed text-[#64748B]">
                  Bütçeniz, kredi ihtimaliniz veya yatırımlarınız hakkında bana her şeyi sorabilirsiniz.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-md">
                <button 
                  onClick={() => setInput("Kredi alabilir miyim?")}
                  className="p-3 text-xs text-left bg-white border border-[#E2E8F0] rounded-xl hover:border-[#2D9CDB] hover:shadow-sm transition-all"
                >
                  "Kredi alabilir miyim?"
                </button>
                <button 
                  onClick={() => setInput("Bütçemi nasıl iyileştiririm?")}
                  className="p-3 text-xs text-left bg-white border border-[#E2E8F0] rounded-xl hover:border-[#2D9CDB] hover:shadow-sm transition-all"
                >
                  "Bütçemi nasıl iyileştiririm?"
                </button>
              </div>
            </div>
          ) : (
            localMessages.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <div key={msg.id} className={`flex gap-3 w-full animate-in slide-in-from-bottom-2 duration-300 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-[#0A2540] flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  
                  <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`px-4 py-3 shadow-sm ${
                        isUser 
                          ? 'bg-[#0A2540] text-white rounded-2xl rounded-br-sm' 
                          : 'bg-white border border-[#E2E8F0] text-[#0F172A] rounded-2xl rounded-bl-sm'
                      }`}
                    >
                      <div className={`text-sm leading-relaxed break-words ${isUser ? 'text-white' : 'text-[#0F172A]'}`}>
                        <ReactMarkdown 
                          components={{
                            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] mt-1.5 px-1 font-medium">
                      {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <UserIcon className="w-5 h-5 text-[#64748B]" />
                    </div>
                  )}
                </div>
              )
            })
          )}

          {sendMutation.isPending && (
            <div className="flex gap-3 w-full justify-start animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-full bg-[#0A2540] flex items-center justify-center shrink-0 shadow-sm mt-1">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white border border-[#E2E8F0] px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                <div className="flex items-center gap-1.5 h-5">
                  <div className="w-1.5 h-1.5 bg-[#2D9CDB] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#2D9CDB] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[#2D9CDB] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Alanı */}
        <div className="p-4 bg-white border-t border-[#E2E8F0]">
          <div className="max-w-4xl mx-auto relative flex items-center shadow-sm rounded-lg">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Finansal durumunuzla ilgili bir soru sorun..."
              className="pr-14 h-12 border-[#E2E8F0] rounded-xl bg-[#F8FAFC] focus:bg-white transition-colors"
              disabled={sendMutation.isPending}
            />
            <Button 
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#0A2540] hover:bg-[#1B4F8A] rounded-lg transition-colors"
            >
              {sendMutation.isPending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
            </Button>
          </div>
          <div className="text-center mt-2 text-[10px] text-[#94A3B8]">
            AI hata yapabilir. Önemli finansal kararlar almadan önce verileri doğrulayın.
          </div>
        </div>

      </div>

    </div>
  )
}
