// Grey placeholders shown while a page waits for the server. The colour and sweep come from the
// theme (see .skeleton in index.css), so every design (mars, orbit, terminal, control, station, bay)
// gets its own look without any extra work here.

// One block of a given size. width/height accept any CSS length ("3rem", "60%", 40).
export const Skeleton = ({ width = '100%', height = '1rem', className = '', style, ...rest }) => (
  <span
    className={`skeleton block ${className}`}
    style={{ width, height, ...style }}
    aria-hidden="true"
    {...rest}
  />
);

// A line of text: a title or a sentence, as a single grey bar.
export const SkeletonText = ({ width = '100%', height = '0.9rem', className = '' }) => (
  <Skeleton width={width} height={height} className={`rounded-md ${className}`} />
);

// A round placeholder, for an avatar or an icon badge.
export const SkeletonAvatar = ({ size = '2.5rem', className = '' }) => (
  <Skeleton width={size} height={size} className={`!rounded-full shrink-0 ${className}`} />
);

// One number-tile, like the stat tiles on the dashboards: a small label and a big value.
export const SkeletonStat = () => (
  <div className="px-5 py-4">
    <SkeletonText width="55%" height="0.65rem" className="mb-2.5" />
    <SkeletonText width="40%" height="1.6rem" />
  </div>
);

// One row of a list/table: an optional avatar, two lines of text, a value on the right.
export const SkeletonRow = ({ avatar = false, trailing = true }) => (
  <div className="flex items-center gap-3 px-5 py-3.5">
    {avatar && <SkeletonAvatar size="2.25rem" />}
    <div className="min-w-0 flex-1 space-y-2">
      <SkeletonText width="45%" />
      <SkeletonText width="28%" height="0.7rem" />
    </div>
    {trailing && <SkeletonText width="4rem" height="0.8rem" className="shrink-0" />}
  </div>
);

// A short list of rows inside a card border, the usual shape of a table or feed while it loads.
export const SkeletonList = ({ rows = 4, avatar = false }) => (
  <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
    {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} avatar={avatar} />)}
  </div>
);

// A card with a title and a few lines, the shape of a stat panel or an empty form.
export const SkeletonCard = ({ lines = 3 }) => (
  <div className="space-y-3 rounded-xl border border-line bg-card p-5">
    <SkeletonText width="40%" height="1.1rem" />
    {Array.from({ length: lines }, (_, i) => <SkeletonText key={i} width={`${85 - i * 12}%`} />)}
  </div>
);

export default Skeleton;
