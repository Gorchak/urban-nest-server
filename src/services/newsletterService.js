const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { Resend } = require('resend');
const { collections } = require('../config/collections');
const { getMailConfig } = require('../config/mail');
const { normalizeEmail, validateEmail } = require('../models/newsletterSubscriberModel');
const { NEWSLETTER_TYPE: TYPE } = require('../models/newsletterCampaignModel');

const BATCH_SIZE = 20;
const publicProductFilter = { isNewArrival: true, isActive: { $ne: false }, isVisible: { $ne: false }, deletedAt: null };
const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const subscribe = async (rawEmail) => {
  const email = normalizeEmail(rawEmail);
  if (!validateEmail(email)) return { status: 400, code: 'INVALID_EMAIL' };
  const existing = await collections.NEWSLETTER_SUBSCRIBERS.findOne({ email });
  if (existing?.isActive) return { status: 409, code: 'ALREADY_SUBSCRIBED' };
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  try {
    await collections.NEWSLETTER_SUBSCRIBERS.updateOne(
      { email },
      { $set: { email, isActive: true, subscribedAt: now, unsubscribedAt: null, unsubscribeTokenHash: tokenHash(token), updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
  } catch (error) {
    // A simultaneous request may win the unique-email upsert race.
    if (error.code === 11000) return { status: 409, code: 'ALREADY_SUBSCRIBED' };
    throw error;
  }
  return { status: 201, code: 'SUBSCRIBED' };
};

const unsubscribe = async (token) => {
  if (!token || typeof token !== 'string' || token.length > 200) return false;
  const now = new Date();
  const result = await collections.NEWSLETTER_SUBSCRIBERS.updateOne(
    { unsubscribeTokenHash: tokenHash(token), isActive: true },
    { $set: { isActive: false, unsubscribedAt: now, updatedAt: now } }
  );
  return result.modifiedCount > 0;
};

const getSubscriptionStatus = async (rawEmail) => {
  const email = normalizeEmail(rawEmail);
  if (!validateEmail(email)) return { isSubscribed: false };
  const subscriber = await collections.NEWSLETTER_SUBSCRIBERS.findOne(
    { email },
    { projection: { isActive: 1 } }
  );
  return { isSubscribed: subscriber?.isActive === true };
};

const setSubscriptionPreference = async (rawEmail, enabled) => {
  const email = normalizeEmail(rawEmail);
  if (!validateEmail(email)) {
    const error = new Error('Вкажіть коректну email-адресу для підписки.');
    error.statusCode = 400;
    throw error;
  }
  if (enabled) {
    const result = await subscribe(email);
    if (result.code === 'ALREADY_SUBSCRIBED') return { isSubscribed: true, alreadySubscribed: true };
    if (result.status >= 400) {
      const error = new Error('Не вдалося оформити підписку.');
      error.statusCode = result.status;
      throw error;
    }
    return { isSubscribed: true, alreadySubscribed: false };
  }
  const now = new Date();
  await collections.NEWSLETTER_SUBSCRIBERS.updateOne(
    { email, isActive: true },
    { $set: { isActive: false, unsubscribedAt: now, updatedAt: now } }
  );
  return { isSubscribed: false };
};

const getSubscribers = async ({ page = 1, limit = 50 } = {}) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const [data, total] = await Promise.all([
    collections.NEWSLETTER_SUBSCRIBERS.find({}, { projection: { unsubscribeTokenHash: 0 } })
      .sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).toArray(),
    collections.NEWSLETTER_SUBSCRIBERS.countDocuments(),
  ]);
  return { data, pagination: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } };
};

const deleteSubscriber = async (id) => {
  if (!ObjectId.isValid(id)) {
    const error = new Error('Некоректний ідентифікатор підписника.');
    error.statusCode = 400;
    throw error;
  }
  const result = await collections.NEWSLETTER_SUBSCRIBERS.deleteOne({ _id: new ObjectId(id) });
  if (!result.deletedCount) {
    const error = new Error('Підписника не знайдено.');
    error.statusCode = 404;
    throw error;
  }
};

const getSentProductIds = async () => {
  const rows = await collections.NEWSLETTER_CAMPAIGNS.find({ type: TYPE, status: 'completed' }, { projection: { productIds: 1 } }).toArray();
  return rows.flatMap((row) => row.productIds || []);
};

const getNewProducts = async () => {
  const sentIds = await getSentProductIds();
  const filter = { ...publicProductFilter };
  if (sentIds.length) filter._id = { $nin: sentIds.map((id) => id instanceof ObjectId ? id : new ObjectId(id)) };
  return collections.MERCHANDISE.find(filter).sort({ createdAt: 1 }).toArray();
};

