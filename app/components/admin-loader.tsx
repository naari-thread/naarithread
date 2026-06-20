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
        <div className="relative grid size-16 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border border-primary/10" />
          <span className="absolute inset-[3px] rounded-full border border-primary/8" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/70 motion-safe:animate-spin [animation-duration:900ms]" />
          <span className="absolute inset-[5px] rounded-full border border-transparent border-b-primary/30 motion-safe:animate-spin [animation-duration:1400ms] [animation-direction:reverse]" />
          <span className="size-2 rounded-full bg-primary/40" />
        </div>

        <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-primary/45">
          NaariThread Admin
        </p>
        <h1 className="mt-1.5 text-lg font-semibold sm:text-xl">{label}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-primary/60">{description}</p>
      </div>
      <span className="sr-only">{description}</span>
    </section>
  );
}
