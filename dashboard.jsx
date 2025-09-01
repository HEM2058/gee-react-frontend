import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Download, ZoomIn, ZoomOut, Globe, Layers } from 'lucide-react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import 'ol/ol.css';

const EarthEngineDashboard = () => {
  const [selectedArea, setSelectedArea] = useState('Amazon Rainforest (Brazil)');
  const [basemap, setBasemap] = useState('Satellite (Dark)');
  const [analysisLayer, setAnalysisLayer] = useState('NDVI (Vegetation Index)');
  const [dateRange, setDateRange] = useState([0, 11]);
  const [liveData, setLiveData] = useState(true);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const areas = [
    'Amazon Rainforest (Brazil)',
    'Congo Basin (Africa)',
    'Boreal Forest (Canada)',
    'Sahara Desert (Africa)',
    'Himalayas (Asia)'
  ];

  const areaCoordinates = {
    'Amazon Rainforest (Brazil)': [-60, -3],
    'Congo Basin (Africa)': [18, 0],
    'Boreal Forest (Canada)': [-105, 55],
    'Sahara Desert (Africa)': [3, 23],
    'Himalayas (Asia)': [85, 28]
  };

  const basemaps = [
    'Satellite (Dark)',
    'Satellite (Light)',
    'Terrain',
    'Street Map',
    'Hybrid'
  ];

  const analysisLayers = [
    'NDVI (Vegetation Index)',
    'LST (Land Surface Temperature)',
    'Precipitation',
    'Deforestation Analysis',
    'Urban Growth'
  ];

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const googleSatelliteLayer = new TileLayer({
        source: new XYZ({
          url: 'http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          maxZoom: 20,
        }),
      });

      const map = new Map({
        target: mapRef.current,
        layers: [googleSatelliteLayer],
        view: new View({
          center: fromLonLat(areaCoordinates[selectedArea]),
          zoom: 6,
        }),
      });

      mapInstanceRef.current = map;
    }
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && areaCoordinates[selectedArea]) {
      mapInstanceRef.current.getView().setCenter(fromLonLat(areaCoordinates[selectedArea]));
      mapInstanceRef.current.getView().setZoom(6);
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
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold text-white">GEE Earth Engine Dashboard</h1>
          </div>
          <p className="text-sm text-gray-400">Interactive satellite data analysis</p>
          <div className="flex items-center justify-end mt-2">
            <div className={`flex items-center gap-1 text-xs ${liveData ? 'text-green-400' : 'text-gray-400'}`}>
              <div className={`w-2 h-2 rounded-full ${liveData ? 'bg-green-400' : 'bg-gray-400'} animate-pulse`}></div>
              Live Data
            </div>
          </div>
        </div>

        {/* Map Controls */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold mb-3 text-white">Map Controls</h2>
          
          {/* Area of Interest */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-2">Area of Interest</label>
            <select 
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {areas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {/* Basemap */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-2">Basemap</label>
            <select 
              value={basemap}
              onChange={(e) => setBasemap(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {basemaps.map(map => (
                <option key={map} value={map}>{map}</option>
              ))}
            </select>
          </div>

          {/* Analysis Layer */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-2">Analysis Layer</label>
            <select 
              value={analysisLayer}
              onChange={(e) => setAnalysisLayer(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {analysisLayers.map(layer => (
                <option key={layer} value={layer}>{layer}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-2">Date Filter: Sep 2025</label>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="11"
                value={dateRange[1]}
                onChange={(e) => setDateRange([dateRange[0], parseInt(e.target.value)])}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span>
                <span>{dateRange[1]}</span>
                <span>11</span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <button className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded px-4 py-2 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>

        {/* NDVI Legend */}
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3 text-white">NDVI (Vegetation Index)</h3>
          <div className="mb-3">
            <div className="h-4 rounded bg-gradient-to-r from-red-600 via-yellow-400 to-green-500"></div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">Higher values indicate healthier vegetation</p>
          <p className="text-xs text-gray-300">Click on map to see pixel value</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-300">Map View</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-gray-400" />
            </button>
            <button 
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
            >
              <ZoomOut className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 bg-gray-900 overflow-hidden">
          <div 
            ref={mapRef} 
            className="w-full h-full"
            style={{ minHeight: '400px' }}
          />
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