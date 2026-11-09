import { SkeletonText, SkeletonStat, SkeletonList } from './Skeleton';

// The shape most pages share: a title, a row of stat tiles, then a list. Shown by React.lazy's
// Suspense while a page's own code is still downloading, before the page gets to render its own
// (more exact) skeleton.
const PageSkeleton = () => (
  <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-9">
    <SkeletonText width="12rem" height="2rem" className="mb-2" />
    <SkeletonText width="20rem" height="0.95rem" className="mb-8" />
    <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-card"><SkeletonStat /></div>
      ))}
    </div>
    <SkeletonList rows={5} />
  </div>
);

export default PageSkeleton;
