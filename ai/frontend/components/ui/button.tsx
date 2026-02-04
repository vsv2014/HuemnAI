import * as React from "react"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link", size?: "default" | "sm" | "lg" | "icon" }
>(({ className, variant = "default", size = "default", ...props }, ref) => {
  let variantClass = "bg-primary text-primary-foreground hover:bg-primary/90"
  if (variant === "destructive") variantClass = "bg-destructive text-destructive-foreground hover:bg-destructive/90"
  if (variant === "outline") variantClass = "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
  if (variant === "secondary") variantClass = "bg-secondary text-secondary-foreground hover:bg-secondary/80"
  if (variant === "ghost") variantClass = "hover:bg-accent hover:text-accent-foreground"
  if (variant === "link") variantClass = "text-primary underline-offset-4 hover:underline"

  let sizeClass = "h-10 px-4 py-2"
  if (size === "sm") sizeClass = "h-9 rounded-md px-3"
  if (size === "lg") sizeClass = "h-11 rounded-md px-8"
  if (size === "icon") sizeClass = "h-10 w-10"

  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${sizeClass} ${className || ""}`}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
