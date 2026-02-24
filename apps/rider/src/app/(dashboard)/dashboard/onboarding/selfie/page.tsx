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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const startCamera = useCallback(async () => {
    try {
      // Stop existing stream
      stream?.getTracks().forEach((t) => t.stop());

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
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
  }, [facingMode, stream]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    // Will re-trigger via startCamera
    setTimeout(startCamera, 100);
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-surface-950 px-6 text-center animate-scale-in">
        <CheckCircle className="h-16 w-16 text-accent-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Selfie Uploaded!</h2>
        <p className="text-surface-400 mb-8">Your photo is being reviewed.</p>
        <Button className="bg-brand-500 hover:bg-brand-600" onClick={() => router.push('/dashboard/onboarding')}>
          Back to Onboarding
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface-950 animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-surface-950 sticky top-0 z-20 border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.push('/dashboard/onboarding')} className="h-9 w-9 rounded-full bg-surface-800 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-surface-300" />
          </button>
          <h1 className="text-lg font-bold text-white">Selfie Verification</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-danger-400 shrink-0 mt-0.5" />
            <p className="text-xs text-danger-300">{error}</p>
          </div>
        )}

        {/* Camera preview / photo */}
        <div className="relative aspect-[3/4] max-h-[60dvh] rounded-2xl overflow-hidden bg-surface-900">
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
              <Camera className="h-12 w-12 text-surface-600" />
              <p className="text-sm text-surface-400">Tap to start camera</p>
              <Button onClick={startCamera} className="bg-brand-500 hover:bg-brand-600">
                Start Camera
              </Button>
            </div>
          )}

          {/* Overlay guide circle */}
          {(stream && !photo) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-72 rounded-full border-2 border-white/30 border-dashed" />
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        {photo ? (
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1 border-surface-700 text-surface-300" onClick={retake}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button size="lg" className="flex-1 bg-accent-500 hover:bg-accent-600 text-white" onClick={upload} loading={uploading}>
              Upload Selfie
            </Button>
          </div>
        ) : stream ? (
          <div className="flex items-center justify-center gap-6">
            <button onClick={flipCamera} className="h-12 w-12 rounded-full bg-surface-800 flex items-center justify-center">
              <FlipHorizontal2 className="h-5 w-5 text-surface-300" />
            </button>
            <button onClick={capture} className="h-16 w-16 rounded-full bg-white flex items-center justify-center ring-4 ring-white/20">
              <div className="h-12 w-12 rounded-full bg-white border-4 border-surface-950" />
            </button>
            <div className="w-12" /> {/* Spacer for alignment */}
          </div>
        ) : null}

        <p className="text-xs text-surface-500 text-center px-4">
          Position your face within the oval guide. Ensure good lighting and remove sunglasses.
        </p>
      </div>
    </div>
  );
}