const preview = async () => {
  const [products, subscribersCount, totalSubscribers, lastCampaign, campaigns] = await Promise.all([
    getNewProducts(),
    collections.NEWSLETTER_SUBSCRIBERS.countDocuments({ isActive: true }),
    collections.NEWSLETTER_SUBSCRIBERS.countDocuments(),
    collections.NEWSLETTER_CAMPAIGNS.findOne({ type: TYPE, status: 'completed' }, { sort: { completedAt: -1 } }),
    collections.NEWSLETTER_CAMPAIGNS.find({ type: TYPE }).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);
  return { newProductsCount: products.length, subscribersCount, totalSubscribers, products: products.slice(0, 10), lastCampaign, campaigns };
};

const renderNewsletter = (products, token) => {
  const site = (process.env.FRONTEND_URL || 'https://uliastore.com.ua').replace(/\/$/, '');
  const cards = products.slice(0, 8).map((p) => `<tr><td style="padding:18px 0;border-bottom:1px solid #ddd"><img src="${escapeHtml(p.images?.[0] || '')}" alt="" style="width:110px;height:140px;object-fit:cover;float:left;margin-right:18px"><h2 style="margin:5px 0;font:24px Georgia,serif">${escapeHtml(p.name)}</h2><p>${escapeHtml(p.shortDescription || '')}</p><b>${Number(p.salePrice || p.retailPrice || 0).toLocaleString('uk-UA')} ${escapeHtml(p.currency || 'UAH')}</b><br><a href="${site}/product/${encodeURIComponent(p.slug)}" style="color:#111">Переглянути</a></td></tr>`).join('');
  const unsubscribeUrl = `${site}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  return `<!doctype html><html lang="uk"><body style="margin:0;background:#f3f0e9;font-family:Arial,sans-serif;color:#1d1d1a"><div style="max-width:680px;margin:auto;padding:24px"><div style="background:#fff;padding:30px"><h1 style="font:40px Georgia,serif">Новинки в нашому магазині</h1><p>Ми додали нові товари, які можуть вас зацікавити.</p><table role="presentation" style="width:100%;border-collapse:collapse">${cards}</table><p style="text-align:center;margin:30px"><a href="${site}/new-arrivals" style="background:#111;color:#fff;padding:14px 22px;text-decoration:none">Переглянути всі новинки</a></p><p style="font-size:12px;color:#666">Ви отримали цей лист, тому що підписались на оновлення магазину. <a href="${unsubscribeUrl}">Відписатися від розсилки</a></p></div></div></body></html>`;
};

const deliverNewsletter = async ({ campaignId, products, subscribers, attempt = 0 }) => {
  const config = getMailConfig();
  if (!config.apiKey || !config.newsletterFrom) throw new Error('Newsletter email configuration is missing');
  const resend = new Resend(config.apiKey);
  const failedSubscriberIds = [];
  const failureMessages = [];
  let sent = 0;
  for (let offset = 0; offset < subscribers.length; offset += BATCH_SIZE) {
    const batch = subscribers.slice(offset, offset + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (subscriber) => {
      const token = crypto.randomBytes(32).toString('base64url');
      await collections.NEWSLETTER_SUBSCRIBERS.updateOne({ _id: subscriber._id }, { $set: { unsubscribeTokenHash: tokenHash(token), updatedAt: new Date() } });
      const site = (process.env.FRONTEND_URL || 'https://uliastore.com.ua').replace(/\/$/, '');
      const unsubscribeUrl = `${site}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
      const suffix = attempt > 0 ? `-retry-${attempt}` : '';
      const result = await resend.emails.send({ from: config.newsletterFrom, to: subscriber.email, subject: 'Новинки в ULIA STORE', html: renderNewsletter(products, token), text: `Новинки в ULIA STORE: ${site}/new-arrivals\n\nВідписатися від розсилки: ${unsubscribeUrl}` }, { idempotencyKey: `newsletter-${campaignId}-${subscriber._id}${suffix}` });
      if (result.error) throw new Error(result.error.message || 'Resend error');
      await collections.NEWSLETTER_SUBSCRIBERS.updateOne({ _id: subscriber._id }, { $set: { lastEmailSentAt: new Date(), updatedAt: new Date() } });
    }));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') sent += 1;
      else {
        failedSubscriberIds.push(batch[index]._id);
        failureMessages.push(String(result.reason?.message || result.reason || 'Невідома помилка'));
      }
    });
  }
  const grouped = failureMessages.reduce((acc, message) => acc.set(message, (acc.get(message) || 0) + 1), new Map());
  const error = [...grouped.entries()].map(([message, count]) => `${count} × ${message}`).join('; ').slice(0, 1000) || null;
  return { sent, failed: failedSubscriberIds.length, failedSubscriberIds, error };
};

