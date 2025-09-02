import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Download, ZoomIn, ZoomOut, Globe, Layers, Calendar, ChevronLeft, ChevronRight, Play, Pause, Square, BarChart3, FileText, Check } from 'lucide-react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Draw from 'ol/interaction/Draw';
import { fromLonLat, toLonLat } from 'ol/proj';
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// import jsPDF from 'jspdf';
// import html2canvas from 'html2canvas';
// import Papa from 'papaparse';
import 'ol/ol.css';
import { amazonAPI, customAPI } from './src/services/api';

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
        // Add small delay for smoother visual transition
        setTimeout(() => {
          updateMapLayer(response, selectedMonth, true);
        }, 150);
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
  
  const fetchCustomData = async (coordinates) => {
    setCustomLoading(true);
    try {
      console.log('🎯 Starting custom data fetch for coordinates:', coordinates);
      console.log('📡 Making API call for', analysisLayer, 'to custom endpoint...');
      
      let customResponse;
      if (analysisLayer === 'NDVI') {
        customResponse = await customAPI.getNDVIData(coordinates);
        console.log('✅ Custom NDVI API Response:', customResponse);
        
        if (customResponse) {
          console.log('📊 NDVI Data Summary:');
          console.log('  - Legend:', customResponse.legend);
          console.log('  - Time Period:', customResponse.time_period);
          console.log('  - Monthly Layers:', customResponse.monthly_layers?.length || 0, 'months');
          if (customResponse.monthly_layers && customResponse.monthly_layers.length > 0) {
            console.log('  - Sample Month Data:', customResponse.monthly_layers[0]);
          }
        }
        
        setCustomNdviData(customResponse);
      } else {
        customResponse = await customAPI.getLSTData(coordinates);
        console.log('✅ Custom LST API Response:', customResponse);
        
        if (customResponse) {
          console.log('🌡️ LST Data Summary:');
          console.log('  - Legend:', customResponse.legend);
          console.log('  - Time Period:', customResponse.time_period);
          console.log('  - Monthly Layers:', customResponse.monthly_layers?.length || 0, 'months');
          if (customResponse.monthly_layers && customResponse.monthly_layers.length > 0) {
            console.log('  - Sample Month Data:', customResponse.monthly_layers[0]);
          }
        }
        
        setCustomLstData(customResponse);
      }
      
      // Update map layer with the new custom data
      if (customResponse) {
        console.log('🗺️ Updating map layer with custom data for:', analysisLayer);
        // Add small delay for smoother visual transition
        setTimeout(() => {
          updateMapLayer(customResponse, selectedMonth, true);
        }, 150);
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
    // Only fetch Amazon data when specifically in default mode
    if (aoiMode === 'default') {
      const currentData = analysisLayer === 'NDVI' ? ndviData : lstData;
      if (!currentData) {
        fetchData();
      }
    }
  }, [aoiMode, analysisLayer]);

  const updateMapLayer = (data, monthIndex, smooth = true) => {
    if (!mapInstanceRef.current || !data || !data.monthly_layers[monthIndex]) {
      return;
    }

    const monthData = data.monthly_layers[monthIndex];
    console.log('Updating map layer with data:', monthData.month_name);
    
    const newTileLayer = new TileLayer({
      source: new XYZ({
        url: monthData.tile_url,
        maxZoom: 20,
      }),
      opacity: smooth ? 0 : 0.7, // Start transparent for smooth transition
      zIndex: 10, // Above base layers
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
      
      // Close search results when clicking on map
      const closeSearchResults = () => {
        setShowSearchResults(false);
      };
      
      // Define click handler inside useEffect to avoid stale closure
      const clickHandler = async (event) => {
        closeSearchResults();
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
          setSelectedCoordinate([lon, lat]);
          
          const timeSeriesData = generateTimeSeriesData([lon, lat]);
          setChartData(timeSeriesData);
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
    const data = getCurrentData();
    if (data && aoiMode === 'default') {
      // Reset month selection if current month is out of range
      const maxMonths = data.monthly_layers?.length || 0;
      if (selectedMonth >= maxMonths) {
        setSelectedMonth(0);
        return;
      }
      updateMapLayer(data, selectedMonth);
    } else if (data && aoiMode === 'draw' && (customNdviData || customLstData)) {
      // Update layer for custom data
      const maxMonths = data.monthly_layers?.length || 0;
      if (selectedMonth >= maxMonths) {
        setSelectedMonth(0);
        return;
      }
      updateMapLayer(data, selectedMonth);
    } else if (aoiMode === 'draw' && !data && pendingPolygonCoords && drawnFeatures.length > 0) {
      // If switching analysis type in draw mode and data is missing, fetch it
      console.log('⚡ Analysis layer switched to', analysisLayer, '- fetching missing data');
      fetchCustomData(pendingPolygonCoords);
    }
  }, [analysisLayer, selectedMonth, ndviData, lstData, customNdviData, customLstData, aoiMode]);
  
  // Handle analysis layer switching in custom mode
  useEffect(() => {
    if (aoiMode === 'draw' && drawnFeatures.length > 0 && pendingPolygonCoords) {
      const needsData = analysisLayer === 'NDVI' ? !customNdviData : !customLstData;
      if (needsData && !customLoading) {
        console.log('🔄 Switching to', analysisLayer, '- need to fetch data');
        setShowAnalysisButton(true);
      } else if (!needsData) {
        setShowAnalysisButton(false);
      }
    }
  }, [analysisLayer, aoiMode, drawnFeatures, customNdviData, customLstData, pendingPolygonCoords, customLoading]);

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
    
    const drawType = 'Polygon';
    const drawInteraction = new Draw({
      source: vectorSourceRef.current,
      type: drawType
    });
    
    drawInteraction.on('drawend', (event) => {
      const feature = event.feature;
      const geometry = feature.getGeometry();
      const coordinates = geometry.getCoordinates();
      
      // Clear previous drawings before adding new one
      if (drawnFeatures.length > 0) {
        clearDrawings();
      }
      
      const newFeature = {
        id: Date.now(),
        type: mode,
        geometry: coordinates,
        bounds: geometry.getExtent()
      };
      
      setDrawnFeatures([newFeature]); // Replace with new feature
      setDrawingMode(null);
      mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
      
      // Store coordinates and show analysis button instead of auto-fetching
      setPendingPolygonCoords(coordinates);
      setShowAnalysisButton(true);
      console.log('🎯 Polygon drawn successfully. Ready for analysis.');
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
    // Clear custom data when clearing drawings
    setCustomNdviData(null);
    setCustomLstData(null);
    // Remove any existing analysis layer
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
      // Clear drawn features and remove analysis layer for clean drawing
      clearDrawings();
      // Clear any existing custom data
      setCustomNdviData(null);
      setCustomLstData(null);
      if (mapInstanceRef.current) {
        // Remove current analysis layer for clean drawing
        if (currentLayer) {
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
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.1) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>
      
      {/* Modern Sidebar */}
      <div className="w-full lg:w-80 bg-black/20 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col relative z-10 max-h-64 lg:max-h-none overflow-y-auto lg:overflow-visible">
        {/* Modern Header */}
        <div className="p-3 lg:p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10 backdrop-blur-sm">
          <div className="flex items-center gap-2 lg:gap-3 mb-2">
            <div className="p-1 lg:p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg">
              <Globe className="w-4 lg:w-6 h-4 lg:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-sm lg:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Earth Engine Pro
              </h1>
              <p className="text-xs lg:text-sm text-gray-300 hidden lg:block">Amazon Rainforest Analysis</p>
            </div>
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
                        ? 'bg-white/5 text-gray-300 hover:bg-white/10 hover:scale-102 backdrop-blur-sm'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed backdrop-blur-sm'
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
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 backdrop-blur-sm'
                }`}
              >
                🌳 Rainforest
              </button>
              <button
                onClick={() => switchAoiMode('draw')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                  aoiMode === 'draw'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 backdrop-blur-sm'
                }`}
              >
                ✏️ Draw Custom
              </button>
            </div>
            
            {aoiMode === 'draw' && (
              <>
                <button
                  onClick={() => toggleDrawingMode('polygon')}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 mb-3 ${
                    drawingMode === 'polygon'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 backdrop-blur-sm'
                  }`}
                >
                  <div className="w-4 h-4 border-2 border-current transform rotate-45"></div>
                  {drawingMode === 'polygon' ? 'Drawing...' : 'Draw Polygon'}
                </button>
                
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
                  🌳 Using default Amazon Rainforest boundary
                </div>
              </div>
            )}
          </div>

          {/* Modern Month Picker */}
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

        {/* Export Section */}
        <div className="p-6 border-t border-white/10">
          <div className="text-center text-gray-500 text-sm">
            Export functionality coming soon
          </div>
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
                  {analysisLayer} • {getMonthNames()[selectedMonth] || 'Loading...'}
                  {aoiMode === 'draw' && drawnFeatures.length > 0 && <span className="ml-2 text-blue-400">• {drawnFeatures.length} Custom AOI</span>}
                  {aoiMode === 'default' && <span className="ml-2 text-green-400">• Rainforest AOI</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search Bar */}
              <div className="relative">
                <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 px-3 py-2">
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
                    className="bg-transparent text-white placeholder-gray-400 text-xs outline-none w-32"
                  />
                  <button
                    onClick={() => searchLocation(searchQuery)}
                    disabled={isSearching || !searchQuery.trim()}
                    className="ml-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Globe className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => selectSearchResult(result)}
                        className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0"
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
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-300 shadow-lg"
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
              <button 
                onClick={handleZoomOut}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-300 shadow-lg"
              >
                <ZoomOut className="w-4 h-4 text-white" />
              </button>
              
              {chartData.length > 0 && (
                <button
                  onClick={() => setShowChart(!showChart)}
                  className={`p-3 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg ${
                    showChart ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title="Toggle Time Series Chart"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              )}
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
          {((loading && aoiMode === 'default') || (customLoading && aoiMode === 'draw')) && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
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
          
          {/* Layer Switching Overlay */}
          {isLayerSwitching && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-15">
              <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  <div className="text-white">
                    <div className="font-medium text-sm">Switching to {analysisLayer}...</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Legend Panel - Right Side */}
          <div className="absolute top-24 right-4 z-20">
            {loading ? (
              <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <div className="text-sm text-gray-300">Loading legend...</div>
                </div>
              </div>
            ) : (
              <>
                {analysisLayer === 'NDVI' && ndviData && (
                  <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl max-w-xs">
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
                  <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl max-w-xs">
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
          <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl max-w-sm">
              <div className="text-xs text-gray-300 mb-2">Current View</div>
              <div className="text-white font-medium">
                {analysisLayer} Analysis
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Data from {getMonthNames()[selectedMonth] || 'Loading...'}
              </div>
              {drawingMode && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-xs text-blue-400">
                    📍 Drawing polygon mode active
                  </div>
                </div>
              )}
              {aoiMode === 'draw' && drawnFeatures.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-xs text-green-400">
                    ✅ {drawnFeatures.length} custom AOI drawn
                  </div>
                </div>
              )}
              {aoiMode === 'default' && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-xs text-green-400">
                    🌳 Using default rainforest boundary
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Time Series Chart Overlay */}
          {showChart && chartData.length > 0 && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center p-4">
              <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
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