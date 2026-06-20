import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState(null);
  
  // Modal viewer state
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/sales`;
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve sales log.');
      const data = await response.json();
      setSales(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSaleDetails = async (saleId) => {
    setDetailsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/${saleId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load transaction details.');
      const data = await response.json();
      setSaleDetails(data);
    } catch (err) {
      alert(err.message);
      setSelectedSale(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate]);

  const openReceipt = (sale) => {
    setSelectedSale(sale);
    fetchSaleDetails(sale.id);
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Sales Transactions</h2>
        <p className="text-sm text-slate-500">Search and audit invoice histories, payment logs, and totals</p>
      </div>

      {/* Date Filters bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-xs">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-500 uppercase">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-500 uppercase">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-xs font-semibold text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 transition-colors"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Sales Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="p-4">Invoice ID</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Cashier</th>
                <th className="p-4">Method</th>
                <th className="p-4 text-right">Total Final</th>
                <th className="p-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-400">
                    No matching sales transactions found.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-700">#{sale.id}</td>
                    <td className="p-4 text-slate-500">{new Date(sale.created_at).toLocaleString()}</td>
                    <td className="p-4 text-slate-800 font-medium">{sale.customer_name || 'Walk-in Customer'}</td>
                    <td className="p-4 text-slate-600">{sale.staff_name}</td>
                    <td className="p-4">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {sale.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right font-extrabold text-indigo-600">${parseFloat(sale.final_amount).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => openReceipt(sale)}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- DETAILED RECEIPT VIEWER MODAL --- */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
            
            {detailsLoading ? (
              <div className="py-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
            ) : saleDetails ? (
              <div className="flex flex-col">
                <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Transaction Details</h3>
                    <p className="text-xs text-slate-400">Invoice: #{saleDetails.id}</p>
                  </div>
                  <button onClick={() => { setSelectedSale(null); setSaleDetails(null); }} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="my-4 space-y-1 bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="font-semibold text-slate-800">{new Date(saleDetails.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier Staff:</span>
                    <span className="font-semibold text-slate-800">{saleDetails.staff_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Profile:</span>
                    <span className="font-semibold text-slate-800">{saleDetails.customer_name || 'Walk-in Customer'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-slate-800 uppercase">{saleDetails.payment_method.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Items list */}
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Checkout Cart Items</h4>
                <div className="flex-1 overflow-y-auto max-h-40 divide-y divide-slate-100 pr-1">
                  {saleDetails.items?.map(item => (
                    <div key={item.id} className="py-2.5 flex justify-between text-xs text-slate-700">
                      <div>
                        <p className="font-semibold text-slate-800">{item.product_name}</p>
                        <span className="text-[10px] text-slate-400">{item.product_sku} (x{item.quantity} @ ${item.unit_price})</span>
                      </div>
                      <span className="font-bold text-slate-800">${parseFloat(item.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="border-t border-slate-100 pt-3 mt-2 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${parseFloat(saleDetails.total_amount).toFixed(2)}</span>
                  </div>
                  {parseFloat(saleDetails.discount) > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount deduction:</span>
                      <span>-${parseFloat(saleDetails.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Tax (10%):</span>
                    <span>${parseFloat(saleDetails.tax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-slate-800 border-t border-slate-200/60 pt-2">
                    <span>Final Amount Paid:</span>
                    <span className="text-indigo-600">${parseFloat(saleDetails.final_amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Print button */}
                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-sm transition-colors"
                  >
                    Print Invoice
                  </button>
                  <button
                    onClick={() => { setSelectedSale(null); setSaleDetails(null); }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400">Failed to render details.</div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
