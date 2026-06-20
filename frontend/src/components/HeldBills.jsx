import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function HeldBills({ onResume = () => {}, onHeldBillsChange = () => {} }) {
  const [heldBills, setHeldBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  const fetchHeldBills = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/held-bills`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve held bills.');
      const data = await response.json();
      setHeldBills(data);
      onHeldBillsChange(data.filter(b => b.status === 'held').length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeldBills();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // 1. UPDATE STATUS
  const handleStatusChange = async (billId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/held-bills/${billId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update status.');

      triggerAlert('success', `Status updated to ${newStatus}!`);
      
      // Update locally
      const updatedList = heldBills.map(bill => 
        bill.id === billId ? { ...bill, status: newStatus } : bill
      );
      setHeldBills(updatedList);
      onHeldBillsChange(updatedList.filter(b => b.status === 'held').length);
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // 2. DISCARD/DELETE HELD BILL
  const handleDelete = async (billId) => {
    if (!window.confirm('Are you sure you want to discard this held bill?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/held-bills/${billId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete held bill.');

      triggerAlert('success', 'Held bill discarded successfully.');
      const updatedList = heldBills.filter(bill => bill.id !== billId);
      setHeldBills(updatedList);
      onHeldBillsChange(updatedList.filter(b => b.status === 'held').length);
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // Filter and search computation
  const filteredBills = heldBills.filter(bill => {
    const matchesSearch = 
      (bill.notes && bill.notes.toLowerCase().includes(search.toLowerCase())) ||
      (bill.customer_name && bill.customer_name.toLowerCase().includes(search.toLowerCase())) ||
      (bill.customer_phone && bill.customer_phone.includes(search)) ||
      (bill.staff_name && bill.staff_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Alerts Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${
          alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Held Bills</h2>
        <p className="text-sm text-slate-500">Manage suspended carts, monitor their status, and resume checkout transactions</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by note, customer, phone, or cashier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status Filter Selector */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl p-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="held">Held (Active)</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Held Bills Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="p-4">Hold ID / Time</th>
                <th className="p-4">Notes / Reference</th>
                <th className="p-4">Cashier</th>
                <th className="p-4">Customer Info</th>
                 <th className="p-4 text-center">Items / Due Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
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
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-400">
                    No held bills matched current filters.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  let itemsList = [];
                  try {
                    itemsList = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
                  } catch (e) {
                    itemsList = [];
                  }
                  const totalItemsQty = itemsList.reduce((sum, item) => sum + item.quantity, 0);
                  const formattedDate = new Date(bill.created_at).toLocaleString();

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <span className="font-mono text-xs font-bold text-slate-500">#{bill.id}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{formattedDate}</div>
                      </td>
                      <td className="p-4">
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-amber-200">
                          {bill.notes || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">{bill.staff_name}</td>
                      <td className="p-4">
                        {bill.customer_name ? (
                          <div>
                            <div className="font-semibold text-slate-800">{bill.customer_name}</div>
                            {bill.customer_phone && <div className="text-xs text-slate-500">{bill.customer_phone}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400">Walk-in</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {parseFloat(bill.due_amount || 0) > 0 ? (
                          <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-100 whitespace-nowrap">
                            ৳{parseFloat(bill.due_amount).toFixed(2)} (Due Payment)
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded">
                            {totalItemsQty} items
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <select
                          value={bill.status}
                          onChange={(e) => handleStatusChange(bill.id, e.target.value)}
                          className={`text-xs font-bold rounded-lg border p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            bill.status === 'held'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : bill.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          <option value="held">Held (Active)</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="p-4 text-center space-x-2">
                        {/* Only allow resume if status is still held */}
                        <button
                          onClick={() => onResume(bill)}
                          disabled={bill.status !== 'held'}
                          className="bg-indigo-600 disabled:bg-slate-150 disabled:text-slate-400 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors shadow-sm inline-flex items-center space-x-1"
                          title="Resume checkout cart or due payment"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                          </svg>
                          <span>Resume</span>
                        </button>
                        <button
                          onClick={() => handleDelete(bill.id)}
                          className="text-rose-600 hover:text-rose-900 border border-rose-100 hover:bg-rose-50 p-1.5 rounded-lg transition-colors inline-flex items-center"
                          title="Discard Held Bill"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
