"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
// useCallback and useId are used for stable send function and unique IDs
import { motion, AnimatePresence } from "framer-motion";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
};

const QUICK_REPLIES = [
  "Track my order",
  "Return policy",
  "Do you have COD?",
  "Help with sizing",
];

const BOT_RESPONSES: Record<string, string> = {
  "Track my order":
    "Once dispatched, you'll receive a tracking link via SMS and email. Orders are processed within 24–48 hours and delivered in 4–7 business days. 📦",
  "Return policy":
    "Returns can be raised within 3 days of delivery. Items must be unused with original tags and packaging. Approved refunds are processed in 5–7 business days. ✨",
  "Do you have COD?":
    "Yes! COD is available on selected orders and locations. A small handling fee may apply and orders may need confirmation before dispatch. 🛵",
  "Help with sizing":
    "We have a size guide with exact measurements for each category. If you are between sizes, we suggest sizing up for comfort. Exchanges for size issues are also available! 📏",
};

function getBotReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("track") || lower.includes("order"))
    return BOT_RESPONSES["Track my order"];
  if (lower.includes("return") || lower.includes("refund"))
    return BOT_RESPONSES["Return policy"];
  if (lower.includes("cod") || lower.includes("cash"))
    return BOT_RESPONSES["Do you have COD?"];
  if (lower.includes("size") || lower.includes("fit") || lower.includes("sizing"))
    return BOT_RESPONSES["Help with sizing"];
  return "Thank you for reaching out! 🌸 For detailed help, email us at naarithread@gmail.com or call +91 84878 49852. We are happy to assist!";
}

export function AiChat() {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const msgCountRef = useRef(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Namaste! 🌸 I am Saathi, your NaariThread style assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = useCallback((text: string) => {
    if (!text.trim()) return;
    msgCountRef.current += 1;
    const n = msgCountRef.current;
    const userMsg: Message = { id: `${baseId}-u-${n}`, role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = getBotReply(text);
      setMessages((prev) => [
        ...prev,
        { id: `${baseId}-b-${n}`, role: "bot", text: reply },
      ]);
      setTyping(false);
    }, 900);
  }, [baseId]);

  return (
    <>
      {/* Toggle button */}
      <motion.button
        type="button"
        aria-label={open ? "Close Saathi chat" : "Open Saathi style assistant"}
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-secondary/50 bg-primary text-secondary shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:border-secondary/80 hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2 }}
            >
              <DynamicHugeIcon name="Cancel01Icon" className="h-5 w-5" iconStrokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DynamicHugeIcon name="AiChat01Icon" className="h-5 w-5" iconStrokeWidth={1.8} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="fixed bottom-28 right-8 z-50 flex w-[340px] max-w-[calc(100vw-4rem)] flex-col overflow-hidden rounded-[1.5rem] border border-primary/15 bg-paper shadow-[0_24px_60px_rgba(120,0,0,0.18)]"
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-primary px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/20">
                <DynamicHugeIcon name="UserIcon" className="h-4.5 w-4.5 text-secondary" iconStrokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-wide text-secondary">Saathi</p>
                <p className="truncate text-xs text-secondary/70">NaariThread Style Assistant</p>
              </div>
              <span
                className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]"
                aria-label="Online"
              />
            </div>

            {/* Messages */}
            <div className="flex h-[272px] flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <p
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-primary text-secondary"
                        : "rounded-bl-sm border border-primary/10 bg-secondary/80 text-primary"
                    }`}
                  >
                    {msg.text}
                  </p>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-primary/10 bg-secondary/80 px-4 py-3">
                    <span className="inline-flex gap-1" aria-label="Typing indicator">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick replies */}
            <div className="flex flex-wrap gap-2 border-t border-primary/10 px-4 py-3">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  aria-label={`Quick reply: ${q}`}
                  onClick={() => send(q)}
                  className="rounded-full border border-primary/20 bg-secondary/60 px-3 py-1 text-xs text-primary/80 transition hover:border-primary/50 hover:bg-secondary hover:text-primary"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-primary/10 px-4 py-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                aria-label="Chat message input"
                className="flex-1 rounded-full border border-primary/20 bg-secondary/50 px-4 py-2 text-sm text-primary outline-none transition placeholder:text-primary/40 focus:border-primary/50 focus:bg-secondary"
              />
              <button
                type="submit"
                disabled={!input.trim()}
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
