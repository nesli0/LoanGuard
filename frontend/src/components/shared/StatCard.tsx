interface StatCardProps {
  label: string
  value: string | number
  prefix?: string
  suffix?: string
  color?: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  icon?: React.ReactNode
  sublabel?: string
}

const colorMap = {
  default: 'text-[#0F172A]',
  success: 'text-[#059669]',
  warning: 'text-[#D97706]',
  danger: 'text-[#DC2626]',
  accent: 'text-[#2D9CDB]',
}

export function StatCard({ label, value, prefix, suffix, color = 'default', icon, sublabel }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 flex flex-col gap-2 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#64748B] uppercase tracking-wider">{label}</span>
        {icon && <span className="text-[#64748B]">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${colorMap[color]}`}>
        {prefix && <span className="text-lg font-semibold mr-0.5">{prefix}</span>}
        {value}
        {suffix && <span className="text-lg font-semibold ml-0.5">{suffix}</span>}
      </div>
      {sublabel && <span className="text-xs text-[#64748B]">{sublabel}</span>}
    </div>
  )
}
