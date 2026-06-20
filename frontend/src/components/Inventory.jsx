import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    cost_price: '',
    stock_quantity: '',
    low_stock_threshold: '10'
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE_URL}/products?search=${encodeURIComponent(search)}${
        lowStockFilter ? '&low_stock=true' : ''
      }`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve inventory.');
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, lowStockFilter]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 1. CREATE PRODUCT
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.price || !formData.cost_price) {
      triggerAlert('error', 'Please fill in all required fields.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          cost_price: parseFloat(formData.cost_price),
          stock_quantity: parseInt(formData.stock_quantity || 0),
          low_stock_threshold: parseInt(formData.low_stock_threshold || 10)
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to create product.');

      triggerAlert('success', 'Product created successfully!');
      setShowAddModal(false);
      resetForm();
      fetchProducts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // 2. OPEN EDIT MODAL
  const openEdit = (product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      price: product.price,
      cost_price: product.cost_price,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold
    });
    setShowEditModal(true);
  };

  // 3. UPDATE PRODUCT
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products/${currentProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          cost_price: parseFloat(formData.cost_price),
          stock_quantity: parseInt(formData.stock_quantity),
          low_stock_threshold: parseInt(formData.low_stock_threshold)
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update product.');

      triggerAlert('success', 'Product updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchProducts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // 4. DELETE PRODUCT
  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete product.');

      triggerAlert('success', 'Product deleted successfully!');
      fetchProducts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      price: '',
      cost_price: '',
      stock_quantity: '',
      low_stock_threshold: '10'
    });
    setCurrentProduct(null);
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory Catalog</h2>
          <p className="text-sm text-slate-500">Manage shop items, monitor levels, and set restock alerts</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Low Stock Checkbox Filter */}
        <label className="flex items-center space-x-2.5 cursor-pointer text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={lowStockFilter}
            onChange={(e) => setLowStockFilter(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Show Low Stock Warnings Only</span>
        </label>
      </div>

      {/* Inventory Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="p-4">SKU</th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Cost Price</th>
                <th className="p-4">Sale Price</th>
                <th className="p-4">Stock</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400">
                    No products matched current search filters.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const isLowStock = product.stock_quantity <= product.low_stock_threshold;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono text-xs font-bold text-slate-500">{product.sku}</td>
                      <td className="p-4 font-semibold text-slate-800">{product.name}</td>
                      <td className="p-4 text-slate-600">৳{parseFloat(product.cost_price).toFixed(2)}</td>
                      <td className="p-4 font-extrabold text-slate-800">৳{parseFloat(product.price).toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                          isLowStock
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {product.stock_quantity} / Threshold: {product.low_stock_threshold}
                        </span>
                      </td>
                      <td className="p-4 text-center space-x-2">
                        <button
                          onClick={() => openEdit(product)}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Delete
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

      {/* --- ADD NEW PRODUCT MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Add New Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Wireless Mouse X"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SKU / Code *</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. MS-WRL-01"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost_price"
                    value={formData.cost_price}
                    onChange={handleInputChange}
                    required
                    placeholder="25.00"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sale Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    placeholder="49.99"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    name="low_stock_threshold"
                    value={formData.low_stock_threshold}
                    onChange={handleInputChange}
                    placeholder="10"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT PRODUCT MODAL --- */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Edit Product: {currentProduct?.name}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SKU / Code *</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cost_price"
                    value={formData.cost_price}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sale Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    name="low_stock_threshold"
                    value={formData.low_stock_threshold}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
