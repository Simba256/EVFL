"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Upload, Sparkles, Loader2, CheckCircle, AlertCircle, ExternalLink, X, ImageIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useTokenFactory } from "@/lib/blockchain/hooks"
import { useAccount } from "wagmi"
import { formatEther, parseEther } from "viem"
import { ConnectButton } from "@rainbow-me/rainbowkit"

type TxState = 'idle' | 'uploading' | 'wrapping' | 'approving' | 'creating' | 'saving' | 'success' | 'error';

// Upload image to IPFS
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

// Save token to database
async function saveTokenToDatabase(data: {
  name: string
  symbol: string
  description: string
  image?: string
  tokenAddress: string
  poolAddress: string
  creatorAddress: string
  totalSupply: string
  initialBnbLiquidity: string
  tokenWeight: number
  deployTxHash: string
}): Promise<boolean> {
  try {
    const response = await fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        symbol: data.symbol,
        description: data.description,
        image: data.image || '',
        tokenAddress: data.tokenAddress,
        poolAddress: data.poolAddress,
        creatorAddress: data.creatorAddress,
        totalSupply: parseEther(data.totalSupply).toString(),
        decimals: 18,
        initialBnbLiquidity: data.initialBnbLiquidity,
        tokenWeight: data.tokenWeight,
        deployTxHash: data.deployTxHash,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Failed to save token to database:', errorData)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving token to database:', error)
    return false
  }
}

