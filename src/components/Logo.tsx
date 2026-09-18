import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="9" r="3.2" />
          <path d="M3 21c1.6-4 5-6 9-6s7.4 2 9 6" strokeLinecap="round" />
          <path d="M12 2.5v1.6M5.5 5l1.1 1.1M18.5 5l-1.1 1.1" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-lg leading-none font-semibold tracking-tight">
        Arte <span className="text-primary">&</span> Cores
      </span>
    </span>
  );
}
