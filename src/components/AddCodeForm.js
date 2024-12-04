import React, { useState } from 'react';

function AddCodeForm({ restaurant, onClose }) {
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const codes = JSON.parse(localStorage.getItem('codes')) || {};
    codes[restaurant.id] = code;
    localStorage.setItem('codes', JSON.stringify(codes));
    onClose();
  };

  return (
    <div className="add-code-form">
      <h3>Add Code for {restaurant.name}</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter restroom code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <button type="submit">Save Code</button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}

export default AddCodeForm;
