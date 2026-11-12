import React, { useState, useEffect } from 'react';

export const PLANTAS_SLIDER_IMAGES = [
  'https://yybannuorhqsykqagkwz.supabase.co/storage/v1/object/public/planta/01.jpg',
  'https://yybannuorhqsykqagkwz.supabase.co/storage/v1/object/public/planta/02.jpg',
  'https://yybannuorhqsykqagkwz.supabase.co/storage/v1/object/public/planta/03.jpg',
  'https://yybannuorhqsykqagkwz.supabase.co/storage/v1/object/public/planta/04.jpg',
];

interface ImageSliderProps {
  variant?: 'sidebar' | 'fullscreen';
  overlay?: 'dark' | 'light';
  intervalMs?: number;
  className?: string;
}

export const ImageSlider: React.FC<ImageSliderProps> = ({
  variant = 'sidebar',
  overlay = 'dark',
  intervalMs = 5000,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % PLANTAS_SLIDER_IMAGES.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  if (variant === 'fullscreen') {
    return (
      <div
        className={`fixed inset-0 pointer-events-none select-none overflow-hidden z-0 ${className}`}
        aria-hidden="true"
      >
        {/* Capas de imágenes con transición suave de opacidad */}
        {PLANTAS_SLIDER_IMAGES.map((imgUrl, idx) => (
          <div
            key={imgUrl}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${
              idx === currentIndex
                ? overlay === 'dark'
                  ? 'opacity-90 scale-100 brightness-95'
                  : 'opacity-40 scale-100'
                : 'opacity-0 scale-105'
            }`}
            style={{
              backgroundImage: `url('${imgUrl}')`,
              transitionProperty: 'opacity, transform',
              transitionDuration: '1200ms',
            }}
          />
        ))}

        {/* Capa de viñeta suave y clara para que las fotos resalten con total nitidez */}
        {overlay === 'dark' ? (
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-black/45" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 via-slate-50/30 to-slate-200/60 backdrop-blur-[1px]" />
        )}
      </div>
    );
  }

  // Variant: 'sidebar' (abajo del logo en la barra de navegación)
  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-[#164e5e] bg-[#08222b] shadow-md group ${className}`}
    >
      {/* Contenedor de imágenes de aspecto 16:10 */}
      <div className="relative w-full h-28 sm:h-32 overflow-hidden">
        {PLANTAS_SLIDER_IMAGES.map((imgUrl, idx) => (
          <img
            key={imgUrl}
            src={imgUrl}
            alt={`Instalación GACCS ${idx + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
              idx === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            loading="lazy"
          />
        ))}

        {/* Gradiente sutil inferior */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Indicadores de diapositiva (puntos) */}
        <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1.5 z-10">
          {PLANTAS_SLIDER_IMAGES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex
                  ? 'w-4 bg-amber-400 shadow-xs'
                  : 'w-1.5 bg-white/50 hover:bg-white/80'
              }`}
              title={`Ver foto ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
