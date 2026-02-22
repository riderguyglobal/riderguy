'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@riderguy/auth';
import {
  Button,
  Card,
  CardContent,
  Spinner,
} from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

// ─── Component ──────────────────────────────────────────────

export default function SelfiePage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // ── Start camera ──────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setCameraError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setCameraError(
        'Camera access denied. Please allow camera access in your browser settings.',
      );
    }
  }, [facingMode, stream]);

  // ── Stop camera on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  // ── Capture photo ─────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Center-crop to square
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;

    // Mirror for selfie camera
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (blob) setCapturedBlob(blob);
      },
      'image/jpeg',
      0.9,
    );

    // Stop camera
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [facingMode, stream]);

  // ── Retake photo ──────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setUploadError(null);
    void startCamera();
  }, [startCamera]);

  // ── Upload selfie ─────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!capturedBlob) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', capturedBlob, 'selfie.jpg');
      formData.append('type', 'SELFIE');
      formData.append('fileName', 'selfie.jpg');
      formData.append('mimeType', 'image/jpeg');
      formData.append('fileSizeBytes', String(capturedBlob.size));

      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Upload failed');
      }

      setUploadSuccess(true);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, accessToken]);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/onboarding')}
          className="mb-3 flex items-center gap-1 text-sm text-brand-500 hover:underline"
        >
          ← Back to checklist
        </button>
        <h1 className="text-xl font-bold text-gray-900">Take a Selfie</h1>
        <p className="mt-1 text-sm text-gray-500">
          We need a clear photo of your face for identity verification.
          Make sure your face is well-lit and centered.
        </p>
      </div>

      {/* Success state */}
      {uploadSuccess && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-green-600"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-800">
            Selfie Uploaded!
          </h3>
          <p className="mt-1 text-sm text-green-600">
            Your selfie has been submitted for verification.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push('/dashboard/onboarding')}
          >
            Back to Checklist
          </Button>
        </div>
      )}

      {/* Camera / Capture area */}
      {!uploadSuccess && (
        <Card>
          <CardContent className="p-4">
            {/* Camera not started */}
            {!stream && !capturedImage && !cameraError && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="relative h-24 w-24">
                  <Image
                    src="/images/illustrations/talking-rider.svg"
                    alt="Selfie"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700">Ready to take your selfie?</p>
                  <p className="mt-1 text-xs text-gray-400">
                    We&apos;ll need access to your camera
                  </p>
                </div>
                <Button onClick={() => void startCamera()}>
                  Open Camera
                </Button>
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-sm text-red-700">{cameraError}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => void startCamera()}
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Live camera view */}
            {stream && !capturedImage && (
              <div className="space-y-4">
                <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />
                  {/* Face guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-48 w-48 rounded-full border-2 border-white/40" />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
                      void startCamera();
                    }}
                  >
                    Flip Camera
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleCapture}
                    className="h-14 w-14 rounded-full p-0"
                  >
                    <div className="h-10 w-10 rounded-full border-2 border-white bg-white" />
                  </Button>
                  <div className="w-[72px]" /> {/* Spacer for centering */}
                </div>
              </div>
            )}

            {/* Captured image preview */}
            {capturedImage && !uploadSuccess && (
              <div className="space-y-4">
                <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-gray-50">
                  <Image
                    src={capturedImage}
                    alt="Selfie preview"
                    fill
                    className="object-cover"
                  />
                </div>

                {uploadError && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {uploadError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleRetake}
                    disabled={uploading}
                  >
                    Retake
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => void handleUpload()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" /> Uploading…
                      </span>
                    ) : (
                      'Use This Photo'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Tips */}
      <div className="mt-6 rounded-xl bg-gray-50 p-4">
        <h3 className="text-sm font-medium text-gray-700">Selfie guidelines</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-gray-500">
          <li className="flex items-start gap-2">
            <span>✅</span>
            <span>Face the camera directly, no sunglasses or hats</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✅</span>
            <span>Good, even lighting — avoid backlighting</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✅</span>
            <span>Neutral expression, mouth closed</span>
          </li>
          <li className="flex items-start gap-2">
            <span>❌</span>
            <span>No filters, masks, or face coverings</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