const sendNewProductsNewsletter = async () => {
  const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await collections.NEWSLETTER_CAMPAIGNS.updateMany(
    { type: TYPE, status: 'processing', startedAt: { $lt: staleBefore } },
    { $set: { status: 'failed', error: 'Campaign timed out before completion', completedAt: new Date(), updatedAt: new Date() } }
  );
  const products = await getNewProducts();
  if (!products.length) return { sent: false, reason: 'NO_NEW_PRODUCTS' };
  const now = new Date();
  let campaign;
  try {
    const inserted = await collections.NEWSLETTER_CAMPAIGNS.insertOne({ type: TYPE, startedAt: now, status: 'processing', productIds: products.map((p) => p._id), subscribersCount: 0, emailsSent: 0, emailsFailed: 0, createdAt: now, updatedAt: now });
    campaign = inserted.insertedId;
  } catch (error) {
    if (error.code === 11000) return { sent: false, reason: 'ALREADY_PROCESSING' };
    throw error;
  }
  try {
    const subscribers = await collections.NEWSLETTER_SUBSCRIBERS.find({ isActive: true }).toArray();
    const delivery = await deliverNewsletter({ campaignId: campaign, products, subscribers });
    const completedAt = new Date();
    await collections.NEWSLETTER_CAMPAIGNS.updateOne({ _id: campaign }, { $set: { status: 'completed', completedAt, subscribersCount: subscribers.length, emailsSent: delivery.sent, emailsFailed: delivery.failed, failedSubscriberIds: delivery.failedSubscriberIds, error: delivery.error, updatedAt: completedAt } });
    return { sent: true, emailsSent: delivery.sent, emailsFailed: delivery.failed, productsCount: products.length, error: delivery.error };
  } catch (error) {
    await collections.NEWSLETTER_CAMPAIGNS.updateOne({ _id: campaign }, { $set: { status: 'failed', error: String(error.message).slice(0, 1000), completedAt: new Date(), updatedAt: new Date() } });
    throw error;
  }
};

const retryCampaign = async (id) => {
  if (!ObjectId.isValid(id)) {
    const error = new Error('Некоректний ідентифікатор кампанії.'); error.statusCode = 400; throw error;
  }
  const campaignId = new ObjectId(id);
  const campaign = await collections.NEWSLETTER_CAMPAIGNS.findOne({ _id: campaignId, type: TYPE });
  if (!campaign) { const error = new Error('Кампанію не знайдено.'); error.statusCode = 404; throw error; }
  if (campaign.status !== 'failed' && !(campaign.emailsFailed > 0)) {
    const error = new Error('Ця кампанія не має помилок для повторної відправки.'); error.statusCode = 409; throw error;
  }
  const subscriberFilter = { isActive: true };
  if (campaign.failedSubscriberIds?.length) subscriberFilter._id = { $in: campaign.failedSubscriberIds };
  const [products, subscribers] = await Promise.all([
    collections.MERCHANDISE.find({ _id: { $in: campaign.productIds || [] } }).toArray(),
    collections.NEWSLETTER_SUBSCRIBERS.find(subscriberFilter).toArray(),
  ]);
  if (!products.length) { const error = new Error('Товари цієї кампанії більше не знайдені.'); error.statusCode = 409; throw error; }
  const attempt = (campaign.retryAttempts || 0) + 1;
  try {
    const claimed = await collections.NEWSLETTER_CAMPAIGNS.updateOne(
      { _id: campaignId, status: campaign.status, emailsFailed: campaign.emailsFailed },
      { $set: { status: 'processing', startedAt: new Date(), updatedAt: new Date() }, $inc: { retryAttempts: 1 } }
    );
    if (!claimed.modifiedCount) return { sent: false, reason: 'ALREADY_PROCESSING' };
  } catch (error) {
    if (error.code === 11000) return { sent: false, reason: 'ALREADY_PROCESSING' };
    throw error;
  }
  try {
    const delivery = await deliverNewsletter({ campaignId, products, subscribers, attempt });
    const completedAt = new Date();
    await collections.NEWSLETTER_CAMPAIGNS.updateOne({ _id: campaignId }, { $set: { status: 'completed', completedAt, emailsSent: (campaign.emailsSent || 0) + delivery.sent, emailsFailed: delivery.failed, failedSubscriberIds: delivery.failedSubscriberIds, error: delivery.error, updatedAt: completedAt } });
    return { sent: true, emailsSent: delivery.sent, emailsFailed: delivery.failed, productsCount: products.length, error: delivery.error, retried: true };
  } catch (error) {
    await collections.NEWSLETTER_CAMPAIGNS.updateOne({ _id: campaignId }, { $set: { status: 'failed', error: String(error.message).slice(0, 1000), completedAt: new Date(), updatedAt: new Date() } });
    throw error;
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  getSubscriptionStatus,
  setSubscriptionPreference,
  getSubscribers,
  deleteSubscriber,
  preview,
  sendNewProductsNewsletter,
  retryCampaign,
  renderNewsletter,
  getNewProducts,
};
