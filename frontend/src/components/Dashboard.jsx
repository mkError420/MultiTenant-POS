import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    total_sales: 0,
    revenue: '0.00',
    total_products: 0,
    low_stock_alerts: 0,
    total_customers: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch analytics.');
      const data = await response.json();
      
      if (data.metrics) {
        setMetrics(data.metrics);
      }
      if (data.recent_sales) {
        setRecentSales(data.recent_sales);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 text-rose-600 border border-rose-100 rounded-xl p-4 text-center">
        Error loading analytics: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Header Row */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Shop Overview</h2>
        <p className="text-sm text-slate-500">Real-time performance indicators and inventory state</p>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Revenue</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">৳{parseFloat(metrics.revenue).toFixed(2)}</h3>
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sales Count</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.total_sales}</h3>
          </div>
        </div>

        {/* Low Stock Warning level */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className={`p-3 rounded-xl ${metrics.low_stock_alerts > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Warnings</p>
            <h3 className={`text-2xl font-extrabold mt-0.5 ${metrics.low_stock_alerts > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{metrics.low_stock_alerts}</h3>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Count</p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.total_customers}</h3>
          </div>
        </div>

      </div>

      {/* 3. Detailed Data Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Recent Transactions (Span 2) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Transactions</h3>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Sale ID</th>
                  <th className="pb-3">Cashier</th>
                  <th className="pb-3">Payment</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 font-semibold text-slate-600">#{sale.id}</td>
                      <td className="py-3.5 text-slate-700">{sale.staff_name}</td>
                      <td className="py-3.5">
                        <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                          {sale.payment_method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-500">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 text-right font-extrabold text-indigo-600">
                        ৳{parseFloat(sale.final_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Quick Actions & Inventory Alert */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Quick Inventory Status</h3>
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catalog Health</h4>
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-slate-600">Total Products listed:</span>
              <span className="text-slate-800">{metrics.total_products}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-slate-600">Low stock alert count:</span>
              <span className={metrics.low_stock_alerts > 0 ? 'text-rose-600' : 'text-slate-800'}>
                {metrics.low_stock_alerts}
              </span>
            </div>
          </div>
          
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h4>
            <a
              href="/checkout"
              onClick={(e) => { e.preventDefault(); window.location.pathname = '/checkout'; }}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Launch POS Checkout</span>
            </a>
          </div>
        </div>

      </div>

    </div>
  );
}
