// ========================================================================
// FILE: src/components/GstInsights.js
// ========================================================================
import React, { useState } from 'react';

// A reusable component to display API results in a structured card format
const ResultCard = ({ title, data, error }) => {
  if (error) {
    return <div className="mt-4 p-3 rounded-md text-center bg-red-100 text-red-800">{error}</div>;
  }
  if (!data) return null;

  return (
    <div className="mt-4 p-4 rounded-md bg-green-50 border border-green-200">
      <h4 className="font-bold text-lg mb-2 text-green-800">{title}</h4>
      <pre className="bg-white p-3 rounded text-sm whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

// Helper function to generate valid financial years
const generateFinancialYears = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  let startYear = currentYear;

  // If we are before April, the current financial year started last year
  if (currentMonth < 3) {
    startYear = currentYear - 1;
  }

  const years = [];
  for (let i = 0; i < 5; i++) {
    const year = startYear - i;
    years.push(`${year}-${String(year + 1).slice(2)}`);
  }
  return years;
};


function GstInsights({ selectedClient }) {
  const financialYears = generateFinancialYears();

  // Base URL for your secure worker
  const workerBaseUrl = 'https://kaagaz-gst-insights.kaagazwork.workers.dev';

  // State for Tool 1: Get GST Status
  const [statusResult, setStatusResult] = useState(null);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);

  // State for Tool 2: Get GST Details
  const [searchType, setSearchType] = useState('gstin'); // 'gstin' or 'pan'
  const [searchValue, setSearchValue] = useState('');
  const [detailsResult, setDetailsResult] = useState(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  // State for Tool 3: Get Return Filing Status
  const [filingYear, setFilingYear] = useState(financialYears[0]); // Default to the latest financial year
  const [filingStatusResult, setFilingStatusResult] = useState(null);
  const [isFetchingFilingStatus, setIsFetchingFilingStatus] = useState(false);

  // --- API Call Handlers ---

  const handleGetGstStatus = async () => {
    setIsFetchingStatus(true);
    setStatusResult(null);
    try {
      const url = `${workerBaseUrl}/getGSTStatus/${selectedClient.gstin}`;
      const response = await fetch(url);
      const data = await response.json();
      setStatusResult(response.ok ? data : { error: data.message || 'Failed to fetch status' });
    } catch (error) {
      setStatusResult({ error: 'Failed to connect to the API worker.' });
    }
    setIsFetchingStatus(false);
  };
  
  const handleGetGstDetails = async () => {
    if (!searchValue) {
      setDetailsResult({ error: 'Please enter a value to search.' });
      return;
    }
    setIsFetchingDetails(true);
    setDetailsResult(null);
    
    let endpoint = '';
    if (searchType === 'gstin') {
      endpoint = `/getGSTDetailsUsingGST/${searchValue}`;
    } else {
      endpoint = `/getGSTDetailsUsingPAN/${searchValue}`;
    }

    try {
      const url = `${workerBaseUrl}${endpoint}`;
      const response = await fetch(url);
      const data = await response.json();
      setDetailsResult(response.ok ? data : { error: data.message || 'Failed to fetch details' });
    } catch (error) {
      setDetailsResult({ error: 'Failed to connect to the API worker.' });
    }
    setIsFetchingDetails(false);
  };

  // UPDATED: This function now correctly processes the API's data structure
  const handleGetFilingStatus = async () => {
    setIsFetchingFilingStatus(true);
    setFilingStatusResult(null);
    try {
      const apiYearFormat = `${filingYear.split('-')[0]}-${filingYear.split('-')[0].slice(0,2)}${filingYear.split('-')[1]}`;
      const url = `${workerBaseUrl}/getGSTReturnFilingStatusSpecificYear/${selectedClient.gstin}/${apiYearFormat}`;
      const response = await fetch(url);
      const data = await response.json();

      console.log('Filing Status API Response:', data);

      if (response.ok) {
        const rawFilings = data?.data?.fillingData?.[apiYearFormat];
        if (Array.isArray(rawFilings)) {
          // Process the raw data into the format our table needs
          const monthlyData = {};
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

          rawFilings.forEach(filing => {
            const monthIndex = parseInt(filing.returnPeriod.substring(0, 2), 10) - 1;
            const monthName = monthNames[monthIndex];

            if (!monthlyData[monthName]) {
              monthlyData[monthName] = { month: monthName };
            }

            if (filing.returnType === 'GSTR1') {
              monthlyData[monthName].gstr1_status = filing.status || 'Filed';
              monthlyData[monthName].gstr1_dof = filing.dateOfFiling;
              monthlyData[monthName].gstr1_mof = filing.modeOfFiling;
            } else if (filing.returnType === 'GSTR3B') {
              monthlyData[monthName].gstr3b_status = filing.status || 'Filed';
              monthlyData[monthName].gstr3b_dof = filing.dateOfFiling;
              monthlyData[monthName].gstr3b_mof = filing.modeOfFiling;
            }
          });

          // Convert the processed object back to an array for rendering
          setFilingStatusResult(Object.values(monthlyData));
        } else {
          setFilingStatusResult([]);
        }
      } else {
        setFilingStatusResult({ error: data.message || 'Failed to fetch filing status' });
      }
    } catch (error) {
      setFilingStatusResult({ error: 'Failed to connect to the API worker.' });
    }
    setIsFetchingFilingStatus(false);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl space-y-10">
      {/* Tool 1: Get GST Status */}
      <div>
        <h3 className="text-xl font-bold mb-4 text-gray-800">Get GST Status</h3>
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <p className="flex-grow font-mono text-gray-700">{selectedClient.gstin}</p>
          <button onClick={handleGetGstStatus} disabled={isFetchingStatus} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300">
            {isFetchingStatus ? 'Fetching...' : 'Get Status'}
          </button>
        </div>
        <ResultCard title="GST Status Result" data={statusResult?.error ? null : statusResult} error={statusResult?.error} />
      </div>

      {/* Tool 2: Get GST Details */}
      <div>
        <h3 className="text-xl font-bold mb-4 text-gray-800">Get GST Details</h3>
        <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                    <label htmlFor="searchType" className="block text-sm font-medium text-gray-700">Search By</label>
                    <select id="searchType" value={searchType} onChange={e => setSearchType(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                        <option value="gstin">GSTIN</option>
                        <option value="pan">PAN</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="searchValue" className="block text-sm font-medium text-gray-700">Value</label>
                    <input type="text" id="searchValue" value={searchValue} onChange={e => setSearchValue(e.target.value.toUpperCase())} placeholder={searchType === 'gstin' ? selectedClient.gstin : 'Enter PAN...'} className="mt-1 block w-full px-3 py-2 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
            </div>
            <button onClick={handleGetGstDetails} disabled={isFetchingDetails} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                {isFetchingDetails ? 'Fetching...' : 'Get Details'}
            </button>
        </div>
        <ResultCard title="GST Details Result" data={detailsResult?.error ? null : detailsResult} error={detailsResult?.error} />
      </div>

      {/* Tool 3: Get GST Return Filing Status */}
      <div>
        <h3 className="text-xl font-bold mb-4 text-gray-800">Get GST Return Filing Status</h3>
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-grow">
            <label htmlFor="filingYear" className="block text-sm font-medium text-gray-700">Financial Year</label>
            <select id="filingYear" value={filingYear} onChange={e => setFilingYear(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
              {financialYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <button onClick={handleGetFilingStatus} disabled={isFetchingFilingStatus} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 self-end">
            {isFetchingFilingStatus ? 'Fetching...' : 'Get Status'}
          </button>
        </div>
        {filingStatusResult && (
          <div className="mt-4 p-3 rounded-md">
            {filingStatusResult.error ? (
              <p className="text-red-800 bg-red-100 p-3 text-center">{filingStatusResult.error}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th rowSpan="2" className="p-2 border align-middle">Month</th>
                      <th colSpan="3" className="p-2 border text-center">GSTR-1/IFF</th>
                      <th colSpan="3" className="p-2 border text-center">GSTR-3B</th>
                    </tr>
                    <tr>
                      <th className="p-2 border text-center">Status</th>
                      <th className="p-2 border text-center">Date of Filing</th>
                      <th className="p-2 border text-center">Mode</th>
                      <th className="p-2 border text-center">Status</th>
                      <th className="p-2 border text-center">Date of Filing</th>
                      <th className="p-2 border text-center">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(filingStatusResult) && filingStatusResult.length > 0 ? (
                      filingStatusResult.map((monthData, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 border font-semibold">{monthData.month}</td>
                          <td className={`p-2 border text-center ${monthData.gstr1_status === 'Filed' ? 'text-green-600' : 'text-red-600'}`}>{monthData.gstr1_status || '-'}</td>
                          <td className="p-2 border text-center">{monthData.gstr1_dof || '-'}</td>
                          <td className="p-2 border text-center">{monthData.gstr1_mof || '-'}</td>
                          <td className={`p-2 border text-center ${monthData.gstr3b_status === 'Filed' ? 'text-green-600' : 'text-red-600'}`}>{monthData.gstr3b_status || '-'}</td>
                          <td className="p-2 border text-center">{monthData.gstr3b_dof || '-'}</td>
                          <td className="p-2 border text-center">{monthData.gstr3b_mof || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="p-4 text-center text-gray-500 border">
                          No filing data found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GstInsights;
