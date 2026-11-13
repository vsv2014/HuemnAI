"use client";

import * as React from "react";

type TabContextValue = {
  selected: string;
  select: (value: string) => void;
  id: string;
};

const TabContext = React.createContext<TabContextValue | null>(null);

function useTabs() {
  const context = React.useContext(TabContext);
  if (!context) throw new Error("Tabs components must be inside <Tabs>");
  return context;
}

type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, defaultValue = "", onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const id = React.useId();
    const selected = value === undefined ? internalValue : value;

    const select = React.useCallback(
      (next: string) => {
        if (value === undefined) setInternalValue(next);
        onValueChange?.(next);
      },
      [value, onValueChange]
    );

    return (
      <TabContext.Provider value={{ selected, select, id }}>
        <div ref={ref} {...props} />
      </TabContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className || ""}`}
      {...props}
    />
  )
);
TabsList.displayName = "TabsList";

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string };

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, onKeyDown, ...props }, ref) => {
    const { selected, select, id } = useTabs();
    const active = selected === value;
    const suffix = encodeURIComponent(value);

    function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;

      const list = event.currentTarget.closest('[role="tablist"]');
      const tabs = list
        ? Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'))
        : [];
      const index = tabs.indexOf(event.currentTarget);
      if (index < 0 || tabs.length === 0) return;
      event.preventDefault();

      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    }

    return (
      <button
        type="button"
        ref={ref}
        role="tab"
        id={`${id}-tab-${suffix}`}
        aria-controls={`${id}-panel-${suffix}`}
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        className={`inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${active ? "bg-background text-foreground shadow-sm" : ""} ${className || ""}`}
        onClick={(event) => {
          select(value);
          onClick?.(event);
        }}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  forceMount?: boolean;
};

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, forceMount = false, ...props }, ref) => {
    const { selected, id } = useTabs();
    const active = selected === value;
    if (!active && !forceMount) return null;

    const suffix = encodeURIComponent(value);
    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${id}-panel-${suffix}`}
        aria-labelledby={`${id}-tab-${suffix}`}
        hidden={!active}
        tabIndex={0}
        className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className || ""}`}
        {...props}
      />
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
