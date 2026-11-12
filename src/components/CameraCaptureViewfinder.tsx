import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, Sparkles, Image as ImageIcon } from 'lucide-react';

interface CameraCaptureViewfinderProps {
  isOpen: boolean;
  onClose: () => void;
  onCapturePhoto: (dataUrl: string) => void;
  slotNumber: number;
}

export const CameraCaptureViewfinder: React.FC<CameraCaptureViewfinderProps> = ({
  isOpen,
  onClose,
  onCapturePhoto,
  slotNumber,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedDataUrl(null);
      setPermissionStatus('idle');
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setPermissionStatus('requesting');
    setCapturedDataUrl(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionStatus('unavailable');
      return;
    }

    try {
      // Check for available video input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setPermissionStatus('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
      } else {
        setPermissionStatus('unavailable');
      }
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Optional timestamp watermark
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(16, canvas.height - 48, 280, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Auditoría NOM · ${dateStr}`, 26, canvas.height - 26);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedDataUrl(dataUrl);
    stopCamera();
  };

  const handleConfirmPhoto = () => {
    if (capturedDataUrl) {
      onCapturePhoto(capturedDataUrl);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
    startCamera(facingMode);
  };

  const handleNativeFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onCapturePhoto(result);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md">
      <div className="relative bg-neutral-900 text-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[95vh] border border-neutral-800">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Tomar Foto para Evidencia {slotNumber}</h3>
              <p className="text-[11px] text-neutral-400">
                Alinea el equipo o punto normativo a auditar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Canvas Area */}
        <div className="relative bg-black flex-1 min-h-[340px] sm:min-h-[420px] flex items-center justify-center overflow-hidden">
          {capturedDataUrl ? (
            /* Preview of Captured Photo */
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={capturedDataUrl}
                alt="Foto capturada"
                className="max-h-[420px] w-auto max-w-full object-contain"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/75 rounded-full text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Foto Capturada</span>
              </div>
            </div>
          ) : permissionStatus === 'granted' ? (
            /* Live Camera Stream with Visual Grid Guides */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[440px]"
              />

              {/* Viewfinder Grid Overlay */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-cyan-400/50 rounded-full" />
                </div>
                <div className="border-b border-white/10" />
                <div className="border-r border-white/10" />
                <div className="border-r border-white/10" />
                <div />
              </div>

              {/* Toggle front/back camera if available */}
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                  }
                  className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/90 rounded-full text-white transition-colors"
                  title="Cambiar cámara frontal / trasera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : permissionStatus === 'requesting' ? (
            /* Requesting permissions state */
            <div className="text-center p-6 space-y-3">
              <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-neutral-300">
                Solicitando acceso a la cámara de tu dispositivo...
              </p>
            </div>
          ) : (
            /* Permission Denied or Unavailable State */
            <div className="p-6 text-center space-y-4 max-w-sm">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  {permissionStatus === 'denied'
                    ? 'Permiso de cámara bloqueado'
                    : 'Cámara en vivo no disponible'}
                </h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {permissionStatus === 'denied'
                    ? 'Para usar la cámara en vivo, concede el permiso en la barra de tu navegador o utiliza el botón de captura nativa para abrir la cámara de tu móvil.'
                    : 'Puedes abrir directamente la cámara nativa de tu dispositivo móvil o seleccionar una foto de tu galería.'}
                </p>
              </div>

              {/* Native Mobile Camera Trigger */}
              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span>Abrir Cámara Nativa del Móvil</span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden Canvas & Native Camera Input */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={nativeInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeFallbackChange}
          className="hidden"
        />

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3">
          {capturedDataUrl ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tomar otra</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="px-5 py-2 text-xs font-bold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors shadow-lg flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Guardar esta Foto</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                className="px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-700 rounded-xl transition-colors flex items-center gap-1.5"
                title="Abrir cámara del sistema o galería"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Cámara Nativa / Archivo</span>
              </button>

              {permissionStatus === 'granted' && (
                <button
                  type="button"
                  onClick={handleCapture}
                  className="px-6 py-2.5 rounded-full bg-white text-neutral-950 font-bold hover:bg-neutral-100 transition-all shadow-xl flex items-center gap-2 border-4 border-cyan-400/40"
                >
                  <div className="w-4 h-4 rounded-full bg-cyan-500" />
                  <span>Capturar Foto</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
