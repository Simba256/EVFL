import { Header } from "@/components/header"
import { TrendingTicker } from "@/components/trending-ticker"
import { OnChainTokenView } from "./on-chain-token-view"

export default async function TokenByAddressPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params

  return (
    <div className="min-h-screen">
      <Header />
      <TrendingTicker />
      <OnChainTokenView tokenAddress={address as `0x${string}`} />
    </div>
  )
}
