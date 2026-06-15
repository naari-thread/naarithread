"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Image from "next/image";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
};

const QUICK_PILLS = [
  { label: "Shipping & delivery", text: "How long does delivery take?" },
  { label: "Return policy", text: "What is your return policy?" },
  { label: "Cash on Delivery", text: "Do you have COD? What are the charges?" },
  { label: "Size help", text: "How do I choose the right size?" },
  { label: "Track my order", text: "How do I track my order?" },
  { label: "Free delivery", text: "When do I get free delivery?" },
];

const WHATSAPP_URL = "https://wa.me/918487849852";

export function AiChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const baseId = useId();
  const msgCountRef = useRef(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Namaste! 🌸 I'm Saathi, your NaariThread style assistant. Ask me anything about our collections, shipping, returns, or sizing!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pillsUsed, setPillsUsed] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    let hideId = 0;
    const alreadyShown = window.sessionStorage.getItem("nt-saathi-nudge") === "1";
    if (alreadyShown) return;

    const showId = window.setTimeout(() => {
      window.sessionStorage.setItem("nt-saathi-nudge", "1");
      if (open) return;
      setShowNudge(true);
      hideId = window.setTimeout(() => setShowNudge(false), 6500);
    }, 20_000);

    return () => {
      window.clearTimeout(showId);
      if (hideId) window.clearTimeout(hideId);
    };
  }, [open]);

  useEffect(() => {
    const handleOpen = () => { setOpen(true); setShowNudge(false); };
    window.addEventListener("open-saathi-chat", handleOpen);

    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") === "open") {
      handleOpen();
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }

    const checkScreen = () => setIsDesktop(window.innerWidth >= 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);

    return () => {
      window.removeEventListener("open-saathi-chat", handleOpen);
      window.removeEventListener("resize", checkScreen);
    };
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    msgCountRef.current += 1;
    const n = msgCountRef.current;

    const updatedMessages: Message[] = [
      ...messages,
      { id: `${baseId}-u-${n}`, role: "user" as const, text: trimmed },
    ];

    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, text: m.text })),
        }),
        signal: AbortSignal.timeout(20_000),
      });

      const data = await response.json() as { reply?: string };
      const reply = data.reply?.trim() || "I'm having a little trouble right now. 🌸 For immediate help, WhatsApp us at +91 84878 49852!";

      setMessages((prev) => [...prev, { id: `${baseId}-b-${n}`, role: "bot", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${baseId}-b-${n}`, role: "bot", text: "I seem to be offline right now. 🌸 Please WhatsApp us at +91 84878 49852 for quick help!" },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, messages, baseId]);

  const handlePillClick = useCallback((pill: typeof QUICK_PILLS[number]) => {
    setPillsUsed((prev) => new Set([...prev, pill.label]));
    void send(pill.text);
  }, [send]);

  const isAdminPage = pathname.startsWith("/admin");
  const isProductsPage = pathname.startsWith("/products") || pathname === "/cart" || pathname === "/wishlist";
  const showFloatingButton = (pathname === "/" || open || isDesktop) && !isAdminPage;

  const visiblePills = QUICK_PILLS.filter((p) => !pillsUsed.has(p.label));

  return (
    <>
      {showFloatingButton && (
        <div className={`fixed ${isProductsPage || pathname === "/" ? "bottom-24 sm:bottom-8" : "bottom-5 sm:bottom-8"} right-5 z-[105] sm:right-8`}>
          <AnimatePresence>
            {!open && showNudge && (
              <motion.div
                key="nudge"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                className="pointer-events-none absolute bottom-16 right-0 w-[min(220px,calc(100vw-1rem))] rounded-2xl border border-primary/15 bg-secondary px-4 py-2.5 shadow-[0_12px_32px_rgba(120,0,0,0.2)]"
                role="status"
                aria-live="polite"
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary/65">Saathi · NaariThread</p>
                <p className="mt-1 text-sm leading-snug text-primary/90">Need help? Tap to chat with me! 🌸</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!open && showNudge && (
              <motion.span
                key="ping"
                initial={{ opacity: 0.45, scale: 0.92 }}
                animate={{ opacity: 0, scale: 1.32 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut", repeat: Infinity, repeatDelay: 0.35 }}
                className="pointer-events-none absolute inset-0 rounded-full border border-primary/40"
                aria-hidden
              />
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            aria-label={open ? "Close Saathi chat" : "Open Saathi style assistant"}
            onClick={() => { setShowNudge(false); setOpen((o) => !o); }}
            whileTap={{ scale: 0.92 }}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-secondary/50 bg-primary text-secondary shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:border-secondary/80 hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
          >
            <span className="absolute right-0.5 -top-1 flex h-3.5 w-3.5 items-center justify-center" aria-hidden>
              <motion.span
                animate={{ scale: [0.9, 1.45], opacity: [0.45, 0] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
                className="absolute h-3.5 w-3.5 rounded-full bg-primary"
              />
              <span className="relative h-2.5 w-2.5 rounded-full border border-primary/55 bg-background" />
            </span>

            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0, scale: 0.7 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.7 }} transition={{ duration: 0.2 }}>
                  <DynamicHugeIcon name="Cancel01Icon" className="h-6 w-6" iconStrokeWidth={2} />
                </motion.div>
              ) : (
                <motion.div key="chat" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Image src="/chatbot.jpg" alt="Saathi chat" width={128} height={128} className="h-auto w-auto rounded-full" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className={`fixed ${isProductsPage ? "bottom-[5.4rem]" : "bottom-24"} right-2 z-[105] flex w-[340px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[1.5rem] border border-primary/15 bg-paper shadow-[0_24px_60px_rgba(120,0,0,0.18)] sm:bottom-28 sm:right-8`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-primary px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary/20">
                <Image src="/chatbot.jpg" alt="Saathi" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-wide text-secondary">Saathi</p>
                <p className="truncate text-xs text-secondary/70">NaariThread Style Assistant</p>
              </div>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open WhatsApp support"
                title="Chat on WhatsApp"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-300 transition hover:bg-green-500/40"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
              {(pathname !== "/" || !isDesktop) && (
                <button
                  type="button"
                  aria-label="Close chat"
                  onClick={() => setOpen(false)}
                  className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary transition hover:bg-secondary/30"
                >
                  <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" iconStrokeWidth={2.2} />
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex h-[260px] flex-col gap-3 overflow-y-auto px-4 py-4 scroll-smooth">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-primary text-secondary"
                        : "rounded-bl-sm border border-primary/10 bg-secondary/80 text-primary"
                    }`}
                  >
                    {msg.text}
                  </p>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-primary/10 bg-secondary/80 px-4 py-3">
                    <span className="inline-flex gap-1" aria-label="Saathi is typing">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick pills — hide once all used */}
            {visiblePills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-primary/10 px-4 py-2.5">
                {visiblePills.slice(0, 4).map((pill) => (
                  <button
                    key={pill.label}
                    type="button"
                    disabled={isTyping}
                    onClick={() => handlePillClick(pill)}
                    className="rounded-full border border-primary/20 bg-secondary/60 px-3 py-1 text-xs text-primary/80 transition hover:border-primary/50 hover:bg-secondary hover:text-primary disabled:opacity-50"
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); void send(input); }}
              className="flex items-center gap-2 border-t border-primary/10 px-4 py-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                aria-label="Chat message"
                disabled={isTyping}
                maxLength={400}
                className="flex-1 rounded-full border border-primary/20 bg-secondary/50 px-4 py-2 text-sm text-primary outline-none transition placeholder:text-primary/40 focus:border-primary/50 focus:bg-secondary disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-secondary transition hover:bg-primary/80 disabled:opacity-40"
              >
                <DynamicHugeIcon name="MailSend01Icon" className="h-4 w-4" iconStrokeWidth={2} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
