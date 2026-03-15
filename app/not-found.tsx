"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-primary px-5 py-16 text-secondary md:px-8 lg:px-12">
      {/* <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute -right-28 bottom-10 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-secondary/20" />
      </div> */}

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-8 text-center">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-xs font-semibold uppercase tracking-[0.34em] text-secondary/70"
        >
          NaariThread
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="font-display text-6xl leading-none sm:text-7xl lg:text-8xl"
        >
          404
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16 }}
          className="font-display max-w-2xl text-3xl sm:text-4xl"
        >
          This Thread Could Not Be Found
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="max-w-2xl text-base leading-relaxed text-secondary/80 sm:text-lg"
        >
          The page you are looking for has moved, been renamed, or never existed.
          Return to the main collection and continue exploring.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.32 }}
          className="mt-2"
        >
          <Link
            href="/"
            aria-label="Back to NaariThread homepage"
            className="cta-thread border-secondary bg-secondary text-primary hover:bg-primary hover:text-secondary"
          >
            Return to Home
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
