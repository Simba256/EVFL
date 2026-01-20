import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/pinata/client'

// Allowed file types
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif']

// Max file size: 2MB
const MAX_SIZE = 2 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: PNG, JPG, GIF' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB' },
        { status: 400 }
      )
    }

    // Upload to Pinata IPFS
    const result = await uploadFile(file)

    return NextResponse.json({
      ipfsHash: result.ipfsHash,
      url: result.url,
    })
  } catch (error) {
    console.error('Error uploading file:', error)

    if ((error as Error).message?.includes('PINATA_JWT')) {
      return NextResponse.json(
        { error: 'IPFS upload service not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
