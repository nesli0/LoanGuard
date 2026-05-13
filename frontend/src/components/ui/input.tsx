import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-1 text-sm text-[#0F172A] shadow-sm transition-colors",
          "placeholder:text-[#94A3B8]",
          "focus:outline-none focus:ring-2 focus:ring-[#2D9CDB] focus:ring-offset-1 focus:border-[#2D9CDB]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
