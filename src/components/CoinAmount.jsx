import { Coins } from 'lucide-react';

// A number of Mars Coins with the coin icon.
const CoinAmount = ({ amount, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${className}`}>
    <Coins size={16} className="shrink-0 text-ochre" aria-hidden="true" />
    {amount}
  </span>
);

export default CoinAmount;
