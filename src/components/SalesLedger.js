// ========================================================================
// FILE: src/components/SalesLedger.js (With Detailed Fields)
// ========================================================================
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';

// A new Confirmation Modal component
const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center">
        <p className="text-lg mb-6">{message}</p>
        <div className="flex justify-center space-x-4">
          <button onClick={onCancel} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-400">
            Cancel
          </button>
          <button onClick={onConfirm} className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700">
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
);

function SalesLedger({ clientId }) {
  // State for the form fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState(''); // NEW
  const [placeOfSupply, setPlaceOfSupply] = useState('27'); // NEW (Default: Maharashtra)
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceValue, setInvoiceValue] = useState('');
  const [taxableValue, setTaxableValue] = useState('');
  const [gstRate, setGstRate] = useState('18');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const [salesInvoices, setSalesInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser && clientId) {
      const salesInvoicesCollectionRef = collection(db, 'users', currentUser.uid, 'clients', clientId, 'salesInvoices');
      const q = query(salesInvoicesCollectionRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const invoices = [];
        querySnapshot.forEach((doc) => {
          invoices.push({ id: doc.id, ...doc.data() });
        });
        setSalesInvoices(invoices);
        setLoadingInvoices(false);
      });

      return () => unsubscribe();
    }
  }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    const currentUser = auth.currentUser;
    if (!currentUser || !clientId) {
      setMessage('Error: A client must be selected.');
      setIsSubmitting(false);
      return;
    }
    try {
      const salesInvoicesCollectionRef = collection(db, 'users', currentUser.uid, 'clients', clientId, 'salesInvoices');
      await addDoc(salesInvoicesCollectionRef, {
        invoiceNumber,
        customerName,
        customerGstin, // NEW
        placeOfSupply, // NEW
        invoiceDate,
        invoiceValue: Number(invoiceValue),
        taxableValue: Number(taxableValue),
        gstRate: Number(gstRate),
        createdAt: serverTimestamp(),
      });
      // Reset form
      setInvoiceNumber('');
      setCustomerName('');
      setCustomerGstin('');
      setInvoiceValue('');
      setTaxableValue('');
      setMessage('Invoice added successfully!');
    } catch (error) {
      console.error("Error adding document: ", error);
      setMessage('Error: Could not save the invoice.');
    }
    setIsSubmitting(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteClick = (invoice) => {
    setInvoiceToDelete(invoice);
    setIsModalOpen(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    const currentUser = auth.currentUser;
    try {
      const invoiceDocRef = doc(db, 'users', currentUser.uid, 'clients', clientId, 'salesInvoices', invoiceToDelete.id);
      await deleteDoc(invoiceDocRef);
    } catch (error) {
      console.error("Error deleting invoice: ", error);
    }
    setIsModalOpen(false);
    setInvoiceToDelete(null);
  };

  return (
    <>
      {isModalOpen && (
        <ConfirmationModal
          message={`Are you sure you want to delete invoice #${invoiceToDelete?.invoiceNumber}?`}
          onConfirm={confirmDeleteInvoice}
          onCancel={() => setIsModalOpen(false)}
        />
      )}

      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Add Sales Invoice</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="invoiceDate">Invoice Date</label>
              <input required type="date" id="invoiceDate" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="invoiceNumber">Invoice Number</label>
              <input required type="text" id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customerName">Customer Name</label>
              <input required type="text" id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Doe" className="w-full px-3 py-2 border rounded-md" />
            </div>
            {/* NEW: Customer GSTIN Field */}
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="customerGstin">Customer GSTIN (Optional for B2C)</label>
              <input type="text" id="customerGstin" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z1" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="invoiceValue">Invoice Value (₹)</label>
              <input required type="number" id="invoiceValue" value={invoiceValue} onChange={(e) => setInvoiceValue(e.target.value)} placeholder="1180.00" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="taxableValue">Taxable Value (₹)</label>
              <input required type="number" id="taxableValue" value={taxableValue} onChange={(e) => setTaxableValue(e.target.value)} placeholder="1000.00" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gstRate">GST Rate (%)</label>
              <select id="gstRate" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-white">
                <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
              </select>
            </div>
            {/* NEW: Place of Supply Field */}
            <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="placeOfSupply">Place of Supply (State Code)</label>
                <input required type="text" id="placeOfSupply" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="27" className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>
          <div className="mt-6">
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300">
              {isSubmitting ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
          {message && <p className={`mt-4 text-center text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
        </form>
      </div>

      <div className="mt-12 bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Saved Sales Invoices</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3">Date</th>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Customer GSTIN</th>
                <th className="p-3 text-right">Amount (₹)</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvoices ? (
                <tr><td colSpan="6" className="text-center p-4">Loading invoices...</td></tr>
              ) : salesInvoices.length > 0 ? (
                salesInvoices.map(invoice => (
                  <tr key={invoice.id} className="border-b">
                    <td className="p-3">{invoice.invoiceDate}</td>
                    <td className="p-3">{invoice.invoiceNumber}</td>
                    <td className="p-3">{invoice.customerName}</td>
                    <td className="p-3 font-mono text-sm">{invoice.customerGstin || '-'}</td>
                    <td className="p-3 text-right">{invoice.invoiceValue.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDeleteClick(invoice)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="text-center p-4">No sales invoices found for this client.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default SalesLedger;
