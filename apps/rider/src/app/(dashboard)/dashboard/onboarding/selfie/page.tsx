'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { Button } from '@riderguy/ui';
import { ArrowLeft, Camera, RotateCcw, FlipHorizontal2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SelfiePage() {
  const router = useRouter();
  const { api } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const startCamera = useCallback(async () => {
    try {
      // Stop existing stream
      stream?.getTracks().forEach((t) => t.stop());

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingModeRef.current, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play();
      }
      setError('');
    } catch {
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, [stream]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Cap canvas resolution to avoid iOS Safari 16M-pixel canvas limit
    const MAX_DIM = 1920;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = MAX_DIM / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip for selfie mode
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.8));

    // Stop stream
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const retake = () => {
    setPhoto(null);
    startCamera();
  };

  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    facingModeRef.current = next;
    setFacingMode(next);
    await startCamera();
  };

  const upload = async () => {
    if (!photo || !api) return;
    setUploading(true);
    setError('');
    try {
      // Convert base64 to blob
      const res = await fetch(photo);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', blob, 'selfie.jpg');
      formData.append('type', 'SELFIE');

      await api.post(`${API_BASE_URL}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-page px-6 text-center animate-scale-in">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-ping" />
          <div className="relative h-20 w-20 rounded-full gradient-accent flex items-center justify-center shadow-xl glow-accent">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-primary mb-2 tracking-tight">Selfie Uploaded!</h2>
        <p className="text-muted mb-8">Your photo is being reviewed.</p>
        <Button className="gradient-brand text-white shadow-lg glow-brand btn-press rounded-2xl font-semibold px-8" onClick={() => router.push('/dashboard/onboarding')}>
          Back to Onboarding
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-page animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-nav backdrop-blur-xl sticky top-0 z-20 border-b border-themed">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard/onboarding')} className="h-9 w-9 rounded-xl bg-skeleton border border-themed-strong flex items-center justify-center btn-press">
            <ArrowLeft className="h-5 w-5 text-secondary" />
          </button>
          <h1 className="text-lg font-bold text-primary tracking-tight">Selfie Verification</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {error && (
          <div className="p-3.5 rounded-2xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
            <p className="text-xs text-danger-300">{error}</p>
          </div>
        )}

        {/* Camera preview / photo */}
        <div className="relative aspect-[3/4] max-h-[60dvh] rounded-2xl overflow-hidden bg-hover-themed border border-themed">
          {photo ? (
            <img src={photo} alt="Selfie" className="w-full h-full object-cover" />
          ) : stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
                <Camera className="h-8 w-8 text-brand-400" />
              </div>
              <p className="text-sm text-muted">Tap to start camera</p>
              <Button onClick={startCamera} className="gradient-brand text-white shadow-lg glow-brand btn-press rounded-xl font-semibold">
                Start Camera
              </Button>
            </div>
          )}

          {/* Overlay guide circle */}
          {(stream && !photo) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-72 rounded-full border-2 border-brand-400/40 border-dashed shadow-[0_0_30px_rgba(34,197,94,0.1)]" />
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        {photo ? (
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1 border-themed-strong text-secondary rounded-xl btn-press" onClick={retake}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button size="lg" className="flex-1 gradient-accent text-white shadow-lg glow-accent btn-press rounded-xl font-semibold" onClick={upload} loading={uploading}>
              Upload Selfie
            </Button>
          </div>
        ) : stream ? (
          <div className="flex items-center justify-center gap-6">
            <button onClick={flipCamera} className="h-12 w-12 rounded-xl bg-skeleton border border-themed-strong flex items-center justify-center btn-press">
              <FlipHorizontal2 className="h-5 w-5 text-secondary" />
            </button>
            <button onClick={capture} className="h-[68px] w-[68px] rounded-full gradient-brand flex items-center justify-center ring-4 ring-brand-500/20 shadow-xl glow-brand btn-press">
              <div className="h-14 w-14 rounded-full bg-white border-4 border-page" />
            </button>
            <div className="w-12" />
          </div>
        ) : null}

        <p className="text-xs text-subtle text-center px-4">
          Position your face within the oval guide. Ensure good lighting and remove sunglasses.
        </p>
      </div>
    </div>
  );
}
