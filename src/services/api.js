// Environment-aware API configuration
const getAPIBaseURL = () => {
  // Check if we're in production based on hostname
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname !== 'localhost' && 
     window.location.hostname !== '127.0.0.1' &&
     !window.location.hostname.includes('dev'));
  
  const baseURL = 'https://backend.getguarddog.com';
  
  console.log('🌐 API Configuration:', {
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    isProduction,
    baseURL,
    environment: process.env.NODE_ENV || 'development'
  });
  
  return baseURL;
};

const API_BASE_URL = getAPIBaseURL();

// Connection test function for debugging
export const testAPIConnection = async () => {
  const testUrl = `${API_BASE_URL}/health`;  // Add a health endpoint if available
  console.log('🔍 Testing API connectivity...');
  
  try {
    const response = await fetch(testUrl, { 
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔍 API connectivity test result:', {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    return { connected: response.ok, status: response.status };
  } catch (error) {
    console.error('🔍 API connectivity test failed:', error);
    return { connected: false, error: error.message };
  }
};

// Enhanced fetch with detailed logging, error handling, and retry mechanism
const enhancedFetch = async (url, options = {}, retryCount = 3, retryDelay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    const startTime = Date.now();
    
    console.log(`🌐 API Request (Attempt ${attempt}/${retryCount}):`, {
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body ? JSON.parse(options.body) : null,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      attempt
    });

    try {
      const response = await fetch(url, {
        ...options,
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : options.signal
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('🌐 API Response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        duration: `${duration}ms`,
        ok: response.ok,
        attempt
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response Body:', errorText);
        
        // Don't retry on client errors (4xx), only on server errors (5xx) and network issues
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
        }
        
        // Server error - might be worth retrying
        if (attempt === retryCount) {
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
        }
        
        console.warn(`⚠️ Server error (${response.status}), retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
        continue;
      }

      console.log(`✅ API Request succeeded on attempt ${attempt}`);
      return response;
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`❌ API Request Failed (Attempt ${attempt}/${retryCount}):`, {
        url,
        error: error.message,
        duration: `${duration}ms`,
        type: error.name,
        stack: error.stack,
        attempt
      });
      
      lastError = error;
      
      // Check for specific network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        lastError = new Error('Network connection failed. Please check your internet connection.');
      }
      
      // If this is the last attempt, throw the error
      if (attempt === retryCount) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      console.warn(`⚠️ Network error, retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2;
    }
  }
  
  console.error(`❌ All ${retryCount} attempts failed for ${url}`);
  throw lastError;
};

export const amazonAPI = {
  async getNDVIData() {
    try {
      const response = await enhancedFetch(`${API_BASE_URL}/api/amazon/ndvi/`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching NDVI data:', error);
      throw error;
    }
  },

  async getLSTData() {
    try {
      const response = await enhancedFetch(`${API_BASE_URL}/api/amazon/lst/`);
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
      const response = await enhancedFetch(`${API_BASE_URL}/api/custom/ndvi/`, {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom NDVI data:', error);
      throw error;
    }
  },

  async getLSTData(geometry) {
    try {
      const response = await enhancedFetch(`${API_BASE_URL}/api/custom/lst/`, {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom LST data:', error);
      throw error;
    }
  },

  async ndviPointAnalysis({ longitude, latitude, month }) {
    try {
      const response = await enhancedFetch(`${API_BASE_URL}/api/custom/point/ndvi/monthly/`, {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching NDVI point data:', error);
      throw error;
    }
  },

  async lstPointAnalysis({ longitude, latitude, month }) {
    try {
      const response = await enhancedFetch(`${API_BASE_URL}/api/custom/point/lst/monthly/`, {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching LST point data:', error);
      throw error;
    }
  },

  // Custom mode point APIs (non-monthly, same format as polygon)
  async ndviCustomPointAnalysis({ longitude, latitude }) {
    try {
      const response = await enhancedFetch(`${API_BASE_URL}/api/custom/point/ndvi/`, {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom NDVI point data:', error);
      throw error;
    }
  },

  async lstCustomPointAnalysis({ longitude, latitude }) {
    try {
      const response = await enhancedFetch(`${API_BASE_URL}/api/custom/point/lst/`, {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching custom LST point data:', error);
      throw error;
    }
  }
};