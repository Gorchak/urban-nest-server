const { escapeRegex, searchTerms, toSearchStem } = require('./search');

describe('catalog search helpers', () => {
  test('normalizes Ukrainian singular and plural forms to the same stem', () => {
    expect(toSearchStem('сумка')).toBe('сумк');
    expect(toSearchStem('Сумки')).toBe('сумк');
  });

  test('splits a phrase and normalizes apostrophes', () => {
    expect(searchTerms("Жіноча сумка")).toEqual(['жіноч', 'сумк']);
  });

  test('escapes user input before constructing a regular expression', () => {
    expect(escapeRegex('bag (mini)+')).toBe('bag \\(mini\\)\\+');
  });
});