export function LaunchForm() {
  const [tokenName, setTokenName] = useState("")
  const [tokenSymbol, setTokenSymbol] = useState("")
  const [description, setDescription] = useState("")
  const [supply, setSupply] = useState("1000000")
  const [bnbLiquidity, setBnbLiquidity] = useState("0.1")
  const [tokenWeight, setTokenWeight] = useState("80")

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [imageIpfsUrl, setImageIpfsUrl] = useState<string>("")
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [txState, setTxState] = useState<TxState>('idle')
  const [txHash, setTxHash] = useState<string>("")
  const [tokenAddress, setTokenAddress] = useState<string>("")
  const [poolAddress, setPoolAddress] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [launchFee, setLaunchFee] = useState<string>("0.01")

  const { isConnected, address } = useAccount()
  const { createToken, getLaunchFee, isConfigured } = useTokenFactory()

  // Fetch launch fee on mount
  useEffect(() => {
    const fetchFee = async () => {
      try {
        const fee = await getLaunchFee()
        setLaunchFee(formatEther(fee))
      } catch (e) {
        console.error('Error fetching launch fee:', e)
      }
    }
    if (isConfigured) {
      fetchFee()
    }
  }, [getLaunchFee, isConfigured])

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PNG, JPG, or GIF.')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Maximum size is 2MB.')
      return
    }

    setError('')
    setImageFile(file)
    setImageIpfsUrl('') // Reset IPFS URL when new file selected

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle drag events
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
    if (file) {
      handleFileSelect(file)
    }
  }

  // Remove selected image
  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview('')
    setImageIpfsUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected) {
      setError("Please connect your wallet first")
      return
    }

    if (!isConfigured) {
      setError("Contracts not configured. Please check your environment variables.")
      return
    }

    // Validate inputs
    if (!tokenName || !tokenSymbol || !supply || !bnbLiquidity) {
      setError("Please fill in all required fields")
      return
    }

    const supplyNum = parseFloat(supply)
    const bnbNum = parseFloat(bnbLiquidity)
    const weightNum = parseInt(tokenWeight)

    if (supplyNum < 1000) {
      setError("Minimum supply is 1,000 tokens")
      return
    }

    if (bnbNum < 0.01) {
      setError("Minimum liquidity is 0.01 BNB")
      return
    }

    if (weightNum < 50 || weightNum > 99) {
      setError("Token weight must be between 50% and 99%")
      return
    }

    setError("")

    // Upload image to IPFS if provided
    let finalImageUrl = imageIpfsUrl
    if (imageFile && !imageIpfsUrl) {
      setTxState('uploading')
      try {
        const uploadResult = await uploadImageToIPFS(imageFile)
        finalImageUrl = uploadResult.url
        setImageIpfsUrl(uploadResult.url)
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Failed to upload image'
        setError(errorMessage)
        setTxState('error')
        return
      }
    }

    setTxState('wrapping')

    try {
      const result = await createToken({
        name: tokenName,
        symbol: tokenSymbol.replace('$', ''), // Remove $ if present
        tokenURI: finalImageUrl || `ipfs://placeholder/${tokenSymbol}`,
        initialSupply: supply,
        initialBnbLiquidity: bnbLiquidity,
        tokenWeight: weightNum,
      })

      setTxHash(result.txHash)
      setTokenAddress(result.tokenAddress)
      setPoolAddress(result.poolAddress)

      // Save to database
      setTxState('saving')
      const saved = await saveTokenToDatabase({
        name: tokenName,
        symbol: tokenSymbol.replace('$', ''),
        description: description,
        image: finalImageUrl,
        tokenAddress: result.tokenAddress,
        poolAddress: result.poolAddress,
        creatorAddress: address as string,
        totalSupply: supply,
        initialBnbLiquidity: bnbLiquidity,
        tokenWeight: weightNum,
        deployTxHash: result.txHash,
      })

      if (!saved) {
        console.warn('Token created on-chain but failed to save to database')
      }

      setTxState('success')
    } catch (err) {
      console.error('Error creating token:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create token'
      setError(errorMessage)
      setTxState('error')
    }
  }

  const resetForm = () => {
    setTxState('idle')
    setTxHash("")
    setTokenAddress("")
    setPoolAddress("")
    setError("")
    setTokenName("")
    setTokenSymbol("")
    setDescription("")
    setSupply("1000000")
    setBnbLiquidity("0.1")
    setImageFile(null)
    setImagePreview("")
    setImageIpfsUrl("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Success state
  if (txState === 'success') {
    return (
      <Card className="border-glow-animated glass-morph backdrop-blur p-6 md:p-8 digital-corners">
        <div className="text-center space-y-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Token Launched!</h3>
            <p className="text-muted-foreground">Your token has been created and is now tradeable.</p>
          </div>

          <div className="space-y-3 text-left bg-background/50 rounded-lg p-4">
            <div>
              <Label className="text-muted-foreground text-xs">Token Address</Label>
              <p className="font-mono text-sm break-all">{tokenAddress}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Pool Address</Label>
              <p className="font-mono text-sm break-all">{poolAddress}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Transaction</Label>
              <a
                href={`https://testnet.bscscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
              >
                {txHash.slice(0, 20)}...
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 py-3 border border-primary text-primary font-semibold rounded-lg hover:bg-primary/10 transition-colors"
            >
              Launch Another
            </button>
            <a
              href={`/token/address/${tokenAddress}`}
              className="flex-1 py-3 btn-metallic-primary text-primary-foreground font-semibold rounded-lg text-center"
            >
              View Token
            </a>
          </div>
        </div>
      </Card>
    )
  }

  // Loading states
  const isLoading = txState === 'uploading' || txState === 'wrapping' || txState === 'approving' || txState === 'creating' || txState === 'saving'
  const loadingText = txState === 'uploading' ? 'Uploading Image...' :
                      txState === 'wrapping' ? 'Wrapping BNB...' :
                      txState === 'approving' ? 'Approving WBNB...' :
                      txState === 'creating' ? 'Creating Token...' :
                      txState === 'saving' ? 'Saving to Database...' : ''

  return (
    <Card className="border-glow-animated glass-morph backdrop-blur p-6 md:p-8 digital-corners scanlines">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground font-semibold">
            Token Name *
          </Label>
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
          <Label htmlFor="symbol" className="text-foreground font-semibold">
            Token Symbol *
          </Label>
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

        <div className="space-y-2">
          <Label htmlFor="description" className="text-foreground font-semibold">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Describe your robotics AI project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-background border-border min-h-24"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="supply" className="text-foreground font-semibold">
              Initial Supply *
            </Label>
            <Input
              id="supply"
              type="number"
              placeholder="1000000"
              value={supply}
              onChange={(e) => setSupply(e.target.value)}
              className="bg-background border-border font-mono"
              min="1000"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">Min: 1,000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bnb" className="text-foreground font-semibold">
              Initial BNB Liquidity *
            </Label>
            <Input
              id="bnb"
              type="number"
              step="0.01"
              placeholder="0.1"
              value={bnbLiquidity}
              onChange={(e) => setBnbLiquidity(e.target.value)}
              className="bg-background border-border font-mono"
              min="0.01"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">Min: 0.01 BNB</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight" className="text-foreground font-semibold">
            Token Weight: {tokenWeight}%
          </Label>
          <input
            id="weight"
            type="range"
            min="50"
            max="99"
            value={tokenWeight}
            onChange={(e) => setTokenWeight(e.target.value)}
            className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>50% (Balanced)</span>
            <span>80% (Recommended)</span>
            <span>99% (Max)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Higher weight = less BNB needed for same token price. Pool will be {tokenWeight}/{100 - parseInt(tokenWeight)} Token/BNB.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground font-semibold">Token Image</Label>
          <input
            ref={fileInputRef}
            id="image-upload"
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isLoading}
          />
          {imagePreview ? (
            <div className="relative border-2 border-primary/50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <img
                  src={imagePreview}
                  alt="Token preview"
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{imageFile?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {imageFile && (imageFile.size / 1024).toFixed(1)} KB
                  </p>
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
                  className="p-2 hover:bg-destructive/20 rounded-lg transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <label
              htmlFor={isLoading ? undefined : "image-upload"}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`block border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground">PNG, JPG or GIF (max. 2MB)</p>
            </label>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="rounded-lg glass-morph border border-primary/30 p-4 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Launch Fee: {launchFee} BNB</h4>
              <p className="text-sm text-muted-foreground">
                Fair launch with automatic weighted pool creation. Your token will be immediately tradeable on
                RoboLaunch.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-primary">Total needed:</span> {launchFee} BNB (fee) + {bnbLiquidity} BNB (liquidity) = <strong>{(parseFloat(launchFee) + parseFloat(bnbLiquidity || '0')).toFixed(3)} BNB</strong>
              </p>
            </div>
          </div>
        </div>

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
              'Launch Token'
            )}
          </button>
        )}

        {!isConfigured && isConnected && (
          <p className="text-center text-sm text-yellow-500">
            Contracts not configured. Make sure you&apos;re on BSC Testnet and contracts are deployed.
          </p>
        )}
      </form>
    </Card>
  )
}
