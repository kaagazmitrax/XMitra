// ========================================================================
// FILE: src/components/PurchaseLedger.js (Using Secure Cloudflare Worker)
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

function PurchaseLedger({ clientId }) {
  // State for form fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxableValue, setTaxableValue] = useState('');
  const [itcClaimed, setItcClaimed] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [verificationMessage, setVerificationMessage] = useState('');

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser && clientId) {
      const purchaseInvoicesCollectionRef = collection(db, 'users', currentUser.uid, 'clients', clientId, 'purchaseInvoices');
      const q = query(purchaseInvoicesCollectionRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const invoices = [];
        querySnapshot.forEach((doc) => {
          invoices.push({ id: doc.id, ...doc.data() });
        });
        setPurchaseInvoices(invoices);
        setLoadingInvoices(false);
      });

      return () => unsubscribe();
    }
  }, [clientId]);

  // UPDATED: This function now calls your secure Cloudflare Worker
  const handleVerifyGstin = async () => {
    if (!supplierGstin || supplierGstin.length !== 15) {
      setVerificationStatus('error');
      setVerificationMessage('Please enter a valid 15-digit GSTIN.');
      return;
    }
    setVerificationStatus('verifying');
    setVerificationMessage('Verifying...');

    // UPDATED with your actual Cloudflare Worker URL
    const workerUrl = `https://kaagaz-mitrax-api-proxy.kaagazwork.workers.dev/${supplierGstin}`;

    try {
      // The fetch call no longer contains any secret keys
      const response = await fetch(workerUrl);
      const data = await response.json();

      console.log('Full API Response from Worker:', data);

      if (response.ok && (data.isValid === true || data.success === true || data.data)) {
        setVerificationStatus('success');
        const legalName = data.data?.legalName || data.data?.lgnm || "Name not found";
        setVerificationMessage(`Verified: ${legalName}`);
        if (!supplierName) {
            setSupplierName(legalName);
        }
      } else {
        setVerificationStatus('error');
        setVerificationMessage(data.message || 'Invalid GSTIN or API error.');
      }
    } catch (error) {
      setVerificationStatus('error');
      setVerificationMessage('Failed to connect to verification service.');
      console.error("GSTIN verification error:", error);
    }
  };


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
      const purchaseInvoicesCollectionRef = collection(db, 'users', currentUser.uid, 'clients', clientId, 'purchaseInvoices');
      await addDoc(purchaseInvoicesCollectionRef, {
        invoiceNumber,
        supplierName,
        supplierGstin,
        invoiceDate,
        taxableValue: Number(taxableValue),
        itcClaimed: Number(itcClaimed),
        createdAt: serverTimestamp(),
      });
      setInvoiceNumber('');
      setSupplierName('');
      setSupplierGstin('');
      setTaxableValue('');
      setItcClaimed('');
      setVerificationStatus('idle');
      setVerificationMessage('');
      setMessage('Purchase invoice added successfully!');
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
      const invoiceDocRef = doc(db, 'users', currentUser.uid, 'clients', clientId, 'purchaseInvoices', invoiceToDelete.id);
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
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Add Purchase Invoice</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="p-invoiceDate">Invoice Date</label>
              <input required type="date" id="p-invoiceDate" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="p-invoiceNumber">Invoice Number</label>
              <input required type="text" id="p-invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="SUP-INV-001" className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
             {/* UPDATED: Supplier GSTIN field with Verify button */}
            <div className="col-span-1 md:col-span-2">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="p-supplierGstin">Supplier GSTIN</label>
                <div className="flex space-x-2">
                    <input 
                        type="text" 
                        id="p-supplierGstin" 
                        value={supplierGstin} 
                        onChange={(e) => {
                            setSupplierGstin(e.target.value.toUpperCase());
                            setVerificationStatus('idle'); // Reset on change
                        }} 
                        placeholder="27ABCDE1234F1Z5 (Optional)" 
                        className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                    <button 
                        type="button" 
                        onClick={handleVerifyGstin} 
                        disabled={verificationStatus === 'verifying'}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400"
                    >
                        Verify
                    </button>
                </div>
                {verificationMessage && (
                    <p className={`mt-2 text-sm ${
                        verificationStatus === 'success' ? 'text-green-600' : 
                        verificationStatus === 'error' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                        {verificationMessage}
                    </p>
                )}
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="p-supplierName">Supplier Name</label>
              <input required type="text" id="p-supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier Inc." className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="p-taxableValue">Taxable Value (₹)</label>
              <input required type="number" id="p-taxableValue" value={taxableValue} onChange={(e) => setTaxableValue(e.target.value)} placeholder="1000.00" className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="p-itcClaimed">ITC Claimed (₹)</label>
              <input required type="number" id="p-itcClaimed" value={itcClaimed} onChange={(e) => setItcClaimed(e.target.value)} placeholder="180.00" className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="mt-6">
            <button type="submit" disabled={isSubmitting} className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition duration-300 font-semibold disabled:bg-green-300">
              {isSubmitting ? 'Saving...' : 'Save Purchase Invoice'}
            </button>
          </div>
          {message && <p className={`mt-4 text-center text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
        </form>
      </div>

      <div className="mt-12 bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Saved Purchase Invoices</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3">Date</th>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Supplier GSTIN</th>
                <th className="p-3 text-right">ITC Claimed (₹)</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvoices ? (
                <tr><td colSpan="6" className="text-center p-4">Loading invoices...</td></tr>
              ) : purchaseInvoices.length > 0 ? (
                purchaseInvoices.map(invoice => (
                  <tr key={invoice.id} className="border-b">
                    <td className="p-3">{invoice.invoiceDate}</td>
                    <td className="p-3">{invoice.invoiceNumber}</td>
                    <td className="p-3">{invoice.supplierName}</td>
                    <td className="p-3 font-mono text-sm">{invoice.supplierGstin}</td>
                    <td className="p-3 text-right">{invoice.itcClaimed.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDeleteClick(invoice)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="text-center p-4">No purchase invoices found for this client.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default PurchaseLedger;
