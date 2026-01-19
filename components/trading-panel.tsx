"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowDownUp, Loader2, AlertCircle, Settings, ChevronDown } from "lucide-react"
import { useWeightedPool } from "@/lib/blockchain/hooks"
import { useAccount } from "wagmi"
import { formatEther, parseEther, formatUnits } from "viem"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { formatSubscriptNumber } from "@/lib/utils/format"

interface TradingPanelProps {
  tokenAddress: `0x${string}`
  poolAddress: `0x${string}`
  tokenSymbol: string
  tokenName: string
}

type TradeMode = 'buy' | 'sell'

export function TradingPanel({ tokenAddress, poolAddress, tokenSymbol, tokenName }: TradingPanelProps) {
  const [mode, setMode] = useState<TradeMode>('buy')
  const [inputAmount, setInputAmount] = useState("")
  const [outputAmount, setOutputAmount] = useState("")
  const [slippage, setSlippage] = useState(1) // 1%
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState("")
  const [txHash, setTxHash] = useState("")
  const [userBnbBalance, setUserBnbBalance] = useState<bigint>(0n)
  const [userTokenBalance, setUserTokenBalance] = useState<bigint>(0n)

  const { isConnected, address } = useAccount()
  const { swap, calcOutGivenIn, getTokenBalance, wbnbAddress, getPoolInfo } = useWeightedPool()

  // Fetch user balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !wbnbAddress) return

      try {
        const [bnbBal, tokenBal] = await Promise.all([
          getTokenBalance(wbnbAddress, address),
          getTokenBalance(tokenAddress, address),
        ])
        setUserBnbBalance(bnbBal)
        setUserTokenBalance(tokenBal)
      } catch (e) {
        console.error('Error fetching balances:', e)
      }
    }

    fetchBalances()
  }, [address, wbnbAddress, tokenAddress, getTokenBalance])

  // Calculate output when input changes
  useEffect(() => {
    const calculateOutput = async () => {
      if (!inputAmount || parseFloat(inputAmount) <= 0 || !poolAddress || !wbnbAddress) {
        setOutputAmount("")
        return
      }

      setIsCalculating(true)
      try {
        const amountInWei = parseEther(inputAmount)
        const tokenIn = mode === 'buy' ? wbnbAddress : tokenAddress
        const tokenOut = mode === 'buy' ? tokenAddress : wbnbAddress

        const amountOut = await calcOutGivenIn(poolAddress, tokenIn, tokenOut, amountInWei)
        setOutputAmount(formatEther(amountOut))
      } catch (e) {
        console.error('Error calculating output:', e)
        setOutputAmount("")
      } finally {
        setIsCalculating(false)
      }
    }

    const debounceTimer = setTimeout(calculateOutput, 300)
    return () => clearTimeout(debounceTimer)
  }, [inputAmount, mode, poolAddress, wbnbAddress, tokenAddress, calcOutGivenIn])

  const handleSwap = async () => {
    if (!isConnected || !inputAmount || !wbnbAddress) {
      setError("Please connect your wallet and enter an amount")
      return
    }

    setError("")
    setIsLoading(true)
    setTxHash("")

    try {
      const tokenIn = mode === 'buy' ? wbnbAddress : tokenAddress
      const tokenOut = mode === 'buy' ? tokenAddress : wbnbAddress

      const result = await swap({
        poolAddress,
        tokenIn,
        tokenOut,
        amountIn: inputAmount,
        slippagePercent: slippage,
      })

      setTxHash(result.txHash)
      setInputAmount("")
      setOutputAmount("")

      // Refresh balances
      const [bnbBal, tokenBal] = await Promise.all([
        getTokenBalance(wbnbAddress, address!),
        getTokenBalance(tokenAddress, address!),
      ])
      setUserBnbBalance(bnbBal)
      setUserTokenBalance(tokenBal)
    } catch (e: any) {
      console.error('Swap error:', e)
      setError(e.message || 'Swap failed')
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'buy' ? 'sell' : 'buy')
    setInputAmount("")
    setOutputAmount("")
  }

  const setMaxInput = () => {
    if (mode === 'buy') {
      // Max BNB (leave some for gas)
      const maxBnb = userBnbBalance > parseEther('0.01')
        ? userBnbBalance - parseEther('0.01')
        : 0n
      setInputAmount(formatEther(maxBnb))
    } else {
      // Max token
      setInputAmount(formatEther(userTokenBalance))
    }
  }

  const inputToken = mode === 'buy' ? 'BNB' : tokenSymbol
  const outputToken = mode === 'buy' ? tokenSymbol : 'BNB'
  const inputBalance = mode === 'buy' ? userBnbBalance : userTokenBalance
  const outputBalance = mode === 'buy' ? userTokenBalance : userBnbBalance

  return (
    <Card className="border-glow-animated glass-morph p-6 scanlines digital-corners">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          Trade {tokenSymbol}
        </h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="mb-4 p-3 bg-background/50 rounded-lg border border-primary/20">
          <Label className="text-sm text-muted-foreground">Slippage Tolerance</Label>
          <div className="flex gap-2 mt-2">
            {[0.5, 1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-3 py-1 text-sm rounded ${
                  slippage === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border hover:border-primary/50'
                }`}
              >
                {s}%
              </button>
            ))}
            <Input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 1)}
              className="w-20 text-center"
              step="0.1"
              min="0.1"
              max="50"
            />
          </div>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex mb-4 bg-background/50 rounded-lg p-1">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${
            mode === 'buy'
              ? 'bg-chart-2 text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${
            mode === 'sell'
              ? 'bg-destructive text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Input */}
      <div className="space-y-4">
        <div className="bg-background/50 rounded-lg p-4 border border-border">
          <div className="flex justify-between mb-2">
            <Label className="text-sm text-muted-foreground">You Pay</Label>
            <button
              onClick={setMaxInput}
              className="text-xs text-primary hover:underline"
            >
              Balance: {parseFloat(formatEther(inputBalance)).toFixed(4)} {inputToken}
            </button>
          </div>
          <div className="flex gap-3">
            <Input
              type="number"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="text-2xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0"
              disabled={isLoading}
            />
            <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-lg border border-border">
              <span className="font-semibold">{inputToken}</span>
            </div>
          </div>
        </div>

        {/* Swap direction button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={switchMode}
            className="p-2 bg-background border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <ArrowDownUp className="h-5 w-5 text-primary" />
          </button>
        </div>

        {/* Output */}
        <div className="bg-background/50 rounded-lg p-4 border border-border">
          <div className="flex justify-between mb-2">
            <Label className="text-sm text-muted-foreground">You Receive</Label>
            <span className="text-xs text-muted-foreground">
              Balance: {parseFloat(formatEther(outputBalance)).toFixed(4)} {outputToken}
            </span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 text-2xl font-bold text-foreground">
              {isCalculating ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : outputAmount ? (
                formatSubscriptNumber(parseFloat(outputAmount))
              ) : (
                <span className="text-muted-foreground">0.0</span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-lg border border-border">
              <span className="font-semibold">{outputToken}</span>
            </div>
          </div>
        </div>

        {/* Price info */}
        {inputAmount && outputAmount && (
          <div className="text-sm text-muted-foreground text-center">
            1 {inputToken} ≈ {formatSubscriptNumber(parseFloat(outputAmount) / parseFloat(inputAmount))} {outputToken}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Success */}
        {txHash && (
          <div className="text-center p-3 bg-chart-2/10 border border-chart-2/30 rounded-lg">
            <p className="text-chart-2 font-semibold mb-1">Swap Successful!</p>
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View transaction →
            </a>
          </div>
        )}

        {/* Action button */}
        {!isConnected ? (
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        ) : (
          <button
            onClick={handleSwap}
            disabled={isLoading || !inputAmount || parseFloat(inputAmount) <= 0}
            className={`w-full py-4 font-bold text-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              mode === 'buy'
                ? 'bg-chart-2 hover:bg-chart-2/90 text-white'
                : 'bg-destructive hover:bg-destructive/90 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Swapping...
              </>
            ) : (
              `${mode === 'buy' ? 'Buy' : 'Sell'} ${tokenSymbol}`
            )}
          </button>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Slippage: {slippage}% • Fee: 0.3%
        </p>
      </div>
    </Card>
  )
}
