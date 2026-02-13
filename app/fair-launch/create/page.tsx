import { Header } from "@/components/header"
import { FairLaunchForm } from "@/components/fair-launch-form"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function CreateFairLaunchPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Back Link */}
        <Link
          href="/fair-launch"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Fair Launches
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl md:text-4xl font-black mb-3 neon-text"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Create <span className="text-primary">Fair Launch</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Deploy your token with a fair ICO. No presales, no VCs - just fair pro-rata distribution
            based on BNB commitments.
          </p>
        </div>

        {/* Form */}
        <FairLaunchForm />
      </main>
    </div>
  )
}
