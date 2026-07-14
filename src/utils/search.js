const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toSearchStem = (value) => {
  const token = String(value || '').toLocaleLowerCase('uk-UA').trim();
  if (token.length < 4) return token;
  const suffixes = ['ями', 'ами', 'ого', 'ому', 'ими', 'ої', 'ій', 'ий', 'а', 'я', 'и', 'і', 'у', 'ю', 'е'];
  const suffix = suffixes.find((item) => token.endsWith(item) && token.length - item.length >= 3);
  return suffix ? token.slice(0, -suffix.length) : token;
};

const searchTerms = (value) => String(value || '')
  .toLocaleLowerCase('uk-UA')
  .replace(/[’'`]/g, '')
  .split(/[^a-zа-яіїєґ0-9]+/i)
  .map(toSearchStem)
  .filter(Boolean);

module.exports = { escapeRegex, toSearchStem, searchTerms };
