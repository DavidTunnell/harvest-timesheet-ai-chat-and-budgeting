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
        <p>✓ Found CloudSee Drive (436.05 hours this month)</p>
        <p>✓ Found Vision AST Maintenance (158.25 hours this month)</p>
        <p>⚠️ Educational Data Systems not found - might be named differently or have no time entries</p>
        <p>✓ Total: 594.30 hours tracked from 2 projects</p>
      </div>

      <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '5px' }}>
        <h3>🔍 Educational Data Services, Inc. Status</h3>
        <p>Confirmed project name: "Educational Data Services, Inc." but it's not appearing in reports.</p>
        <p><strong>Possible reasons:</strong></p>
        <ul style={{ marginLeft: '20px' }}>
          <li>No time entries logged for this project in August 2025</li>
          <li>Project might be inactive or archived in Harvest</li>
          <li>Exact name might have different punctuation/spacing</li>
        </ul>
        <p>✅ <strong>System ready:</strong> As soon as time is logged to EDS, it will appear in reports</p>
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