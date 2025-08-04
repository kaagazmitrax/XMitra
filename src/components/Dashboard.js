// ========================================================================
// FILE: src/components/Dashboard.js (With GST Insights Tab)
// ========================================================================
import React, { useState } from 'react';
import SalesLedger from './SalesLedger';
import PurchaseLedger from './PurchaseLedger';
import Gstr1Filing from './Gstr1Filing';
import Gstr3bFiling from './Gstr3bFiling';
import GstInsights from './GstInsights'; // Import the new Insights component

function Dashboard({ user, handleLogout, selectedClient, onBack }) {
  const [activeTab, setActiveTab] = useState('insights'); // Default to the new tab

  const activeTabStyle = 'border-blue-500 text-blue-600';
  const inactiveTabStyle = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Kaagaz MitraX</h1>
            <p className="text-sm text-gray-600">Managing: {selectedClient.name}</p>
          </div>
          <div className="flex items-center">
            <span className="text-gray-700 mr-4 hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-300"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <button onClick={onBack} className="text-blue-600 hover:underline">
            &larr; Back to Client List
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {/* NEW: GST Insights Tab */}
            <button
              onClick={() => setActiveTab('insights')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'insights' ? activeTabStyle : inactiveTabStyle}`}
            >
              GST Insights
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'sales' ? activeTabStyle : inactiveTabStyle}`}
            >
              Sales Ledger
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'purchases' ? activeTabStyle : inactiveTabStyle}`}
            >
              Purchase Ledger
            </button>
            <button
              onClick={() => setActiveTab('gstr1')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'gstr1' ? activeTabStyle : inactiveTabStyle}`}
            >
              GSTR-1 Filing
            </button>
            <button
              onClick={() => setActiveTab('gstr3b')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'gstr3b' ? activeTabStyle : inactiveTabStyle}`}
            >
              GSTR-3B Filing
            </button>
          </nav>
        </div>

        {/* Conditionally render the component based on the active tab */}
        <div className="flex justify-center">
          {/* NEW: Render GstInsights component */}
          {activeTab === 'insights' && <GstInsights selectedClient={selectedClient} />}
          {activeTab === 'sales' && <SalesLedger clientId={selectedClient.id} />}
          {activeTab === 'purchases' && <PurchaseLedger clientId={selectedClient.id} />}
          {activeTab === 'gstr1' && <Gstr1Filing clientId={selectedClient.id} clientGstin={selectedClient.gstin} />}
          {activeTab === 'gstr3b' && <Gstr3bFiling clientId={selectedClient.id} />}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;