type AdminLoaderProps = {
  label?: string;
  description?: string;
  fullScreen?: boolean;
};

export function AdminLoader({
  label = "Preparing dashboard",
  description = "Loading secure admin data...",
  fullScreen = true,
}: AdminLoaderProps): React.JSX.Element {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={`flex w-full items-center justify-center bg-paper px-5 text-primary ${
        fullScreen ? "min-h-screen pb-24 md:pb-10" : "min-h-[22rem]"
      }`}
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="relative grid size-20 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border border-primary/15" />
          <span className="absolute inset-1 rounded-full border-2 border-transparent border-r-primary/35 border-t-primary motion-safe:animate-spin" />
          <span className="grid size-12 place-items-center rounded-full bg-primary text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-secondary shadow-[0_10px_28px_rgba(120,0,0,0.22)]">
            NT
          </span>
        </div>

        <p className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-primary/60">
          NaariThread Admin
        </p>
        <h1 className="mt-2 text-xl font-semibold sm:text-2xl">{label}</h1>
        <p className="mt-2 text-sm leading-relaxed text-primary/65">{description}</p>

        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className={`size-1.5 rounded-full bg-primary/45 motion-safe:animate-pulse ${
                item === 1 ? "[animation-delay:150ms]" : item === 2 ? "[animation-delay:300ms]" : ""
              }`}
            />
          ))}
        </div>
      </div>
      <span className="sr-only">{description}</span>
    </section>
  );
}
