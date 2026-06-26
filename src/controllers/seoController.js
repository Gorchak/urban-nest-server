const seoService = require('../services/seoService');
const asyncHandler = require('../utils/asyncHandler');

const getSitemap = asyncHandler(async (req, res) => {
  const xml = await seoService.getSitemapXml();
  res.type('application/xml').send(xml);
});

const getRobots = asyncHandler(async (req, res) => {
  res.type('text/plain').send(seoService.getRobotsTxt());
});

module.exports = {
  getSitemap,
  getRobots,
};
