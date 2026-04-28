export const formatCurrency = (value, config) => {
  const num = parseFloat(value) || 0;
  const system = config?.system || {};
  const {
    currencySymbol = '$',
    thousandsSeparator = ',',
    decimalPlaces = 2
  } = system;

  const fixed = num.toFixed(decimalPlaces);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
  return `${currencySymbol} ${parts.join('.')}`.trim();
};