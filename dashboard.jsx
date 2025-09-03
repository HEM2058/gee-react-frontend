import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Download, ZoomIn, ZoomOut, Globe, Layers, Calendar, ChevronLeft, ChevronRight, Play, Pause, Square, BarChart3, FileText, Check, X } from 'lucide-react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Draw from 'ol/interaction/Draw';
import { fromLonLat, toLonLat } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line } from 'recharts';
// import jsPDF from 'jspdf';
// import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import 'ol/ol.css';
import { amazonAPI, customAPI, testAPIConnection } from './src/services/api';

// Statistics Chart Component
const StatisticsChart = ({ data, dataType, selectedMonth, onMonthSelect }) => {
  if (!data || data.length === 0) return null;

  // Prepare data for the chart
  const chartData = data.map((item, index) => ({
    month: item.month_name.split(' ')[0], // Just the month name
    mean: item.statistics.mean,
    min: item.statistics.min,
    max: item.statistics.max,
    fullName: item.month_name,
    isSelected: index === selectedMonth
  }));

  const exportToCSV = () => {
    const csvData = data.map(item => ({
      month: item.month_name,
      mean: item.statistics.mean,
      min: item.statistics.min,
      max: item.statistics.max
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${dataType}_statistics.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getColor = (type) => {
    if (dataType === 'NDVI') {
      return {
        mean: '#10b981', // green-500
        min: '#ef4444',  // red-500
        max: '#3b82f6'   // blue-500
      };
    } else {
      return {
        mean: '#f59e0b', // amber-500
        min: '#06b6d4',  // cyan-500
        max: '#dc2626'   // red-600
      };
    }
  };

  const colors = getColor(dataType);

  return (
    <div className="w-full">
      {/* Export Button */}
      <div className="mb-2 flex justify-end">
        <button
          onClick={exportToCSV}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
          title={`Export ${dataType} statistics to CSV`}
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

    </div>
  );
};

// Monthly Point Data Popup Component
const MonthlyPointDataPopup = ({ data, analysisLayer, coordinates, loading, onClose }) => {
  if (!data && !loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-600 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Monthly {analysisLayer} Analysis
              </h3>
              {coordinates && (
                <p className="text-sm text-gray-400 mt-1">
                  📍 {coordinates[1].toFixed(6)}°, {coordinates[0].toFixed(6)}°
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="ml-3 text-gray-300">Loading monthly data...</span>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Analysis Results */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">Analysis Results</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">{analysisLayer} Value:</span>
                    <span className="text-white font-mono">
                      {(() => {
                        // Try specific median fields first based on analysis layer
                        if (analysisLayer === 'NDVI' && data.median_ndvi !== undefined) {
                          return data.median_ndvi.toFixed(4);
                        } else if (analysisLayer === 'LST' && data.median_lst !== undefined) {
                          return data.median_lst.toFixed(4);
                        } else if (data.value !== undefined) {
                          // Fallback to generic value field
                          return data.value.toFixed(4);
                        } else {
                          return 'N/A';
                        }
                      })()}
                    </span>
                  </div>
                  
                  {data.month && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Month:</span>
                      <span className="text-white">{data.month}</span>
                    </div>
                  )}
                  
                  {data.year && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Year:</span>
                      <span className="text-white">{data.year}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Data */}
              {data.additional_info && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-3">Additional Information</h4>
                  <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-x-auto">
                    {JSON.stringify(data.additional_info, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">❌ No data available</div>
              <p className="text-sm text-gray-500">Unable to fetch monthly data for this location.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Horizontal Statistics Popup Component
const StatisticsPopup = ({ ndviData, lstData, selectedMonth, onMonthSelect, onClose }) => {
  if (!ndviData && !lstData) return null;

  const createHorizontalChart = (data, dataType) => {
    if (!data || !data.length) return null;
    
    const chartData = data.map((item, index) => ({
      month: item.month_name.split(' ')[0].substring(0, 3),
      mean: item.statistics.mean,
      min: item.statistics.min,
      max: item.statistics.max,
      fullName: item.month_name,
      isSelected: index === selectedMonth
    }));

    const colors = dataType === 'NDVI' ? {
      mean: '#10b981', min: '#ef4444', max: '#3b82f6'
    } : {
      mean: '#f59e0b', min: '#06b6d4', max: '#dc2626'
    };

    return (
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 15 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#374151" opacity={0.2} />
            <XAxis 
              dataKey="month" 
              stroke="#9ca3af"
              fontSize={10}
            />
            <YAxis 
              stroke="#9ca3af"
              fontSize={9}
              domain={['dataMin - 0.05', 'dataMax + 0.05']}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px'
              }}
              formatter={(value, name) => [
                value.toFixed(4), 
                name.charAt(0).toUpperCase() + name.slice(1)
              ]}
            />
            <Bar dataKey="mean" fill={colors.mean} opacity={0.8} />
            <Bar dataKey="min" fill={colors.min} opacity={0.6} />
            <Bar dataKey="max" fill={colors.max} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const getCardColor = (type) => {
    if (type === 'NDVI') return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
    if (type === 'LST') return 'from-orange-500/20 to-red-500/20 border-orange-500/30';
    return 'from-blue-500/20 to-purple-500/20 border-blue-500/30';
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-40 flex items-end justify-center">
      <div className="bg-gray-900 border border-gray-600 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[70vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Statistics Overview</h2>
            <p className="text-sm text-gray-400">NDVI Data & LST Analysis - Click on bars to select different months</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl p-2 rounded-lg hover:bg-gray-700"
          >
            ×
          </button>
        </div>

        {/* 3-Card Linear Layout */}
        <div className="p-4 space-y-4">
          {/* NDVI Card */}
          {ndviData && (
            <div className={`bg-gradient-to-r ${getCardColor('NDVI')} border rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">NDVI Statistics Over Time</h3>
                    <p className="text-xs text-gray-400">Normalized Difference Vegetation Index</p>
                  </div>
                </div>
                {ndviData[selectedMonth] && (
                  <div className="text-right">

                    <div className="grid grid-cols-3 gap-4 text-xs mt-2">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                          Mean
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                          Min
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                          Max
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {createHorizontalChart(ndviData, 'NDVI')}
            </div>
          )}

          {/* LST Card */}
          {lstData && (
            <div className={`bg-gradient-to-r ${getCardColor('LST')} border rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <div className="w-4 h-4 rounded bg-orange-500"></div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">LST Statistics Over Time</h3>
                    <p className="text-xs text-gray-400">Land Surface Temperature</p>
                  </div>
                </div>
                {lstData[selectedMonth] && (
                  <div className="text-right">
                    <div className="grid grid-cols-3 gap-4 text-xs mt-2">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                          Mean
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#06b6d4' }}></div>
                          Min
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }}></div>
                          Max
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {createHorizontalChart(lstData, 'LST')}
            </div>
          )}

          {/* Combined Overview Card */}
          {ndviData && lstData && (
            <div className={`bg-gradient-to-r ${getCardColor('Combined')} border rounded-xl p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <div className="w-4 h-4 rounded bg-gradient-to-r from-green-500 to-orange-500"></div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Combined Analysis Overview</h3>
                    <p className="text-xs text-gray-400">NDVI & LST Correlation Data</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-gray-300 mb-2">September 2024 - Current Selection</div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-green-400 font-medium">NDVI: 0.7700</div>
                      <div className="text-gray-500">High Vegetation</div>
                    </div>
                    <div className="text-center">
                      <div className="text-orange-400 font-medium">LST: 28.5°C</div>
                      <div className="text-gray-500">Warm Temperature</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-32 bg-gray-800/50 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Combined Analysis Chart</div>
                  <div className="text-xs">Correlation visualization between NDVI and LST data</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EarthEngineDashboard = () => {
  const [selectedArea, setSelectedArea] = useState('Amazon Rainforest (Brazil)');
  const [basemap, setBasemap] = useState('satellite');
  const [analysisLayer, setAnalysisLayer] = useState('NDVI');
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [liveData, setLiveData] = useState(true);
  const [ndviData, setNdviData] = useState(null);
  const [lstData, setLstData] = useState(null);
  const [customNdviData, setCustomNdviData] = useState(null);
  const [customLstData, setCustomLstData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customLoading, setCustomLoading] = useState(false);
  const [showAnalysisButton, setShowAnalysisButton] = useState(false);
  const [pendingPolygonCoords, setPendingPolygonCoords] = useState(null);
  const [currentLayer, setCurrentLayer] = useState(null);
  const [baseLayerGroup, setBaseLayerGroup] = useState(null);
  const [pixelInfo, setPixelInfo] = useState(null);
  const [pixelLoading, setPixelLoading] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const [drawingMode, setDrawingMode] = useState(null);
  const [drawnFeatures, setDrawnFeatures] = useState([]);
  const [showChart, setShowChart] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const [aoiMode, setAoiMode] = useState('default'); // 'default' or 'draw'
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLayerSwitching, setIsLayerSwitching] = useState(false);
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  const [showMonthlyPointPopup, setShowMonthlyPointPopup] = useState(false);
  const [monthlyPointData, setMonthlyPointData] = useState(null);
  const [monthlyPointLoading, setMonthlyPointLoading] = useState(false);
  const [clickedPointCoordinates, setClickedPointCoordinates] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Start open on mobile
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const drawInteractionRef = useRef(null);

  const areas = [
    'Amazon Rainforest (Brazil)'
  ];

  const areaCoordinates = {
    'Amazon Rainforest (Brazil)': [-62.255170, -3.380281]
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

  // Get current data based on selected analysis layer and AOI mode
  const getCurrentData = () => {
    if (aoiMode === 'draw') {
      return analysisLayer === 'NDVI' ? customNdviData : customLstData;
    }
    return analysisLayer === 'NDVI' ? ndviData : lstData;
  };

  // Get month names from API data
  const getMonthNames = () => {
    const data = getCurrentData();
    if (aoiMode === 'draw') {
      return data?.monthly_statistics?.map(stat => stat.month_name) || [];
    }
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
    const [lon, lat] = coordinate;
    
    // Determine which data type has loaded tiles
    const ndviDataSource = aoiMode === 'draw' ? customNdviData : ndviData;
    const lstDataSource = aoiMode === 'draw' ? customLstData : lstData;
    
    let hasNdviData = ndviDataSource && ndviDataSource.monthly_layers && ndviDataSource.monthly_layers[selectedMonth];
    let hasLstData = lstDataSource && lstDataSource.monthly_layers && lstDataSource.monthly_layers[selectedMonth];
    
    console.log('🖱️ MAP CLICK DETECTED');
    console.log('🎯 Current Analysis Type:', analysisLayer);
    console.log('📅 Selected Month Index:', selectedMonth);
    console.log('🗺️ AOI Mode:', aoiMode);
    console.log('📍 Click Coordinates:', { longitude: lon, latitude: lat });
    console.log('');
    
    console.log('🔍 Tile Data Check:');
    console.log('   NDVI data available:', hasNdviData);
    console.log('   LST data available:', hasLstData);
    console.log('   Analysis Layer (UI):', analysisLayer);
    
    // Use the data type that actually has loaded tiles
    let dataToUse = null;
    let apiLayerToUse = analysisLayer;
    
    if (hasLstData && !hasNdviData) {
      dataToUse = lstDataSource;
      apiLayerToUse = 'LST';
      console.log('   → Using LST data (LST tiles loaded)');
    } else if (hasNdviData && !hasLstData) {
      dataToUse = ndviDataSource;
      apiLayerToUse = 'NDVI';
      console.log('   → Using NDVI data (NDVI tiles loaded)');
    } else if (hasNdviData && hasLstData) {
      // Both available, use UI selection
      dataToUse = getCurrentData();
      console.log('   → Using', analysisLayer, 'data (both available, using UI selection)');
    } else {
      console.log('❌ No tile data available');
      return null;
    }

    if (!dataToUse || !dataToUse.monthly_layers[selectedMonth]) {
      return null;
    }

    const monthData = dataToUse.monthly_layers[selectedMonth];

    try {
      // 1. Get pixel value from tile
      console.log('🚀 Initiating monthly point API call...');
      const pixelValue = await getGEEPixelValue([lon, lat], monthData);
      
      // 2. Make monthly API call with correct month and API type
      let monthForApi = selectedMonth + 1; // fallback
      const monthName = monthData.month_name;
      
      // Convert month name to YYYY-MM format
      if (monthName.includes('-')) {
        // Already in YYYY-MM format
        monthForApi = monthName;
      } else {
        // Parse from "September 2024" format
        const parts = monthName.split(' ');
        if (parts.length >= 2) {
          const monthStr = parts[0];
          const year = parts[1];
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                             'July', 'August', 'September', 'October', 'November', 'December'];
          const monthNumber = monthNames.indexOf(monthStr) + 1;
          if (monthNumber > 0) {
            monthForApi = `${year}-${monthNumber.toString().padStart(2, '0')}`;
          }
        }
      }
      
      console.log('📅 Using month for API:', monthForApi);
      console.log('🎯 Using API type:', apiLayerToUse);
      
      let apiResponse;
      if (apiLayerToUse === 'NDVI') {
        console.log('🌿 → Calling NDVI monthly API endpoint');
        console.log('📤 NDVI API Payload:', { latitude: lat, longitude: lon, month: monthForApi });
        apiResponse = await customAPI.ndviPointAnalysis({ longitude: lon, latitude: lat, month: monthForApi });
        console.log('📥 NDVI API Response:', apiResponse);
      } else if (apiLayerToUse === 'LST') {
        console.log('🌡️ → Calling LST monthly API endpoint');
        console.log('📤 LST API Payload:', { latitude: lat, longitude: lon, month: monthForApi });
        apiResponse = await customAPI.lstPointAnalysis({ longitude: lon, latitude: lat, month: monthForApi });
        console.log('📥 LST API Response:', apiResponse);
      }
      
      return {
        coordinate: [lon, lat],
        value: pixelValue,
        dataType: apiLayerToUse,
        month: monthData.month_name,
        unit: apiLayerToUse === 'LST' ? '°C' : '',
        visParams: monthData.vis_params,
        mapId: extractMapIdFromTileUrl(monthData.tile_url),
        apiResponse: apiResponse // Include API response
      };
    } catch (error) {
      console.error('Error getting pixel value:', error);
      return null;
    }
  };


  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🌳 Starting Amazon data fetch for:', analysisLayer);
      console.log('📡 Making API call to Amazon', analysisLayer, 'endpoint...');
      
      let response;
      if (analysisLayer === 'NDVI') {
        response = await amazonAPI.getNDVIData();
        console.log('✅ Amazon NDVI API Response:', response);
        
        if (response) {
          console.log('📊 Amazon NDVI Data Summary:');
          console.log('  - Legend:', response.legend);
          console.log('  - Time Period:', response.time_period);
          console.log('  - Monthly Layers:', response.monthly_layers?.length || 0, 'months');
          if (response.monthly_layers && response.monthly_layers.length > 0) {
            console.log('  - Sample Month Data:', response.monthly_layers[0]);
          }
        }
        
        setNdviData(response);
      } else {
        response = await amazonAPI.getLSTData();
        console.log('✅ Amazon LST API Response:', response);
        
        if (response) {
          console.log('🌡️ Amazon LST Data Summary:');
          console.log('  - Legend:', response.legend);
          console.log('  - Time Period:', response.time_period);
          console.log('  - Monthly Layers:', response.monthly_layers?.length || 0, 'months');
          if (response.monthly_layers && response.monthly_layers.length > 0) {
            console.log('  - Sample Month Data:', response.monthly_layers[0]);
          }
        }
        
        setLstData(response);
      }
      
      // Update map layer with the new data
      if (response) {
        console.log('🗺️ Updating map layer with Amazon data for:', analysisLayer);
        // Ensure map is ready before updating layer
        const waitForMapAndUpdate = () => {
          if (mapInstanceRef.current && mapInstanceRef.current.getTargetElement()) {
            console.log('✅ Map is ready - updating initial layer');
            updateMapLayer(response, selectedMonth, false); // No smooth transition for initial load
          } else {
            console.log('⏳ Map not ready yet, retrying...');
            setTimeout(waitForMapAndUpdate, 100);
          }
        };
        
        // Start checking immediately, then with small delay as fallback
        waitForMapAndUpdate();
      }
      
      console.log('🎉 Amazon', analysisLayer, 'data fetch completed successfully!');
    } catch (error) {
      console.error('❌ Error fetching Amazon', analysisLayer, 'data:', error);
      console.log('🔍 Error details:');
      console.log('  - Message:', error.message);
      console.log('  - Stack:', error.stack);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyPointData = async (longitude, latitude) => {
    // Prevent multiple concurrent API calls
    if (monthlyPointLoading) {
      console.log('🚫 Already loading monthly point data, skipping...');
      return;
    }
    
    setMonthlyPointLoading(true);
    setClickedPointCoordinates([longitude, latitude]);
    
    try {
      console.log(`🎯 Fetching monthly ${analysisLayer} data for point:`, { longitude, latitude, selectedMonth });
      
      // Get current data to extract the exact month info
      const currentData = getCurrentData();
      let monthString = '';
      
      console.log('📊 Current data:', currentData);
      console.log('📅 Selected month index:', selectedMonth);
      
      if (currentData && currentData.monthly_layers && currentData.monthly_layers[selectedMonth]) {
        // Get month info from the currently selected tile layer
        const monthLayer = currentData.monthly_layers[selectedMonth];
        console.log('🗓️ Month layer data:', monthLayer);
        
        if (monthLayer.month_name) {
          const monthName = monthLayer.month_name; // e.g., "January 2024"
          console.log('📅 Month name from tile layer:', monthName);
          
          const parts = monthName.split(' ');
          if (parts.length >= 2) {
            const monthText = parts[0];
            const year = parts[1];
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const monthNumber = monthNames.indexOf(monthText) + 1;
            
            if (monthNumber > 0) {
              monthString = `${year}-${monthNumber.toString().padStart(2, '0')}`;
              console.log('✅ Formatted month string:', monthString);
            }
          }
        }
      } else if (currentData && currentData.monthly_statistics && currentData.monthly_statistics[selectedMonth]) {
        // Fallback to monthly_statistics if monthly_layers doesn't have month_name
        const monthName = currentData.monthly_statistics[selectedMonth].month_name;
        console.log('📅 Month name from statistics:', monthName);
        
        const parts = monthName.split(' ');
        if (parts.length >= 2) {
          const monthText = parts[0];
          const year = parts[1];
          
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                             'July', 'August', 'September', 'October', 'November', 'December'];
          const monthNumber = monthNames.indexOf(monthText) + 1;
          
          if (monthNumber > 0) {
            monthString = `${year}-${monthNumber.toString().padStart(2, '0')}`;
            console.log('✅ Formatted month string (from stats):', monthString);
          }
        }
      }
      
      if (!monthString) {
        throw new Error('Unable to determine month parameter from current data');
      }
      
      console.log('📡 Making API call with params:', { longitude, latitude, month: monthString, analysisLayer });
      
      let response;
      if (analysisLayer === 'NDVI') {
        response = await customAPI.ndviPointAnalysis({ 
          longitude, 
          latitude, 
          month: monthString 
        });
      } else {
        response = await customAPI.lstPointAnalysis({ 
          longitude, 
          latitude, 
          month: monthString 
        });
      }
      
      console.log('✅ Monthly point analysis response:', response);
      setMonthlyPointData(response);
      setShowMonthlyPointPopup(true);
      
    } catch (error) {
      console.error('❌ Error fetching monthly point data:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      setMonthlyPointData(null);
      // Still show popup to display error state
      setShowMonthlyPointPopup(true);
    } finally {
      setMonthlyPointLoading(false);
    }
  };
  
  const fetchCustomData = async (coordinates) => {
    setCustomLoading(true);
    try {
      console.log('🎯 Starting custom data fetch for coordinates:', coordinates);
      console.log('📡 Making API call for', analysisLayer, 'to custom endpoint...');
      
      // Check if this is point data (single coordinate pair) or polygon data (array of coordinate arrays)
      const isPointData = drawnFeatures.length > 0 && drawnFeatures[0].type === 'point';
      console.log('🔍 Data type detected:', isPointData ? 'Point' : 'Polygon');
      
      let customResponse;
      
      // Determine which data type has loaded tiles
      const ndviDataSource = aoiMode === 'draw' ? customNdviData : ndviData;
      const lstDataSource = aoiMode === 'draw' ? customLstData : lstData;
      
      let hasNdviData = ndviDataSource && ndviDataSource.monthly_layers && ndviDataSource.monthly_layers[selectedMonth];
      let hasLstData = lstDataSource && lstDataSource.monthly_layers && lstDataSource.monthly_layers[selectedMonth];
      
      // For draw mode, check monthly_statistics instead
      if (aoiMode === 'draw') {
        hasNdviData = ndviDataSource && ndviDataSource.monthly_statistics && ndviDataSource.monthly_statistics[selectedMonth];
        hasLstData = lstDataSource && lstDataSource.monthly_statistics && lstDataSource.monthly_statistics[selectedMonth];
      }
      
      console.log('🔍 Tile Data Check:');
      console.log('   NDVI data available:', hasNdviData);
      console.log('   LST data available:', hasLstData);
      console.log('   Analysis Layer (UI):', analysisLayer);
      
      // Use the data type that actually has loaded tiles, or fall back to UI selection
      let apiLayerToUse = analysisLayer;
      if (hasLstData && !hasNdviData) {
        apiLayerToUse = 'LST';
        console.log('   → Using LST API (LST tiles loaded)');
      } else if (hasNdviData && !hasLstData) {
        apiLayerToUse = 'NDVI';
        console.log('   → Using NDVI API (NDVI tiles loaded)');
      } else {
        console.log('   → Using', analysisLayer, 'API (UI selection)');
      }
      
      if (apiLayerToUse === 'NDVI') {
        if (isPointData) {
          // For point data, coordinates is [longitude, latitude]
          const [longitude, latitude] = coordinates[0];
          
          if (aoiMode === 'default') {
            // Default rainforest mode: use monthly point API
            // Get the actual month from the loaded tile data
            const currentData = ndviDataSource;
            let monthForApi = selectedMonth + 1; // fallback
            
            if (currentData && currentData.monthly_layers && currentData.monthly_layers[selectedMonth]) {
              const monthData = currentData.monthly_layers[selectedMonth];
              const monthName = monthData.month_name;
              
              // Convert month name to YYYY-MM format
              if (monthName.includes('-')) {
                // Already in YYYY-MM format
                monthForApi = monthName;
              } else {
                // Parse from "September 2024" format
                const parts = monthName.split(' ');
                if (parts.length >= 2) {
                  const monthStr = parts[0];
                  const year = parts[1];
                  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                     'July', 'August', 'September', 'October', 'November', 'December'];
                  const monthNumber = monthNames.indexOf(monthStr) + 1;
                  if (monthNumber > 0) {
                    monthForApi = `${year}-${monthNumber.toString().padStart(2, '0')}`;
                  }
                }
              }
            }
            
            console.log('📅 Using month for NDVI API:', monthForApi);
            customResponse = await customAPI.ndviPointAnalysis({ longitude, latitude, month: monthForApi });
            console.log('✅ Default NDVI Point API Response (monthly):', customResponse);
          } else {
            // Custom draw mode: use regular point API (same format as polygon)
            customResponse = await customAPI.ndviCustomPointAnalysis({ longitude, latitude });
            console.log('✅ Custom NDVI Point API Response:', customResponse);
          }
        } else {
          // For polygon data, use existing polygon API
          customResponse = await customAPI.getNDVIData(coordinates);
          console.log('✅ Custom NDVI Polygon API Response:', customResponse);
        }
        
        if (customResponse) {
          console.log('📊 NDVI Data Summary:');
          console.log('  - Time Period:', customResponse.time_period);
          console.log('  - Total Months:', customResponse.total_months);
          console.log('  - Monthly Statistics:', customResponse.monthly_statistics?.length || 0, 'months');
          if (customResponse.monthly_statistics && customResponse.monthly_statistics.length > 0) {
            console.log('  - Sample Month Data:', customResponse.monthly_statistics[0]);
          }
        }
        
        setCustomNdviData(customResponse);
      } else {
        if (isPointData) {
          // For point data, coordinates is [longitude, latitude]
          const [longitude, latitude] = coordinates[0];
          
          if (aoiMode === 'default') {
            // Default rainforest mode: use monthly point API
            // Get the actual month from the loaded tile data
            const currentData = lstDataSource;
            let monthForApi = selectedMonth + 1; // fallback
            
            if (currentData && currentData.monthly_layers && currentData.monthly_layers[selectedMonth]) {
              const monthData = currentData.monthly_layers[selectedMonth];
              const monthName = monthData.month_name;
              
              // Convert month name to YYYY-MM format
              if (monthName.includes('-')) {
                // Already in YYYY-MM format
                monthForApi = monthName;
              } else {
                // Parse from "September 2024" format
                const parts = monthName.split(' ');
                if (parts.length >= 2) {
                  const monthStr = parts[0];
                  const year = parts[1];
                  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                     'July', 'August', 'September', 'October', 'November', 'December'];
                  const monthNumber = monthNames.indexOf(monthStr) + 1;
                  if (monthNumber > 0) {
                    monthForApi = `${year}-${monthNumber.toString().padStart(2, '0')}`;
                  }
                }
              }
            }
            
            console.log('📅 Using month for LST API:', monthForApi);
            customResponse = await customAPI.lstPointAnalysis({ longitude, latitude, month: monthForApi });
            console.log('✅ Default LST Point API Response (monthly):', customResponse);
          } else {
            // Custom draw mode: use regular point API (same format as polygon)
            customResponse = await customAPI.lstCustomPointAnalysis({ longitude, latitude });
            console.log('✅ Custom LST Point API Response:', customResponse);
          }
        } else {
          // For polygon data, use existing polygon API
          customResponse = await customAPI.getLSTData(coordinates);
          console.log('✅ Custom LST Polygon API Response:', customResponse);
        }
        
        if (customResponse) {
          console.log('🌡️ LST Data Summary:');
          console.log('  - Time Period:', customResponse.time_period);
          console.log('  - Total Months:', customResponse.total_months);
          console.log('  - Monthly Statistics:', customResponse.monthly_statistics?.length || 0, 'months');
          if (customResponse.monthly_statistics && customResponse.monthly_statistics.length > 0) {
            console.log('  - Sample Month Data:', customResponse.monthly_statistics[0]);
          }
        }
        
        setCustomLstData(customResponse);
      }
      
      // Data received - chart will be rendered automatically by useEffect
      if (customResponse && customResponse.monthly_statistics) {
        console.log('📊 Statistics data received for', analysisLayer, '- chart will be displayed');
      }
      
      console.log('🎉 Custom', analysisLayer, 'data fetch completed successfully!');
    } catch (error) {
      console.error('❌ Error fetching custom', analysisLayer, 'data:', error);
      console.log('🔍 Error details:');
      console.log('  - Message:', error.message);
      console.log('  - Stack:', error.stack);
      
      // Show user-friendly error message
      alert(`Error fetching ${analysisLayer} data for custom area. Please try again or check your connection.`);
    } finally {
      setCustomLoading(false);
    }
  };

  useEffect(() => {
    // Test API connectivity on component mount
    const initializeAPI = async () => {
      console.log('🚀 Initializing dashboard...');
      const connectionTest = await testAPIConnection();
      
      if (connectionTest.connected) {
        console.log('✅ API connection successful');
      } else {
        console.error('❌ API connection failed:', connectionTest.error);
        // You might want to show a user notification here
      }
    };
    
    initializeAPI();
    
    // Only fetch Amazon data when specifically in default mode
    if (aoiMode === 'default') {
      const currentData = analysisLayer === 'NDVI' ? ndviData : lstData;
      if (!currentData) {
        fetchData();
      }
    }
  }, [aoiMode, analysisLayer]);

  const updateMapLayer = (data, monthIndex, smooth = true) => {
    if (!mapInstanceRef.current || !data || !data.monthly_layers || !data.monthly_layers[monthIndex]) {
      console.log('❌ updateMapLayer failed - missing data:', {
        hasMap: !!mapInstanceRef.current,
        hasMapElement: !!(mapInstanceRef.current && mapInstanceRef.current.getTargetElement()),
        hasData: !!data,
        hasMonthlyLayers: !!(data && data.monthly_layers),
        monthIndex,
        maxMonths: data?.monthly_layers?.length || 0
      });
      return;
    }

    // Additional check to ensure map is fully initialized
    if (!mapInstanceRef.current.getTargetElement()) {
      console.log('❌ Map element not ready for layer update');
      return;
    }

    const monthData = data.monthly_layers[monthIndex];
    console.log('🗺️ Updating map layer with data:', {
      monthName: monthData.month_name,
      tileUrl: monthData.tile_url,
      dataType: monthData.data_type,
      smooth
    });
    
    const newTileLayer = new TileLayer({
      source: new XYZ({
        url: monthData.tile_url,
        maxZoom: 20,
      }),
      opacity: smooth ? 0 : 0.7, // Start transparent for smooth transition
      zIndex: 10, // Above base layers
    });

    console.log('🔧 Created new tile layer:', {
      url: monthData.tile_url,
      smooth: smooth,
      opacity: smooth ? 0 : 0.7
    });

    // Add tile loading event listeners for debugging
    newTileLayer.getSource().on('tileloadstart', () => {
      console.log('🔄 Tile loading started for month:', monthData.month_name);
    });
    
    newTileLayer.getSource().on('tileloadend', () => {
      console.log('✅ Tile loading completed for month:', monthData.month_name);
    });
    
    newTileLayer.getSource().on('tileloaderror', (event) => {
      console.error('❌ Tile loading failed for month:', monthData.month_name, event);
    });

    if (smooth && currentLayer) {
      // Smooth layer transition
      mapInstanceRef.current.addLayer(newTileLayer);
      
      // Animate new layer opacity in
      let opacity = 0;
      const fadeInInterval = setInterval(() => {
        opacity += 0.1;
        if (opacity >= 0.7) {
          opacity = 0.7;
          clearInterval(fadeInInterval);
          
          // Remove old layer after new one is fully visible
          if (currentLayer) {
            mapInstanceRef.current.removeLayer(currentLayer);
          }
          setIsLayerSwitching(false);
        }
        newTileLayer.setOpacity(opacity);
      }, 30); // 300ms total fade duration
      
    } else {
      // Instant layer switch
      if (currentLayer) {
        mapInstanceRef.current.removeLayer(currentLayer);
      }
      mapInstanceRef.current.addLayer(newTileLayer);
      setIsLayerSwitching(false);
    }

    setCurrentLayer(newTileLayer);
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
      
      const vectorSource = new VectorSource();
      vectorSourceRef.current = vectorSource;
      
      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: {
          'stroke-color': '#3b82f6',
          'stroke-width': 2,
          'fill-color': 'rgba(59, 130, 246, 0.1)'
        },
        zIndex: 20
      });

      const map = new Map({
        target: mapRef.current,
        layers: [initialBaseLayer, vectorLayer],
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
      console.log('🌐 Production debugging - hostname:', window.location.hostname);
      console.log('🌐 Production debugging - user agent:', navigator.userAgent);
      
      // Global error handler for debugging
      window.addEventListener('error', (error) => {
        console.error('🚨 GLOBAL ERROR CAUGHT:', error);
      });
      window.addEventListener('unhandledrejection', (event) => {
        console.error('🚨 UNHANDLED PROMISE REJECTION:', event);
      });
      
      // Close search results when clicking on map
      const closeSearchResults = () => {
        setShowSearchResults(false);
      };
      
      // Define click handler inside useEffect to avoid stale closure
      let clickTimeout = null;
      const clickHandler = async (event) => {
        console.log('🔥 CLICK DETECTED - This should appear in production!', event);
        console.log('🌐 Environment check:', window.location.hostname);
        
        // Debounce clicks to prevent multiple rapid API calls
        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }
        
        clickTimeout = setTimeout(async () => {
          try {
            closeSearchResults();
            console.log('🖱️ Map clicked!', event);
            console.log('Environment:', process.env.NODE_ENV || 'development');
            console.log('User Agent:', navigator.userAgent);
            console.log('Raw coordinate:', event.coordinate);
            console.log('Pixel position:', event.pixel);
            console.log('Current AOI mode:', aoiMode);
            
            const coordinate = event.coordinate;
            const [lon, lat] = toLonLat(coordinate);
            
            console.log('Converted lon/lat:', lon, lat);
            console.log('Current analysis layer:', analysisLayer);
            console.log('Selected month:', selectedMonth);
            
            setClickPosition([event.pixel[0], event.pixel[1]]);
            
            // In default mode, call monthly point analysis API
            if (aoiMode === 'default') {
              console.log('🎯 Default mode: Calling monthly point analysis API');
              try {
                await fetchMonthlyPointData(lon, lat);
              } catch (apiError) {
                console.error('❌ Monthly point API failed:', apiError);
                console.error('API Error details:', {
                  message: apiError.message,
                  stack: apiError.stack,
                  name: apiError.name
                });
                // Show user-friendly error
                alert('Unable to fetch data for this location. Please check your internet connection and try again.');
              }
              return;
            }
            
            // Original custom mode logic for pixel data
            setPixelLoading(true);
            setPixelInfo(null);

            try {
              const data = analysisLayer === 'NDVI' ? ndviData : lstData;
              console.log('Current data:', data);
              
              if (!data || !data.monthly_layers[selectedMonth]) {
                console.log('❌ No data available for pixel query');
                alert('No data available for the selected month. Please select a different month.');
                return;
              }

              const pixelData = await getPixelValue([lon, lat]);
              console.log('Final pixel data:', pixelData);
              setPixelInfo(pixelData);
              setSelectedCoordinate([lon, lat]);
              
              const timeSeriesData = generateTimeSeriesData([lon, lat]);
              setChartData(timeSeriesData);
            } catch (pixelError) {
              console.error('❌ Pixel data error:', pixelError);
              console.error('Pixel Error details:', {
                message: pixelError.message,
                stack: pixelError.stack,
                name: pixelError.name
              });
              alert('Unable to get pixel data for this location. Please try clicking elsewhere on the map.');
            } finally {
              setPixelLoading(false);
            }
          } catch (generalError) {
            console.error('❌ General map click error:', generalError);
            console.error('General Error details:', {
              message: generalError.message,
              stack: generalError.stack,
              name: generalError.name
            });
            alert('An error occurred while processing your click. Please refresh the page and try again.');
          }
        }, 300); // 300ms debounce delay
      };
      
      // Force initial render and handle resize
      const updateSize = () => {
        if (map && mapRef.current) {
          map.updateSize();
        }
      };
      
      setTimeout(updateSize, 100);
      
      // Add single click event listener after map is rendered
      let clickListenerKey = null;
      
      setTimeout(() => {
        console.log('🔧 Production build detected - using DOM-based click handling');
        
        // Production-compatible click handler using DOM events
        const mapElement = map.getTargetElement();
        if (mapElement) {
          let clickTimeout = null;
          
          mapElement.addEventListener('click', (domEvent) => {
            // Prevent multiple rapid clicks
            if (clickTimeout) {
              clearTimeout(clickTimeout);
            }
            
            clickTimeout = setTimeout(() => {
              console.log('🔧 Production click detected:', domEvent);
              
              // Get the pixel coordinates relative to the map viewport
              const rect = mapElement.getBoundingClientRect();
              const pixel = [
                domEvent.clientX - rect.left,
                domEvent.clientY - rect.top
              ];
              
              console.log('🔧 Pixel coordinates:', pixel);
              
              // Convert to map coordinates
              const coordinate = map.getCoordinateFromPixel(pixel);
              console.log('🔧 Map coordinate:', coordinate);
              
              if (coordinate) {
                // Call the click handler directly with production-compatible data
                handleProductionClick(coordinate, pixel, domEvent);
              } else {
                console.warn('🔧 Could not convert pixel to coordinate');
              }
            }, 300); // Same debounce as original
          });
          
          console.log('✅ Production click handler attached');
        }
      }, 200);
      
      // Production-compatible click handler
      const handleProductionClick = async (coordinate, pixel, domEvent) => {
        try {
          console.log('🔥 Production click processing started');
          closeSearchResults();
          
          const [lon, lat] = toLonLat(coordinate);
          console.log('Converted lon/lat:', lon, lat);
          console.log('Current AOI mode:', aoiMode);
          console.log('Current analysis layer:', analysisLayer);
          
          setClickPosition([pixel[0], pixel[1]]);
          
          // In default mode, call monthly point analysis API
          if (aoiMode === 'default') {
            console.log('🎯 Default mode: Calling monthly point analysis API');
            await fetchMonthlyPointData(lon, lat);
            return;
          }
          
          // Custom mode logic for pixel data
          setPixelLoading(true);
          setPixelInfo(null);
          
          try {
            const data = analysisLayer === 'NDVI' ? ndviData : lstData;
            console.log('Current data:', data);
            
            if (!data || !data.monthly_layers[selectedMonth]) {
              console.log('❌ No data available for pixel query');
              alert('No data available for the selected month. Please select a different month.');
              return;
            }
            
            const pixelData = await getPixelValue([lon, lat]);
            console.log('Final pixel data:', pixelData);
            setPixelInfo(pixelData);
            setSelectedCoordinate([lon, lat]);
            
            const timeSeriesData = generateTimeSeriesData([lon, lat]);
            setChartData(timeSeriesData);
          } catch (error) {
            console.error('❌ Error handling click:', error);
            alert('Unable to get data for this location. Please try again.');
          } finally {
            setPixelLoading(false);
          }
        } catch (error) {
          console.error('❌ Production click handler error:', error);
          alert('An error occurred. Please refresh and try again.');
        }
      };
      
      window.addEventListener('resize', updateSize);
      
      // Cleanup on unmount
      return () => {
        window.removeEventListener('resize', updateSize);
        if (map) {
          // Properly remove event listeners using their keys
          if (clickListenerKey) {
            unByKey(clickListenerKey);
          }
          console.log('🧹 Map event listeners cleaned up');
        }
      };
    }
  }, [analysisLayer, selectedMonth, ndviData, lstData, aoiMode]); // Add dependencies

  useEffect(() => {
    const data = getCurrentData();
    if (data && aoiMode === 'default') {
      // Reset month selection if current month is out of range
      const maxMonths = data.monthly_layers?.length || 0;
      if (selectedMonth >= maxMonths) {
        setSelectedMonth(0);
        return;
      }
      updateMapLayer(data, selectedMonth);
    } else if (data && aoiMode === 'draw') {
      // For custom data, just handle month selection bounds - no tiles to render
      const maxMonths = data.monthly_statistics?.length || 0;
      if (selectedMonth >= maxMonths) {
        setSelectedMonth(0);
        return;
      }
      console.log('📊 Custom data available for month:', selectedMonth, data.monthly_statistics[selectedMonth]?.month_name);
    } else if (aoiMode === 'draw' && !data && pendingPolygonCoords && drawnFeatures.length > 0) {
      // If switching analysis type in draw mode and data is missing, fetch it
      console.log('⚡ Analysis layer switched to', analysisLayer, '- fetching missing data');
      fetchCustomData(pendingPolygonCoords);
    }
  }, [analysisLayer, selectedMonth, ndviData, lstData, customNdviData, customLstData, aoiMode]);
  
  // Handle analysis layer switching in custom mode
  useEffect(() => {
    if (aoiMode === 'draw' && drawnFeatures.length > 0) {
      // Since we fetch both NDVI and LST concurrently, we only need to check if any data exists
      const hasData = customNdviData || customLstData;
      if (!hasData && pendingPolygonCoords && !customLoading) {
        console.log('🔄 No data available - showing analysis button');
        setShowAnalysisButton(true);
      } else if (hasData) {
        console.log('✅ Data available for both NDVI and LST - hiding analysis button');
        setShowAnalysisButton(false);
      }
    }
  }, [analysisLayer, aoiMode, drawnFeatures, customNdviData, customLstData, pendingPolygonCoords, customLoading]);

  // Sync monthly point data popup with sidebar settings
  useEffect(() => {
    if (showMonthlyPointPopup && clickedPointCoordinates && aoiMode === 'default') {
      console.log('🔄 Sidebar settings changed - refetching monthly point data');
      fetchMonthlyPointData(clickedPointCoordinates[0], clickedPointCoordinates[1]);
    }
  }, [selectedMonth, analysisLayer, showMonthlyPointPopup, clickedPointCoordinates, aoiMode]);

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


  const toggleDrawingMode = (mode) => {
    if (!mapInstanceRef.current) return;
    
    if (drawInteractionRef.current) {
      mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    
    if (drawingMode === mode) {
      setDrawingMode(null);
      return;
    }
    
    setDrawingMode(mode);
    
    // Zoom to drawing level for better precision
    const view = mapInstanceRef.current.getView();
    const currentZoom = view.getZoom();
    if (currentZoom < 17) {
      view.animate({
        zoom: 17,
        duration: 1000
      });
    }
    
    // Set drawing type based on mode
    const drawType = mode === 'point' ? 'Point' : 'Polygon';
    const drawInteraction = new Draw({
      source: vectorSourceRef.current,
      type: drawType
    });
    
    drawInteraction.on('drawend', (event) => {
      const feature = event.feature;
      const geometry = feature.getGeometry();
      
      if (mode === 'point') {
        // Handle point drawing
        const coordinates = geometry.getCoordinates();
        const wgs84Coordinates = toLonLat(coordinates);
        
        console.log('📍 Point drawn at WGS84:', wgs84Coordinates);
        
        // Clear previous drawings before adding new one
        if (drawnFeatures.length > 0) {
          clearDrawings();
        }
        
        const newFeature = {
          id: Date.now(),
          type: mode,
          geometry: coordinates, // Keep original for display
          bounds: geometry.getExtent(),
          wgs84Coordinates: wgs84Coordinates
        };
        
        setDrawnFeatures([newFeature]); // Replace with new feature
        setDrawingMode(null);
        mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
        
        // Store point coordinates for analysis button
        setPendingPolygonCoords([wgs84Coordinates]); // Store point coordinates
        setShowAnalysisButton(true);
        console.log('🎯 Point placed successfully. Ready for analysis.');
        
      } else {
        // Handle polygon drawing
        const coordinates = geometry.getCoordinates();
        const wgs84Coordinates = coordinates[0].map(coord => toLonLat(coord));
        
        // Close the polygon by ensuring first and last points are the same
        if (wgs84Coordinates.length > 0) {
          const firstPoint = wgs84Coordinates[0];
          const lastPoint = wgs84Coordinates[wgs84Coordinates.length - 1];
          if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
            wgs84Coordinates.push([...firstPoint]);
          }
        }
        
        console.log('🌍 Polygon converted to WGS84:', {
          originalLength: coordinates[0].length,
          wgs84Length: wgs84Coordinates.length,
          firstPoint: wgs84Coordinates[0],
          lastPoint: wgs84Coordinates[wgs84Coordinates.length - 1]
        });
        
        // Clear previous drawings before adding new one
        if (drawnFeatures.length > 0) {
          clearDrawings();
        }
        
        const newFeature = {
          id: Date.now(),
          type: mode,
          geometry: coordinates, // Keep original for display
          bounds: geometry.getExtent()
        };
        
        setDrawnFeatures([newFeature]); // Replace with new feature
        setDrawingMode(null);
        mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
        
        // Store WGS84 coordinates for API calls
        setPendingPolygonCoords([wgs84Coordinates]); // Wrap in array to match expected format
        setShowAnalysisButton(true);
        console.log('🎯 Polygon drawn successfully. Ready for analysis.');
      }
    });
    
    mapInstanceRef.current.addInteraction(drawInteraction);
    drawInteractionRef.current = drawInteraction;
  };
  
  const clearDrawings = () => {
    if (vectorSourceRef.current) {
      vectorSourceRef.current.clear();
    }
    setDrawnFeatures([]);
    setShowAnalysisButton(false);
    setPendingPolygonCoords(null);
    // Only clear custom data when clearing drawings (keep Amazon data intact)
    setCustomNdviData(null);
    setCustomLstData(null);
    // Remove only custom analysis layers (not Amazon layers)
    if (currentLayer && aoiMode === 'draw') {
      mapInstanceRef.current.removeLayer(currentLayer);
      setCurrentLayer(null);
    }
  };
  
  const runAnalysis = async () => {
    if (!pendingPolygonCoords) return;
    
    setShowAnalysisButton(false);
    await fetchCustomData(pendingPolygonCoords);
    setPendingPolygonCoords(null);
  };
  
  const switchAoiMode = (mode) => {
    setAoiMode(mode);
    if (mode === 'default') {
      // Clear any drawn features and return to default view
      clearDrawings();
      setDrawingMode(null);
    } else if (mode === 'draw') {
      // Automatically start polygon drawing when switching to draw mode
      setTimeout(() => toggleDrawingMode('polygon'), 100);
      // Clear custom data
      setCustomNdviData(null);
      setCustomLstData(null);
      if (mapInstanceRef.current) {
        const view = mapInstanceRef.current.getView();
        view.animate({
          center: fromLonLat(areaCoordinates[selectedArea]),
          zoom: 6,
          duration: 1000
        });
        // Re-add the analysis layer for default mode
        if (ndviData || lstData) {
          const data = analysisLayer === 'NDVI' ? ndviData : lstData;
          if (data) {
            updateMapLayer(data, selectedMonth);
          }
        }
      }
    } else if (mode === 'draw') {
      // Clear only drawn features and custom data (keep Amazon data)
      if (vectorSourceRef.current) {
        vectorSourceRef.current.clear();
      }
      setDrawnFeatures([]);
      setShowAnalysisButton(false);
      setPendingPolygonCoords(null);
      // Clear only custom data (keep Amazon data intact for when returning to default mode)
      setCustomNdviData(null);
      setCustomLstData(null);
      
      if (mapInstanceRef.current) {
        // Remove only the current analysis layer (Amazon or custom)
        if (currentLayer) {
          console.log('🗑️ Removing current analysis layer for clean drawing');
          mapInstanceRef.current.removeLayer(currentLayer);
          setCurrentLayer(null);
        }
        
        // Zoom to very high level for precise drawing
        const view = mapInstanceRef.current.getView();
        view.animate({
          zoom: 18,
          duration: 1000
        });
      }
      console.log('🎯 Cleared custom data and layers, keeping Amazon data for later use');
      // Automatically activate drawing mode
      setTimeout(() => {
        toggleDrawingMode('polygon');
      }, 1200); // Wait for zoom animation to complete
    }
  };
  
  const searchLocation = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    try {
      // Using Nominatim for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const results = data.map(item => ({
          display_name: item.display_name,
          lon: parseFloat(item.lon),
          lat: parseFloat(item.lat),
          type: item.type,
          class: item.class
        }));
        setSearchResults(results);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };
  
  const selectSearchResult = (result) => {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([result.lon, result.lat]),
        zoom: 17,
        duration: 1500
      });
    }
    setSearchQuery(result.display_name.split(',')[0]); // Set short name
    setSearchResults([]);
    setShowSearchResults(false);
  };
  
  const generateTimeSeriesData = (coordinate) => {
    const [lon, lat] = coordinate;
    
    // Generate dummy time series data for 12 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const timeSeriesData = months.map((month, index) => {
      let value;
      if (analysisLayer === 'NDVI') {
        // NDVI values between -1 and 1, seasonal variation
        const baseValue = 0.3 + 0.4 * Math.sin((index / 12) * 2 * Math.PI);
        value = Math.round((baseValue + (Math.random() - 0.5) * 0.2) * 1000) / 1000;
      } else {
        // LST values between 20-35°C, seasonal variation
        const baseValue = 27 + 5 * Math.sin((index / 12) * 2 * Math.PI);
        value = Math.round((baseValue + (Math.random() - 0.5) * 3) * 10) / 10;
      }
      
      return {
        month,
        value,
        monthIndex: index
      };
    });
    
    return timeSeriesData;
  };
  
  // Export functionality disabled
  
  // Toggle sidebar function with map resize
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
    
    // Trigger map resize after sidebar animation completes
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.updateSize();
        console.log('🗺️ Map resized after sidebar toggle');
      }
    }, 300); // Match CSS transition duration
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.1) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      
      {/* Mobile Sidebar Toggle Button - Hidden when sidebar is open */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="lg:hidden fixed top-4 left-4 z-50 bg-gray-800 border border-gray-600 rounded-xl p-3 shadow-lg hover:bg-gray-700 transition-all duration-300"
          aria-label="Toggle sidebar"
        >
          {/* 3 Dots Icon */}
          <div className="flex flex-col space-y-1">
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
        </button>
      )}

      {/* Modern Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-40
        w-80 lg:w-80 
        bg-gray-900 border-r border-gray-600 
        flex flex-col 
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}
        lg:max-h-none overflow-y-auto lg:overflow-visible
      `}>
        {/* Modern Header */}
        <div className="p-3 lg:p-6 border-b border-gray-600 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="p-1 lg:p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg">
              <Globe className="w-4 lg:w-6 h-4 lg:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-sm lg:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Rainforest Analyser
              </h1>
              </div>
            </div>
            
            {/* Mobile Close Button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Modern Controls */}
        <div className="p-3 lg:p-6 space-y-3 lg:space-y-6">
          
          {/* Analysis Layer Toggle */}
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2 lg:mb-3">Analysis Type</label>
            <div className="grid grid-cols-2 gap-2">
              {analysisLayers.map(layer => {
                const isActive = analysisLayer === layer;
                const isLoading = (loading && aoiMode === 'default') || (customLoading && aoiMode === 'draw');
                const canSwitch = !isLoading && !isLayerSwitching;
                
                return (
                  <button
                    key={layer}
                    onClick={() => {
                      if (canSwitch && !isActive) {
                        setIsLayerSwitching(true);
                        // Add small delay for visual feedback
                        setTimeout(() => {
                          setAnalysisLayer(layer);
                        }, 100);
                      }
                    }}
                    disabled={!canSwitch}
                    className={`px-3 lg:px-4 py-2 lg:py-3 rounded-xl text-xs lg:text-sm font-medium transition-all duration-500 transform ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg scale-105'
                        : canSwitch
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-102'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    } ${
                      isLayerSwitching && !isActive ? 'animate-pulse' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isLayerSwitching && !isActive && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                      )}
                      <span className={`transition-all duration-300 ${
                        isLayerSwitching && !isActive ? 'opacity-50' : 'opacity-100'
                      }`}>
                        {layer}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>


          {/* AOI Mode Selection */}
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2 lg:mb-3">Area of Interest</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => switchAoiMode('default')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                  aoiMode === 'default'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                🌳 Rainforest
              </button>
              <button
                onClick={() => switchAoiMode('draw')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                  aoiMode === 'draw'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                ✏️ {aoiMode === 'draw' && drawingMode === 'polygon' ? 'Drawing Polygon...' : 'Draw Custom'}
              </button>
            </div>
            
            {aoiMode === 'draw' && (
              <>
                
                {(drawnFeatures.length > 0 || showAnalysisButton) && (
                  <div className="mb-3 space-y-2">
                    <div className="text-xs text-gray-400 mb-2">
                      {drawnFeatures.length} AOI drawn
                      {showAnalysisButton && ' • Ready for analysis'}
                    </div>
                    
                    {showAnalysisButton && (
                      <button
                        onClick={runAnalysis}
                        disabled={customLoading}
                        className="w-full px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white text-sm transition-all duration-300 flex items-center justify-center gap-2 font-medium"
                      >
                        {customLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            Run Analysis
                          </>
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={clearDrawings}
                      className="w-full px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-all duration-300"
                    >
                      Clear All
                    </button>
                  </div>
                )}
                
                {drawingMode && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
                    <div className="text-xs text-blue-400">
                      {customLoading ? '📡 Fetching data for drawn area...' : '🔷 Click to add points, double-click to finish'}
                    </div>
                    {customLoading && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                        <span className="text-xs text-blue-300">Loading analysis data...</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            
            {aoiMode === 'default' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="text-xs text-green-400">
                  🌳 Using default Amazon rainforest (Brazil) boundary
                </div>
              </div>
            )}
          </div>

          {/* Time Period Section - Show chart in custom mode, month picker in default mode */}
          {aoiMode === 'draw' && (customNdviData?.monthly_statistics || customLstData?.monthly_statistics) ? (
            /* Custom Mode: Show Chart */
            <div>
              <div className="flex items-center justify-between mb-2 lg:mb-3">
                <label className="text-xs lg:text-sm font-medium text-gray-300">Statistics Chart</label>
                <div className="flex items-center gap-1 lg:gap-2">
                  <BarChart3 className="w-3 lg:w-4 h-3 lg:h-4 text-blue-400" />
                  <span className="text-xs text-blue-400">{analysisLayer} Analysis</span>
                </div>
              </div>
              
              {/* Chart Display */}
              <div className="bg-gray-800/30 rounded-lg p-4 mb-4">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={getCurrentData()?.monthly_statistics?.map((item, index) => ({
                        month: item.month_name.split(' ')[0].substring(0, 3),
                        mean: item.statistics.mean,
                        min: item.statistics.min,
                        max: item.statistics.max,
                        index: index
                      })) || []}
                      margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        width={25}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(17, 24, 39, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        formatter={(value, name) => [value.toFixed(4), name.charAt(0).toUpperCase() + name.slice(1)]}
                      />
                      
                      {/* Three horizontal lines for min, max, mean */}
                      <Line 
                        type="monotone" 
                        dataKey="max" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: '#fff' }}
                        name="Maximum"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="mean" 
                        stroke={analysisLayer === 'NDVI' ? '#10b981' : '#f59e0b'} 
                        strokeWidth={3}
                        dot={{ fill: analysisLayer === 'NDVI' ? '#10b981' : '#f59e0b', strokeWidth: 2, r: 5 }}
                        activeDot={{ r: 7, stroke: analysisLayer === 'NDVI' ? '#10b981' : '#f59e0b', strokeWidth: 2, fill: '#fff' }}
                        name="Mean"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="min" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                        name="Minimum"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Chart Legend and Selected Month Info */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-red-500"></div>
                      <span className="text-xs text-gray-300">Max</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-3 h-0.5 ${analysisLayer === 'NDVI' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                      <span className="text-xs text-gray-300">Mean</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-blue-500"></div>
                      <span className="text-xs text-gray-300">Min</span>
                    </div>
                  </div>
                  <div className="text-center">
                 
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowStatsPopup(true)}
                        className="p-1 rounded bg-gray-800 hover:bg-gray-700 transition-all duration-300 hover:scale-105 shadow-lg border border-gray-600"
                        title="View Statistics Overview"
                      >
                        <BarChart3 className="w-3 h-3 text-white" />
                      </button>
                      <button
                        onClick={() => {
                          const currentData = getCurrentData();
                          if (currentData && currentData.monthly_statistics) {
                            const csvData = currentData.monthly_statistics.map(item => ({
                              month: item.month_name,
                              mean: item.statistics.mean,
                              min: item.statistics.min,
                              max: item.statistics.max
                            }));
                            const csv = Papa.unparse(csvData);
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            const url = URL.createObjectURL(blob);
                            link.setAttribute('href', url);
                            link.setAttribute('download', `${analysisLayer}_statistics.csv`);
                            link.style.visibility = 'hidden';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        title={`Export ${analysisLayer} statistics to CSV`}
                      >
                        <Download size={10} />
                        CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Default Mode: Show Month Picker */
            <div>
              <div className="flex items-center justify-between mb-2 lg:mb-3">
                <label className="text-xs lg:text-sm font-medium text-gray-300">Time Period</label>
                <div className="flex items-center gap-1 lg:gap-2 hidden lg:flex">
                  <Calendar className="w-3 lg:w-4 h-3 lg:h-4 text-blue-400" />
                  <span className="text-xs text-blue-400">{getTimePeriod()}</span>
                </div>
              </div>
              
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setSelectedMonth(Math.max(0, selectedMonth - 1))}
                  disabled={selectedMonth === 0 || loading || !getCurrentData()}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
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
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
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
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                    }`}
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
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                  style={{ width: `${((selectedMonth + 1) / (getMonthNames().length || 12)) * 100}%` }}
                ></div>
              </div>
            </div>
            </div>
          )}


        </div>

        {/* Query Button */}
        {selectedCoordinate && (
          <div className="p-6 border-t border-white/10">
            <button
              onClick={() => setShowChart(!showChart)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <BarChart3 className="w-4 h-4" />
              {showChart ? 'Hide' : 'Show'} Time Series
            </button>
          </div>
        )}


      </div>

      {/* Modern Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Floating Top Bar - Hidden on Mobile */}
        <div className="hidden md:block absolute top-4 left-4 right-4 z-20">
          <div className="bg-gray-900 border border-gray-600 rounded-2xl p-2 md:p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1 md:p-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <Layers className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
              </div>
              <div className="hidden md:block">
                <span className="text-white font-medium text-sm md:text-base">Amazon rainforest (Brazil)</span>
                <div className="text-xs text-gray-300">
                  {analysisLayer} • {getMonthNames()[selectedMonth] || 'Loading...'}
                  {aoiMode === 'draw' && drawnFeatures.length > 0 && <span className="ml-2 text-blue-400">• {drawnFeatures.length} Custom AOI</span>}
                  {aoiMode === 'default' && <span className="ml-2 text-green-400">• Rainforest AOI</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              {/* Search Bar */}
              <div className="relative">
                <div className="flex items-center bg-gray-700 rounded-xl border border-gray-600 px-2 py-1 md:px-3 md:py-2">
                  <input
                    type="text"
                    placeholder="Search location..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        searchLocation(e.target.value);
                      } else {
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        searchLocation(searchQuery);
                      }
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) {
                        setShowSearchResults(true);
                      }
                    }}
                    className="bg-transparent text-white placeholder-gray-400 text-xs outline-none w-20 md:w-32"
                  />
                  <button
                    onClick={() => searchLocation(searchQuery)}
                    disabled={isSearching || !searchQuery.trim()}
                    className="ml-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-white"></div>
                    ) : (
                      <Globe className="w-3 h-3 md:w-4 md:h-4" />
                    )}
                  </button>
                </div>
                
                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => selectSearchResult(result)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors border-b border-gray-600 last:border-b-0"
                      >
                        <div className="text-xs text-white truncate">
                          {result.display_name.split(',')[0]}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {result.display_name.split(',').slice(1, 3).join(',')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Basemap Toggle */}
              <div className="flex bg-gray-700 rounded-xl p-1 border border-gray-600">
                {Object.entries(basemaps).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => switchBaseLayer(key)}
                    className={`px-2 py-1 md:px-3 md:py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                      basemap === key
                        ? 'bg-white text-gray-900 shadow-lg'
                        : 'text-white hover:bg-gray-600'
                    }`}
                  >
                    {key === 'satellite' ? 'Satellite' : 'Street'}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={handleZoomIn}
                className="p-2 md:p-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all duration-300 shadow-lg"
              >
                <ZoomIn className="w-3 h-3 md:w-4 md:h-4 text-white" />
              </button>
              <button 
                onClick={handleZoomOut}
                className="p-2 md:p-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all duration-300 shadow-lg"
              >
                <ZoomOut className="w-3 h-3 md:w-4 md:h-4 text-white" />
              </button>

              {chartData.length > 0 && (
                <button
                  onClick={() => setShowChart(!showChart)}
                  className={`p-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg ${
                    showChart ? 'bg-blue-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                  title="Toggle Time Series Chart"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile-Only Simple Navigation */}
        <div className="md:hidden absolute top-4 right-4 z-20">
          <div className="flex gap-2">
            {/* Basemap Toggle */}
            <div className="flex bg-gray-900 border border-gray-600 rounded-xl p-1">
              {Object.entries(basemaps).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => switchBaseLayer(key)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all duration-300 ${
                    basemap === key
                      ? 'bg-white text-gray-900 shadow-lg'
                      : 'text-white hover:bg-gray-700'
                  }`}
                >
                  {key === 'satellite' ? 'Satellite' : 'Street'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Overlay - appears when sidebar is open */}
        {!sidebarCollapsed && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={toggleSidebar}
          />
        )}

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
          {((loading && aoiMode === 'default') || (customLoading && aoiMode === 'draw')) && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <div className="bg-gray-900 rounded-2xl p-8 border border-gray-600 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <div className="text-white">
                    <div className="font-medium">
                      {aoiMode === 'default' ? 'Loading satellite data...' : 'Analyzing custom area...'}
                    </div>
                    <div className="text-sm text-gray-300">
                      {aoiMode === 'default' ? `Fetching ${analysisLayer} layers` : `Processing ${analysisLayer} analysis for drawn polygon`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          
          {/* Legend Panel - Right Side - Show on mobile only when tiles loaded */}
          <div className={`absolute top-24 right-4 z-20 ${(ndviData || lstData) ? 'block' : 'hidden md:block'}`}>
            {loading ? (
              <div className="bg-gray-900 border border-gray-600 rounded-xl p-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <div className="text-sm text-gray-300">Loading legend...</div>
                </div>
              </div>
            ) : (
              <>
                {analysisLayer === 'NDVI' && ndviData && (
                  <div className="bg-gray-900 border border-gray-600 rounded-xl p-4 shadow-2xl max-w-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50"></div>
                      <h3 className="text-sm font-semibold text-white">{ndviData.legend.title}</h3>
                    </div>
                    
                    <div className="mb-3">
                      <div 
                        className="h-4 rounded-lg shadow-lg border border-white/20"
                        style={{
                          background: `linear-gradient(to right, ${ndviData.legend.colors.join(', ')})`
                        }}
                      ></div>
                      <div className="flex justify-between text-xs text-gray-300 mt-1 font-medium">
                        <span>{ndviData.legend.min}</span>
                        <span>{ndviData.legend.max}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      {ndviData.legend.labels.slice(0, 3).map((label, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-gray-300">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-400"></div>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysisLayer === 'LST' && lstData && (
                  <div className="bg-gray-900 border border-gray-600 rounded-xl p-4 shadow-2xl max-w-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-orange-400 shadow-lg shadow-orange-400/50"></div>
                      <h3 className="text-sm font-semibold text-white">{lstData.legend.title}</h3>
                    </div>
                    
                    <div className="mb-3">
                      <div 
                        className="h-4 rounded-lg shadow-lg border border-white/20"
                        style={{
                          background: `linear-gradient(to right, ${lstData.legend.colors.join(', ')})`
                        }}
                      ></div>
                      <div className="flex justify-between text-xs text-gray-300 mt-1 font-medium">
                        <span>{lstData.legend.min}°C</span>
                        <span>{lstData.legend.max}°C</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      {lstData.legend.labels.slice(0, 3).map((label, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-gray-300">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-red-400"></div>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Floating Info Panel */}
      

          {/* Time Series Chart Overlay */}
          {showChart && chartData.length > 0 && (
            <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-600 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {analysisLayer} Time Series
                  </h3>
                  <button
                    onClick={() => setShowChart(false)}
                    className="text-gray-400 hover:text-white transition-colors text-xl"
                  >
                    ×
                  </button>
                </div>
                
                <div className="h-64 mb-4 bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">Time Series Chart</div>
                    <div className="text-xs">Chart functionality temporarily disabled</div>
                    <div className="text-xs mt-2">
                      {chartData.length} data points for {analysisLayer}
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-300">
                  <div className="mb-2">
                    <strong>Location:</strong> {selectedCoordinate[0].toFixed(4)}°, {selectedCoordinate[1].toFixed(4)}°
                  </div>
                  <div className="mb-2">
                    <strong>Data Type:</strong> {analysisLayer === 'NDVI' ? 'Normalized Difference Vegetation Index' : 'Land Surface Temperature'}
                  </div>
                  <div className="text-xs text-gray-400">
                    📊 12-month time series • 📡 Dummy data for demonstration
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <div className="bg-gray-900 border border-gray-600 rounded-xl p-4 shadow-2xl min-w-[200px]">
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
                        {chartData.length > 0 && (
                          <button
                            onClick={() => setShowChart(true)}
                            className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline pointer-events-auto"
                          >
                            View Time Series →
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              
              {/* Arrow pointing to clicked location */}
              <div 
                className="absolute top-full left-6 w-3 h-3 bg-gray-900 border-r border-b border-gray-600 transform rotate-45"
                style={{ marginTop: '-6px' }}
              ></div>
            </div>
          )}

        </div>
      </div>

      {/* Statistics Popup */}
      {showStatsPopup && (
        <StatisticsPopup
          ndviData={aoiMode === 'draw' ? customNdviData?.monthly_statistics : null}
          lstData={aoiMode === 'draw' ? customLstData?.monthly_statistics : null}
          selectedMonth={selectedMonth}
          onMonthSelect={setSelectedMonth}
          onClose={() => setShowStatsPopup(false)}
        />
      )}

      {/* Monthly Point Data Popup */}
      {showMonthlyPointPopup && (
        <MonthlyPointDataPopup
          data={monthlyPointData}
          analysisLayer={analysisLayer}
          coordinates={clickedPointCoordinates}
          loading={monthlyPointLoading}
          onClose={() => {
            setShowMonthlyPointPopup(false);
            setMonthlyPointData(null);
            setClickedPointCoordinates(null);
          }}
        />
      )}

      {/* Developer Credit */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="bg-gradient-to-t from-black/50 to-transparent py-2">
          <div className="text-center">
            <p className="text-xs text-gray-400 opacity-70">
              Developed by <span className="font-medium text-gray-300">Hem Raj Pandey</span>
            </p>
          </div>
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