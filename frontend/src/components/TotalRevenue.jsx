import React, { useState, useEffect } from 'react';
 
const API_BASE_URL = 'http://localhost:5000/api';
 
export default function TotalRevenue() {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userObj.role === 'super_admin';

  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');

  useEffect(() => {
    if (isSuperAdmin) {
      const fetchShops = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/shops`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setShops(data);
          }
        } catch (err) {
          console.error('Failed to fetch shops:', err);
        }
      };
      fetchShops();
    }
  }, [isSuperAdmin]);
 
  const fetchRevenue = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/analytics/revenue`;
      const queryParams = [];
      if (startDate) queryParams.push(`start_date=${startDate}`);
      if (endDate) queryParams.push(`end_date=${endDate}`);
      if (isSuperAdmin && selectedShopId) {
        queryParams.push(`shop_id=${selectedShopId}`);
      }
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }
 
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to retrieve financial analytics data.');
      }
      
      const data = await response.json();
      setRevenueData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchRevenue();
  }, [startDate, endDate, selectedShopId]);
 
  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };
 
  const formatCurrency = (val) => {
    const numericVal = parseFloat(val || 0);
    return `৳${numericVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
 
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    }
    return new Date(dateStr).toLocaleDateString();
  };
 
  const exportToCSV = () => {
    if (!revenueData) {
      triggerAlert('error', 'No financial data to export.');
      return;
    }
 
    const headers = ['Financial Indicator', 'Category', 'Description', 'Amount (৳)'];
    const rows = [
      ['Sales Revenue', 'Inflow', 'Gross revenue generated from customer sales transactions', revenueData.sales_revenue.toFixed(2)],
      ['Cost of Goods Sold (COGS)', 'Outflow', 'Cost price value of stock sold to customers', revenueData.cost_of_goods_sold.toFixed(2)],
      ['Product Purchasing Cost', 'Outflow', 'Cash outflow for received purchase orders', revenueData.inventory_purchasing_cost.toFixed(2)],
      ['Other Costs', 'Outflow', 'Shop operational costs and miscellaneous overheads', revenueData.other_costs.toFixed(2)],
      ['Wastage & Damage Loss', 'Outflow', 'Cost of damaged, expired, or stolen items written off', (revenueData.wastage_loss || 0).toFixed(2)],
      ['Net Profit (Cashflow Basis)', 'Summary', 'Net cashflow liquid profit (Sales - Purchasing Cost - Other Costs - Wastage Loss)', revenueData.net_profit_cashflow.toFixed(2)],
      ['Net Profit (COGS Margin Basis)', 'Summary', 'Net trading margins profit (Sales - COGS - Other Costs - Wastage Loss)', revenueData.net_profit_cogs.toFixed(2)]
    ];
 
    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(e => e.map(val => {
        let str = String(val);
        if (/[",\n\r]/.test(str)) {
          str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');
 
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const selectedShop = shops.find(s => String(s.id) === String(selectedShopId));
    const shopNameSlug = selectedShop ? selectedShop.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'all_shops';
    const startStr = startDate ? startDate : 'all-time';
    const endStr = endDate ? endDate : 'all-time';
    link.setAttribute('download', `financial_report_${shopNameSlug}_${startStr}_to_${endStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert('success', 'Financial report exported successfully!');
  };
 
  return (
    <div className="space-y-6">
      {/* Alert Alert Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${
          alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}
 
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Total Revenue & Profits</h2>
          <p className="text-sm text-slate-500">Comprehensive overview of sales, buying costs, operational costs, and profitability analysis</p>
        </div>
        <div>
          <button
            onClick={exportToCSV}
            disabled={loading || !revenueData}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-5 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Financial Report</span>
          </button>
        </div>
      </div>
 
      {/* Date Filters Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center space-x-2 text-slate-600 font-semibold text-sm">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Filter Report Period:</span>
        </div>
 
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
          {isSuperAdmin && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-slate-500">Tenant Shop:</span>
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 font-medium"
              >
                <option value="">All Shops (Consolidated)</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700"
            />
          </div>
          {(startDate || endDate || (isSuperAdmin && selectedShopId)) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setSelectedShopId(''); }}
              className="text-indigo-600 hover:text-indigo-850 font-bold ml-2 underline"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm flex items-center space-x-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-24 text-center shadow-xs">
          <div className="flex justify-center items-center flex-col space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
            <p className="text-slate-500 text-sm font-medium">Aggregating financial statements...</p>
          </div>
        </div>
      ) : revenueData ? (
        <div className="space-y-6">
          
          {/* Main KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            
            {/* Sales Revenue Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sales Revenue</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{formatCurrency(revenueData.sales_revenue)}</span>
                <span className="text-xs text-slate-450 mt-1 block">From {revenueData.sales_count} sales transactions</span>
              </div>
            </div>

            {/* Buying Costs Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Buying Cost</span>
                <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{formatCurrency(revenueData.inventory_purchasing_cost)}</span>
                <span className="text-xs text-slate-450 mt-1 block">Cash outflow on received POs</span>
              </div>
            </div>

            {/* Other Cost Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Other costs (Overhead)</span>
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{formatCurrency(revenueData.other_costs)}</span>
                <span className="text-xs text-slate-450 mt-1 block">Overhead/miscellaneous expenses</span>
              </div>
            </div>

            {/* Wastage Loss Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wastage & Damage Loss</span>
                <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{formatCurrency(revenueData.wastage_loss || 0)}</span>
                <span className="text-xs text-slate-450 mt-1 block">Value of stock adjustments/damage</span>
              </div>
            </div>

            {/* Net Cashflow Profit Card */}
            <div className={`border rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between ${
              revenueData.net_profit_cashflow >= 0
                ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800'
                : 'bg-rose-50/40 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Net Profit (Cashflow)</span>
                <div className={`p-2.5 rounded-xl ${
                  revenueData.net_profit_cashflow >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black">{formatCurrency(revenueData.net_profit_cashflow)}</span>
                <span className="text-xs opacity-75 mt-1 block">Based on liquid cash transactions</span>
              </div>
            </div>

          </div>

          {/* Two profit breakdown boxes side-by-side (Net cashflow profit vs Trading margin COGS profit) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Profitability COGS Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span>Trading Profitability (COGS Basis)</span>
                  </h3>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    Accrual Margin
                  </span>
                </div>

                <div className="space-y-3.5 mt-5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Gross Sales Revenue:</span>
                    <span className="font-bold text-slate-800">{formatCurrency(revenueData.sales_revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Cost of Goods Sold (COGS):</span>
                    <span className="font-bold text-rose-600">-{formatCurrency(revenueData.cost_of_goods_sold)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Other Operational Costs:</span>
                    <span className="font-bold text-rose-600">-{formatCurrency(revenueData.other_costs)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Wastage & Damage Loss:</span>
                    <span className="font-bold text-rose-600">-{formatCurrency(revenueData.wastage_loss || 0)}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-800">Net Profit (Trading):</span>
                    <span className={`text-lg font-black ${
                      revenueData.net_profit_cogs >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(revenueData.net_profit_cogs)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-xl p-3 text-xs text-slate-500">
                <span className="font-bold text-slate-700 block mb-0.5">What is COGS Basis?</span>
                Measures trading profitability by subtracting the *original cost price* of items actually sold and wastage write-off value, rather than raw purchasing expenditure. Gives you the exact sales margin.
              </div>
            </div>

            {/* Profitability Cashflow Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Net Cash Flow (Cashflow Basis)</span>
                  </h3>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    Liquidity Flow
                  </span>
                </div>

                <div className="space-y-3.5 mt-5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Gross Sales Revenue:</span>
                    <span className="font-bold text-slate-800">{formatCurrency(revenueData.sales_revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Product Buying Cost (POs):</span>
                    <span className="font-bold text-rose-600">-{formatCurrency(revenueData.inventory_purchasing_cost)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Other Operational Costs:</span>
                    <span className="font-bold text-rose-600">-{formatCurrency(revenueData.other_costs)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Wastage & Damage Loss:</span>
                    <span className="font-bold text-rose-600">-{formatCurrency(revenueData.wastage_loss || 0)}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-800">Net Profit (Cashflow):</span>
                    <span className={`text-lg font-black ${
                      revenueData.net_profit_cashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(revenueData.net_profit_cashflow)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-xl p-3 text-xs text-slate-500">
                <span className="font-bold text-slate-700 block mb-0.5">What is Cashflow Basis?</span>
                Reflects cash flow liquidity by subtracting the actual *buying cost* of all stocked products purchased during this period and wastage write-offs. Indicates the physical cash status of your shop.
              </div>
            </div>

          </div>

          {/* Ledger Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-855 text-sm">Summary Ledger Statement</h3>
              <p className="text-xs text-slate-450 mt-1">Direct comparison ledger representing cashflow indicators and margins</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th className="p-4 pl-6">Financial Indicator</th>
                    <th className="p-4">Type / Direction</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-right pr-6">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  
                  {/* Row 1: Sales Revenue */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-800">Sales Revenue</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                        Inflow (+)
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">Gross revenue generated from customer checkout transactions</td>
                    <td className="p-4 text-right pr-6 font-black text-emerald-600">{formatCurrency(revenueData.sales_revenue)}</td>
                  </tr>

                  {/* Row 2: COGS */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-800">Cost of Goods Sold (COGS)</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-655">
                        Inventory Cost (-)
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">Cost value of items sold (used for gross margin computation)</td>
                    <td className="p-4 text-right pr-6 font-bold text-slate-700">-{formatCurrency(revenueData.cost_of_goods_sold)}</td>
                  </tr>

                  {/* Row 3: Product Buying Cost */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-800">Product Buying Cost</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600">
                        Outflow (-)
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">Total expenditure for restocking inventory through received purchase orders</td>
                    <td className="p-4 text-right pr-6 font-bold text-rose-600">-{formatCurrency(revenueData.inventory_purchasing_cost)}</td>
                  </tr>

                  {/* Row 4: Other Costs */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-800">Other Costs (Overheads)</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600">
                        Outflow (-)
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">Recorded operational costs (e.g. utility bills, rent, overheads)</td>
                    <td className="p-4 text-right pr-6 font-bold text-rose-600">-{formatCurrency(revenueData.other_costs)}</td>
                  </tr>

                  {/* Row 4.5: Wastage Loss */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-800">Wastage & Damage Loss</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600">
                        Outflow (-)
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">Recorded value of damaged, expired, or stolen inventory written off</td>
                    <td className="p-4 text-right pr-6 font-bold text-rose-600">-{formatCurrency(revenueData.wastage_loss || 0)}</td>
                  </tr>

                  {/* Row 5: Net Profit Cashflow */}
                  <tr className="bg-slate-50/40 hover:bg-slate-50 transition-colors border-t border-slate-150">
                    <td className="p-4 pl-6 font-extrabold text-slate-800">Net Profit (Cashflow Basis)</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        revenueData.net_profit_cashflow >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        Net Summary
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 italic">Liquid cash calculation: Sales Revenue - Buying Cost - Other Costs - Wastage Loss</td>
                    <td className={`p-4 text-right pr-6 font-black text-base ${
                      revenueData.net_profit_cashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(revenueData.net_profit_cashflow)}
                    </td>
                  </tr>

                  {/* Row 6: Net Profit COGS */}
                  <tr className="bg-slate-50/40 hover:bg-slate-50 transition-colors">
                    <td className="p-4 pl-6 font-extrabold text-slate-800">Net Profit (COGS Basis)</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        revenueData.net_profit_cogs >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        Net Summary
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 italic">Trading margins calculation: Sales Revenue - COGS - Other Costs - Wastage Loss</td>
                    <td className={`p-4 text-right pr-6 font-black text-base ${
                      revenueData.net_profit_cogs >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(revenueData.net_profit_cogs)}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-450">
          No financial records found.
        </div>
      )}
    </div>
  );
}
