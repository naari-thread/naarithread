"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.1 }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-primary/10 bg-paper/92 shadow-[0_2px_24px_rgba(120,0,0,0.07)] backdrop-blur-md"
          : ""
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-2 md:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="NaariThread — return to homepage"
          className="group flex items-center gap-3"
        >
          <Image
            src="/logo2.png"
            alt="NaariThread logo mark"
            width={80}
            height={80}
            priority
            className="h-12 w-12 rounded-full border border-primary/20 object-cover transition duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_0_3px_rgba(120,0,0,0.09)]"
          />
          <span className="font-display text-2xl tracking-wide text-primary">
            NaariThread
          </span>
        </Link>

        <Link
          href="/products"
          aria-label="Shop the NaariThread collection"
          className="cta-thread py-2 text-xs"
        >
          Shop Now
        </Link>
      </div>
    </motion.header>
  );
}
