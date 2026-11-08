import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Gift, Minus, Plus, Trash2, Loader2 } from 'lucide-react';
import Modal from './Modal';
import CoinAmount from './CoinAmount';
import { api, errorText } from '../lib/api';
import {
  MAX_QUANTITY, selectCartItems, selectCartTotal, setQuantity, removeItem, clearCart,
} from '../features/cart/cartSlice';

const CODE_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;

// A clock that ticks every second while the code step is open.
const useNow = (running) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return now;
};

const formatLeft = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// The cart and the two steps of buying: 1. check the cart, the email code is sent; 2. type the code.
const CartModal = ({ balance, onClose, onBought }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);

  const [purchase, setPurchase] = useState(null); // { verificationId, expiresAt } once the code was sent
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useNow(!!purchase);

  const notEnough = balance !== null && total > balance;
  const timeLeft = purchase ? new Date(purchase.expiresAt).getTime() - now : 0;
  const sentAgo = purchase ? now - (new Date(purchase.expiresAt).getTime() - CODE_LIFETIME_MS) : 0;
  const resendIn = Math.max(0, Math.ceil((RESEND_AFTER_MS - sentAgo) / 1000));

  const sendCode = async () => {
    setBusy(true);
    try {
      const started = await api('/api/shop/purchases', {
        method: 'POST',
        body: { items: items.map(({ productId, quantity }) => ({ productId, quantity })) },
      });
      setPurchase(started);
      setCode('');
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const done = await api(`/api/shop/purchases/${purchase.verificationId}/confirm`, { method: 'POST', body: { code } });
      dispatch(clearCart());
      toast.success(t('shop.bought'));
      onBought(done.balance);
      onClose();
    } catch (error) {
      toast.error(errorText(t, error));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (purchase) {
    return (
      <Modal title={t('shop.codeTitle')} onClose={onClose}>
        <form onSubmit={confirm} className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-soft">{t('shop.codeSent')}</p>
          <div>
            <label htmlFor="purchase-code" className="field-label">{t('shop.codeLabel')}</label>
            <input
              id="purchase-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="field text-center font-display text-2xl tracking-[0.5em]"
              autoFocus
            />
            <p className={`mt-2 text-xs ${timeLeft > 0 ? 'text-ink-faint' : 'font-semibold text-brick'}`}>
              {timeLeft > 0 ? t('shop.codeLeft', { time: formatLeft(timeLeft) }) : t('shop.codeExpired')}
            </p>
          </div>
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <button type="button" onClick={sendCode} disabled={busy || resendIn > 0} className="btn-quiet">
              {resendIn > 0 ? t('shop.resendIn', { seconds: resendIn }) : t('shop.resend')}
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPurchase(null)} className="btn-quiet">{t('shop.back')}</button>
              <button type="submit" disabled={busy || code.length !== 6 || timeLeft <= 0} className="btn-primary">
                {busy && <Loader2 size={16} className="animate-spin" />} {t('shop.confirm')}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal title={t('shop.cart')} onClose={onClose}>
      {items.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-display text-lg font-semibold text-ink">{t('shop.cartEmpty')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t('shop.cartEmptyHint')}</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center gap-3 py-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken text-ink-faint">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Gift size={22} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{item.name}</div>
                  <CoinAmount amount={item.price * item.quantity} className="text-xs text-ink-soft" />
                </div>
                <div className="flex items-center gap-1" role="group" aria-label={t('shop.quantity')}>
                  <button
                    onClick={() => dispatch(setQuantity({ productId: item.productId, quantity: item.quantity - 1 }))}
                    aria-label="-"
                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:bg-sunken"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                  <button
                    onClick={() => dispatch(setQuantity({ productId: item.productId, quantity: item.quantity + 1 }))}
                    disabled={item.quantity >= MAX_QUANTITY}
                    aria-label="+"
                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:bg-sunken disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={() => dispatch(removeItem(item.productId))}
                  aria-label={`${t('shop.remove')}: ${item.name}`}
                  className="rounded-lg p-2 text-ink-faint hover:bg-brick-tint hover:text-brick"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm font-medium text-ink-soft">{t('shop.total')}</span>
            <CoinAmount amount={total} className="text-lg text-ink" />
          </div>
          {notEnough && (
            <p className="mt-3 rounded-lg bg-brick-tint px-3.5 py-2.5 text-sm text-brick">
              {t('shop.notEnough', { balance, total })}
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <button onClick={sendCode} disabled={busy || notEnough} className="btn-primary">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? t('shop.sending') : t('shop.buy')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default CartModal;
