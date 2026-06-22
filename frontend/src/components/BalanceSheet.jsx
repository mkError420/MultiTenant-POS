import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function BalanceSheet() {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userObj.role === 'super_admin';

  const [balanceData, setBalanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  
  // Date Filters
  const [filterPreset, setFilterPreset] = useState('all-time');
  const [manualDate, setManualDate] = useState('');
  const [activeDateParam, setActiveDateParam] = useState('');

  // Fetch shops for Super Admin
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

  // Adjust activeDateParam based on presets or manual selection
  useEffect(() => {
    const today = new Date();
    
    if (filterPreset === 'manual') {
      setActiveDateParam(manualDate);
    } else if (filterPreset === 'today') {
      const dateStr = today.toISOString().split('T')[0];
      setActiveDateParam(dateStr);
    } else if (filterPreset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      setActiveDateParam(dateStr);
    } else if (filterPreset === 'last-week') {
      // Last Sunday or 7 days ago
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      const dateStr = lastWeek.toISOString().split('T')[0];
      setActiveDateParam(dateStr);
    } else if (filterPreset === 'last-month') {
      // Last day of previous month
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      const dateStr = lastMonthEnd.toISOString().split('T')[0];
      setActiveDateParam(dateStr);
    } else {
      // All-time (blank parameter retrieves live/today snapshot)
      setActiveDateParam('');
    }
  }, [filterPreset, manualDate]);

  const fetchBalanceSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/analytics/balance-sheet`;
      const params = [];
      
      if (isSuperAdmin && selectedShopId) {
        params.push(`shop_id=${selectedShopId}`);
      }
      if (activeDateParam) {
        params.push(`end_date=${activeDateParam}`);
      }

      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve Balance Sheet data.');
      }

      const data = await response.json();
      setBalanceData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when active date or selected shop changes
  useEffect(() => {
    fetchBalanceSheet();
  }, [selectedShopId, activeDateParam]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const formatCurrency = (val) => {
    const numericVal = parseFloat(val || 0);
    return `৳${numericVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const exportToCSV = () => {
    if (!balanceData) {
      triggerAlert('error', 'No balance sheet data to export.');
      return;
    }

    const headers = ['Classification', 'Sub-Classification', 'Line Item Description', 'Amount (৳)'];
    const rows = [
      ['ASSETS', 'Current Assets', 'Cash & Cash Equivalents (Cash flow from sales minus expenses)', balanceData.assets.cash_on_hand.toFixed(2)],
      ['ASSETS', 'Current Assets', 'Inventory Asset Value (Stock * cost price)', balanceData.assets.inventory_value.toFixed(2)],
      ['ASSETS', 'Current Assets', 'Accounts Receivable (Customer Dues)', balanceData.assets.accounts_receivable.toFixed(2)],
      ['ASSETS', 'Total Assets', 'Total Assets (Sum of all assets)', balanceData.assets.total_assets.toFixed(2)],
      ['LIABILITIES', 'Current Liabilities', 'Accounts Payable (Supplier Dues)', balanceData.liabilities.accounts_payable.toFixed(2)],
      ['LIABILITIES', 'Total Liabilities', 'Total Liabilities (Sum of all liabilities)', balanceData.liabilities.total_liabilities.toFixed(2)],
      ['OWNERS EQUITY', 'Equity', 'Retained Earnings (Accumulated profits/losses)', balanceData.equity.retained_earnings.toFixed(2)],
      ['OWNERS EQUITY', 'Equity', 'Owners Capital (Initial investment / balancing figure)', balanceData.equity.owners_capital.toFixed(2)],
      ['OWNERS EQUITY', 'Total Equity', 'Total Owner Equity', balanceData.equity.total_equity.toFixed(2)],
      ['TOTAL LIABILITIES & EQUITY', 'Grand Total', 'Total Liabilities and Equity', balanceData.total_liabilities_and_equity.toFixed(2)]
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
    const dateSlug = activeDateParam || 'live';
    link.setAttribute('download', `balance_sheet_${shopNameSlug}_as_of_${dateSlug}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert('success', 'Balance sheet exported successfully!');
  };

  const getShopName = () => {
    if (!isSuperAdmin) return userObj.shop_name || 'My Shop';
    if (!selectedShopId) return 'All Shops (Consolidated)';
    const shop = shops.find(s => String(s.id) === String(selectedShopId));
    return shop ? shop.name : 'Selected Shop';
  };

  // Check if Assets = Liabilities + Equity
  const getBalancingCheck = () => {
    if (!balanceData) return { balanced: false, diff: 0 };
    const assets = parseFloat(balanceData.assets.total_assets.toFixed(2));
    const libAndEq = parseFloat(balanceData.total_liabilities_and_equity.toFixed(2));
    const diff = Math.abs(assets - libAndEq);
    return {
      balanced: diff < 0.05,
      diff
    };
  };

  const balanceCheckResult = getBalancingCheck();

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
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
          <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
            <span>Balance Sheet</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-pulse">
              ● Real-time Synced
            </span>
          </h2>
          <p className="text-sm text-slate-500">Statement of financial position showing assets, liabilities, and owner's equity</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchBalanceSheet}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4 text-slate-500 animate-spin-hover" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.23" />
            </svg>
            <span>Sync Live</span>
          </button>
          <button
            onClick={exportToCSV}
            disabled={loading || !balanceData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow-sm transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Shop Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Preset Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider mr-2">Report Date:</span>
            {[
              { label: 'All Time (Live)', value: 'all-time' },
              { label: 'Today', value: 'today' },
              { label: 'Yesterday', value: 'yesterday' },
              { label: 'Last 7 Days', value: 'last-week' },
              { label: 'Last Month End', value: 'last-month' },
              { label: 'Manual Date', value: 'manual' }
            ].map(p => (
              <button
                key={p.value}
                onClick={() => setFilterPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterPreset === p.value
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-slate-50 text-slate-650 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Shop Selector for Super Admin */}
          {isSuperAdmin && (
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Tenant Shop:</span>
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 font-medium text-xs bg-slate-50"
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
        </div>

        {/* Manual Date Input Picker */}
        {filterPreset === 'manual' && (
          <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl w-fit border border-slate-100">
            <span className="text-xs font-semibold text-slate-500">As of Date:</span>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs text-slate-700 bg-white"
            />
            {manualDate && (
              <button 
                onClick={() => { setManualDate(''); setFilterPreset('all-time'); }}
                className="text-[10px] text-rose-500 font-extrabold hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}
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
            <p className="text-slate-500 text-sm font-medium">Reconstructing balance sheet snapshot...</p>
          </div>
        </div>
      ) : balanceData ? (
        <div className="space-y-6">
          
          {/* Top Balancing Status KPI Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Entity / Organization</span>
              <span className="text-lg font-extrabold text-slate-800">{getShopName()}</span>
              <span className="text-xs text-slate-400 block mt-0.5">As of Date: {balanceData.asOfDate}</span>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Assets</span>
                <span className="text-2xl font-black text-emerald-600">{formatCurrency(balanceData.assets.total_assets)}</span>
              </div>
              <div className="h-10 w-[1px] bg-slate-200 hidden md:block"></div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Liabilities & Equity</span>
                <span className="text-2xl font-black text-indigo-600">{formatCurrency(balanceData.total_liabilities_and_equity)}</span>
              </div>
            </div>

            {/* Auto-Balancing Check Card */}
            <div className={`flex flex-col items-center justify-center border rounded-2xl p-4 md:w-52 text-center transition-all ${
              balanceCheckResult.balanced 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}>
              {balanceCheckResult.balanced ? (
                <>
                  <div className="flex items-center space-x-1.5 font-extrabold text-sm text-emerald-700">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Balanced</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Assets = Liabilities + Equity</p>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-1.5 font-extrabold text-sm text-rose-700">
                    <svg className="w-5 h-5 text-rose-650 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Out of Balance</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Difference: {formatCurrency(balanceCheckResult.diff)}</p>
                </>
              )}
            </div>
          </div>

          {/* Double Column Balance Sheet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side: Assets */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span>ASSETS</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">What you own</span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Current Assets Section */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">Current Assets</h4>
                    
                    <div className="space-y-4">
                      {/* Cash */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-700 text-sm block">Cash & Cash Equivalents</span>
                          <span className="text-xs text-slate-450 block max-w-xs md:max-w-md">Liquid cash on hand (cumulative cash sales minus inventory purchases & overheads).</span>
                        </div>
                        <span className="font-extrabold text-slate-800 text-sm text-right shrink-0">{formatCurrency(balanceData.assets.cash_on_hand)}</span>
                      </div>

                      {/* Inventory Asset Value */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-700 text-sm block">Inventory Assets</span>
                          <span className="text-xs text-slate-450 block max-w-xs md:max-w-md">Valuation of stock as of selected date based on cost price.</span>
                        </div>
                        <span className="font-extrabold text-slate-800 text-sm text-right shrink-0">{formatCurrency(balanceData.assets.inventory_value)}</span>
                      </div>

                      {/* Accounts Receivable */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-700 text-sm block">Accounts Receivable</span>
                          <span className="text-xs text-slate-450 block max-w-xs md:max-w-md">Credit sales due from customers as of selected date.</span>
                        </div>
                        <span className="font-extrabold text-slate-800 text-sm text-right shrink-0">{formatCurrency(balanceData.assets.accounts_receivable)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Assets Footer */}
              <div className="bg-emerald-50/50 border-t border-emerald-100 px-6 py-4 flex items-center justify-between mt-auto">
                <span className="font-black text-slate-800 text-sm uppercase tracking-wider">Total Assets</span>
                <span className="font-black text-emerald-700 text-lg">{formatCurrency(balanceData.assets.total_assets)}</span>
              </div>
            </div>

            {/* Right Side: Liabilities & Owners Equity */}
            <div className="space-y-6 flex flex-col">
              {/* Liabilities and Equity Main Box */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between flex-1">
                <div>
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                      <span>LIABILITIES & EQUITY</span>
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">What you owe & initial investments</span>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Current Liabilities */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">Current Liabilities</h4>
                      
                      <div className="space-y-4">
                        {/* Accounts Payable */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-700 text-sm block">Accounts Payable</span>
                            <span className="text-xs text-slate-450 block max-w-xs text-slate-400">Outstanding bills due to suppliers.</span>
                          </div>
                          <span className="font-extrabold text-slate-850 text-sm text-right shrink-0">{formatCurrency(balanceData.liabilities.accounts_payable)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Owner's Equity */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">Owner's Equity</h4>
                      
                      <div className="space-y-4">
                        {/* Owners Capital */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-700 text-sm block">Owner's Capital (Injected Equity)</span>
                            <span className="text-xs text-slate-450 block max-w-xs md:max-w-md">Capital investment balancing figure (Assets minus Liabilities & Retained Earnings).</span>
                          </div>
                          <span className="font-extrabold text-slate-800 text-sm text-right shrink-0">{formatCurrency(balanceData.equity.owners_capital)}</span>
                        </div>

                        {/* Retained Earnings */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-700 text-sm block">Retained Earnings</span>
                            <span className="text-xs text-slate-450 block max-w-xs md:max-w-md">Cumulative net profit earned by trading operations up to the selected date.</span>
                          </div>
                          <span className="font-extrabold text-slate-800 text-sm text-right shrink-0">{formatCurrency(balanceData.equity.retained_earnings)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Liabilities & Equity Footer */}
                <div className="bg-indigo-50/50 border-t border-indigo-100 px-6 py-4 flex items-center justify-between mt-auto">
                  <span className="font-black text-slate-800 text-sm uppercase tracking-wider">Total Liabilities & Equity</span>
                  <span className="font-black text-indigo-700 text-lg">{formatCurrency(balanceData.total_liabilities_and_equity)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
