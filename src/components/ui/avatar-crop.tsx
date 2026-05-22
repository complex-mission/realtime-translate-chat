'use client'
import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Point, Area } from 'react-easy-crop'

interface AvatarCropProps {
  imageFile: File
  onCrop: (blob: Blob) => void
  onCancel: () => void
}

// PRD: 头像 300x300 正方形, WebP 格式, 质量 85
const AVATAR_SIZE = 300
const AVATAR_QUALITY = 0.85

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image()
  image.src = imageSrc
  await new Promise(resolve => { image.onload = resolve })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE

  // 裁切为正方形并缩放到 300x300
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, AVATAR_SIZE, AVATAR_SIZE
  )

  // 输出 WebP 格式, 质量 85%
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => { if (blob) resolve(blob); else reject(new Error('Canvas toBlob failed')) },
      'image/webp',
      AVATAR_QUALITY
    )
  })
}

export default function AvatarCrop({ imageFile, onCrop, onCancel }: AvatarCropProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)
  const imageSrc = URL.createObjectURL(imageFile)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setProcessing(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCrop(blob)
    } catch (e) {
      console.error('Crop failed:', e)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl mx-4">
        <h3 className="mb-4 text-lg font-semibold">裁切头像</h3>
        <p className="mb-3 text-xs text-gray-500">头像将裁切为 300×300 正方形，转换为 WebP 格式</p>

        <div className="relative h-72 w-full rounded-lg overflow-hidden bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-gray-500">缩小</span>
          <input type="range" min={1} max={3} step={0.1} value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))} className="flex-1 accent-blue-600" />
          <span className="text-xs text-gray-500">放大</span>
        </div>

        <div className="mt-2 flex justify-center gap-4 text-xs text-gray-400">
          <span>拖动调整位置</span>
          <span>·</span>
          <span>滚轮或滑块缩放</span>
          <span>·</span>
          <span>输出: 300×300 WebP</span>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 transition">取消</button>
          <button onClick={handleConfirm} disabled={processing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition">
            {processing ? '处理中...' : '确认裁切'}
          </button>
        </div>
      </div>
    </div>
  )
}
