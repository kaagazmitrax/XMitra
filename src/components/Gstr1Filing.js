// ========================================================================
// FILE: src/components/Gstr1Filing.js (Portal-Compliant JSON)
// ========================================================================
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

function Gstr1Filing({ clientId, clientGstin }) {
  // State for the filing period
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [grossTurnover, setGrossTurnover] = useState(0); // Add state for GT
  
  // State for the sales data
  const [allInvoices, setAllInvoices] = useState([]);
  const [processedData, setProcessedData] = useState(null);

  // Fetch all invoices for the client once
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser && clientId) {
      const salesInvoicesCollectionRef = collection(db, 'users', currentUser.uid, 'clients', clientId, 'salesInvoices');
      const q = query(salesInvoicesCollectionRef);
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const invoices = [];
        querySnapshot.forEach((doc) => {
          invoices.push({ id: doc.id, ...doc.data() });
        });
        setAllInvoices(invoices);
      });

      return () => unsubscribe();
    }
  }, [clientId]);

  // Function to process the data for the selected period
  const handleProcessData = () => {
    const period = `${String(month).padStart(2, '0')}${year}`;
    
    // Filter invoices for the selected month and year
    const filteredInvoices = allInvoices.filter(inv => {
      const invoiceDate = new Date(inv.invoiceDate);
      return invoiceDate.getFullYear() === year && (invoiceDate.getMonth() + 1) === month;
    });

    // Separate invoices into B2B (with customer GSTIN) and B2C
    const b2bInvoices = filteredInvoices.filter(inv => inv.customerGstin && inv.customerGstin.length === 15);
    // In a full app, you would also process B2C invoices here.

    // Group B2B invoices by customer GSTIN
    const b2bGroupedByCustomer = b2bInvoices.reduce((acc, inv) => {
      const ctin = inv.customerGstin;
      if (!acc[ctin]) {
        acc[ctin] = [];
      }
      acc[ctin].push(inv);
      return acc;
    }, {});

    // Format the grouped B2B invoices into the final JSON structure
    const b2bFinal = Object.keys(b2bGroupedByCustomer).map(ctin => {
      const customerInvoices = b2bGroupedByCustomer[ctin];
      return {
        ctin: ctin,
        inv: customerInvoices.map(inv => {
          const totalTax = inv.invoiceValue - inv.taxableValue;
          const isInterState = clientGstin.substring(0, 2) !== inv.placeOfSupply;
          
          return {
            inum: inv.invoiceNumber,
            idt: new Date(inv.invoiceDate).toLocaleDateString('en-GB').replace(/\//g, '-'), // DD-MM-YYYY
            val: inv.invoiceValue,
            pos: inv.placeOfSupply,
            rchrg: "N",
            inv_typ: "R",
            itms: [{
              num: 1,
              itm_det: {
                txval: inv.taxableValue,
                rt: inv.gstRate,
                iamt: isInterState ? totalTax : 0.00,
                camt: !isInterState ? totalTax / 2 : 0.00,
                samt: !isInterState ? totalTax / 2 : 0.00,
                csamt: 0.00
              }
            }]
          };
        })
      };
    });

    const currentTurnover = filteredInvoices.reduce((acc, inv) => acc + inv.invoiceValue, 0);

    const finalJson = {
      gstin: clientGstin,
      fp: period,
      gt: Number(grossTurnover),
      cur_gt: currentTurnover,
      b2b: b2bFinal,
      // Add other sections like b2c, cdnr, etc. here in a full app
    };

    setProcessedData(finalJson);
  };

  // Function to handle JSON export
  const handleExportJson = () => {
    if (!processedData) {
      alert("Please process the data first.");
      return;
    }
    const jsonString = JSON.stringify(processedData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR1_${clientGstin}_${String(month).padStart(2, '0')}${year}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">GSTR-1 Preparation & Export</h2>
      
      {/* Period Selection & Gross Turnover */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <label htmlFor="month" className="block text-sm font-medium text-gray-700">Filing Month</label>
          <select id="month" value={month} onChange={e => setMonth(Number(e.target.value))} className="mt-1 block w-full py-2 px-3 border rounded-md">
            {[...Array(12).keys()].map(i => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700">Filing Year</label>
          <select id="year" value={year} onChange={e => setYear(Number(e.target.value))} className="mt-1 block w-full py-2 px-3 border rounded-md">
            {[...Array(5).keys()].map(i => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}
          </select>
        </div>
        <div>
            <label htmlFor="grossTurnover" className="block text-sm font-medium text-gray-700">Gross Turnover (Last FY)</label>
            <input type="number" id="grossTurnover" value={grossTurnover} onChange={e => setGrossTurnover(e.target.value)} placeholder="e.g., 1500000" className="mt-1 block w-full py-2 px-3 border rounded-md" />
        </div>
      </div>
      <div className="mb-6">
        <button onClick={handleProcessData} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            Process Data for Selected Period
        </button>
      </div>

      {/* Processed Data Display */}
      {processedData && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Processed Summary</h3>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p><strong>Period:</strong> {processedData.fp}</p>
            <p><strong>B2B Customers Found:</strong> {processedData.b2b.length}</p>
            <p><strong>Turnover for Period:</strong> ₹{processedData.cur_gt.toFixed(2)}</p>
            <button onClick={handleExportJson} className="mt-4 w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-semibold">
              Export GSTR-1 JSON File
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Gstr1Filing;
