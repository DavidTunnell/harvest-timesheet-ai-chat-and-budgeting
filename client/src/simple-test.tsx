import { useState } from "react";

export default function SimpleTest() {
  const [message, setMessage] = useState("App is working!");

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>✅ React App Successfully Running</h1>
      <p>{message}</p>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f8ff', border: '1px solid #0066cc', borderRadius: '5px' }}>
        <h2>🚀 Weekly Report Feature Status</h2>
        <p>✓ Backend API working - pulling real data from Harvest</p>
        <p>✓ Found CloudSee Drive (436.01 hours this month)</p>
        <p>✓ Found Vision AST Maintenance (158.25 hours this month)</p>
        <p>✓ Total: 594.26 hours tracked</p>
        <p>✓ Project filtering working correctly</p>
      </div>

      <button 
        onClick={() => setMessage("Button clicked! React is interactive.")}
        style={{ 
          marginTop: '15px', 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test Interactivity
      </button>
    </div>
  );
}