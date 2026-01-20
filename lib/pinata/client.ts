import { PinataSDK } from 'pinata'

// Initialize Pinata client with JWT authentication
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
})

// Gateway URL for accessing IPFS content
export const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs'

/**
 * Upload a file to IPFS via Pinata
 * @param file - The file to upload
 * @returns The IPFS hash (CID) and full URL
 */
export async function uploadFile(file: File): Promise<{ ipfsHash: string; url: string }> {
  if (!process.env.PINATA_JWT) {
    throw new Error('PINATA_JWT environment variable is not set')
  }

  const upload = await pinata.upload.public.file(file)
  const ipfsHash = upload.cid

  return {
    ipfsHash,
    url: `${PINATA_GATEWAY}/${ipfsHash}`,
  }
}

/**
 * Upload JSON metadata to IPFS via Pinata
 * @param json - The JSON object to upload
 * @param name - Optional name for the pin
 * @returns The IPFS hash (CID) and full URL
 */
export async function uploadJson(
  json: Record<string, unknown>,
  name?: string
): Promise<{ ipfsHash: string; url: string }> {
  if (!process.env.PINATA_JWT) {
    throw new Error('PINATA_JWT environment variable is not set')
  }

  const uploadBuilder = pinata.upload.public.json(json)
  if (name) {
    uploadBuilder.name(name)
  }
  const upload = await uploadBuilder
  const ipfsHash = upload.cid

  return {
    ipfsHash,
    url: `${PINATA_GATEWAY}/${ipfsHash}`,
  }
}

export { pinata }
