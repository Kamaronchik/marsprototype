import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Undo2, Gift, ImagePlus } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import CoinAmount from '../../components/CoinAmount';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';

const EMPTY_FORM = { name: '', description: '', price: '', imageUrl: '', isAvailable: true };
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Admin: the products of the shop.
const ShopProducts = () => {
  const { t } = useTranslation();
  const { data, loading, reload } = useFetch('/api/admin/shop/products');
  const [editing, setEditing] = useState(null); // null = closed, {} = new product, {id,...} = existing
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const products = data?.products ?? [];

  const openForm = (product) => {
    setEditing(product ?? {});
    setForm(product
      ? { name: product.name, description: product.description, price: product.price, imageUrl: product.imageUrl ?? '', isAvailable: product.isAvailable }
      : EMPTY_FORM);
  };

  const uploadImage = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t('products.imageHint'));
      return;
    }
    setUploading(true);
    try {
      const { imageUrl } = await api('/api/admin/shop/products/image', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      setForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const body = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      imageUrl: form.imageUrl || null,
      isAvailable: form.isAvailable,
    };
    try {
      if (editing.id) {
        await api(`/api/admin/shop/products/${editing.id}`, { method: 'PATCH', body });
      } else {
        await api('/api/admin/shop/products', { method: 'POST', body });
      }
      toast.success(t('products.saved'));
      setEditing(null);
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const patch = async (product, changes) => {
    try {
      await api(`/api/admin/shop/products/${product.id}`, { method: 'PATCH', body: changes });
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const remove = async (product) => {
    if (!window.confirm(t('products.removeConfirm'))) return;
    try {
      const result = await api(`/api/admin/shop/products/${product.id}`, { method: 'DELETE' });
      toast.info(result.archived ? t('products.archivedMsg') : t('products.deleted'));
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader
        title={t('products.title')}
        action={<button onClick={() => openForm()} className="btn-primary"><Plus size={17} /> {t('products.add')}</button>}
      >
        {t('products.subtitle')}
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('products.name')}</th>
              <th className="px-5 py-3">{t('products.price')}</th>
              <th className="px-5 py-3">{t('common.status')}</th>
              <th className="px-5 py-3"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id} className={p.isArchived ? 'opacity-60' : 'hover:bg-sunken/40'}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken text-ink-faint">
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <Gift size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{p.name}</div>
                      <div className="max-w-xs truncate text-xs text-ink-faint">{p.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm"><CoinAmount amount={p.price} className="text-ink" /></td>
                <td className="px-5 py-3">
                  {p.isArchived ? (
                    <span className="rounded-md bg-sunken px-2 py-1 text-xs font-semibold text-ink-faint">{t('products.archived')}</span>
                  ) : (
                    <button
                      onClick={() => patch(p, { isAvailable: !p.isAvailable })}
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${p.isAvailable ? 'bg-moss-tint text-moss' : 'bg-ochre-tint text-ochre'}`}
                    >
                      {p.isAvailable ? t('products.onSale') : t('products.hidden')}
                    </button>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    {p.isArchived ? (
                      <button onClick={() => patch(p, { isArchived: false, isAvailable: true })} aria-label={`${t('products.restore')}: ${p.name}`} className="rounded-lg p-2 text-ink-faint hover:bg-sunken hover:text-ink">
                        <Undo2 size={16} />
                      </button>
                    ) : (
                      <>
                        <button onClick={() => openForm(p)} aria-label={`${t('common.edit')}: ${p.name}`} className="rounded-lg p-2 text-ink-faint hover:bg-sunken hover:text-ink">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(p)} aria-label={`${t('products.remove')}: ${p.name}`} className="rounded-lg p-2 text-ink-faint hover:bg-brick-tint hover:text-brick">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && !loading && (
              <tr>
                <td colSpan="4" className="px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold text-ink">{t('products.empty')}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t('products.emptyHint')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? t('products.editTitle') : t('products.addTitle')} onClose={() => setEditing(null)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="product-name" className="field-label">{t('products.name')}</label>
              <input id="product-name" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
            </div>
            <div>
              <label htmlFor="product-description" className="field-label">{t('products.description')}</label>
              <textarea id="product-description" rows={3} value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product-price" className="field-label">{t('products.price')}</label>
                <input id="product-price" type="number" min="1" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="field" />
              </div>
              <label className="flex items-end gap-2.5 pb-2.5 text-sm text-ink">
                <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} className="h-4 w-4 accent-mars" />
                {t('products.onSale')}
              </label>
            </div>
            <div>
              <span className="field-label">{t('products.image')}</span>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken text-ink-faint">
                  {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : <Gift size={26} />}
                </div>
                <div>
                  <label className="btn-quiet cursor-pointer">
                    <ImagePlus size={16} /> {uploading ? t('common.loading') : t('products.chooseImage')}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} className="sr-only" />
                  </label>
                  <p className="mt-1.5 text-xs text-ink-faint">{t('products.imageHint')}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-quiet">{t('common.cancel')}</button>
              <button type="submit" disabled={!form.name.trim() || !form.price || uploading} className="btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default ShopProducts;
