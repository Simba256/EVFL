"use client"

import { useState } from "react"
import { Flame, TrendingUp, Award } from "lucide-react"

const TABS = [
  { id: "new", label: "New Launches", icon: Flame },
  { id: "rising", label: "Rising Stars", icon: TrendingUp },
  { id: "graduated", label: "Graduated", icon: Award },
]

export function FilterTabs() {
  const [activeTab, setActiveTab] = useState("new")

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground glow-cyan"
                : "bg-card hover:bg-card/80 text-foreground border border-border"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
