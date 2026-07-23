const { Resend } = require('resend');
const { getMailConfig, getMissingMailConfig } = require('../config/mail');

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatPrice = (value, currency = 'UAH') =>
  `${Number(value || 0).toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${escapeHtml(currency)}`;

const deliveryNames = {
  nova_poshta: '&#1053;&#1086;&#1074;&#1072; &#1087;&#1086;&#1096;&#1090;&#1072;',
  courier: '&#1050;&#1091;&#1088;&#39;&#1108;&#1088;',
  pickup: '&#1057;&#1072;&#1084;&#1086;&#1074;&#1080;&#1074;&#1110;&#1079;',
};

const paymentNames = {
  cash_on_delivery: '&#1055;&#1088;&#1080; &#1086;&#1090;&#1088;&#1080;&#1084;&#1072;&#1085;&#1085;&#1110;',
  bank_transfer: '&#1041;&#1072;&#1085;&#1082;&#1110;&#1074;&#1089;&#1100;&#1082;&#1080;&#1081; &#1087;&#1077;&#1088;&#1077;&#1082;&#1072;&#1079;',
  card: '&#1050;&#1072;&#1088;&#1090;&#1082;&#1086;&#1102;',
  google_pay: 'Google Pay',
  online: '&#1054;&#1085;&#1083;&#1072;&#1081;&#1085;',
};

const renderItems = (sale) => sale.items.map((item) => {
  const option = item.inventoryValueLabel
    ? `<div style="margin-top:5px;color:#777;font-size:12px">${escapeHtml(item.inventoryValueLabel)}</div>`
    : '';
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" width="56" height="70" alt="" style="display:block;width:56px;height:70px;object-fit:cover;border-radius:4px">`
    : '<div style="width:56px;height:70px;background:#eee;border-radius:4px"></div>';

  return `
    <tr>
      <td style="padding:14px 8px 14px 0;border-bottom:1px solid #ece8e1;width:56px">${image}</td>
      <td style="padding:14px 8px;border-bottom:1px solid #ece8e1">
        <div style="font-weight:700">${escapeHtml(item.name)}</div>${option}
      </td>
      <td style="padding:14px 8px;border-bottom:1px solid #ece8e1;text-align:center;white-space:nowrap">${item.quantity} &#1096;&#1090;.</td>
      <td style="padding:14px 0 14px 8px;border-bottom:1px solid #ece8e1;text-align:right;font-weight:700;white-space:nowrap">${formatPrice(item.totalPrice, sale.currency)}</td>
    </tr>`;
}).join('');

const renderDeliveryAddress = (address = {}) => [
  address.region,
  address.city,
  address.warehouse,
  address.street,
  address.building,
  address.apartment,
].filter(Boolean).map(escapeHtml).join(', ');

