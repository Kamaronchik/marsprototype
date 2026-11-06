import PageHeader from './PageHeader';

// Honest placeholder for sections that are not built yet.
const ComingSoon = ({ title, note }) => (
  <>
    <PageHeader title={title} />
    <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
      <p className="font-display text-xl font-semibold text-ink">Nothing here yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        {note || 'This section is still being built. It will show up here when it is ready.'}
      </p>
    </div>
  </>
);

export default ComingSoon;
