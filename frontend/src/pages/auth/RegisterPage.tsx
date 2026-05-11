import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/

const schema = z.object({
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalıdır.'),
  email: z.string().email('Lütfen geçerli bir e-posta adresi girin.'),
  password: z.string()
    .min(8, 'Parola en az 8 karakter olmalıdır.')
    .regex(passwordRegex, 'Parola en az 1 büyük harf ve 1 rakam içermelidir.'),
  password_confirm: z.string().min(1, 'Lütfen parolanızı tekrar girin.'),
}).refine((data) => data.password === data.password_confirm, {
  message: "Parolalar eşleşmiyor.",
  path: ["password_confirm"],
})

type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    mode: 'onTouched'
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        username: data.username,
        email: data.email,
        password: data.password,
      }
      const res = await api.post('/auth/register', payload)
      return res.data
    },
    onSuccess: () => navigate('/login'),
  })

  const errorMessage = (() => {
    if (!error) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any
    return err?.response?.data?.message ?? 'Kayıt işlemi başarısız. Lütfen bilgilerinizi kontrol edip tekrar deneyin.'
  })()

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Sol panel (Sadece lg ve üzeri ekranlarda görünür) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden" style={{ background: '#0A2540' }}>
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
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-2 tracking-tight">Hesap Oluştur</h1>
            <p className="text-sm text-[#64748B]">Finansal asistanınız LoanGuard'a katılın.</p>
          </div>

          {errorMessage && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-5">
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  placeholder="kullanici_adi"
                  {...register('username')}
                  aria-invalid={!!errors.username}
                  className="h-11"
                />
                {errors.username && <span className="text-xs font-medium text-[#DC2626]">{errors.username.message}</span>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                  className="h-11"
                />
                {errors.email && <span className="text-xs font-medium text-[#DC2626]">{errors.email.message}</span>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Parola</Label>
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
                {errors.password && <span className="text-xs font-medium text-[#DC2626]">{errors.password.message}</span>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password_confirm">Parola Tekrar</Label>
                <div className="relative">
                  <Input
                    id="password_confirm"
                    type={showPasswordConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password_confirm')}
                    aria-invalid={!!errors.password_confirm}
                    className="pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
                  >
                    {showPasswordConfirm ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                {errors.password_confirm && <span className="text-xs font-medium text-[#DC2626]">{errors.password_confirm.message}</span>}
              </div>

              <Button type="submit" className="w-full h-11 text-base mt-2" disabled={isPending}>
                {isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Kayıt Olunuyor...</> : <>Kayıt Ol <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center text-sm text-[#64748B]">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="font-semibold text-[#2D9CDB] hover:text-[#1B84C3] transition-colors">
              Giriş Yap
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
