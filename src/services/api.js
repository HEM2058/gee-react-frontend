const API_BASE_URL = 'https://backend.getguarddog.com';

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
  },

  async ndviPointAnalysis({ longitude, latitude, month }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom/point/ndvi/monthly/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: latitude,
          longitude: longitude,
          month: month
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching NDVI point data:', error);
      throw error;
    }
  },

  async lstPointAnalysis({ longitude, latitude, month }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom/point/lst/monthly/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: latitude,
          longitude: longitude,
          month: month
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching LST point data:', error);
      throw error;
    }
  },

  // Custom mode point APIs (non-monthly, same format as polygon)
  async ndviCustomPointAnalysis({ longitude, latitude }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom/point/ndvi/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          object: {
            geometry: {
              type: "Point",
              coordinates: [longitude, latitude]
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom NDVI point data:', error);
      throw error;
    }
  },


  async lstCustomPointAnalysis({ longitude, latitude }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom/point/lst/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          object: {
            geometry: {
              type: "Point",
              coordinates: [longitude, latitude]
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom LST point data:', error);
      throw error;
    }
  }
};