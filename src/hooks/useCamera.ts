import { useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    readerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  const startScanning = useCallback(async (onDetected: (barcode: string) => void) => {
    setError(null)
    setScanning(true)

    try {
      readerRef.current = new BrowserMultiFormatReader()

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      if (!devices.length) {
        setError('لا توجد كاميرا متاحة')
        setScanning(false)
        return
      }

      // Prefer back camera
      const backCam = devices.find((d) =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      )
      const deviceId = backCam?.deviceId ?? devices[devices.length - 1].deviceId

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, facingMode: 'environment' },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()

        controlsRef.current = await readerRef.current.decodeFromVideoElement(
          videoRef.current,
          (result, err) => {
            if (result) {
              const code = result.getText()
              stopScanning()
              onDetected(code)
            }
            // Ignore continuous decode errors
            if (err && err.name !== 'NotFoundException') {
              console.warn('Scan error:', err)
            }
          }
        )
      }
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('يجب السماح للتطبيق باستخدام الكاميرا')
      } else {
        setError('تعذّر فتح الكاميرا')
      }
      setScanning(false)
    }
  }, [stopScanning])

  return { videoRef, scanning, error, startScanning, stopScanning }
}
