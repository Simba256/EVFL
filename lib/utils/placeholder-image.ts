const ROBOTICS_PLACEHOLDERS = [
  "/futuristic-battle-robot-with-weapons.jpg",
  "/ethereal-robot-with-glowing-neural-network.jpg",
  "/humanoid-robot-with-glowing-cyan-interface.jpg",
  "/giant-mecha-robot-with-metallic-armor.jpg",
  "/ai-robot-influencer-with-social-media-hologram.jpg",
  "/swarm-of-small-autonomous-robots.jpg",
]

export function getPlaceholderImage(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return ROBOTICS_PLACEHOLDERS[Math.abs(hash) % ROBOTICS_PLACEHOLDERS.length]
}

export function getTokenImage(image: string | undefined | null, name: string): string {
  if (image && !image.includes("placeholder")) return image
  return getPlaceholderImage(name)
}
