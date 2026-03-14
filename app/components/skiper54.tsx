"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";

export type SkiperImage = {
  src: string;
  alt: string;
  title: string;
};

type Skiper54Props = {
  images: SkiperImage[];
  className?: string;
  autoplay?: boolean;
  loop?: boolean;
  showNavigation?: boolean;
  showPagination?: boolean;
};

const EMPTY_CLASSES = "";

function wrapIndex(index: number, total: number) {
  if (total === 0) return 0;
  return ((index % total) + total) % total;
}

function visibleSlides(images: SkiperImage[], current: number) {
  if (images.length === 0) {
    return [] as Array<{ key: string; image: SkiperImage; slot: number }>;
  }

  const slots = [-1, 0, 1];
  return slots.map((slot) => {
    const idx = wrapIndex(current + slot, images.length);
    return {
      key: `${idx}-${slot}`,
      image: images[idx],
      slot,
    };
  });
}

const slotClasses: Record<number, string> = {
  [-1]: "left-[4%] w-[42%] md:left-[3%] md:w-[33%] lg:left-[6%] lg:w-[28%]",
  0: "left-1/2 w-[56%] -translate-x-1/2 md:w-[42%] lg:w-[34%]",
  1: "right-[4%] w-[42%] md:right-[3%] md:w-[33%] lg:right-[6%] lg:w-[28%]",
};

const scaleBySlot: Record<number, number> = {
  [-1]: 0.92,
  0: 1,
  1: 0.92,
};

const opacityBySlot: Record<number, number> = {
  [-1]: 0.7,
  0: 1,
  1: 0.7,
};

const zClassBySlot: Record<number, string> = {
  [-1]: "z-10",
  0: "z-20",
  1: "z-10",
};

const Skiper54 = ({
  images,
  className = EMPTY_CLASSES,
  autoplay = true,
  loop = true,
  showNavigation = true,
  showPagination = true,
}: Skiper54Props) => {
  const [current, setCurrent] = useState(0);

  const slides = useMemo(() => visibleSlides(images, current), [images, current]);

  useEffect(() => {
    if (!autoplay || images.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrent((prev) => {
        if (!loop && prev >= images.length - 1) {
          return prev;
        }
        return wrapIndex(prev + 1, images.length);
      });
    }, 2600);

    return () => window.clearInterval(timer);
  }, [autoplay, loop, images.length]);

  if (images.length === 0) {
    return null;
  }

  const next = () => {
    setCurrent((prev) => {
      if (!loop && prev >= images.length - 1) {
        return prev;
      }
      return wrapIndex(prev + 1, images.length);
    });
  };

  const prev = () => {
    setCurrent((prevIndex) => {
      if (!loop && prevIndex <= 0) {
        return prevIndex;
      }
      return wrapIndex(prevIndex - 1, images.length);
    });
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-[56vh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-secondary/20 bg-primary/20">
        <AnimatePresence mode="popLayout" initial={false}>
          {slides.map((slide) => (
            <motion.div
              key={slide.key}
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{
                opacity: opacityBySlot[slide.slot],
                scale: scaleBySlot[slide.slot],
                y: slide.slot === 0 ? 0 : 12,
              }}
              exit={{ opacity: 0, scale: 0.9, y: 18 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className={`absolute top-1/2 h-[88%] -translate-y-1/2 overflow-hidden rounded-2xl border border-secondary/30 ${slotClasses[slide.slot]} ${zClassBySlot[slide.slot]}`}
            >
              <Image
                src={slide.image.src}
                alt={slide.image.alt}
                fill
                priority={slide.slot === 0}
                sizes="(max-width: 768px) 56vw, (max-width: 1200px) 42vw, 34vw"
                className="object-cover object-top"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-transparent p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-secondary/80">Most Loved</p>
                <p className="mt-1 text-sm font-semibold text-secondary md:text-base">{slide.image.title}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {showNavigation ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-3 md:px-5">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/30 bg-primary/65 text-lg text-secondary transition hover:bg-primary"
            >
              <span aria-hidden="true">&#8249;</span>
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary/30 bg-primary/65 text-lg text-secondary transition hover:bg-primary"
            >
              <span aria-hidden="true">&#8250;</span>
            </button>
          </div>
        ) : null}
      </div>

      {showPagination ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {images.map((image, idx) => (
            <button
              key={image.title + idx}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setCurrent(idx)}
              className={`h-2.5 rounded-full transition-all ${idx === current ? "w-8 bg-secondary" : "w-2.5 bg-secondary/40"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export { Skiper54 };
