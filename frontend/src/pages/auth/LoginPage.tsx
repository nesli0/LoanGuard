import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import api from '@/api/axios'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ApiResponse, User } from '@/types'

const schema = z.object({
  username_or_email: z.string().min(1, 'Kullanıcı adı veya e-posta alanı zorunludur.'),
  password: z.string().min(1, 'Lütfen parolanızı girin.'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post<ApiResponse<{ access_token: string }>>('/auth/login', data)
      return res.data.data
    },
    onSuccess: async (tokenData) => {
      // Token'ı aldıktan sonra kullanıcı bilgilerini çek
      const meRes = await api.get<ApiResponse<User>>('/auth/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      setAuth(tokenData.access_token, meRes.data.data)
      navigate('/dashboard')
    },
  })

  const errorMessage = (() => {
    if (!error) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any
    return err?.response?.data?.message ?? 'Giriş işlemi başarısız. Lütfen bilgilerinizi kontrol edip tekrar deneyin.'
  })()

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Sol panel (Sadece lg ve üzeri ekranlarda görünür) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden" style={{ background: '#0A2540' }}>
        {/* Dekoratif arkaplan efekti */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#1B4F8A] rounded-full blur-[120px] opacity-20 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: '#2D9CDB' }}>
            <ShieldCheck className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Loan</span>
            <span style={{ color: '#2D9CDB' }}>Guard</span>
          </span>
        </div>
        
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-[1.15] mb-6 tracking-tight">
            Finansal geleceğinizi <br /> güvenle inşa edin.
          </h2>
          <div className="flex flex-col gap-5 mt-10">
            {[
              { title: 'Kredi Analizi', desc: 'Yapay zeka ile onay ihtimalinizi hesaplayın.' },
              { title: 'Bütçe Takibi', desc: 'Gelir ve giderlerinizi tek noktadan yönetin.' },
              { title: 'Finansal Hedefler', desc: 'Hayallerinize ulaşmak için plan yapın.' },
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="mt-1">
                  <CheckCircle2 className="w-5 h-5" style={{ color: '#2D9CDB' }} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-white/60 mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="relative z-10 text-sm text-white/40">
          &copy; {new Date().getFullYear()} LoanGuard. Tüm hakları saklıdır.
        </div>
      </div>

      {/* Sağ panel (Form alanı) */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          {/* Mobil Logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm" style={{ background: '#0A2540' }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#0A2540]">Loan</span>
              <span style={{ color: '#2D9CDB' }}>Guard</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-2 tracking-tight">Hoş Geldiniz</h1>
            <p className="text-sm text-[#64748B]">Devam etmek için hesabınıza giriş yapın.</p>
          </div>

          {errorMessage && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username_or_email">Kullanıcı Adı veya E-posta</Label>
              <Input
                id="username_or_email"
                placeholder="ornek@email.com"
                {...register('username_or_email')}
                aria-invalid={!!errors.username_or_email}
                className="h-11"
              />
              {errors.username_or_email && (
                <span className="text-xs font-medium text-[#DC2626]">{errors.username_or_email.message}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Parola</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  className="pr-10 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs font-medium text-[#DC2626]">{errors.password.message}</span>
              )}
            </div>

            <Button type="submit" className="w-full h-11 text-base mt-2" disabled={isPending}>
              {isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Giriş Yapılıyor...</> : 'Giriş Yap'}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-[#64748B]">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="font-semibold text-[#2D9CDB] hover:text-[#1B84C3] transition-colors">
              Kayıt Ol
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
