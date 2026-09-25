'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand
} from '../../services/product.service.js';

// Helper function outside component to avoid reference updates
const getBrandName = (brand) => brand.brandName || brand.brand_name || '';

export default function BrandTab({
  isActive = true,
  brands: initialBrands = [],
  onSave,
  onDelete,
  formSubBg = 'transparent',
  tableHeaderBg = 'transparent',
  inputBg = 'transparent',
  borderRow = 'transparent',
}) {
  const [brandName, setBrandName] = useState('');
  const [logo, setLogo] = useState('');
  const [brands, setBrands] = useState(initialBrands);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const hasFetchedRef = useRef(false);

  // Fetch brands API call
  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedBrands = await getAllBrands();
      setBrands(fetchedBrands.data || []);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch strictly ONCE when tab becomes active
  useEffect(() => {
    if (isActive && !hasFetchedRef.current) {
      fetchBrands();
    }
  }, [isActive, fetchBrands]);

  // Performance Optimization: Memoize transformed list to prevent O(N) calculations on input keypresses
  const memoizedBrands = useMemo(() => {
    return brands.map(brand => ({
      ...brand,
      displayName: getBrandName(brand),
    }));
  }, [brands]);

  // Stable handlers using useCallback
  const resetForm = useCallback(() => {
    setBrandName('');
    setLogo('');
    setEditingId(null);
  }, []);

  const handleEditClick = useCallback((brand) => {
    setEditingId(brand.id);
    setBrandName(getBrandName(brand));
    setLogo(brand.logo || '');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) return;

    setLoading(true);
    const payload = {
      brand_name: brandName.trim(),
      logo: logo.trim() || null,
    };

    try {
      if (editingId) {
        await updateBrand(editingId, payload);
      } else {
        await createBrand(payload);
      }

      await fetchBrands();

      if (onSave) {
        onSave(payload, editingId ? String(editingId) : null);
      }

      resetForm();
    } catch (err) {
      console.error('Failed to save brand:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = useCallback(async (id) => {
    setLoading(true);
    try {
      await deleteBrand(id);
      await fetchBrands();

      if (onDelete) {
        onDelete(String(id));
      }
    } catch (err) {
      console.error('Failed to delete brand:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchBrands, onDelete]);

  if (!isActive) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Brand Form */}
      <form onSubmit={handleSubmit} className={`${formSubBg} p-5 rounded-xl border space-y-4 h-fit`}>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          {editingId ? 'Edit Brand' : 'Add Brand'}
        </h3>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Brand Name</label>
          <input
            type="text"
            required
            disabled={loading}
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            className={`w-full text-xs p-2.5 rounded-lg border outline-none ${inputBg}`}
            placeholder="e.g. Sony, Apple, Nike"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2.5 rounded-lg font-bold shadow-lg shadow-indigo-600/20 transition"
          >
            {loading ? 'Saving...' : editingId ? 'Update Brand' : 'Save Brand'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-lg font-bold transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Brands Table View */}
      <div className="lg:col-span-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className={`text-xs uppercase font-bold border-b ${tableHeaderBg}`}>
            <tr>
              <th className="p-3">Brand Name</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {memoizedBrands.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-4 text-center text-xs text-slate-400">
                  No brands found.
                </td>
              </tr>
            ) : (
              memoizedBrands.map(brand => (
                <tr key={brand.id} className={`hover:bg-indigo-500/5 ${borderRow}`}>
                  <td className="p-3 font-bold">{brand.displayName}</td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => handleEditClick(brand)}
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id)}
                      className="text-xs text-rose-500 hover:underline"
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
  );
}