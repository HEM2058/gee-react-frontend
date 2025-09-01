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