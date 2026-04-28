// frontend/src/components/TicketToPrint.jsx
import { forwardRef } from "react";

const TicketToPrint = forwardRef(
  ({ saleData, items, storeInfo, config }, ref) => {
    const invoice = config?.invoice || {};
    const system = config?.system || {};

    const formatDate = (date) => {
      if (!date) return "N/A";
      const d = new Date(date);
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    const formatTime = (date) => {
      if (!date) return "N/A";
      const d = new Date(date);
      return d.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };

    const formatCurrency = (amount) => {
      const symbol = system?.currencySymbol || "€";
      const decimals = system?.decimalPlaces || 2;
      const separator = system?.thousandsSeparator || ".";

      let formatted = amount.toFixed(decimals);
      const parts = formatted.split(".");
      if (separator === ".") {
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      } else if (separator === ",") {
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      } else if (separator === " ") {
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      }
      formatted = parts.join(",");

      return `${formatted} ${symbol}`;
    };

    const calculateSubtotal = () => {
      return (
        items?.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        ) || 0
      );
    };

    const subtotal = calculateSubtotal();

    // ✅ Verificar si el IVA está activado
    const showTaxInfo = invoice?.showTaxInfo !== false;
    const taxRate = showTaxInfo ? invoice?.taxRate || 10 : 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    const baseAmount = subtotal;

    return (
      <div ref={ref} className="ticket-print">
        <style>
          {`
          .ticket-print {
            width: ${invoice?.paperSize === "58mm" ? "58mm" : "80mm"};
            margin: 0 auto;
            padding: 8px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            background: white;
            color: black;
          }
          
          .ticket-logo {
            text-align: center;
            margin-bottom: 8px;
          }
          
          .ticket-logo img {
            max-width: 100%;
            max-height: 70px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
          }
          
          .ticket-header {
            text-align: center;
            margin-bottom: 8px;
          }
          
          .ticket-header h2 {
            margin: 3px 0;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
          }
          
          .ticket-header p {
            margin: 2px 0;
            font-size: 10px;
          }
          
          .ticket-divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          
          .ticket-info {
            margin-bottom: 8px;
          }
          
          .ticket-info-row {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            margin: 3px 0;
          }
          
          .ticket-items {
            margin: 8px 0;
          }
          
          .ticket-items table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .ticket-items th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 3px 0;
            font-size: 10px;
          }
          
          .ticket-items td {
            padding: 3px 0;
            font-size: 10px;
            vertical-align: top;
          }
          
          .ticket-items .text-right {
            text-align: right;
          }
          
          .ticket-items .text-center {
            text-align: center;
          }
          
          .ticket-total {
            margin: 8px 0;
          }
          
          .ticket-total-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 12px;
            margin: 3px 0;
          }
          
          .ticket-tax-table {
            width: 100%;
            margin: 5px 0;
            font-size: 9px;
          }
          
          .ticket-tax-table th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 2px 0;
          }
          
          .ticket-tax-table td {
            padding: 2px 0;
          }
          
          .ticket-footer {
            text-align: center;
            margin-top: 10px;
            font-size: 10px;
          }
          
          .ticket-promo {
            text-align: center;
            margin-top: 5px;
            font-size: 9px;
            font-style: italic;
          }
          
          .ticket-website {
            text-align: center;
            margin-top: 5px;
            font-size: 9px;
          }
          
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .ticket-print {
              margin: 0 auto;
            }
            @page {
              size: ${invoice?.paperSize === "58mm" ? "58mm" : "80mm"} auto;
              margin: 0mm;
            }
          }
        `}
        </style>

        {/* ✅ LOGO CENTRADO */}
        {invoice?.logo && (
          <div className="ticket-logo">
            <img src={invoice.logo} alt="Logo" />
          </div>
        )}

        {/* ✅ NOMBRE EMPRESA */}
        <div className="ticket-header">
          <h2>{invoice?.companyName || "CAFÉ UNIVERSAL"}</h2>
          <p>{invoice?.companyAddress || "Avda. Central, 4"}</p>
          {invoice?.companyPhone && <p>{invoice.companyPhone}</p>}
        </div>

        <div className="ticket-divider" />

        {/* ✅ INFORMACIÓN FISCAL Y TICKET */}
        <div className="ticket-info">
          <div className="ticket-info-row">
            {invoice?.companyRuc && invoice.companyRuc.trim() !== "" && (
              <div className="ticket-info-row">
                <span>
                  <strong>{invoice.companyRuc}</strong>
                </span>
              </div>
            )}
          </div>
          <div className="ticket-info-row">
            <span>Le ha atendido: {storeInfo?.cashier || "Jose"}</span>
          </div>
          <div className="ticket-info-row">
            <span>Fecha: {formatDate(saleData?.createdAt)}</span>
          </div>
          <div className="ticket-info-row">
            <span>Hora: {formatTime(saleData?.createdAt)}</span>
          </div>
          <div className="ticket-info-row">
            <span>Ticket N°: {saleData?.saleId || `VENTA-${Date.now()}`}</span>
          </div>
          <div className="ticket-info-row">
            <span>
              Pago:{" "}
              {saleData?.paymentMethod === "cash"
                ? "EFECTIVO"
                : saleData?.paymentMethod === "card"
                  ? "TARJETA"
                  : "TRANSFERENCIA"}
            </span>
          </div>
        </div>

        <div className="ticket-divider" />

        {/* ✅ TABLA DE PRODUCTOS */}
        <div className="ticket-items">
          <table>
            <thead>
              <tr>
                <th>Cant</th>
                <th>Artículo</th>
                <th className="text-right">Prec</th>
                <th className="text-right">Import</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item, index) => (
                <tr key={index}>
                  <td className="text-center">{item.quantity}</td>
                  <td style={{ wordBreak: "break-word" }}>{item.name}</td>
                  <td className="text-right">
                    {formatCurrency(item.unit_price).replace(
                      ` ${system?.currencySymbol || "€"}`,
                      "",
                    )}
                  </td>
                  <td className="text-right">
                    {formatCurrency(item.unit_price * item.quantity).replace(
                      ` ${system?.currencySymbol || "€"}`,
                      "",
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ticket-divider" />

        {/* ✅ TOTAL */}
        <div className="ticket-total">
          <div className="ticket-total-row">
            <span>TOTAL {system?.currency || "EUR"}:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* ✅ DESGLOSE DE IVA - SOLO SI ESTÁ ACTIVADO */}
        {showTaxInfo && (
          <>
            <div className="ticket-divider" />
            <table className="ticket-tax-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">IVA</th>
                  <th className="text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{taxRate}%</td>
                  <td className="text-right">
                    {formatCurrency(baseAmount)
                      .replace(` ${system?.currencySymbol || "€"}`, "")
                      .replace(".", ",")}
                  </td>
                  <td className="text-right">
                    {formatCurrency(taxAmount)
                      .replace(` ${system?.currencySymbol || "€"}`, "")
                      .replace(".", ",")}
                  </td>
                  <td className="text-right">
                    {formatCurrency(total)
                      .replace(` ${system?.currencySymbol || "€"}`, "")
                      .replace(".", ",")}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* ✅ MENSAJE DE AGRADECIMIENTO */}
        <div className="ticket-footer">
          <div className="ticket-divider" />
          <p>
            <strong>
              {invoice?.footerMessage || "Muchas gracias por su visita"}
            </strong>
          </p>
        </div>

        {/* ✅ MENSAJE PROMOCIONAL */}
        {invoice?.promoMessage && (
          <div className="ticket-promo">
            <p>{invoice.promoMessage}</p>
          </div>
        )}

        {/* ✅ SITIO WEB */}
        {invoice?.website && (
          <div className="ticket-website">
            <p>{invoice.website}</p>
          </div>
        )}
      </div>
    );
  },
);

TicketToPrint.displayName = "TicketToPrint";

export default TicketToPrint;
