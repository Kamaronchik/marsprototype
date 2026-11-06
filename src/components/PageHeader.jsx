const PageHeader = ({ title, children, action }) => (
  <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.1rem]">{title}</h1>
      {children && <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-soft">{children}</p>}
    </div>
    {action}
  </header>
);

export default PageHeader;
