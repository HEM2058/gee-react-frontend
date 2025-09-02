const API_BASE_URL = 'http://127.0.0.1:8000';

export const amazonAPI = {
  async getNDVIData() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/amazon/ndvi/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching NDVI data:', error);
      throw error;
    }
  },

  async getLSTData() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/amazon/lst/`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching LST data:', error);
      throw error;
    }
  }
};

export const customAPI = {
  async getNDVIData(geometry) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom/ndvi/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry: {
            geometry: {
              type: "Polygon",
              coordinates: geometry
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom NDVI data:', error);
      throw error;
    }
  },

  async getLSTData(geometry) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom/lst/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry: {
            geometry: {
              type: "Polygon",
              coordinates: geometry
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom LST data:', error);
      throw error;
    }
  }
};