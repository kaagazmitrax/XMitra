// ========================================================================
// FILE: src/components/ClientDashboard.js (With Delete Functionality)
// ========================================================================
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore'; // Import doc and deleteDoc
import Dashboard from './Dashboard';

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


function ClientDashboard({ user, handleLogout }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // NEW: State for the delete confirmation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const clientsCollectionRef = collection(db, 'users', currentUser.uid, 'clients');
      const q = query(clientsCollectionRef, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const clientsList = [];
        querySnapshot.forEach((doc) => {
          clientsList.push({ id: doc.id, ...doc.data() });
        });
        setClients(clientsList);
        setLoadingClients(false);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleAddClient = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setMessage('Error: You must be logged in.');
      setIsSubmitting(false);
      return;
    }
    try {
      const clientsCollectionRef = collection(db, 'users', currentUser.uid, 'clients');
      await addDoc(clientsCollectionRef, {
        name: clientName,
        gstin: clientGstin,
        createdAt: serverTimestamp(),
      });
      setClientName('');
      setClientGstin('');
      setMessage('Client added successfully!');
    } catch (error) {
      console.error("Error adding client: ", error);
      setMessage('Error: Could not add client.');
    }
    setIsSubmitting(false);
    setTimeout(() => setMessage(''), 3000);
  };

  // NEW: Function to open the delete confirmation modal
  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setIsModalOpen(true);
  };

  // NEW: Function to perform the actual deletion
  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    const currentUser = auth.currentUser;
    try {
      // Note: This deletes the client document, but not its subcollections (sales, purchases).
      // A full cleanup requires a Cloud Function for recursive deletion.
      const clientDocRef = doc(db, 'users', currentUser.uid, 'clients', clientToDelete.id);
      await deleteDoc(clientDocRef);
    } catch (error) {
      console.error("Error deleting client: ", error);
    }
    setIsModalOpen(false);
    setClientToDelete(null);
  };


  if (selectedClient) {
    return (
      <Dashboard
        user={user}
        handleLogout={handleLogout}
        selectedClient={selectedClient}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <>
      {/* NEW: Render the modal if it's open */}
      {isModalOpen && (
        <ConfirmationModal
          message={`Are you sure you want to delete the client "${clientToDelete?.name}"? This action cannot be undone.`}
          onConfirm={confirmDeleteClient}
          onCancel={() => setIsModalOpen(false)}
        />
      )}

      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-md">
          <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800">Kaagaz MitraX - Client Dashboard</h1>
            <div className="flex items-center">
              <span className="text-gray-700 mr-4 hidden sm:block">{user.email}</span>
              <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-300">
                Logout
              </button>
            </div>
          </nav>
        </header>
        <main className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Add New Client</h2>
                <form onSubmit={handleAddClient}>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="clientName">Client Name / Business Name</label>
                    <input required type="text" id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="ABC Corporation" className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="clientGstin">Client GSTIN</label>
                    <input required type="text" id="clientGstin" value={clientGstin} onChange={(e) => setClientGstin(e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-300 font-semibold disabled:bg-blue-300">
                    {isSubmitting ? 'Adding...' : 'Add Client'}
                  </button>
                  {message && <p className={`mt-4 text-center text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Your Clients</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3">Client Name</th>
                        <th className="p-3">GSTIN</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingClients ? (
                        <tr><td colSpan="3" className="text-center p-4">Loading clients...</td></tr>
                      ) : clients.length > 0 ? (
                        clients.map(client => (
                          <tr key={client.id} className="border-b">
                            <td className="p-3 font-medium">{client.name}</td>
                            <td className="p-3 font-mono text-sm">{client.gstin}</td>
                            <td className="p-3 space-x-2">
                              <button onClick={() => setSelectedClient(client)} className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 text-sm">Manage</button>
                              {/* NEW: Delete button */}
                              <button onClick={() => handleDeleteClick(client)} className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 text-sm">Delete</button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="3" className="text-center p-4">No clients found. Add one to get started.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default ClientDashboard;
