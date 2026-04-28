// frontend/src/components/MoneyDisplay.jsx
import { useConfig } from "../context/ConfigContext";
import { formatCurrency } from "../utils/formatters";

export default function MoneyDisplay({ amount }) {
  const { config } = useConfig();
  // Aseguramos que amount sea un número válido, si no, 0
  const safeAmount = parseFloat(amount) || 0;
  return (
    <span className="whitespace-nowrap">
      {formatCurrency(safeAmount, config)}
    </span>
  );
}