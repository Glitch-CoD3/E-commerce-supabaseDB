'use client';

import { useState, useEffect } from 'react';
import axiosInstance from '../../../api/axiosInstance.js';

// Components
import Header from '../../../components/admin_dashboard/Header.jsx';
import BrandTab from '../../../components/admin_dashboard/BrandTab.jsx';
import CategoryTab from '../../../components/admin_dashboard/CategoryTab.jsx';
import OrderTab from '../../../components/admin_dashboard/OrderTab.jsx';
import ProductTab from '../../../components/admin_dashboard/ProductTab.jsx';
import PaidCustomerTab from '../../../components/admin_dashboard/PaidCustomerTab.jsx';
import TopSellingTab from '../../../components/admin_dashboard/TopSellingTab.jsx';
import OrderModal from '../../../components/admin_dashboard/OrderModal.jsx';

import { getAllBrands, getAllProducts, getCategories } from '../../../services/product.service.js';

function StatsOverview({ cardBg }) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {['Products', 'Categories', 'Brands', 'Orders'].map(label => (
        <div key={label} className={`${cardBg} rounded-2xl border p-5`}>
          <p className="text-sm text-slate-400">Total {label}</p>
        </div>
      ))}
    </section>
  );
}

export default function SinglePageAdmin() {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('products');

  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const extractData = res => (res && res.data !== undefined ? res.data : res);

  // --- API FETCHING ---
  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Renamed local variable to avoid shadowing state 'brands'
        const fetchedBrands = await getAllBrands();
        setBrands(fetchedBrands.data);

        const fetchedProducts = await getAllProducts();
        setProducts(fetchedProducts.data);

        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories.All_categories);

      } catch (err) {
        console.error('Fetch error:', err);
        setBrands([]); // Fallback array on error
      }
    };

    fetchAll();
  }, []);

  // --- PRODUCT HANDLERS ---
  const handleSaveProduct = async (productData, editingId) => {
    try {
      if (editingId) {
        const res = await axiosInstance.put(`/products/${editingId}`, productData);
        const updated = extractData(res);
        setProducts(products.map(p => (p.id === editingId ? updated : p)));
      } else {
        const res = await axiosInstance.post('/products', productData);
        const created = extractData(res);
        setProducts([...products, created]);
      }
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleDeleteProduct = async id => {
    try {
      await axiosInstance.delete(`/products/${id}`);
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  // --- BRAND HANDLERS ---
  const handleSaveBrand = async (name, editingId) => {
    try {
      if (editingId) {
        const res = await axiosInstance.put(`/brands/${editingId}`, { name });
        const updated = extractData(res);
        setBrands(brands.map(b => (b.id === editingId ? updated : b)));
      } else {
        const res = await axiosInstance.post('/brands', { name });
        const created = extractData(res);
        setBrands([...brands, created]);
      }
    } catch (err) {
      console.error('Error saving brand:', err);
    }
  };

  const handleDeleteBrand = async id => {
    try {
      await axiosInstance.delete(`/brands/${id}`);
      setBrands(brands.filter(b => b.id !== id));
    } catch (err) {
      console.error('Error deleting brand:', err);
    }
  };

  // --- CATEGORY HANDLERS ---
  const handleSaveCategory = async (data, editingId) => {
    try {
      if (editingId) {
        const res = await axiosInstance.put(`/categories/${editingId}`, data);
        const updated = extractData(res);
        setCategories(categories.map(c => (c.id === editingId ? updated : c)));
      } else {
        const res = await axiosInstance.post('/categories', data);
        const created = extractData(res);
        setCategories([...categories, created]);
      }
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const handleDeleteCategory = async id => {
    try {
      await axiosInstance.delete(`/categories/${id}`);
      setCategories(categories.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  // --- THEME UTILS ---
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const cardBg = isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const inputBg = isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900';
  const formSubBg = isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100/70 border-slate-200';
  const tableHeaderBg = isDark ? 'bg-slate-900/50 text-slate-400 border-slate-800' : 'bg-slate-100/80 text-slate-600 border-slate-200';
  const borderRow = isDark ? 'border-slate-800/80' : 'border-slate-100';

  const getStatusBadge = status => {
    const colors = {
      paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      cancelled: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      unpaid: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    };
    return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${colors[status]}`}>{status}</span>;
  };

  // Safe evaluation ensuring array methods like .filter do not throw uncaught errors
  const paidOrders = Array.isArray(orders) ? orders.filter(o => o.status === 'paid') : [];

  return (
    <div className={`min-h-screen ${bgMain} p-6 space-y-8 font-sans transition-colors duration-300`}>
      <Header theme={theme} setTheme={setTheme} />

      <StatsOverview cardBg={cardBg} />

      <section className={`${cardBg} rounded-2xl border backdrop-blur-md overflow-hidden shadow-xl`}>
        {/* Navigation Tabs Header */}
        <div className="flex flex-wrap border-b border-slate-800/40 px-6 pt-3 gap-6 bg-slate-950/20">
          {(
            [
              { id: 'products', label: 'Products' },
              { id: 'categories', label: 'Categories' },
              { id: 'brands', label: 'Brands' },
              { id: 'orders', label: 'All Orders' },
              { id: 'paid_customers', label: 'Paid Customers' },
              { id: 'top_selling', label: 'Top Selling' },
            ]
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3.5 text-sm font-bold transition-all border-b-2 ${activeTab === tab.id ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panes */}
        <div className="p-6">
          {activeTab === 'products' && (
            <ProductTab {...({
              products,
              categories,
              brands,
              onSave: handleSaveProduct,
              onDelete: handleDeleteProduct,
              formSubBg,
              tableHeaderBg,
              inputBg,
              borderRow,
            })} />
          )}

          {activeTab === 'categories' && (
            <CategoryTab
              categories={categories}
              onSave={handleSaveCategory}
              onDelete={handleDeleteCategory}
              formSubBg={formSubBg}
              tableHeaderBg={tableHeaderBg}
              inputBg={inputBg}
              borderRow={borderRow}
            />
          )}

          {activeTab === 'brands' && (
            <BrandTab
              brands={brands}
              onSave={handleSaveBrand}
              onDelete={handleDeleteBrand}
              formSubBg={formSubBg}
              tableHeaderBg={tableHeaderBg}
              inputBg={inputBg}
              borderRow={borderRow}
            />
          )}

          {activeTab === 'orders' && (
            <OrderTab
              orders={orders}
              onSelectOrder={setSelectedOrder}
              getStatusBadge={getStatusBadge}
              tableHeaderBg={tableHeaderBg}
              borderRow={borderRow}
            />
          )}

          {activeTab === 'paid_customers' && (
            <PaidCustomerTab
              paidOrders={paidOrders}
              tableHeaderBg={tableHeaderBg}
              borderRow={borderRow}
            />
          )}

          {activeTab === 'top_selling' && (
            <TopSellingTab
              products={products}
              tableHeaderBg={tableHeaderBg}
              borderRow={borderRow}
            />
          )}
        </div>
      </section>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          getStatusBadge={getStatusBadge}
          cardBg={cardBg}
          formSubBg={formSubBg}
        />
      )}
    </div>
  );
}