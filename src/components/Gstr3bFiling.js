// ========================================================================
// FILE: src/components/Gstr3bFiling.js (With Advanced GSTR-2B Auto-fill)
// ========================================================================
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

function Gstr3bFiling({ clientId, clientGstin }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [processedJson, setProcessedJson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [supplierItcData, setSupplierItcData] = useState([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const totalClaimedItc = supplierItcData
    .filter(supplier => supplier.isClaimed)
    .reduce((acc, supplier) => acc + supplier.totalItc, 0);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessingFile(true);
    setUploadMessage('Processing Excel file...');
    setSupplierItcData([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('b2b'));
        if (!sheetName) throw new Error("Could not find a 'B2B' sheet in the Excel file.");

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let headerRowIndex = -1;
        let gstinCol = -1, nameCol = -1, igstCol = -1, cgstCol = -1, sgstCol = -1;

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i].map(cell => (typeof cell === 'string' ? cell.toLowerCase() : cell));
          if (row.some(cell => typeof cell === 'string' && (cell.includes('gstin') && cell.includes('supplier')))) {
            headerRowIndex = i;
            gstinCol = row.findIndex(cell => typeof cell === 'string' && cell.includes('gstin') && cell.includes('supplier'));
            nameCol = row.findIndex(cell => typeof cell === 'string' && (cell.includes('trade') || cell.includes('name')));
            igstCol = row.findIndex(cell => typeof cell === 'string' && (cell.includes('integrated') || cell.includes('igst')));
            cgstCol = row.findIndex(cell => typeof cell === 'string' && (cell.includes('central') || cell.includes('cgst')));
            sgstCol = row.findIndex(cell => typeof cell === 'string' && (cell.includes('state/ut') || cell.includes('sgst')));
            break;
          }
        }

        if (headerRowIndex === -1) throw new Error("Could not find required columns in the B2B sheet.");

        const itcBySupplier = {};
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const gstin = row[gstinCol];
          if (gstin && gstin.length === 15) {
            if (!itcBySupplier[gstin]) {
              itcBySupplier[gstin] = { name: row[nameCol] || 'N/A', iamt: 0, camt: 0, samt: 0 };
            }
            if (typeof row[igstCol] === 'number') itcBySupplier[gstin].iamt += row[igstCol];
            if (typeof row[cgstCol] === 'number') itcBySupplier[gstin].camt += row[cgstCol];
            if (typeof row[sgstCol] === 'number') itcBySupplier[gstin].samt += row[sgstCol];
          }
        }

        const processedList = Object.keys(itcBySupplier).map(gstin => ({
          gstin,
          name: itcBySupplier[gstin].name,
          iamt: itcBySupplier[gstin].iamt,
          camt: itcBySupplier[gstin].camt,
          samt: itcBySupplier[gstin].samt,
          totalItc: itcBySupplier[gstin].iamt + itcBySupplier[gstin].camt + itcBySupplier[gstin].samt,
          isClaimed: true,
        }));

        setSupplierItcData(processedList);
        setUploadMessage(`Successfully processed ${processedList.length} suppliers from GSTR-2B.`);

      } catch (error) {
        console.error("Error processing Excel file:", error);
        setUploadMessage(`Error: ${error.message}`);
      } finally {
        setIsProcessingFile(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const handleClaimToggle = (gstinToToggle) => {
    setSupplierItcData(prevData =>
      prevData.map(supplier =>
        supplier.gstin === gstinToToggle
          ? { ...supplier, isClaimed: !supplier.isClaimed }
          : supplier
      )
    );
  };

  const handleProcessData = async () => {
    setLoading(true);
    setProcessedJson(null);
    const currentUser = auth.currentUser;
    if (!currentUser || !clientId) { setLoading(false); return; }

    const period = `${String(month).padStart(2, '0')}${year}`;
    const selectedMonth = month - 1;

    const salesInvoicesCollectionRef = collection(db, 'users', currentUser.uid, 'clients', clientId, 'salesInvoices');
    const salesPromise = new Promise(resolve => {
        onSnapshot(query(salesInvoicesCollectionRef), snapshot => {
            const invoices = [];
            snapshot.forEach(doc => invoices.push(doc.data()));
            resolve(invoices.filter(inv => new Date(inv.invoiceDate).getFullYear() === year && new Date(inv.invoiceDate).getMonth() === selectedMonth));
        });
    });

    const sales = await salesPromise;
    let totalTaxableValue = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    sales.forEach(inv => {
        totalTaxableValue += inv.taxableValue;
        const totalTax = inv.invoiceValue - inv.taxableValue;
        const isInterState = clientGstin.substring(0, 2) !== inv.placeOfSupply;
        if (isInterState) totalIgst += totalTax;
        else { totalCgst += totalTax / 2; totalSgst += totalTax / 2; }
    });

    const claimedSuppliers = supplierItcData.filter(s => s.isClaimed);
    const itcNet = {
        iamt: claimedSuppliers.reduce((acc, s) => acc + s.iamt, 0),
        camt: claimedSuppliers.reduce((acc, s) => acc + s.camt, 0),
        samt: claimedSuppliers.reduce((acc, s) => acc + s.samt, 0),
    };

    const finalJson = {
      gstin: clientGstin, fp: period,
      sup_details: { osup_det: { txval: totalTaxableValue, iamt: totalIgst, camt: totalCgst, samt: totalSgst, csamt: 0.00 }, isup_det: { txval: 0, iamt: 0 } },
      inter_sup: { unreg_details: [], comp_details: [], uin_details: [] },
      inward_sup: { isup_rev: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 } },
      itc_elg: {
        itc_avl: [{ ty: "OTH", iamt: itcNet.iamt, camt: itcNet.camt, samt: itcNet.samt }],
        itc_rev: [], itc_net: itcNet
      },
      tx_pay: { cgst: { amt: 0, chlln: 0 }, sgst: { amt: 0, chlln: 0 }, igst: { amt: 0, chlln: 0 }, cess: { amt: 0, chlln: 0 } },
      interest: { cgst: 0, sgst: 0, igst: 0, cess: 0 }, latefee: { cgst: 0, sgst: 0 }
    };

    setProcessedJson(finalJson);
    setLoading(false);
  };

  const handleExportJson = () => {
    if (!processedJson) { alert("Please process the data first."); return; }
    const jsonString = JSON.stringify(processedJson, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR3B_${clientGstin}_${String(month).padStart(2, '0')}${year}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">GSTR-3B Preparation & Export</h2>
      
      <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <label htmlFor="month-3b" className="block text-sm font-medium text-gray-700">Filing Month</label>
          <select id="month-3b" value={month} onChange={e => setMonth(Number(e.target.value))} className="mt-1 block w-full py-2 px-3 border rounded-md">
            {[...Array(12).keys()].map(i => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="year-3b" className="block text-sm font-medium text-gray-700">Filing Year</label>
          <select id="year-3b" value={year} onChange={e => setYear(Number(e.target.value))} className="mt-1 block w-full py-2 px-3 border rounded-md">
            {[...Array(5).keys()].map(i => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">Step 1: Auto-fill ITC from GSTR-2B</h3>
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        {uploadMessage && <p className={`mt-2 text-sm ${uploadMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{uploadMessage}</p>}
      </div>

      {supplierItcData.length > 0 && (
        <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">GSTR-2B Supplier Breakdown</h3>
            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 text-left">Claim</th>
                            <th className="p-2 text-left">Supplier Name</th>
                            <th className="p-2 text-left">GSTIN</th>
                            <th className="p-2 text-right">Total ITC (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {supplierItcData.map(supplier => (
                            <tr key={supplier.gstin} className="border-b">
                                <td className="p-2">
                                    <input type="checkbox" checked={supplier.isClaimed} onChange={() => handleClaimToggle(supplier.gstin)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                </td>
                                <td className="p-2">{supplier.name}</td>
                                <td className="p-2 font-mono">{supplier.gstin}</td>
                                <td className="p-2 text-right">{supplier.totalItc.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-200 font-bold">
                        <tr>
                            <td colSpan="3" className="p-2 text-right">Total Claimed ITC:</td>
                            <td className="p-2 text-right">₹{totalClaimedItc.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-2">Step 2: Process Data and Generate Summary</h3>
        <button onClick={handleProcessData} disabled={loading || isProcessingFile} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
          {loading ? 'Processing...' : 'Process Data'}
        </button>
      </div>

      {processedJson && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">GSTR-3B Summary for {processedJson.fp}</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-800">3.1 Outward Supplies</p>
              <p><strong>Taxable Value:</strong> ₹{processedJson.sup_details.osup_det.txval.toFixed(2)}</p>
              <p><strong>Total Tax:</strong> ₹{(processedJson.sup_details.osup_det.iamt + processedJson.sup_details.osup_det.camt + processedJson.sup_details.osup_det.samt).toFixed(2)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="font-semibold text-green-800">4. Eligible ITC (from selected GSTR-2B suppliers)</p>
              <p><strong>Net ITC:</strong> ₹{(processedJson.itc_elg.itc_net.iamt + processedJson.itc_elg.itc_net.camt + processedJson.itc_elg.itc_net.samt).toFixed(2)}</p>
            </div>
            <button onClick={handleExportJson} className="mt-4 w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-semibold">
              Export GSTR-3B JSON File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Gstr3bFiling;
