"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Upload, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function LaunchForm() {
  const [tokenName, setTokenName] = useState("")
  const [tokenSymbol, setTokenSymbol] = useState("")
  const [description, setDescription] = useState("")
  const [supply, setSupply] = useState("")

  return (
    <Card className="border-glow-animated glass-morph backdrop-blur p-6 md:p-8 digital-corners scanlines">
      <form className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground font-semibold">
            Token Name
          </Label>
          <Input
            id="name"
            placeholder="e.g., RoboWarrior Protocol"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="symbol" className="text-foreground font-semibold">
            Token Symbol
          </Label>
          <Input
            id="symbol"
            placeholder="e.g., $ROBWAR"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
            className="bg-background border-border font-mono"
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
            className="bg-background border-border min-h-32"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supply" className="text-foreground font-semibold">
            Initial Supply
          </Label>
          <Input
            id="supply"
            type="number"
            placeholder="1000000000"
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            className="bg-background border-border font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground font-semibold">Token Image</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">Click to upload or drag and drop</p>
            <p className="text-xs text-muted-foreground">PNG, JPG or GIF (max. 2MB)</p>
          </div>
        </div>

        <div className="rounded-lg glass-morph border border-primary/30 p-4 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Launch Fee: 0.1 SOL</h4>
              <p className="text-sm text-muted-foreground">
                Fair launch with automatic liquidity pool creation. Your token will be immediately tradeable on
                RoboLaunch.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-4 btn-metallic-primary text-primary-foreground font-bold text-lg rounded-lg"
        >
          Launch Token
        </button>
      </form>
    </Card>
  )
}
