import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'

import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse } from '@/types'

const profileSchema = z.object({
  first_name: z.string().min(2, 'Ad en az 2 karakter olmalıdır'),
  last_name: z.string().min(2, 'Soyad en az 2 karakter olmalıdır'),
  age: z.coerce.number().min(18, 'En az 18 yaşında olmalısınız').max(100, 'Geçerli bir yaş girin'),
  city: z.string().min(2, 'Geçerli bir şehir girin'),
  
  employment_type: z.string().min(1, 'Çalışma durumu seçin'),
  education: z.string().min(1, 'Eğitim durumu seçin'),
  dependents: z.coerce.number().min(0).max(10, 'En fazla 10 olabilir'),
  marital_status: z.string().min(1, 'Medeni durum seçin'),
})

type ProfileFormData = z.infer<typeof profileSchema>

const STEPS = [
  { id: 1, title: 'Kişisel Bilgiler' },
  { id: 2, title: 'İş Bilgileri' },
  { id: 3, title: 'Özet' },
]

export function ProfilePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const isOnboarding = location.state?.requiresProfile

  const { data: profileRes, isLoading: isFetching } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any>>('/profile')
      return res.data.data
    },
  })

  const {
    register,
    control,
    handleSubmit,
    trigger,
    reset,
    getValues,
    formState: { errors }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as any,
    mode: 'onTouched'
  })

  useEffect(() => {
    if (profileRes) {
      reset({
        first_name: profileRes.first_name || '',
        last_name: profileRes.last_name || '',
        age: profileRes.age || 18,
        city: profileRes.city || '',
        employment_type: profileRes.employment_type || '',
        education: profileRes.education || '',
        dependents: profileRes.dependents ?? 0,
        marital_status: profileRes.marital_status || '',
      })
      if (profileRes.first_name && !isOnboarding) {
        setIsEditing(false)
      } else {
        setIsEditing(true)
      }
    }
  }, [profileRes, reset, isOnboarding])

  const mutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const res = await api.put('/profile', data)
      return res.data
    },
    onSuccess: (responseData) => {
      const newProfile = responseData.data;
      // Synchronously update cache to prevent AppLayout from redirecting back to /profile
      queryClient.setQueryData(['profile'], newProfile)
      queryClient.setQueryData(['profile-check'], newProfile)
      
      if (isOnboarding) {
        setShowSuccess(true)
        setTimeout(() => {
          navigate('/dashboard')
        }, 1500)
      } else {
        setShowSuccess(true)
        setIsEditing(false)
        setCurrentStep(1)
        setTimeout(() => setShowSuccess(false), 5000) // 5 saniye sonra gizle
      }
    }
  })

  const handleNext = async () => {
    let fieldsToValidate: (keyof ProfileFormData)[] = []
    
    if (currentStep === 1) fieldsToValidate = ['first_name', 'last_name', 'age', 'city']
    if (currentStep === 2) fieldsToValidate = ['employment_type', 'education', 'dependents', 'marital_status']
    
    const isValid = await trigger(fieldsToValidate)
    if (isValid) {
      setCurrentStep(s => Math.min(s + 1, 3))
    }
  }

  const handlePrev = () => {
    setCurrentStep(s => Math.max(s - 1, 1))
  }

  const onSubmit = (data: ProfileFormData) => {
    if (currentStep < 3) {
      handleNext()
      return
    }
    mutation.mutate(data)
  }

  if (isFetching) return <LoadingSkeleton type="form" rows={6} />

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100
  const values = getValues()

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        {isOnboarding && (
          <Alert variant="warning" className="mb-6 bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]">
            <AlertDescription className="font-medium">Sistemi kullanmaya başlamak için lütfen profilinizi tamamlayın.</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-[#0F172A]">Profil Ayarları</h1>
          {!isEditing && profileRes?.first_name && (
            <Button type="button" onClick={() => { setIsEditing(true); setShowSuccess(false); }} variant="outline" className="border-[#0A2540] text-[#0A2540]">
              Profili Düzenle
            </Button>
          )}
        </div>
        
        {showSuccess && (
          <Alert variant="success" className="mb-6 bg-[#ECFDF5] border-[#A7F3D0] text-[#059669] animate-in fade-in">
            <AlertDescription className="font-medium">Profiliniz başarıyla güncellendi!</AlertDescription>
          </Alert>
        )}

        {mutation.isError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>Profil güncellenirken bir hata oluştu.</AlertDescription>
          </Alert>
        )}
        
        {!isEditing && profileRes?.first_name ? (
          <div className="bg-[#F8FAFC] rounded-lg p-6 border border-[#E2E8F0] space-y-4 animate-in fade-in">
            <h3 className="font-semibold text-[#0F172A] border-b pb-3 mb-4">Mevcut Profil Bilgileriniz</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div><span className="text-[#64748B] block mb-1">Ad Soyad</span><span className="font-medium text-[#0F172A] text-base">{profileRes.first_name} {profileRes.last_name}</span></div>
              <div><span className="text-[#64748B] block mb-1">Yaş / Şehir</span><span className="font-medium text-[#0F172A] text-base">{profileRes.age} / {profileRes.city}</span></div>
              <div><span className="text-[#64748B] block mb-1">Çalışma Durumu</span><span className="font-medium text-[#0F172A] text-base">{profileRes.employment_type}</span></div>
              <div><span className="text-[#64748B] block mb-1">Eğitim</span><span className="font-medium text-[#0F172A] text-base">{profileRes.education}</span></div>
              <div><span className="text-[#64748B] block mb-1">Medeni Durum</span><span className="font-medium text-[#0F172A] text-base">{profileRes.marital_status}</span></div>
              <div><span className="text-[#64748B] block mb-1">Bağımlı Kişi</span><span className="font-medium text-[#0F172A] text-base">{profileRes.dependents}</span></div>
            </div>
          </div>
        ) : (
          <>
            {/* Stepper Header */}
            <div className="mb-8">
          <div className="flex items-center justify-between relative z-10 px-2">
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id
              const isActive = currentStep === step.id
              
              return (
                <div key={step.id} className="flex flex-col items-center gap-2 bg-white relative z-10">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-colors duration-300
                      ${isCompleted ? 'bg-[#0A2540] text-white' : 
                        isActive ? 'border-2 border-[#0A2540] text-[#0A2540]' : 
                        'bg-[#F1F5F9] text-[#94A3B8]'}`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${isActive || isCompleted ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                    {step.title}
                  </span>
                </div>
              )
            })}
            
            {/* Arka plan çizgisi */}
            <div className="absolute top-4 left-0 w-full h-[2px] bg-[#F1F5F9] -z-10" />
            <div 
              className="absolute top-4 left-0 h-[2px] bg-[#0A2540] -z-10 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>



        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Adım 1: Kişisel Bilgiler */}
          <div className={currentStep === 1 ? 'block animate-in slide-in-from-right-4' : 'hidden'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">Ad</Label>
                <Input id="first_name" {...register('first_name')} />
                {errors.first_name && <span className="text-xs text-[#DC2626]">{errors.first_name.message}</span>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Soyad</Label>
                <Input id="last_name" {...register('last_name')} />
                {errors.last_name && <span className="text-xs text-[#DC2626]">{errors.last_name.message}</span>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age">Yaş</Label>
                <Input id="age" type="number" {...register('age')} min="18" max="100" />
                {errors.age && <span className="text-xs text-[#DC2626]">{errors.age.message}</span>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Şehir</Label>
                <Input id="city" {...register('city')} />
                {errors.city && <span className="text-xs text-[#DC2626]">{errors.city.message}</span>}
              </div>
            </div>
          </div>

          {/* Adım 2: İş Bilgileri */}
          <div className={currentStep === 2 ? 'block animate-in slide-in-from-right-4' : 'hidden'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label>Çalışma Durumu</Label>
                <Controller
                  name="employment_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Maaşlı">Maaşlı</SelectItem>
                        <SelectItem value="Serbest">Serbest</SelectItem>
                        <SelectItem value="İşveren">İşveren</SelectItem>
                        <SelectItem value="İşsiz">İşsiz</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.employment_type && <span className="text-xs text-[#DC2626]">{errors.employment_type.message}</span>}
              </div>

              <div className="space-y-1.5">
                <Label>Eğitim Durumu</Label>
                <Controller
                  name="education"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="İlköğretim">İlköğretim</SelectItem>
                        <SelectItem value="Lise">Lise</SelectItem>
                        <SelectItem value="Önlisans">Önlisans</SelectItem>
                        <SelectItem value="Lisans">Lisans</SelectItem>
                        <SelectItem value="Yüksek Lisans">Yüksek Lisans</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.education && <span className="text-xs text-[#DC2626]">{errors.education.message}</span>}
              </div>

              <div className="space-y-1.5">
                <Label>Medeni Durum</Label>
                <Controller
                  name="marital_status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bekar">Bekar</SelectItem>
                        <SelectItem value="Evli">Evli</SelectItem>
                        <SelectItem value="Boşanmış">Boşanmış</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.marital_status && <span className="text-xs text-[#DC2626]">{errors.marital_status.message}</span>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dependents">Bakmakla Yükümlü Olunan Kişi Sayısı</Label>
                <Input id="dependents" type="number" {...register('dependents')} min="0" max="10" />
                {errors.dependents && <span className="text-xs text-[#DC2626]">{errors.dependents.message}</span>}
              </div>
            </div>
          </div>

          {/* Adım 3: Özet */}
          <div className={currentStep === 3 ? 'block animate-in slide-in-from-right-4' : 'hidden'}>
            <div className="bg-[#F8FAFC] rounded-lg p-5 border border-[#E2E8F0] space-y-4">
              <h3 className="font-semibold text-[#0F172A] border-b pb-2">Girdiğiniz Bilgilerin Özeti</h3>
              
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-[#64748B]">Ad Soyad:</div>
                <div className="font-medium text-[#0F172A]">{values.first_name} {values.last_name}</div>
                
                <div className="text-[#64748B]">Yaş / Şehir:</div>
                <div className="font-medium text-[#0F172A]">{values.age} / {values.city}</div>
                
                <div className="text-[#64748B]">Çalışma Durumu:</div>
                <div className="font-medium text-[#0F172A]">{values.employment_type}</div>
                
                <div className="text-[#64748B]">Eğitim:</div>
                <div className="font-medium text-[#0F172A]">{values.education}</div>
                
                <div className="text-[#64748B]">Medeni Durum:</div>
                <div className="font-medium text-[#0F172A]">{values.marital_status} ({values.dependents} Bağımlı)</div>
              </div>
            </div>
          </div>

          {/* Navigation Butonları */}
          <div className="flex justify-between pt-6 border-t border-gray-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handlePrev} 
              disabled={currentStep === 1 || mutation.isPending}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Geri
            </Button>
            
            {currentStep < 3 ? (
              <Button 
                key="next-btn"
                type="button" 
                onClick={handleNext}
                className="bg-[#0A2540] hover:bg-[#1B4F8A]"
              >
                İleri <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                key="save-btn"
                type="submit" 
                className="bg-[#2D9CDB] hover:bg-[#1B84C3]" 
                disabled={mutation.isPending}
              >
                {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Kaydediliyor...</> : 'Kaydet'}
              </Button>
            )}
          </div>

        </form>
        </>
        )}
      </div>
    </div>
  )
}
