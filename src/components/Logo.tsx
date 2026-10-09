export function Logo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center ${className ?? ""}`}>
      <img
        src="/arrocha-logo.png"
        alt="ArrochaApp"
        className="h-10 w-10 shrink-0 rounded-xl object-cover"
      />
    </span>
  );
}