const renderOrderEmail = (sale) => {
  const deliveryName = deliveryNames[sale.shippingAddress?.deliveryService]
    || escapeHtml(sale.shippingAddress?.deliveryService);
  const paymentName = paymentNames[sale.payment?.method] || escapeHtml(sale.payment?.method);
  const customerName = [sale.customer?.firstName, sale.customer?.lastName].filter(Boolean).map(escapeHtml).join(' ');

  return `<!doctype html>
  <html lang="uk">
  <body style="margin:0;background:#f3f0e9;color:#1d1d1a;font-family:Arial,sans-serif">
    <div style="padding:32px 12px">
      <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e0d7">
        <div style="padding:34px;background:#1d1d1a;color:#fff">
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Urban Nest / &#1053;&#1086;&#1074;&#1077; &#1079;&#1072;&#1084;&#1086;&#1074;&#1083;&#1077;&#1085;&#1085;&#1103;</div>
          <h1 style="margin:16px 0 8px;font-family:Georgia,serif;font-size:38px;font-weight:400">&#1047;&#1072;&#1084;&#1086;&#1074;&#1083;&#1077;&#1085;&#1085;&#1103; ${escapeHtml(sale.orderNumber)}</h1>
          <div style="color:#d9d4ca">&#1044;&#1103;&#1082;&#1091;&#1108;&#1084;&#1086; &#1079;&#1072; &#1087;&#1086;&#1082;&#1091;&#1087;&#1082;&#1091;. &#1047;&#1072;&#1084;&#1086;&#1074;&#1083;&#1077;&#1085;&#1085;&#1103; &#1087;&#1088;&#1080;&#1081;&#1085;&#1103;&#1090;&#1086;, &#1086;&#1095;&#1110;&#1082;&#1091;&#1081;&#1090;&#1077; &#1085;&#1072; &#1076;&#1086;&#1089;&#1090;&#1072;&#1074;&#1082;&#1091;.</div>
        </div>

        <div style="padding:30px">
          <table role="presentation" style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:0 12px 18px 0;vertical-align:top">
                <div style="margin-bottom:7px;color:#777;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">&#1055;&#1086;&#1082;&#1091;&#1087;&#1077;&#1094;&#1100;</div>
                <div style="line-height:1.6">${customerName || '&#1053;&#1077; &#1074;&#1082;&#1072;&#1079;&#1072;&#1085;&#1086;'}<br>${escapeHtml(sale.customer?.phone)}<br>${escapeHtml(sale.customer?.email)}</div>
              </td>
              <td style="padding:0 0 18px 12px;vertical-align:top">
                <div style="margin-bottom:7px;color:#777;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">&#1044;&#1086;&#1089;&#1090;&#1072;&#1074;&#1082;&#1072;</div>
                <div style="line-height:1.6">${deliveryName}<br>${renderDeliveryAddress(sale.shippingAddress) || '&#1040;&#1076;&#1088;&#1077;&#1089;&#1091; &#1085;&#1077; &#1074;&#1082;&#1072;&#1079;&#1072;&#1085;&#1086;'}</div>
              </td>
            </tr>
          </table>

          <h2 style="margin:18px 0 6px;font-family:Georgia,serif;font-size:25px;font-weight:400">&#1058;&#1086;&#1074;&#1072;&#1088;&#1080;</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse">${renderItems(sale)}</table>

          <table role="presentation" style="width:100%;margin-top:22px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#777">&#1057;&#1087;&#1086;&#1089;&#1110;&#1073; &#1086;&#1087;&#1083;&#1072;&#1090;&#1080;</td><td style="padding:6px 0;text-align:right">${paymentName}</td></tr>
            <tr><td style="padding:14px 0 0;font-size:20px;font-weight:700">&#1057;&#1091;&#1084;&#1072; &#1079;&#1072;&#1084;&#1086;&#1074;&#1083;&#1077;&#1085;&#1085;&#1103;</td><td style="padding:14px 0 0;color:#c85436;text-align:right;font-size:24px;font-weight:700">${formatPrice(sale.grandTotal, sale.currency)}</td></tr>
          </table>

          ${sale.notes ? `<div style="margin-top:24px;padding:16px;background:#f6f3ed"><b>&#1050;&#1086;&#1084;&#1077;&#1085;&#1090;&#1072;&#1088;:</b> ${escapeHtml(sale.notes)}</div>` : ''}
          <div style="margin-top:16px;color:#777;font-size:13px">&#1055;&#1110;&#1076;&#1090;&#1074;&#1077;&#1088;&#1076;&#1078;&#1077;&#1085;&#1085;&#1103; &#1090;&#1077;&#1083;&#1077;&#1092;&#1086;&#1085;&#1086;&#1084;: ${sale.doNotCall ? '&#1085;&#1077; &#1087;&#1077;&#1088;&#1077;&#1076;&#1079;&#1074;&#1086;&#1085;&#1102;&#1074;&#1072;&#1090;&#1080;' : '&#1087;&#1077;&#1088;&#1077;&#1076;&#1079;&#1074;&#1086;&#1085;&#1080;&#1090;&#1080;'}</div>
        </div>

        <div style="padding:20px 30px;background:#ebe6dc;color:#665f55;font-size:12px;text-align:center">
          Urban Nest &middot; &#1044;&#1103;&#1082;&#1091;&#1108;&#1084;&#1086;, &#1097;&#1086; &#1086;&#1073;&#1080;&#1088;&#1072;&#1108;&#1090;&#1077; &#1085;&#1072;&#1089;
        </div>
      </div>
    </div>
  </body>
  </html>`;
};

const renderOrderText = (sale) => [
  `New order ${sale.orderNumber}`,
  `Customer: ${sale.customer?.firstName || ''} ${sale.customer?.lastName || ''}`,
  `Phone: ${sale.customer?.phone || ''}`,
  `Email: ${sale.customer?.email || ''}`,
  ...sale.items.map((item) => `${item.name} x ${item.quantity}: ${formatPrice(item.totalPrice, sale.currency)}`),
  `Total: ${formatPrice(sale.grandTotal, sale.currency)}`,
].join('\n');

const sendOrderNotification = async (sale) => {
  const config = getMailConfig();
  const missing = getMissingMailConfig(config);
  if (missing.length) {
    console.warn(`Order email skipped: missing configuration: ${missing.join(', ')}`);
    return { sent: false, reason: 'not_configured', missing };
  }

  const resend = new Resend(config.apiKey);
  const { data, error } = await resend.emails.send({
    from: config.from,
    to: config.adminOrderEmail,
    replyTo: sale.customer?.email || undefined,
    subject: `New order ${sale.orderNumber} - ${formatPrice(sale.grandTotal, sale.currency)}`,
    text: renderOrderText(sale),
    html: renderOrderEmail(sale),
  }, {
    idempotencyKey: `order-${sale.orderNumber}`,
  });
  if (error) {
    throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
  }

  return { sent: true, messageId: data.id, recipient: config.adminOrderEmail };
};

module.exports = { sendOrderNotification, renderOrderEmail, renderOrderText };
