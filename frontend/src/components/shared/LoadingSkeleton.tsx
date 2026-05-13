interface LoadingSkeletonProps {
  rows?: number
  cards?: number
  type?: 'rows' | 'cards' | 'table' | 'form'
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function LoadingSkeleton({ rows = 4, cards = 4, type = 'cards' }: LoadingSkeletonProps) {
  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-lg p-5 flex flex-col gap-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-7 w-32" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'rows') {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-lg p-4 flex items-center gap-4">
            <SkeletonBlock className="h-10 w-10 rounded-full" />
            <div className="flex-1 flex flex-col gap-2">
              <SkeletonBlock className="h-3 w-40" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <SkeletonBlock className="h-5 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SkeletonBlock className="h-4 w-32" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-50 flex gap-4">
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'form') {
    return (
      <div className="flex flex-col gap-5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-10 w-full rounded-md" />
          </div>
        ))}
        <SkeletonBlock className="h-10 w-32 rounded-md" />
      </div>
    )
  }

  return null
}
