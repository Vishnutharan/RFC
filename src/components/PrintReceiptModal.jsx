import { X, Printer } from 'lucide-react';

const getOrderItemName = (item) => item.name || item.item?.name || 'Menu item';
const getOrderItemUnitPrice = (item) => Number(item.price ?? item.unitPrice ?? item.item?.price ?? 0);

export default function PrintReceiptModal({ isOpen, onClose, order }) {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const subtotal = order.subtotal || order.total || 0;
  const discount = order.discountAmount || 0;
  const deliveryFee = order.deliveryFee || 0;
  const total = order.total || subtotal - discount + deliveryFee;

  return (
    <div className="modal-overlay print-modal-overlay" onClick={onClose}>
      <div className="modal-card print-modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Actions (Hidden during print via CSS @media print) */}
        <div className="modal-header no-print">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={18} /> Receipt Preview
          </h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* PRINTABLE RECEIPT CONTENT */}
        <div className="printable-receipt-content" style={{ padding: '24px', background: '#FFF', fontFamily: 'monospace', color: '#000' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>RFC WATFORD</h2>
            <p style={{ fontSize: '0.8rem' }}>119 Courtlands Drive, Watford WD17 4HZ</p>
            <p style={{ fontSize: '0.8rem' }}>Tel: +44 1923 961864</p>
            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>VAT Reg: GB 982 120 441</p>
          </div>

          {/* Meta details */}
          <div style={{ fontSize: '0.82rem', marginBottom: '12px', borderBottom: '1px dashed #000', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ORDER NO:</span>
              <strong style={{ fontSize: '1rem' }}>#{order.orderNumber}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span>TYPE:</span>
              <strong style={{ textTransform: 'uppercase' }}>{order.orderType || 'DELIVERY'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span>DATE:</span>
              <span>{order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span>CUSTOMER:</span>
              <span>{order.customerName || 'Walk-in Customer'}</span>
            </div>
            {order.customerPhone && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>PHONE:</span>
                <span>{order.customerPhone}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dotted #ccc' }}>
                <span>ADDRESS:</span>
                <p style={{ fontWeight: 'bold' }}>{order.deliveryAddress}</p>
              </div>
            )}
          </div>

          {/* Items breakdown */}
          <div style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '6px' }}>
              <span>QTY ITEM</span>
              <span>AMOUNT</span>
            </div>
            {order.items && order.items.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.quantity}x {getOrderItemName(item)}</span>
                  <span>£{(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                </div>
                {item.options && item.options.length > 0 && (
                  <div style={{ fontSize: '0.75rem', paddingLeft: '14px', color: '#444' }}>
                    + {item.options.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary Totals */}
          <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SUBTOTAL:</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DISCOUNT ({order.voucherCode || 'PROMO'}):</span>
                <span>-£{discount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>DELIVERY FEE:</span>
              <span>{deliveryFee === 0 ? 'FREE' : `£${deliveryFee.toFixed(2)}`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', borderTop: '2px solid #000', marginTop: '6px', paddingTop: '6px' }}>
              <span>TOTAL PAID:</span>
              <span>£{total.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '4px' }}>
              <span>PAYMENT METHOD:</span>
              <span style={{ textTransform: 'uppercase' }}>{order.paymentMethod || 'CARD'}</span>
            </div>
          </div>

          {/* Footer Barcode / Thank you */}
          <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px dashed #000', paddingTop: '10px', fontSize: '0.75rem' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>THANK YOU FOR YOUR ORDER!</p>
            <p>Order online at www.rfcchickenwatford.com</p>
            <div style={{ letterSpacing: '4px', fontSize: '1.2rem', margin: '8px 0', fontFamily: 'monospace' }}>
              ||| | ||||| |||| | |||| |||
            </div>
          </div>
        </div>

        {/* Modal Footer Actions (Hidden during print) */}
        <div className="modal-footer no-print" style={{ gap: '10px' }}>
          <button className="btn-back" onClick={onClose} style={{ flex: 1 }}>Close</button>
          <button className="btn-submit-modal" onClick={handlePrint} style={{ flex: 2 }}>
            <Printer size={16} /> Print Receipt / Docket
          </button>
        </div>
      </div>
    </div>
  );
}
