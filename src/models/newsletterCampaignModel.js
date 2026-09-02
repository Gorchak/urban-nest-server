const NEWSLETTER_TYPE = 'new-products';
const CAMPAIGN_STATUSES = ['processing', 'completed', 'failed'];

const isValidCampaignStatus = (value) => CAMPAIGN_STATUSES.includes(value);

module.exports = { NEWSLETTER_TYPE, CAMPAIGN_STATUSES, isValidCampaignStatus };
