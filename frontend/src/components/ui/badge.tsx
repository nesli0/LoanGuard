import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-[#0A2540] text-white",
        accent:      "border-transparent bg-[#EFF8FF] text-[#2D9CDB] border-[#BFDFEF]",
        success:     "border-transparent bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]",
        warning:     "border-transparent bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]",
        danger:      "border-transparent bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
        outline:     "text-[#0F172A] border-[#E2E8F0]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
