"use client"

import { useState, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  X,
  Rocket,
  Users,
  Clock,
  Wallet,
} from "lucide-react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useFairLaunch } from "@/lib/blockchain/hooks/useFairLaunch"
import { isAddress } from "viem"

type TxState = 'idle' | 'uploading' | 'creating' | 'success' | 'error'

async function uploadImageToIPFS(file: File): Promise<{ ipfsHash: string; url: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to upload image')
  }

  return response.json()
}

export function FairLaunchForm() {
  // Form state
  const [tokenName, setTokenName] = useState("")
  const [tokenSymbol, setTokenSymbol] = useState("")
  const [description, setDescription] = useState("")
  const [tokenSupply, setTokenSupply] = useState("10000000") // 10M default
  const [minimumRaise, setMinimumRaise] = useState("1") // 1 BNB default
  const [icoDuration, setIcoDuration] = useState("7") // 7 days default
  const [teamPercent, setTeamPercent] = useState("0")
  const [teamWallet, setTeamWallet] = useState("")
  const [monthlyBudget, setMonthlyBudget] = useState("")
  const [treasuryOwner, setTreasuryOwner] = useState("")
  const [enableLP, setEnableLP] = useState(true)
  const [lpBnbPercent, setLpBnbPercent] = useState("30") // 30% of raised BNB for LP
  const [lpTokensPercent, setLpTokensPercent] = useState("30") // 30% of supply for LP

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [imageIpfsUrl, setImageIpfsUrl] = useState<string>("")
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // TX state
  const [txState, setTxState] = useState<TxState>('idle')
  const [txHash, setTxHash] = useState<string>("")
  const [error, setError] = useState<string>("")

  const { isConnected, address } = useAccount()
  const { createFairLaunch, isConfigured } = useFairLaunch()

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PNG, JPG, or GIF.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Maximum size is 2MB.')
      return
    }

    setError('')
    setImageFile(file)
    setImageIpfsUrl('')

    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview('')
    setImageIpfsUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected) {
      setError("Please connect your wallet")
      return
    }

    if (!isConfigured) {
      setError("Fair Launch contracts not configured")
      return
    }

    // Validate inputs
    if (!tokenName || !tokenSymbol || !tokenSupply || !minimumRaise || !icoDuration) {
      setError("Please fill in all required fields")
      return
    }

    const supplyNum = parseFloat(tokenSupply)
    const raiseNum = parseFloat(minimumRaise)
    const durationNum = parseInt(icoDuration)
    const teamNum = parseInt(teamPercent)

    if (supplyNum < 1000000) {
      setError("Minimum supply is 1,000,000 tokens")
      return
    }

    if (raiseNum < 0.1) {
      setError("Minimum raise is 0.1 BNB")
      return
    }

    if (durationNum < 1 || durationNum > 14) {
      setError("ICO duration must be between 1 and 14 days")
      return
    }

    if (teamNum > 20) {
      setError("Maximum team allocation is 20%")
      return
    }

    if (teamNum > 0 && !teamWallet) {
      setError("Team wallet address is required when team allocation > 0")
      return
    }

    if (teamWallet && !isAddress(teamWallet)) {
      setError("Invalid team wallet address")
      return
    }

    if (treasuryOwner && !isAddress(treasuryOwner)) {
      setError("Invalid treasury owner address")
      return
    }

    setError("")

    // Upload image if provided
    let finalImageUrl = imageIpfsUrl
    if (imageFile && !imageIpfsUrl) {
      setTxState('uploading')
      try {
        const uploadResult = await uploadImageToIPFS(imageFile)
        finalImageUrl = uploadResult.url
        setImageIpfsUrl(uploadResult.url)
      } catch (uploadError: any) {
        setError(uploadError.message || 'Failed to upload image')
        setTxState('error')
        return
      }
    }

    setTxState('creating')

    try {
      const result = await createFairLaunch({
        name: tokenName,
        symbol: tokenSymbol.replace('$', ''),
        imageURI: finalImageUrl || '',
        description,
        tokenSupply,
        minimumRaise,
        icoDurationDays: durationNum,
        teamTokensPercent: teamNum,
        teamWallet: teamNum > 0 ? teamWallet : undefined,
        monthlyBudget: monthlyBudget || undefined,
        treasuryOwner: treasuryOwner || undefined,
        lpBnbPercent: enableLP ? parseInt(lpBnbPercent) : 0,
        lpTokensPercent: enableLP ? parseInt(lpTokensPercent) : 0,
      })

      setTxHash(result.txHash)
      setTxState('success')
    } catch (err: any) {
      console.error('Error creating fair launch:', err)
      setError(err.message || 'Failed to create fair launch')
      setTxState('error')
    }
  }

  const resetForm = () => {
    setTxState('idle')
    setTxHash("")
    setError("")
    setTokenName("")
    setTokenSymbol("")
    setDescription("")
    setTokenSupply("10000000")
    setMinimumRaise("1")
    setIcoDuration("7")
    setTeamPercent("0")
    setTeamWallet("")
    setMonthlyBudget("")
    setTreasuryOwner("")
    setEnableLP(true)
    setLpBnbPercent("30")
    setLpTokensPercent("30")
    handleRemoveImage()
  }

  // Success state
  if (txState === 'success') {
    return (
      <Card className="border-glow-animated glass-morph backdrop-blur p-6 md:p-8 digital-corners">
        <div className="text-center space-y-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Fair Launch Created!</h3>
            <p className="text-muted-foreground">
              Your Fair Launch ICO has been deployed. It will start accepting commitments in 1 hour.
            </p>
          </div>

          <div className="space-y-3 text-left bg-background/50 rounded-lg p-4">
            <div>
              <Label className="text-muted-foreground text-xs">Transaction</Label>
              <a
                href={`https://testnet.bscscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
              >
                {txHash.slice(0, 30)}...
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 py-3 border border-primary text-primary font-semibold rounded-lg hover:bg-primary/10 transition-colors"
            >
              Create Another
            </button>
            <a
              href="/fair-launch"
              className="flex-1 py-3 btn-metallic-primary text-primary-foreground font-semibold rounded-lg text-center"
            >
              View Fair Launches
            </a>
          </div>
        </div>
      </Card>
    )
  }

  const isLoading = txState === 'uploading' || txState === 'creating'
  const loadingText = txState === 'uploading' ? 'Uploading Image...' : 'Creating Fair Launch...'

  return (
    <Card className="border-glow-animated glass-morph backdrop-blur p-6 md:p-8 digital-corners scanlines">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Token Details
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-semibold">Token Name *</Label>
              <Input
                id="name"
                placeholder="e.g., RoboWarrior Protocol"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                className="bg-background border-border"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-foreground font-semibold">Symbol *</Label>
              <Input
                id="symbol"
                placeholder="e.g., ROBWAR"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                className="bg-background border-border font-mono"
                maxLength={10}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground font-semibold">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background border-border min-h-20"
              disabled={isLoading}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-foreground font-semibold">Token Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
              disabled={isLoading}
            />
            {imagePreview ? (
              <div className="relative border-2 border-primary/50 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <img src={imagePreview} alt="Token preview" className="w-16 h-16 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{imageFile?.name}</p>
                    {imageIpfsUrl && (
                      <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-3 w-3" />
                        Uploaded to IPFS
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isLoading}
                    className="p-2 hover:bg-destructive/20 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="image-upload"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isLoading && fileInputRef.current?.click()}
                className={`block border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click or drag to upload (max 2MB)</p>
              </label>
            )}
          </div>
        </div>

        {/* ICO Parameters */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            ICO Parameters
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supply" className="text-foreground font-semibold">Token Supply *</Label>
              <Input
                id="supply"
                type="number"
                placeholder="10000000"
                value={tokenSupply}
                onChange={(e) => setTokenSupply(e.target.value)}
                className="bg-background border-border font-mono"
                min="1000000"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Min: 1M, Max: 1T</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="raise" className="text-foreground font-semibold">Minimum Raise (BNB) *</Label>
              <Input
                id="raise"
                type="number"
                step="0.1"
                placeholder="1"
                value={minimumRaise}
                onChange={(e) => setMinimumRaise(e.target.value)}
                className="bg-background border-border font-mono"
                min="0.1"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Min: 0.1 BNB</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration" className="text-foreground font-semibold">
              ICO Duration: {icoDuration} days
            </Label>
            <input
              id="duration"
              type="range"
              min="1"
              max="14"
              value={icoDuration}
              onChange={(e) => setIcoDuration(e.target.value)}
              className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 day</span>
              <span>7 days</span>
              <span>14 days</span>
            </div>
          </div>
        </div>

        {/* Team Allocation (Optional) */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Team Allocation (Optional)
          </h3>

          <div className="space-y-2">
            <Label htmlFor="team" className="text-foreground font-semibold">
              Team Tokens: {teamPercent}%
            </Label>
            <input
              id="team"
              type="range"
              min="0"
              max="20"
              value={teamPercent}
              onChange={(e) => setTeamPercent(e.target.value)}
              className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% (No team)</span>
              <span>10%</span>
              <span>20% (Max)</span>
            </div>
          </div>

          {parseInt(teamPercent) > 0 && (
            <div className="space-y-2">
              <Label htmlFor="teamWallet" className="text-foreground font-semibold">
                Team Wallet Address *
              </Label>
              <Input
                id="teamWallet"
                placeholder="0x..."
                value={teamWallet}
                onChange={(e) => setTeamWallet(e.target.value)}
                className="bg-background border-border font-mono"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Team tokens will be sent to treasury, controlled by this wallet
              </p>
            </div>
          )}
        </div>

        {/* Treasury (Optional) */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Treasury Settings (Optional)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget" className="text-foreground font-semibold">Monthly Budget (BNB)</Label>
              <Input
                id="budget"
                type="number"
                step="0.1"
                placeholder="0 = No limit"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="bg-background border-border font-mono"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner" className="text-foreground font-semibold">Treasury Owner</Label>
              <Input
                id="owner"
                placeholder="Default: Your wallet"
                value={treasuryOwner}
                onChange={(e) => setTreasuryOwner(e.target.value)}
                className="bg-background border-border font-mono"
                disabled={isLoading}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Treasury owner should be a multisig or timelock for security. You can transfer ownership later.
          </p>
        </div>

        {/* Liquidity Pool Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              Liquidity Pool (Recommended)
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableLP}
                onChange={(e) => setEnableLP(e.target.checked)}
                className="sr-only peer"
                disabled={isLoading}
              />
              <div className="w-11 h-6 bg-background border border-border rounded-full peer peer-checked:bg-primary/20 peer-checked:border-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted-foreground after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-primary"></div>
            </label>
          </div>

          {enableLP && (
            <>
              <p className="text-sm text-muted-foreground">
                Automatically create a PancakeSwap liquidity pool when the ICO finalizes successfully.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lpBnb" className="text-foreground font-semibold">
                    BNB for LP: {lpBnbPercent}%
                  </Label>
                  <input
                    id="lpBnb"
                    type="range"
                    min="10"
                    max="50"
                    value={lpBnbPercent}
                    onChange={(e) => setLpBnbPercent(e.target.value)}
                    className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                    disabled={isLoading}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span>30%</span>
                    <span>50%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lpTokens" className="text-foreground font-semibold">
                    Tokens for LP: {lpTokensPercent}%
                  </Label>
                  <input
                    id="lpTokens"
                    type="range"
                    min="10"
                    max="50"
                    value={lpTokensPercent}
                    onChange={(e) => setLpTokensPercent(e.target.value)}
                    className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                    disabled={isLoading}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span>30%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{lpBnbPercent}%</strong> of raised BNB +{' '}
                  <strong className="text-foreground">{lpTokensPercent}%</strong> of tokens will be added as liquidity.
                  LP tokens will be sent to the treasury.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-lg glass-morph border border-primary/30 p-4 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
          <div className="flex items-start gap-3">
            <Rocket className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Fair Launch ICO</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>ICO starts 1 hour after creation</li>
                <li>Users commit BNB, receive pro-rata token allocation</li>
                <li>If minimum raise is met, ICO succeeds and pool is created</li>
                <li>If minimum not met, all commitments are refundable</li>
                <li>1% platform fee on successful ICOs</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit */}
        {!isConnected ? (
          <div className="w-full flex justify-center">
            <ConnectButton />
          </div>
        ) : (
          <button
            type="submit"
            disabled={isLoading || !isConfigured}
            className="w-full py-4 btn-metallic-primary text-primary-foreground font-bold text-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {loadingText}
              </>
            ) : (
              <>
                <Rocket className="h-5 w-5" />
                Create Fair Launch
              </>
            )}
          </button>
        )}

        {!isConfigured && isConnected && (
          <p className="text-center text-sm text-yellow-500">
            Fair Launch contracts not configured. Make sure you&apos;re on BSC Testnet and contracts are deployed.
          </p>
        )}
      </form>
    </Card>
  )
}
