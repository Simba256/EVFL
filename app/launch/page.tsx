import { Header } from "@/components/header"
import { TrendingTicker } from "@/components/trending-ticker"
import { LaunchForm } from "@/components/launch-form"
import { Rocket } from "lucide-react"

export default function LaunchPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <TrendingTicker />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Rocket className="h-8 w-8 text-primary" />
              <h1
                className="text-4xl md:text-5xl font-black text-balance"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                LAUNCH YOUR <span className="text-primary">ROBOT</span>
              </h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Deploy your robotics AI token to the launchpad. Set your parameters, define your vision, and let the
              machines decide.
            </p>
          </div>

          <LaunchForm />
        </div>
      </main>
    </div>
  )
}
