import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

const SelectContext = React.createContext<{
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  value: any
  onValueChange: (value: any) => void
} | null>(null)

const Select = ({ children, value, onValueChange }: { children: React.ReactNode, value?: any, onValueChange?: (value: any) => void }) => {
  const [open, setOpen] = React.useState(false)
  
  return (
    <SelectContext.Provider value={{ open, setOpen, value, onValueChange: onValueChange || (() => {}) }}>
      <div className="relative inline-block w-full text-left">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = ({ className, children, ...props }: any) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("SelectTrigger must be used within Select")
  
  return (
    <button 
      type="button"
      onClick={() => context.setOpen(!context.open)}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`} 
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
}

const SelectValue = ({ placeholder }: any) => {
    const context = React.useContext(SelectContext)
    // Ideally we would map value to label here, but for now we just show placeholder or value
    // Since we don't have access to the children of SelectContent here easily without more complex logic,
    // we'll rely on the user to pass a label or just show the value if it's simple.
    // For this specific use case (TicketConsole), the value is lowercase ("priority"), but we might want to show "Priority".
    // A simple mapping approach or just displaying the value is a start.
    // Given the previous dummy implementation just rendered placeholder, let's try to render value if present.
    
    return <span>{context?.value ? (context.value.charAt(0).toUpperCase() + context.value.slice(1)) : placeholder}</span>
}

const SelectContent = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("SelectContent must be used within Select")

  if (!context.open) return null

  return (
    <div className={`absolute right-0 z-50 mt-2 min-w-[8rem] origin-top-right rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 ${className || ""}`}>
      <div className="p-1">
        {children}
      </div>
    </div>
  )
}

const SelectItem = ({ children, className, value, ...props }: any) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("SelectItem must be used within Select")

  const isSelected = context.value === value

  return (
    <div 
      onClick={() => {
        context.onValueChange(value)
        context.setOpen(false)
      }}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${isSelected ? "bg-accent text-accent-foreground" : ""} ${className || ""}`} 
      {...props}
    >
      <span className="flex-grow">{children}</span>
      {isSelected && <Check className="h-4 w-4 ml-2" />}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
