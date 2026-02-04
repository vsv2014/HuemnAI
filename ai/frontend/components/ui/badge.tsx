import * as React from "react"

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" }
>(({ className, variant = "default", ...props }, ref) => {
  let variantClass = "border-transparent bg-primary text-primary-foreground hover:bg-primary/80"
  if (variant === "secondary") variantClass = "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
  if (variant === "destructive") variantClass = "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80"
  if (variant === "outline") variantClass = "text-foreground"

  return (
    <div
      ref={ref}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantClass} ${className || ""}`}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }
