const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

export function Logo({ size = 36 }: { size?: number }) {
  return <img src={ICON} width={size} height={size} alt="" className="rounded-[22%] shadow-sm" />;
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <span className="text-[15px] font-extrabold tracking-[0.08em] text-ink">
        LIFE TRACKER<span className="sr-only"> home</span>
      </span>
    </div>
  );
}
