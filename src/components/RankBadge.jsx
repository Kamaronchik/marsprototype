import { ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Gauge from './Gauge';

const RANK_ORDER = ['cadet', 'pilot', 'navigator', 'commander'];

// The student's rank: stripes like an insignia (one for a Cadet, four for a Commander) inside a ring
// that shows the progress to the next rank. With showName the rank is written under the badge.
const RankBadge = ({ rank, size = 64, showName = false }) => {
  const { t } = useTranslation();
  const stripes = RANK_ORDER.indexOf(rank.key) + 1;
  const percent = rank.xpForNext ? (rank.xpIntoRank / rank.xpForNext) * 100 : 100;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <Gauge percent={percent} size={size} stroke={Math.max(4, Math.round(size / 12))}>
        <span className="flex flex-col items-center text-mars" role="img" aria-label={t(`ranks.${rank.key}`)}>
          {Array.from({ length: stripes }, (_, i) => (
            <ChevronUp key={i} size={Math.round(size / 4)} strokeWidth={3.2} className="-my-[18%]" />
          ))}
        </span>
      </Gauge>
      {showName && <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">{t(`ranks.${rank.key}`)}</span>}
    </div>
  );
};

export default RankBadge;
