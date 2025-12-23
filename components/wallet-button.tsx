'use client'

/**
 * Wallet Connection Button
 * Custom styled RainbowKit connect button matching cyberpunk theme
 */

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, ChevronDown } from 'lucide-react'

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Note: If your app doesn't use authentication, you
        // can remove all 'authenticationStatus' checks
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 btn-metallic-primary text-primary-foreground font-bold rounded-lg transition-all hover:shadow-[0_0_20px_rgba(0,255,255,0.4)]"
                  >
                    <Wallet className="h-4 w-4" />
                    <span className="hidden md:inline">Connect Wallet</span>
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground font-bold rounded-lg hover:bg-destructive/90 transition-all"
                  >
                    ⚠️ Wrong Network
                  </button>
                )
              }

              return (
                <div className="flex items-center gap-2">
                  {/* Chain Switcher */}
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="flex items-center gap-1 px-3 py-2 btn-metallic rounded-lg text-sm font-semibold transition-all hover:border-primary"
                    style={{ display: chain.hasIcon ? 'flex' : 'none' }}
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 16, height: 16 }}
                          />
                        )}
                      </div>
                    )}
                    <span className="hidden lg:inline">{chain.name}</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {/* Account Button */}
                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 btn-metallic-primary text-primary-foreground font-bold rounded-lg transition-all hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] font-mono"
                  >
                    <Wallet className="h-4 w-4" />
                    <span className="hidden md:inline">
                      {account.displayName}
                    </span>
                    <span className="md:hidden">
                      {account.displayName.slice(0, 6)}...
                    </span>
                    {account.displayBalance && (
                      <span className="hidden lg:inline text-xs opacity-80">
                        ({account.displayBalance})
                      </span>
                    )}
                  </button>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
