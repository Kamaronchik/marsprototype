const crypto = require('crypto');
const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid, isPositiveInt } = require('../utils/validate');
const { logAction } = require('../utils/audit');

const BUCKET = 'shop-products';
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const COLUMNS = 'id, name, description, image_url, price, is_available, is_archived, created_at';

const toClient = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  imageUrl: p.image_url,
  price: p.price,
  isAvailable: p.is_available,
  isArchived: p.is_archived,
  createdAt: p.created_at,
});

const validate = ({ name, description, price, imageUrl, isAvailable, isArchived }, { partial }) => {
  if (!partial || name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) return 'Name: 1-100 characters';
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > 1000)) {
    return 'Description: up to 1000 characters';
  }
  if (!partial || price !== undefined) {
    if (!isPositiveInt(price)) return 'Price must be a positive whole number of coins';
  }
  if (imageUrl !== undefined && imageUrl !== null && !/^https:\/\/\S+$/.test(imageUrl)) {
    return 'Image must be an https link';
  }
  if (isAvailable !== undefined && typeof isAvailable !== 'boolean') return 'isAvailable must be true or false';
  if (isArchived !== undefined && typeof isArchived !== 'boolean') return 'isArchived must be true or false';
  return null;
};

const listProducts = async (req, res) => {
  const { data, error } = await supabase
    .from('products').select(COLUMNS).order('created_at', { ascending: false });
  if (error) return handleDbError(error, res);
  res.json({ products: data.map(toClient) });
};

const createProduct = async (req, res) => {
  const { name, description, price, imageUrl, isAvailable } = req.body;
  const problem = validate({ name, description, price, imageUrl, isAvailable }, { partial: false });
  if (problem) return res.status(400).json({ message: problem });

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: name.trim(),
      description: description ? description.trim() : '',
      price,
      image_url: imageUrl || null,
      is_available: isAvailable ?? true,
    })
    .select(COLUMNS)
    .single();
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'product.create', 'product', data.id, { name: data.name, price: data.price });
  res.status(201).json({ product: toClient(data) });
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, imageUrl, isAvailable, isArchived } = req.body;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid product id' });

  const problem = validate({ name, description, price, imageUrl, isAvailable, isArchived }, { partial: true });
  if (problem) return res.status(400).json({ message: problem });

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (price !== undefined) updates.price = price;
  if (imageUrl !== undefined) updates.image_url = imageUrl;
  if (isAvailable !== undefined) updates.is_available = isAvailable;
  if (isArchived !== undefined) updates.is_archived = isArchived;
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nothing to update' });

  const { data, error } = await supabase
    .from('products').update(updates).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Product not found' });

  await logAction(req.user.id, 'product.update', 'product', id, updates);
  res.json({ product: toClient(data) });
};

// A product with order history is archived, never deleted: old orders keep their data.
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid product id' });

  const { count, error: countError } = await supabase
    .from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id);
  if (countError) return handleDbError(countError, res);

  if (count > 0) {
    const { data, error } = await supabase
      .from('products')
      .update({ is_archived: true, is_available: false })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return handleDbError(error, res);
    if (!data) return res.status(404).json({ message: 'Product not found' });

    await logAction(req.user.id, 'product.archive', 'product', id);
    return res.json({ message: 'Product archived', archived: true });
  }

  const { data, error } = await supabase.from('products').delete().eq('id', id).select('id').maybeSingle();
  if (error) return handleDbError(error, res);
  if (!data) return res.status(404).json({ message: 'Product not found' });

  await logAction(req.user.id, 'product.delete', 'product', id);
  res.json({ message: 'Product deleted', archived: false });
};

// The browser sends the raw image (PNG, JPEG or WebP, up to 2 MB); the answer is its public link.
const uploadImage = async (req, res) => {
  const extension = IMAGE_TYPES[req.headers['content-type']];
  if (!extension || !Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ message: 'Send a PNG, JPEG or WebP image' });
  }

  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, req.body, { contentType: req.headers['content-type'] });
  if (error) return handleDbError(error, res);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  res.status(201).json({ imageUrl: data.publicUrl });
};

module.exports = { listProducts, createProduct, updateProduct, deleteProduct, uploadImage };
