import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, PlusCircle, Bot, User as UserIcon, Loader2 } from 'lucide-react'

import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse } from '@/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export function ChatPage() {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: historyRes, isLoading } = useQuery({
    queryKey: ['chat-history'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChatMessage[]>>('/chat/')
      return res.data.data
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post<ApiResponse<ChatMessage>>('/chat/', { message })
      return res.data.data
    },
    // Optimistic UI update could be added here, but to keep it simple and reliable we invalidate or append
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-history'] })
    }
  })

  // Local messages state to handle optimistic display of the user's message while waiting for AI
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (historyRes) {
      setLocalMessages(historyRes)
    }
  }, [historyRes])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages, sendMutation.isPending])

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return
    const text = input.trim()
    setInput('')
    
    // Optimistic update for user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    }
    setLocalMessages(prev => [...prev, tempUserMsg])
    
    sendMutation.mutate(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  if (isLoading) return <LoadingSkeleton type="cards" cards={1} />

  // Left column history items (grouping by sessions is ideal, but let's just list recent user messages)
  const userMessages = localMessages.filter(m => m.role === 'user').reverse()

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] -mt-6 -mx-6 lg:-mx-8 overflow-hidden bg-[#F8FAFC]">
      
      {/* Sol Kolon - Geçmiş */}
      <div className="hidden md:flex flex-col w-72 bg-white border-r border-[#E2E8F0] z-10 shadow-sm">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="font-semibold text-[#0F172A]">Sohbet Geçmişi</h2>
          <button className="text-[#2D9CDB] hover:text-[#1B84C3] transition-colors" title="Yeni Sohbet">
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {userMessages.length === 0 ? (
            <div className="text-sm text-[#64748B] text-center mt-4">Henüz sohbet yok.</div>
          ) : (
            userMessages.slice(0, 10).map((msg) => (
              <div key={msg.id} className="p-3 rounded-lg hover:bg-[#F1F5F9] cursor-pointer transition-colors border border-transparent hover:border-[#E2E8F0]">
                <p className="text-sm text-[#0F172A] truncate">{msg.content}</p>
                <span className="text-[10px] text-[#64748B] mt-1 block">
                  {new Date(msg.created_at).toLocaleDateString('tr-TR')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sağ Kolon - Chat */}
      <div className="flex-1 flex flex-col relative bg-white">
        
        {/* Banner */}
        <div className="bg-[#EFF8FF] border-b border-[#BFDFEF] px-6 py-3 flex items-center justify-center gap-2 text-sm text-[#1B4F8A] font-medium shadow-sm z-10">
          <Bot className="w-4 h-4" /> Yanıtlar finansal profilinize göre kişiselleştirilir.
        </div>

        {/* Mesaj Listesi */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth bg-gradient-to-b from-[#F8FAFC] to-white">
          {localMessages.length === 0 && !sendMutation.isPending && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-[#64748B] animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center">
                <Bot className="w-8 h-8 text-[#2D9CDB]" />
              </div>
              <div>
                <h3 className="font-medium text-[#0F172A] text-lg">AI Finansal Asistan</h3>
                <p className="text-sm max-w-sm mt-1">Bütçeniz, kredi ihtimaliniz veya yatırımlarınız hakkında bana her şeyi sorabilirsiniz.</p>
              </div>
            </div>
          )}

          {localMessages.map((msg) => {
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
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
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
          })}

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
              className="pr-14 h-12 border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:bg-white transition-colors"
              disabled={sendMutation.isPending}
            />
            <Button 
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#0A2540] hover:bg-[#1B4F8A] rounded-md transition-colors"
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
