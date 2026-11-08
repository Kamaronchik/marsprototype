import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Gift, ShoppingCart } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import CartModal from '../../components/CartModal';
import CoinAmount from '../../components/CoinAmount';
import { useFetch } from '../../lib/useFetch';
import { addItem, selectCartItems, selectCartCount } from '../../features/cart/cartSlice';

// Student: the rewards shop. Products go into the cart; the cart is paid with an email code.
const Shop = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const cartCount = useSelector(selectCartCount);
  const [cartOpen, setCartOpen] = useState(false);

  const products = useFetch('/api/shop/products');
  const wallet = useFetch('/api/wallet');

  const list = products.data?.products ?? [];
  const balance = wallet.data?.balance ?? null;

  return (
    <>
      <PageHeader
        title={t('shop.title')}
        action={
          <button onClick={() => setCartOpen(true)} className="btn-primary">
            <ShoppingCart size={17} /> {t('shop.cart')}
            {cartCount > 0 && <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">{cartCount}</span>}
          </button>
        }
      >
        {t('shop.subtitle')}
      </PageHeader>

      <div className="mb-6 inline-flex items-center gap-3 rounded-xl border border-line bg-card px-5 py-3">
        <span className="text-sm text-ink-soft">{t('shop.balance')}</span>
        {balance === null ? '—' : <CoinAmount amount={balance} className="text-xl text-ink" />}
      </div>

      {list.length === 0 && !products.loading && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold text-ink">{t('shop.empty')}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{t('shop.emptyHint')}</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((product) => {
          const inCart = cartItems.find((item) => item.productId === product.id)?.quantity ?? 0;
          return (
            <article key={product.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
              <div className="flex aspect-[4/3] items-center justify-center bg-sunken text-ink-faint">
                {product.imageUrl
                  ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  : <Gift size={44} strokeWidth={1.4} />}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-lg font-semibold text-ink">{product.name}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-soft">{product.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <CoinAmount amount={product.price} className="text-lg text-ink" />
                  <button
                    onClick={() => dispatch(addItem(product))}
                    disabled={!product.isAvailable}
                    className="btn-quiet !px-3.5 !py-2"
                  >
                    {!product.isAvailable && t('shop.unavailable')}
                    {product.isAvailable && (inCart > 0 ? `${t('shop.inCart')}: ${inCart}` : t('shop.add'))}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {cartOpen && (
        <CartModal
          balance={balance}
          onClose={() => setCartOpen(false)}
          onBought={() => { wallet.reload(); products.reload(); }}
        />
      )}
    </>
  );
};

export default Shop;
