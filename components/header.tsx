import Link from "next/link"
import { Zap } from "lucide-react"
import { WalletButton } from "./wallet-button"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/20 glass-morph scanlines">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative">
            <Zap className="h-8 w-8 text-primary drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]" fill="currentColor" />
            <div className="absolute inset-0 animate-ping">
              <Zap className="h-8 w-8 text-primary/30" fill="currentColor" />
            </div>
          </div>
          <span className="text-2xl font-bold tracking-tight neon-text" style={{ fontFamily: "var(--font-heading)" }}>
            ROBO<span className="text-primary">LAUNCH</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { href: "/", label: "Tokens" },
            { href: "/fair-launch", label: "Fair Launch" },
            { href: "/launch", label: "Launch" },
            { href: "/portfolio", label: "Portfolio" },
            { href: "/leaderboard", label: "Leaderboard" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,255,0.6)] transition-all duration-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <WalletButton />
      </div>
    </header>
  )
}
