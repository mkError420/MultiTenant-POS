import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Sub-navigation tabs: 'directory', 'pos', 'logs'
  const [activeTab, setActiveTab] = useState('directory');

  // Supplier Profile view state (null = show tabs, non-null = supplier ID)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('pos_history'); // 'pos_history', 'cost_history', 'supplied_products'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  const [showAddPoModal, setShowAddPoModal] = useState(false);
  const [showPoDetailsModal, setShowPoDetailsModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Shared entity states
  const [productsList, setProductsList] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [costLogs, setCostLogs] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);

  // Supplier basic form state
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: ''
  });

  // PO form state
  const [poFormData, setPoFormData] = useState({
    supplier_id: '',
    notes: '',
    items: [{ product_id: '', quantity_ordered: 1, cost_price: 0.00 }]
  });

  // Receive verification form state
  const [receiveItems, setReceiveItems] = useState([]); // Array of { product_id, quantity_received, cost_price, product_name, sku }
  const [receiveNotes, setReceiveNotes] = useState('');

  // PO Filter
  const [poFilterStatus, setPoFilterStatus] = useState('all');

  // Load baseline directory data
  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve suppliers.');
      const data = await response.json();
      setSuppliers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Load products list for PO creations
  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setProductsList(await response.json());
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // Load purchase orders global list
  const fetchPurchaseOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setPurchaseOrders(await response.json());
      }
    } catch (err) {
      console.error('Error fetching POs:', err);
    }
  };

  // Load cost price logs global list
  const fetchCostLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/cost-price-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setCostLogs(await response.json());
      }
    } catch (err) {
      console.error('Error fetching cost logs:', err);
    }
  };

  // Initialize data on mount
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSuppliers(),
        fetchProducts(),
        fetchPurchaseOrders(),
        fetchCostLogs()
      ]);
      setLoading(false);
    };
    initData();
  }, []);

  // Sync profile when selected supplier ID changes
  useEffect(() => {
    if (selectedSupplierId) {
      loadProfileData(selectedSupplierId);
    } else {
      setProfileData(null);
    }
  }, [selectedSupplierId]);

  // Load profile data and stats
  const loadProfileData = async (supplierId) => {
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve supplier profile details.');
      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      triggerAlert('error', err.message);
      setSelectedSupplierId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // CREATE SUPPLIER
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      triggerAlert('error', 'Supplier name is required.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to create supplier.');

      triggerAlert('success', 'Supplier created successfully!');
      setShowAddModal(false);
      resetForm();
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // EDIT SUPPLIER OPEN
  const openEdit = (supplier) => {
    setCurrentSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || ''
    });
    setShowEditModal(true);
  };

  // UPDATE SUPPLIER
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${currentSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update supplier.');

      triggerAlert('success', 'Supplier updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchSuppliers();
      if (selectedSupplierId === currentSupplier.id) {
        loadProfileData(currentSupplier.id);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // DELETE SUPPLIER
  const handleDelete = async (supplierId) => {
    if (!window.confirm('Are you sure you want to delete this supplier? This will also remove associated POs and logs.')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete supplier.');

      triggerAlert('success', 'Supplier deleted successfully!');
      setSelectedSupplierId(null);
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchCostLogs();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_name: '',
      email: '',
      phone: ''
    });
    setCurrentSupplier(null);
  };

  // OPEN PO CREATION MODAL
  const openAddPo = (supplierId = '') => {
    setPoFormData({
      supplier_id: supplierId,
      notes: '',
      items: [{ product_id: '', quantity_ordered: 1, cost_price: 0.00, selling_price: 0.00, is_new: false, name: '', sku: '' }]
    });
    setShowAddPoModal(true);
  };

  // ADD PO LINE ITEM IN FORM
  const addPoLine = () => {
    setPoFormData({
      ...poFormData,
      items: [...poFormData.items, { product_id: '', quantity_ordered: 1, cost_price: 0.00, selling_price: 0.00, is_new: false, name: '', sku: '' }]
    });
  };

  // REMOVE PO LINE ITEM IN FORM
  const removePoLine = (index) => {
    const updated = [...poFormData.items];
    updated.splice(index, 1);
    setPoFormData({ ...poFormData, items: updated });
  };

  // UPDATE PO LINE FIELD
  const updatePoLineField = (index, field, value) => {
    const updated = [...poFormData.items];
    
    if (field === 'product_id') {
      updated[index][field] = value;
      // Auto fill default cost price and selling price from inventory cache if product selected
      const prod = productsList.find(p => String(p.id) === String(value));
      if (prod) {
        updated[index]['cost_price'] = parseFloat(prod.cost_price);
        updated[index]['selling_price'] = parseFloat(prod.price);
      }
    } else {
      updated[index][field] = value;
    }
    
    setPoFormData({ ...poFormData, items: updated });
  };

  // SUBMIT PURCHASE ORDER
  const handlePoSubmit = async (e, poStatus = 'draft') => {
    e.preventDefault();
    if (!poFormData.supplier_id) {
      triggerAlert('error', 'Supplier selection is required.');
      return;
    }
    
    // Validate lines
    const validLines = poFormData.items.filter(item => {
      const hasProduct = item.product_id || (item.is_new && item.name && item.sku);
      return hasProduct && parseInt(item.quantity_ordered) > 0;
    });

    if (validLines.length === 0) {
      triggerAlert('error', 'Please add at least one product with a valid quantity.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          supplier_id: parseInt(poFormData.supplier_id),
          notes: poFormData.notes,
          status: poStatus,
          items: validLines.map(item => {
            if (item.is_new) {
              return {
                is_new: true,
                name: item.name,
                sku: item.sku,
                quantity_ordered: parseInt(item.quantity_ordered),
                cost_price: parseFloat(item.cost_price || 0),
                selling_price: parseFloat(item.selling_price || 0)
              };
            }
            return {
              product_id: parseInt(item.product_id),
              quantity_ordered: parseInt(item.quantity_ordered),
              cost_price: parseFloat(item.cost_price || 0),
              selling_price: parseFloat(item.selling_price || 0)
            };
          })
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to create Purchase Order.');

      triggerAlert('success', `Purchase Order created successfully as ${poStatus}!`);
      setShowAddPoModal(false);
      fetchPurchaseOrders();
      fetchProducts(); // Refresh products cache in case new product was created
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // OPEN PO DETAILS MODAL
  const openPoDetails = async (poId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Could not retrieve PO details.');
      const po = await response.json();
      setSelectedPo(po);
      setShowPoDetailsModal(true);
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // UPDATE PO STATUS (ORDERED OR CANCELLED)
  const updatePoStatus = async (poId, status) => {
    if (status === 'cancelled' && !window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update PO status.');

      triggerAlert('success', `PO Status updated to ${status}!`);
      fetchPurchaseOrders();
      if (selectedPo && selectedPo.id === poId) {
        openPoDetails(poId);
      }
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // OPEN RECEIVE MODAL
  const openReceiveModal = (po) => {
    setSelectedPo(po);
    setReceiveItems(po.items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.product_sku,
      quantity_ordered: item.quantity_ordered,
      quantity_received: item.quantity_ordered, // Default match ordered qty
      cost_price: parseFloat(item.cost_price),
      selling_price: parseFloat(item.selling_price || 0)
    })));
    setReceiveNotes('');
    setShowReceiveModal(true);
  };

  // SUBMIT CONFIRMED RECEIVE
  const handleConfirmReceive = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${selectedPo.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'received',
          notes: receiveNotes,
          items: receiveItems.map(item => ({
            product_id: item.product_id,
            quantity_received: parseInt(item.quantity_received || 0),
            cost_price: parseFloat(item.cost_price || 0),
            selling_price: parseFloat(item.selling_price || 0)
          }))
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to process PO receipt.');

      triggerAlert('success', 'Purchase Order successfully received. Inventory stock and cost price logs updated!');
      setShowReceiveModal(false);
      setShowPoDetailsModal(false);
      fetchPurchaseOrders();
      fetchCostLogs();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleReceivedSaleChange = (idx, val) => {
    const updated = [...receiveItems];
    updated[idx].selling_price = parseFloat(val) || 0.00;
    setReceiveItems(updated);
  };

  // DELETE PURCHASE ORDER
  const handleDeletePo = async (po) => {
    const isReceived = po.status === 'received';
    const confirmMessage = isReceived
      ? 'Are you sure you want to delete this RECEIVED purchase order? This will revert product stock quantities added by this order.'
      : `Are you sure you want to delete this purchase order (${po.status})?`;

    if (!window.confirm(confirmMessage)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${po.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete PO.');

      triggerAlert('success', isReceived ? 'Received Purchase Order deleted and stock reverted!' : 'Purchase Order deleted successfully.');
      fetchPurchaseOrders();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // DELETE PRODUCT FROM PO
  const handleDeletePoItem = async (poId, productId) => {
    if (!window.confirm('Are you sure you want to delete this product from the purchase order?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}/items/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to remove product from Purchase Order.');

      triggerAlert('success', 'Product removed from Purchase Order successfully.');
      openPoDetails(poId); // Refresh details modal
      fetchPurchaseOrders(); // Refresh global PO list
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId); // Refresh profile if open
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // HELPER FORMATTERS
  const formatCurrency = (val) => `৳${parseFloat(val).toFixed(2)}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // FILTERED PURCHASE ORDERS FOR LISTINGS
  const getFilteredPOs = (ordersList) => {
    if (poFilterStatus === 'all') return ordersList;
    return ordersList.filter(o => o.status === poFilterStatus);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ordered':
        return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse';
      case 'received':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // PROFILE RENDER
  if (selectedSupplierId && profileData) {
    const { supplier, stats, purchaseOrders: sPOs, costLogs: sLogs } = profileData;
    
    // Unique list of products this supplier has supplied or historically adjusted
    const uniqueProducts = Array.from(new Set(sLogs.map(l => l.product_id)))
      .map(id => {
        const log = sLogs.find(l => l.product_id === id);
        // Find product details in inventory cache
        const pDetails = productsList.find(p => p.id === id);
        return {
          id,
          name: log.product_name,
          sku: log.product_sku,
          stock: pDetails ? pDetails.stock_quantity : 'N/A',
          current_cost: pDetails ? pDetails.cost_price : log.new_cost_price
        };
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

        {/* Back and Header Card */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSelectedSupplierId(null)}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors"
            title="Back to Directory"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Supplier Profile</span>
            <h2 className="text-2xl font-bold text-slate-800">{supplier.name}</h2>
          </div>
        </div>

        {/* Info & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier details card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Contact Card</h3>
              <button
                onClick={() => openEdit(supplier)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Edit Vendor Details
              </button>
            </div>
            
            <div className="space-y-3.5 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-400">CONTACT REPRESENTATIVE</span>
                <span className="font-semibold text-slate-700">{supplier.contact_name || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">EMAIL ADDRESS</span>
                <span className="font-semibold text-slate-700">{supplier.email || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">PHONE NUMBER</span>
                <span className="font-semibold text-slate-700">{supplier.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">VENDOR REGISTERED</span>
                <span className="font-semibold text-slate-700">{new Date(supplier.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => handleDelete(supplier.id)}
                className="w-full text-center py-2 border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-xl transition-all"
              >
                Delete Supplier
              </button>
            </div>
          </div>

          {/* Quick Stats Block */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* KPI 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Spent</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{formatCurrency(stats.totalSpent)}</span>
                <span className="text-xs text-slate-400">On all completed purchases</span>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed POs</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{stats.poStats.received}</span>
                <span className="text-xs text-slate-400">Shipments fully received</span>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Orders</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">
                  {stats.poStats.draft + stats.poStats.ordered}
                </span>
                <span className="text-xs text-slate-400">{stats.poStats.ordered} ordered · {stats.poStats.draft} draft</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setProfileTab('pos_history')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                profileTab === 'pos_history'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              Purchase Orders ({sPOs.length})
            </button>
            <button
              onClick={() => setProfileTab('cost_history')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                profileTab === 'cost_history'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              Cost Logs ({sLogs.length})
            </button>
            <button
              onClick={() => setProfileTab('supplied_products')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                profileTab === 'supplied_products'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              Supplied Products ({uniqueProducts.length})
            </button>
          </div>

          <div className="p-6">
            {profileTab === 'pos_history' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-700 text-sm">POs placed with {supplier.name}</h4>
                  <button
                    onClick={() => openAddPo(supplier.id)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-colors"
                  >
                    + Add Purchase Order
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">PO ID</th>
                        <th className="p-3">Order Date</th>
                        <th className="p-3">Received Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Total Amount</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {sPOs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-400">No POs recorded.</td>
                        </tr>
                      ) : (
                        sPOs.map(po => (
                          <tr key={po.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-slate-700">#PO-{po.id}</td>
                            <td className="p-3 text-slate-600">{formatDate(po.order_date)}</td>
                            <td className="p-3 text-slate-600">{po.received_date ? formatDate(po.received_date) : '-'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(po.status)}`}>
                                {po.status}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-800">{formatCurrency(po.total_amount)}</td>
                            <td className="p-3 text-center space-x-2">
                              <button
                                onClick={() => openPoDetails(po.id)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                Details
                              </button>
                              {po.status === 'ordered' && (
                                <button
                                  onClick={() => openReceiveModal(po)}
                                  className="text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"
                                >
                                  Receive
                                </button>
                              )}
                              {po.status === 'draft' && (
                                <button
                                  onClick={() => updatePoStatus(po.id, 'ordered')}
                                  className="text-amber-600 hover:text-amber-850 font-semibold mr-3"
                                >
                                  Place Order
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePo(po)}
                                className="text-rose-600 hover:text-rose-850 font-semibold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'cost_history' && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 text-sm">Product cost changes from this vendor</h4>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">Date</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Old Cost</th>
                        <th className="p-3">New Cost</th>
                        <th className="p-3">Difference</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {sLogs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-slate-400">No cost price logs matching this supplier.</td>
                        </tr>
                      ) : (
                        sLogs.map(log => {
                          const diff = parseFloat(log.new_cost_price) - parseFloat(log.old_cost_price);
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-600">{formatDate(log.created_at)}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{log.product_sku}</td>
                              <td className="p-3 font-semibold text-slate-800">{log.product_name}</td>
                              <td className="p-3 text-slate-550">{formatCurrency(log.old_cost_price)}</td>
                              <td className="p-3 font-extrabold text-slate-850">{formatCurrency(log.new_cost_price)}</td>
                              <td className="p-3">
                                {diff === 0 ? (
                                  <span className="text-slate-400 font-semibold">-</span>
                                ) : diff > 0 ? (
                                  <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                    +{formatCurrency(diff)} ▲
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    {formatCurrency(diff)} ▼
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-medium text-indigo-600">{log.change_reason}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'supplied_products' && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 text-sm">Products currently cataloged from this vendor</h4>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Last Cost Price</th>
                        <th className="p-3">Current Active Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {uniqueProducts.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-slate-400">No products recorded.</td>
                        </tr>
                      ) : (
                        uniqueProducts.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-slate-500">{p.sku}</td>
                            <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                            <td className="p-3 text-slate-750 font-bold">{formatCurrency(p.current_cost)}</td>
                            <td className="p-3">
                              <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                                {p.stock} units
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RENDER EDIT SUPPLIER MODAL */}
        {showEditModal && renderSupplierFormModal(true)}

        {/* RENDER PO DETAILS MODAL */}
        {showPoDetailsModal && renderPoDetailsModal()}

        {/* RENDER RECEIVE MODAL */}
        {showReceiveModal && renderReceiveModal()}

        {/* RENDER ADD PO MODAL */}
        {showAddPoModal && renderAddPoModal()}
      </div>
    );
  }

  // --- GENERAL LAYOUTS RENDER (selectedSupplierId is null) ---
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Supplier Directory</h2>
          <p className="text-sm text-slate-500">Manage vendor profiles, purchase orders, and cost price changes</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={() => openAddPo()}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-5 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Create Purchase Order</span>
          </button>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 bg-slate-100/50 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'directory'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Vendors Directory
        </button>
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'pos'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'logs'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Cost Price Logs
        </button>
      </div>

      {/* --- TAB: DIRECTORY --- */}
      {activeTab === 'directory' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-4">Supplier Name</th>
                  <th className="p-4">Contact Person</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-slate-400">
                      No suppliers listed yet. Add a supplier to begin.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">{supplier.name}</td>
                      <td className="p-4 text-slate-700">{supplier.contact_name || '-'}</td>
                      <td className="p-4 text-slate-600">{supplier.email || '-'}</td>
                      <td className="p-4 text-slate-600">{supplier.phone || '-'}</td>
                      <td className="p-4 text-center space-x-2">
                        <button
                          onClick={() => setSelectedSupplierId(supplier.id)}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => openEdit(supplier)}
                          className="text-slate-500 hover:text-slate-800 font-semibold text-xs border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: PURCHASE ORDERS --- */}
      {activeTab === 'pos' && (
        <div className="space-y-4">
          {/* PO Filters bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase">Filter Status:</span>
              <div className="flex space-x-1.5">
                {['all', 'draft', 'ordered', 'received', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setPoFilterStatus(st)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase tracking-wider transition-all border ${
                      poFilterStatus === st
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PO Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th className="p-4">PO ID</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Order Date</th>
                    <th className="p-4">Received Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Total Amount</th>
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
                  ) : getFilteredPOs(purchaseOrders).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-12 text-center text-slate-400">
                        No purchase orders matching filters.
                      </td>
                    </tr>
                  ) : (
                    getFilteredPOs(purchaseOrders).map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-650">#PO-{po.id}</td>
                        <td className="p-4 font-semibold text-slate-800">{po.supplier_name}</td>
                        <td className="p-4 text-slate-600">{formatDate(po.order_date)}</td>
                        <td className="p-4 text-slate-600">{po.received_date ? formatDate(po.received_date) : '-'}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getStatusBadge(po.status)}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="p-4 font-extrabold text-slate-800">{formatCurrency(po.total_amount)}</td>
                        <td className="p-4 text-center space-x-2">
                          <button
                            onClick={() => openPoDetails(po.id)}
                            className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Details
                          </button>
                          {po.status === 'ordered' && (
                            <button
                              onClick={() => openReceiveModal(po)}
                              className="text-emerald-600 hover:text-emerald-900 font-bold text-xs border border-emerald-100 bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors animate-pulse"
                            >
                              Receive Stocks
                            </button>
                          )}
                          {po.status === 'draft' && (
                            <button
                              onClick={() => updatePoStatus(po.id, 'ordered')}
                              className="text-amber-600 hover:text-amber-900 font-semibold text-xs border border-amber-100 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors mr-2"
                            >
                              Place Order
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePo(po)}
                            className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: COST PRICE LOGS --- */}
      {activeTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-4">Date Logged</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Vendor Supplier</th>
                  <th className="p-4">Old Cost</th>
                  <th className="p-4">New Cost</th>
                  <th className="p-4">Difference</th>
                  <th className="p-4">Reason / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : costLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-slate-400">
                      No cost price logs recorded yet. Logs generate automatically when POs are received.
                    </td>
                  </tr>
                ) : (
                  costLogs.map((log) => {
                    const diff = parseFloat(log.new_cost_price) - parseFloat(log.old_cost_price);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-650">{formatDate(log.created_at)}</td>
                        <td className="p-4 font-mono text-xs font-bold text-slate-500">{log.product_sku}</td>
                        <td className="p-4 font-semibold text-slate-800">{log.product_name}</td>
                        <td className="p-4 font-semibold text-slate-700">{log.supplier_name || 'N/A'}</td>
                        <td className="p-4 text-slate-600">{formatCurrency(log.old_cost_price)}</td>
                        <td className="p-4 font-extrabold text-slate-800">{formatCurrency(log.new_cost_price)}</td>
                        <td className="p-4">
                          {diff === 0 ? (
                            <span className="text-slate-400 font-semibold">-</span>
                          ) : diff > 0 ? (
                            <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded text-xs inline-flex items-center">
                              +{formatCurrency(diff)} ▲
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded text-xs inline-flex items-center">
                              {formatCurrency(diff)} ▼
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-medium text-indigo-600">{log.change_reason}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ADD SUPPLIER MODAL --- */}
      {showAddModal && renderSupplierFormModal(false)}

      {/* --- EDIT SUPPLIER MODAL --- */}
      {showEditModal && renderSupplierFormModal(true)}

      {/* --- ADD PO MODAL --- */}
      {showAddPoModal && renderAddPoModal()}

      {/* --- PO DETAILS MODAL --- */}
      {showPoDetailsModal && renderPoDetailsModal()}

      {/* --- RECEIVE MODAL --- */}
      {showReceiveModal && renderReceiveModal()}

    </div>
  );

  // --- RENDER COMPONENT PIECES AS UTILITIES TO KEEP CODE READABLE ---

  // SUPPLIER FORM MODAL (ADD & EDIT)
  function renderSupplierFormModal(isEdit = false) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">
              {isEdit ? `Edit Supplier: ${currentSupplier?.name}` : 'Add New Supplier'}
            </h3>
            <button
              onClick={() => isEdit ? setShowEditModal(false) : setShowAddModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form onSubmit={isEdit ? handleEditSubmit : handleAddSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Company / Vendor Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="e.g. Acme Wholesale Corp"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Rep Name</label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleInputChange}
                placeholder="e.g. John Doe"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="johndoe@acme.com"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="555-0120"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => isEdit ? setShowEditModal(false) : setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
              >
                {isEdit ? 'Save Changes' : 'Create Supplier'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ADD PURCHASE ORDER FORM MODAL
  function renderAddPoModal() {
    const calculatePOTotal = () => {
      return poFormData.items.reduce((sum, item) => {
        return sum + ((parseInt(item.quantity_ordered) || 0) * (parseFloat(item.cost_price) || 0));
      }, 0);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col my-8 max-h-[85vh]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Create Purchase Order</h3>
            <button onClick={() => setShowAddPoModal(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier *</label>
                <select
                  value={poFormData.supplier_id}
                  onChange={(e) => setPoFormData({ ...poFormData, supplier_id: e.target.value })}
                  disabled={!!selectedSupplierId}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Instructions</label>
                <input
                  type="text"
                  value={poFormData.notes}
                  onChange={(e) => setPoFormData({ ...poFormData, notes: e.target.value })}
                  placeholder="e.g. Rush order for holiday stock"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* PO Line Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items</h4>
                <button
                  type="button"
                  onClick={addPoLine}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  + Add Line Item
                </button>
              </div>

              <div className="space-y-2">
                {poFormData.items.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-end gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product *</label>
                      {item.is_new ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">New Product</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...poFormData.items];
                                updated[idx].is_new = false;
                                updated[idx].name = '';
                                updated[idx].sku = '';
                                setPoFormData({ ...poFormData, items: updated });
                              }}
                              className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:underline"
                            >
                              Choose Existing
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              required
                              value={item.name || ''}
                              onChange={(e) => updatePoLineField(idx, 'name', e.target.value)}
                              placeholder="Product Name"
                              className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                            <input
                              type="text"
                              required
                              value={item.sku || ''}
                              onChange={(e) => updatePoLineField(idx, 'sku', e.target.value)}
                              placeholder="SKU Code"
                              className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <select
                          value={item.product_id}
                          onChange={(e) => {
                            if (e.target.value === 'new_product') {
                              const updated = [...poFormData.items];
                              updated[idx].is_new = true;
                              updated[idx].product_id = '';
                              updated[idx].name = '';
                              updated[idx].sku = '';
                              setPoFormData({ ...poFormData, items: updated });
                            } else {
                              updatePoLineField(idx, 'product_id', e.target.value);
                            }
                          }}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        >
                          <option value="">-- Select Product --</option>
                          <option value="new_product" className="text-indigo-600 font-bold">+ New Product (Create on-the-fly)</option>
                          {productsList.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="w-full sm:w-20">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Qty Ordered</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity_ordered}
                        onChange={(e) => updatePoLineField(idx, 'quantity_ordered', parseInt(e.target.value) || 0)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    <div className="w-full sm:w-24">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Cost (৳)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cost_price}
                        onChange={(e) => updatePoLineField(idx, 'cost_price', parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    <div className="w-full sm:w-24">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sale Price (৳)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.selling_price || 0.00}
                        onChange={(e) => updatePoLineField(idx, 'selling_price', parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    {(() => {
                      const itemProfit = parseFloat(item.selling_price || 0) - parseFloat(item.cost_price || 0);
                      const itemMargin = item.selling_price > 0 ? (itemProfit / parseFloat(item.selling_price)) * 100 : 0;
                      return (
                        <div className="w-full sm:w-32 text-center pb-2.5">
                          <span className={`inline-block text-[9px] font-bold px-2 py-1 rounded-lg border ${
                            itemProfit >= 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            Profit: ৳{itemProfit.toFixed(2)} ({itemMargin.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })()}

                    <button
                      type="button"
                      disabled={poFormData.items.length === 1}
                      onClick={() => removePoLine(idx)}
                      className="p-2 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 rounded-lg disabled:opacity-40 mb-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Total display & submit actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm font-bold text-slate-700">
                Running PO Total: <span className="text-lg font-black text-slate-800">{formatCurrency(calculatePOTotal())}</span>
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddPoModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handlePoSubmit(e, 'draft')}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={(e) => handlePoSubmit(e, 'ordered')}
                  className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  Place Order
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // PO DETAILS VIEW MODAL
  function renderPoDetailsModal() {
    if (!selectedPo) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Purchase Order Detail</span>
              <h3 className="text-lg font-black text-slate-800">#PO-{selectedPo.id}</h3>
            </div>
            <button onClick={() => setShowPoDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1 text-sm">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="block text-xs font-bold text-slate-400">SUPPLIER</span>
                <span className="font-semibold text-slate-700">{selectedPo.supplier_name}</span>
                <span className="block text-xs text-slate-500">{selectedPo.supplier_phone} · {selectedPo.supplier_email}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">PO STATUS</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 ${getStatusBadge(selectedPo.status)}`}>
                  {selectedPo.status}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">ORDER DATE</span>
                <span className="font-semibold text-slate-700">{formatDate(selectedPo.order_date)}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">RECEIVED DATE</span>
                <span className="font-semibold text-slate-700">
                  {selectedPo.received_date ? formatDate(selectedPo.received_date) : '-'}
                </span>
              </div>
              {selectedPo.notes && (
                <div className="col-span-2">
                  <span className="block text-xs font-bold text-slate-400">NOTES</span>
                  <span className="font-medium text-slate-650 italic">"{selectedPo.notes}"</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Line Items</h4>
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Cost Price</th>
                      <th className="p-3">Sale Price</th>
                      <th className="p-3">Qty Ordered</th>
                      <th className="p-3">Qty Received</th>
                      <th className="p-3 text-right">Subtotal</th>
                      {['draft', 'ordered'].includes(selectedPo.status) && (
                        <th className="p-3 text-center">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPo.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-mono font-bold text-slate-500">{item.product_sku}</td>
                        <td className="p-3 font-semibold text-slate-800">{item.product_name}</td>
                        <td className="p-3 text-slate-650">{formatCurrency(item.cost_price)}</td>
                        <td className="p-3 text-slate-650">{formatCurrency(item.selling_price || 0)}</td>
                        <td className="p-3 text-slate-700 font-semibold">{item.quantity_ordered}</td>
                        <td className="p-3 text-slate-750">
                          {selectedPo.status === 'received' ? (
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              {item.quantity_received}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-extrabold text-slate-800">
                          {formatCurrency(item.quantity_ordered * item.cost_price)}
                        </td>
                        {['draft', 'ordered'].includes(selectedPo.status) && (
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePoItem(selectedPo.id, item.product_id)}
                              className="text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2 py-0.5 rounded transition-all text-[10px]"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-right text-sm font-bold text-slate-700">
              Total Order Value: <span className="text-lg font-black text-slate-800">{formatCurrency(selectedPo.total_amount)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
            <button
              onClick={() => setShowPoDetailsModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            {selectedPo.status === 'ordered' && (
              <button
                onClick={() => openReceiveModal(selectedPo)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Confirm Receive Stocks
              </button>
            )}
            {selectedPo.status === 'draft' && (
              <button
                onClick={() => updatePoStatus(selectedPo.id, 'ordered')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Place Order
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CONFIRM STOCK RECEIVING DIALOG
  function renderReceiveModal() {
    if (!selectedPo) return null;

    const handleReceivedQtyChange = (idx, val) => {
      const updated = [...receiveItems];
      updated[idx].quantity_received = parseInt(val) || 0;
      setReceiveItems(updated);
    };

    const handleReceivedCostChange = (idx, val) => {
      const updated = [...receiveItems];
      updated[idx].cost_price = parseFloat(val) || 0.00;
      setReceiveItems(updated);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col my-8 max-h-[85vh]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Confirm Stock Receipt</span>
              <h3 className="text-lg font-black text-slate-800">Review PO #PO-{selectedPo.id}</h3>
            </div>
            <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleConfirmReceive} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            <p className="text-xs text-slate-500">
              Please count the physically received items below. Updating the cost price will automatically update the product's default purchase price in inventory and log a cost tracking entry.
            </p>

            <div className="space-y-3">
              {receiveItems.map((item, idx) => (
                <div key={item.product_id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{item.product_name}</h4>
                      <span className="text-xs font-mono font-bold text-slate-400">{item.sku}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Ordered: <strong className="text-slate-700">{item.quantity_ordered} pcs</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Quantity Received
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity_received}
                        onChange={(e) => handleReceivedQtyChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Actual Unit Cost (৳)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cost_price}
                        onChange={(e) => handleReceivedCostChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Actual Unit Sale (৳)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.selling_price || 0.00}
                        onChange={(e) => handleReceivedSaleChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Receiving Notes</label>
              <input
                type="text"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="e.g. 2 items damaged, signed receipt attached"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Confirm Receipt & Adjust Inventory
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
