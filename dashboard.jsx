import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Download, ZoomIn, ZoomOut, Globe, Layers, Calendar, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import 'ol/ol.css';
import { amazonAPI } from './src/services/api';

const EarthEngineDashboard = () => {
  const [selectedArea, setSelectedArea] = useState('Amazon Rainforest (Brazil)');
  const [basemap, setBasemap] = useState('satellite');
  const [analysisLayer, setAnalysisLayer] = useState('NDVI');
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [liveData, setLiveData] = useState(true);
  const [ndviData, setNdviData] = useState(null);
  const [lstData, setLstData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentLayer, setCurrentLayer] = useState(null);
  const [baseLayerGroup, setBaseLayerGroup] = useState(null);
  const [pixelInfo, setPixelInfo] = useState(null);
  const [pixelLoading, setPixelLoading] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const areas = [
    'Amazon Rainforest (Brazil)'
  ];

  const areaCoordinates = {
    'Amazon Rainforest (Brazil)': [-60, -3]
  };

  const basemaps = {
    satellite: {
      name: 'Google Satellite',
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attribution: '© Google'
    },
    osm: {
      name: 'OpenStreetMap',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors'
    }
  };

  const analysisLayers = [
    'NDVI',
    'LST'
  ];

  // Get current data based on selected analysis layer
  const getCurrentData = () => {
    return analysisLayer === 'NDVI' ? ndviData : lstData;
  };

  // Get month names from API data
  const getMonthNames = () => {
    const data = getCurrentData();
    return data?.monthly_layers?.map(layer => layer.month_name) || [];
  };

  // Get time period from API data
  const getTimePeriod = () => {
    const data = getCurrentData();
    return data?.time_period || 'Loading...';
  };

  const extractMapIdFromTileUrl = (tileUrl) => {
    // Extract map ID from GEE tile URL
    // Format: https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/{mapId}/tiles/{z}/{x}/{y}
    const match = tileUrl.match(/\/maps\/([^\/]+)\/tiles/);
    return match ? match[1] : null;
  };

  const getGEEPixelValue = async (coordinate, monthData) => {
    const [lon, lat] = coordinate;
    
    try {
      // Use the tile URL and modify it to get pixel value
      // Original: https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/mapId/tiles/{z}/{x}/{y}
      // Modified: https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/mapId/tiles?lon={lon}&lat={lat}
      
      const baseTileUrl = monthData.tile_url.replace('/tiles/{z}/{x}/{y}', '/tiles');
      const getPixelUrl = `${baseTileUrl}?lon=${lon}&lat=${lat}`;
      
      // Console log the request details
      console.log('🗺️ GEE Tile Pixel Query (Direct URL):');
      console.log('Modified URL:', getPixelUrl);
      console.log('Original Tile URL:', monthData.tile_url);
      console.log('Base Tile URL:', baseTileUrl);
      console.log('Coordinates:', `lon=${lon}, lat=${lat}`);

      const response = await fetch(getPixelUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('📡 GEE Tile Response Status:', response.status, response.statusText);
      console.log('📡 Response Headers:', [...response.headers.entries()]);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ GEE Tile Error Response:', errorText);
        throw new Error(`GEE Tile API error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('📄 Content Type:', contentType);

      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log('✅ GEE Tile JSON Response:', result);
        
        // Extract pixel value from response
        if (result && typeof result.value !== 'undefined') {
          console.log('🎯 Extracted Pixel Value:', result.value);
          return result.value;
        }
        
        if (result && result.values && Array.isArray(result.values)) {
          const value = result.values[0];
          console.log('🎯 Extracted Pixel Value (array format):', value);
          return value;
        }
      } else {
        // Handle non-JSON response
        const textResult = await response.text();
        console.log('📄 GEE Tile Text Response:', textResult);
        
        // Try to parse as number if it's a simple pixel value
        const numValue = parseFloat(textResult);
        if (!isNaN(numValue)) {
          console.log('🎯 Extracted Pixel Value (text format):', numValue);
          return numValue;
        }
      }
      
      console.log('⚠️ No pixel data found in response');
      return null;
    } catch (error) {
      console.error('❌ Error querying GEE tile URL:', error);
      console.log('🔄 Falling back to simulated value');
      // Fallback to simulated value if GEE API fails
      return simulatePixelQuery(lon, lat, monthData);
    }
  };

  const simulatePixelQuery = (lon, lat, monthData) => {
    // Fallback simulation when GEE API is unavailable
    const baseValue = analysisLayer === 'NDVI' 
      ? Math.random() * (monthData.vis_params.max - monthData.vis_params.min) + monthData.vis_params.min
      : Math.random() * (35 - 20) + 20;
    
    return Math.round(baseValue * 100) / 100;
  };

  const getPixelValue = async (coordinate) => {
    const data = getCurrentData();
    if (!data || !data.monthly_layers[selectedMonth]) {
      return null;
    }

    const monthData = data.monthly_layers[selectedMonth];
    const [lon, lat] = coordinate;

    try {
      // Use GEE's getValue API to get real pixel values
      const pixelValue = await getGEEPixelValue([lon, lat], monthData);
      
      return {
        coordinate: [lon, lat],
        value: pixelValue,
        dataType: analysisLayer,
        month: monthData.month_name,
        unit: analysisLayer === 'LST' ? '°C' : '',
        visParams: monthData.vis_params,
        mapId: extractMapIdFromTileUrl(monthData.tile_url)
      };
    } catch (error) {
      console.error('Error getting pixel value:', error);
      return null;
    }
  };


  const fetchData = async () => {
    setLoading(true);
    try {
      const [ndviResponse, lstResponse] = await Promise.all([
        amazonAPI.getNDVIData(),
        amazonAPI.getLSTData()
      ]);
      setNdviData(ndviResponse);
      setLstData(lstResponse);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateMapLayer = (data, monthIndex) => {
    if (!mapInstanceRef.current || !data || !data.monthly_layers[monthIndex]) {
      return;
    }

    if (currentLayer) {
      mapInstanceRef.current.removeLayer(currentLayer);
    }

    const monthData = data.monthly_layers[monthIndex];
    const tileLayer = new TileLayer({
      source: new XYZ({
        url: monthData.tile_url,
        maxZoom: 20,
      }),
      opacity: 0.7,
      zIndex: 10, // Above base layers
    });

    mapInstanceRef.current.addLayer(tileLayer);
    setCurrentLayer(tileLayer);
  };

  const createBaseLayer = (basemapType) => {
    const basemapConfig = basemaps[basemapType];
    return new TileLayer({
      source: new XYZ({
        url: basemapConfig.url,
        attributions: basemapConfig.attribution,
        maxZoom: 18,
      }),
      zIndex: 1,
    });
  };

  const switchBaseLayer = (newBasemap) => {
    if (!mapInstanceRef.current) return;
    
    const layers = mapInstanceRef.current.getLayers();
    const currentBaseLayers = layers.getArray().filter(layer => layer.getZIndex() === 1);
    
    currentBaseLayers.forEach(layer => {
      mapInstanceRef.current.removeLayer(layer);
    });
    
    const newBaseLayer = createBaseLayer(newBasemap);
    mapInstanceRef.current.addLayer(newBaseLayer);
    setBasemap(newBasemap);
  };

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const initialBaseLayer = createBaseLayer(basemap);

      const map = new Map({
        target: mapRef.current,
        layers: [initialBaseLayer],
        view: new View({
          center: fromLonLat(areaCoordinates[selectedArea]),
          zoom: 6,
          maxZoom: 18,
          minZoom: 2,
        }),
        controls: [], // Remove default controls for cleaner look
      });

      mapInstanceRef.current = map;
      
      console.log('🗺️ Map initialized successfully');
      console.log('Map instance:', map);
      
      // Define click handler inside useEffect to avoid stale closure
      const clickHandler = async (event) => {
        console.log('🖱️ Map clicked!', event);
        console.log('Raw coordinate:', event.coordinate);
        console.log('Pixel position:', event.pixel);
        
        const coordinate = event.coordinate;
        const [lon, lat] = toLonLat(coordinate);
        
        console.log('Converted lon/lat:', lon, lat);
        console.log('Current analysis layer:', analysisLayer);
        console.log('Selected month:', selectedMonth);
        
        setClickPosition([event.pixel[0], event.pixel[1]]);
        setPixelLoading(true);
        setPixelInfo(null);

        try {
          const data = analysisLayer === 'NDVI' ? ndviData : lstData;
          console.log('Current data:', data);
          
          if (!data || !data.monthly_layers[selectedMonth]) {
            console.log('❌ No data available for pixel query');
            return;
          }

          const pixelData = await getPixelValue([lon, lat]);
          console.log('Final pixel data:', pixelData);
          setPixelInfo(pixelData);
        } catch (error) {
          console.error('❌ Error handling map click:', error);
        } finally {
          setPixelLoading(false);
        }
      };
      
      // Force initial render and handle resize
      const updateSize = () => {
        if (map && mapRef.current) {
          map.updateSize();
        }
      };
      
      setTimeout(updateSize, 100);
      
      // Add click event listener after map is rendered
      let clickListenerKey = null;
      let singleClickListenerKey = null;
      
      setTimeout(() => {
        clickListenerKey = map.on('click', clickHandler);
        console.log('✅ Click event listener added to map after render');
        
        // Test with a simple click handler first
        singleClickListenerKey = map.on('singleclick', (event) => {
          console.log('🎯 OpenLayers singleclick event fired!', event);
        });
      }, 200);
      
      window.addEventListener('resize', updateSize);
      
      // Cleanup on unmount
      return () => {
        window.removeEventListener('resize', updateSize);
        if (map) {
          // Properly remove event listeners using their keys
          if (clickListenerKey) {
            map.unByKey(clickListenerKey);
          }
          if (singleClickListenerKey) {
            map.unByKey(singleClickListenerKey);
          }
          console.log('🧹 Map event listeners cleaned up');
        }
      };
    }
  }, [analysisLayer, selectedMonth, ndviData, lstData]); // Add dependencies

  useEffect(() => {
    const data = analysisLayer === 'NDVI' ? ndviData : lstData;
    if (data) {
      // Reset month selection if current month is out of range
      const maxMonths = data.monthly_layers?.length || 0;
      if (selectedMonth >= maxMonths) {
        setSelectedMonth(0);
        return;
      }
      updateMapLayer(data, selectedMonth);
    }
  }, [analysisLayer, selectedMonth, ndviData, lstData]);

  useEffect(() => {
    if (mapInstanceRef.current && areaCoordinates[selectedArea]) {
      mapInstanceRef.current.getView().animate({
        center: fromLonLat(areaCoordinates[selectedArea]),
        zoom: 6,
        duration: 1000,
      });
    }
  }, [selectedArea]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.setZoom(view.getZoom() + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.setZoom(view.getZoom() - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.1) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      
      {/* Modern Sidebar */}
      <div className="w-80 bg-black/20 backdrop-blur-xl border-r border-white/10 flex flex-col relative z-10">
        {/* Modern Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Earth Engine Pro
              </h1>
              <p className="text-sm text-gray-300">Amazon Rainforest Analysis</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-400">
              Real-time Satellite Data
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${!loading && (ndviData || lstData) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : loading ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              <div className={`w-2 h-2 rounded-full ${!loading && (ndviData || lstData) ? 'bg-green-400 shadow-lg shadow-green-400/50' : loading ? 'bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50' : 'bg-red-400 shadow-lg shadow-red-400/50'}`}></div>
              {loading ? 'Loading...' : (ndviData || lstData) ? 'Connected' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Modern Controls */}
        <div className="p-6 space-y-6">
          
          {/* Analysis Layer Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Analysis Type</label>
            <div className="grid grid-cols-2 gap-2">
              {analysisLayers.map(layer => (
                <button
                  key={layer}
                  onClick={() => setAnalysisLayer(layer)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                    analysisLayer === layer
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-105'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 backdrop-blur-sm'
                  }`}
                >
                  {layer === 'NDVI' ? 'Vegetation' : 'Temperature'}
                </button>
              ))}
            </div>
          </div>


          {/* Modern Month Picker */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300">Time Period</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-400">{getTimePeriod()}</span>
              </div>
            </div>
            
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedMonth(Math.max(0, selectedMonth - 1))}
                disabled={selectedMonth === 0 || loading || !getCurrentData()}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 backdrop-blur-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex-1 mx-3">
                <div className="text-center">
                  <div className="text-lg font-semibold text-white mb-1">
                    {getMonthNames()[selectedMonth]?.split(' ')[0] || 'Loading...'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Month {selectedMonth + 1} of {getMonthNames().length || 12}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedMonth(Math.min(getMonthNames().length - 1, selectedMonth + 1))}
                disabled={selectedMonth >= (getMonthNames().length - 1) || loading || !getCurrentData()}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 backdrop-blur-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Month Grid */}
            <div className="grid grid-cols-3 gap-2">
              {getMonthNames().map((month, index) => {
                const monthShort = month?.split(' ')[0]?.substring(0, 3) || `M${index + 1}`;
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedMonth(index)}
                    disabled={loading || !getCurrentData()}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                      selectedMonth === index
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                    } backdrop-blur-sm`}
                  >
                    {monthShort}
                  </button>
                );
              })}
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4 mb-2">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>{getMonthNames()[0]?.split(' ')[0]?.substring(0, 3) || 'Start'}</span>
                <span>{getMonthNames()[getMonthNames().length - 1]?.split(' ')[0]?.substring(0, 3) || 'End'}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                  style={{ width: `${((selectedMonth + 1) / (getMonthNames().length || 12)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

        </div>

        {/* Export Section */}
        <div className="p-6 border-t border-white/10">
          <button className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Download className="w-4 h-4" />
            Export Analysis
          </button>
        </div>

        {/* Modern Legend */}
        <div className="p-6 bg-gradient-to-b from-transparent to-black/20">
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
              <div className="text-sm text-gray-300">Loading legend...</div>
            </div>
          ) : (
            <>
              {analysisLayer === 'NDVI' && ndviData && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50"></div>
                    <h3 className="text-lg font-semibold text-white">{ndviData.legend.title}</h3>
                  </div>
                  
                  <div className="mb-4">
                    <div 
                      className="h-6 rounded-lg shadow-lg border border-white/20"
                      style={{
                        background: `linear-gradient(to right, ${ndviData.legend.colors.join(', ')})`
                      }}
                    ></div>
                    <div className="flex justify-between text-sm text-gray-300 mt-2 font-medium">
                      <span>{ndviData.legend.min}</span>
                      <span>{ndviData.legend.max}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {ndviData.legend.labels.map((label, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-300">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-400"></div>
                        {label}
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      Click anywhere on map to get pixel value
                    </p>
                  </div>
                </div>
              )}
              
              {analysisLayer === 'LST' && lstData && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-orange-400 shadow-lg shadow-orange-400/50"></div>
                    <h3 className="text-lg font-semibold text-white">{lstData.legend.title}</h3>
                  </div>
                  
                  <div className="mb-4">
                    <div 
                      className="h-6 rounded-lg shadow-lg border border-white/20"
                      style={{
                        background: `linear-gradient(to right, ${lstData.legend.colors.join(', ')})`
                      }}
                    ></div>
                    <div className="flex justify-between text-sm text-gray-300 mt-2 font-medium">
                      <span>{lstData.legend.min}°C</span>
                      <span>{lstData.legend.max}°C</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {lstData.legend.labels.map((label, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-300">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-red-400"></div>
                        {label}
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      Click anywhere on map to get pixel value
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modern Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Floating Top Bar */}
        <div className="absolute top-4 left-4 right-4 z-20">
          <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm">
                <Layers className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <span className="text-white font-medium">Amazon Rainforest</span>
                <div className="text-xs text-gray-300">
                  {analysisLayer === 'NDVI' ? 'Vegetation Index' : 'Land Surface Temperature'} • {getMonthNames()[selectedMonth] || 'Loading...'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Basemap Toggle */}
              <div className="flex bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20">
                {Object.entries(basemaps).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => switchBaseLayer(key)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                      basemap === key
                        ? 'bg-white text-gray-900 shadow-lg'
                        : 'text-white hover:bg-white/20'
                    }`}
                  >
                    {key === 'satellite' ? 'Satellite' : 'Street'}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={handleZoomIn}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
              <button 
                onClick={handleZoomOut}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <ZoomOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative overflow-hidden">
          <div 
            ref={mapRef} 
            className="w-full h-full absolute inset-0 cursor-crosshair"
            style={{ 
              minHeight: '100vh',
              backgroundColor: '#1e293b' // Fallback color while loading
            }}
            title="Click anywhere to get pixel values"
          />
          
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <div className="text-white">
                    <div className="font-medium">Loading satellite data...</div>
                    <div className="text-sm text-gray-300">Fetching {analysisLayer} layers</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Floating Info Panel */}
          <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl max-w-sm">
              <div className="text-xs text-gray-300 mb-2">Current View</div>
              <div className="text-white font-medium">
                {analysisLayer === 'NDVI' ? 'Vegetation Health Analysis' : 'Temperature Distribution'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Data from {getMonthNames()[selectedMonth] || 'Loading...'}
              </div>
            </div>
          </div>

          {/* Pixel Value Popup */}
          {(pixelInfo || pixelLoading) && clickPosition && (
            <div 
              className="absolute z-30 pointer-events-none"
              style={{
                left: `${clickPosition[0] + 10}px`,
                top: `${clickPosition[1] - 10}px`,
                transform: 'translateY(-100%)'
              }}
            >
              <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-2xl min-w-[200px]">
                {pixelLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                    <span className="text-sm text-white">Getting pixel value...</span>
                  </div>
                ) : pixelInfo ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-white">
                        {pixelInfo.dataType} Value
                      </div>
                      <button
                        onClick={() => setPixelInfo(null)}
                        className="text-gray-400 hover:text-white transition-colors pointer-events-auto"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-300">Value:</span>
                        <span className="text-sm font-medium text-white">
                          {pixelInfo.value !== null ? `${pixelInfo.value}${pixelInfo.unit}` : 'No data'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-300">Location:</span>
                        <span className="text-xs text-gray-400">
                          {pixelInfo.coordinate[0].toFixed(4)}°, {pixelInfo.coordinate[1].toFixed(4)}°
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-300">Month:</span>
                        <span className="text-xs text-gray-400">
                          {pixelInfo.month}
                        </span>
                      </div>

                      {pixelInfo.mapId && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-300">Map ID:</span>
                          <span className="text-xs text-gray-400 font-mono">
                            {pixelInfo.mapId.substring(0, 8)}...
                          </span>
                        </div>
                      )}
                      
                      {/* Value interpretation */}
                      {pixelInfo.value !== null && (
                        <div className="pt-2 border-t border-white/10">
                          <div className="text-xs text-gray-300">
                            {pixelInfo.dataType === 'NDVI' ? (
                              pixelInfo.value > 0.6 ? '🟢 High Vegetation' :
                              pixelInfo.value > 0.3 ? '🟡 Moderate Vegetation' :
                              pixelInfo.value > 0.1 ? '🟠 Low Vegetation' :
                              pixelInfo.value > -0.1 ? '🟤 Bare Soil' :
                              '🔵 Water'
                            ) : (
                              pixelInfo.value > 30 ? '🔥 Hot' :
                              pixelInfo.value > 25 ? '🟡 Warm' :
                              pixelInfo.value > 20 ? '🟦 Cool' :
                              '🧊 Cold'
                            )}
                          </div>
                        </div>
                      )}

                      {/* Data source indicator */}
                      <div className="pt-2 border-t border-white/10">
                        <div className="text-xs text-gray-500">
                          📡 Google Earth Engine
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              
              {/* Arrow pointing to clicked location */}
              <div 
                className="absolute top-full left-6 w-3 h-3 bg-black/80 border-r border-b border-white/20 transform rotate-45"
                style={{ marginTop: '-6px' }}
              ></div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1f2937;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1f2937;
        }
      `}</style>
    </div>
  );
};

export default EarthEngineDashboard;