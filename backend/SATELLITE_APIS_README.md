# Satellite Data APIs Documentation

This document describes the 6 main satellite data APIs for environmental monitoring and their corresponding endpoints.

## API Endpoints Overview

```
GET  /amazon/ndvi/                    - Amazon NDVI data with grid tiling
GET  /amazon/lst/                     - Amazon LST data with grid tiling  
POST /custom/ndvi/                    - Custom area NDVI statistics
POST /custom/lst/                     - Custom area LST statistics
POST /custom/point/ndvi/monthly/      - Point NDVI data for specific month
POST /custom/point/lst/monthly/       - Point LST data for specific month
```

---

## 1. Amazon NDVI API

**Endpoint:** `GET /amazon/ndvi/`  
**Description:** Retrieves NDVI (Normalized Difference Vegetation Index) data for the entire Amazon rainforest using grid-based tiling for complete coverage.

### Features:
- **Grid-based processing**: Splits Amazon into 5°×5° tiles for reliable processing
- **12-month time series**: Returns data for the last 12 months
- **Cloud masking**: Filters out cloudy pixels using Sentinel-2 SCL band
- **Concurrent processing**: Uses ThreadPoolExecutor for faster computation
- **Tile merging**: Automatically merges all grid tiles into seamless coverage

### Request:
```http
GET /amazon/ndvi/
```

### Response:
```json
{
  "success": true,
  "region": "Amazon Rainforest",
  "data_type": "NDVI",
  "time_period": "2023-09-01 to 2024-09-01",
  "total_layers": 12,
  "monthly_layers": [
    {
      "month": "2023-09",
      "month_name": "September 2023",
      "tile_url": "https://earthengine.googleapis.com/...",
      "vis_params": {
        "min": 0,
        "max": 1.0,
        "palette": ["#ff0000", "#ffff00", "#00ff00"]
      },
      "data_type": "NDVI",
      "tiles_processed": 64,
      "grid_coverage": "complete"
    }
  ],
  "legend": {
    "title": "NDVI Values",
    "min": 0,
    "max": 1.0,
    "colors": ["#ff0000", "#ffff00", "#00ff00"],
    "labels": ["Low Vegetation", "Moderate Vegetation", "High Vegetation"]
  },
  "aoi_bounds": [[[-74.0, -18.0], [-74.0, 12.0], [-34.0, 12.0], [-34.0, -18.0], [-74.0, -18.0]]],
  "processing_info": {
    "grid_tiles": 64,
    "tile_size_degrees": 5.0,
    "coverage_method": "grid-based_tiling"
  }
}
```

---

## 2. Amazon LST API

**Endpoint:** `GET /amazon/lst/`  
**Description:** Retrieves Land Surface Temperature data for the Amazon rainforest with the same grid-based approach as NDVI.

### Features:
- **MODIS data source**: Uses MODIS MOD11A2 8-day LST composite
- **Temperature conversion**: Converts from Kelvin to Celsius
- **Grid-based processing**: Same tiling system as Amazon NDVI
- **1km resolution**: Uses MODIS 1km resolution data

### Request:
```http
GET /amazon/lst/
```

### Response:
```json
{
  "success": true,
  "region": "Amazon Rainforest",
  "data_type": "LST (Land Surface Temperature)",
  "time_period": "2023-09-01 to 2024-09-01",
  "total_layers": 12,
  "monthly_layers": [
    {
      "month": "2023-09",
      "month_name": "September 2023",
      "tile_url": "https://earthengine.googleapis.com/...",
      "vis_params": {
        "min": 20,
        "max": 40,
        "palette": ["#313695", "#4575b4", "#74add1", ...]
      },
      "data_type": "LST",
      "unit": "Celsius",
      "tiles_processed": 64,
      "grid_coverage": "complete"
    }
  ],
  "legend": {
    "title": "Land Surface Temperature (°C)",
    "min": 20,
    "max": 40,
    "colors": ["#313695", "#4575b4", "#74add1", ...],
    "labels": ["Cool (20°C)", "Moderate (25°C)", "Warm (30°C)", "Hot (35°C)", "Very Hot (40°C)"]
  }
}
```

---

## 3. Custom NDVI API

**Endpoint:** `POST /custom/ndvi/`  
**Description:** Calculates NDVI statistics for a custom Area of Interest (AOI) defined by user-provided GeoJSON polygon.

### Features:
- **Custom AOI**: User defines area using GeoJSON polygon
- **Statistical analysis**: Returns mean, min, max NDVI values
- **12-month analysis**: Processes last 12 months of data
- **Sentinel-2 data**: 10m resolution analysis

### Request:
```http
POST /custom/ndvi/
Content-Type: application/json

{
  "geometry": {
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [-60.0, -3.0],
          [-60.0, -2.0],
          [-59.0, -2.0],
          [-59.0, -3.0],
          [-60.0, -3.0]
        ]
      ]
    }
  }
}
```

### Response:
```json
{
  "success": true,
  "region": "Custom AOI",
  "data_type": "NDVI",
  "time_period": "2023-09-01 to 2024-09-01",
  "total_months": 12,
  "monthly_statistics": [
    {
      "month": "2023-09",
      "month_name": "September 2023",
      "data_type": "NDVI",
      "statistics": {
        "mean": 0.7845,
        "min": 0.2341,
        "max": 0.9562
      },
      "data_available": true
    }
  ],
  "aoi_bounds": [[[-60.0, -3.0], [-60.0, -2.0], [-59.0, -2.0], [-59.0, -3.0], [-60.0, -3.0]]]
}
```

---

## 4. Custom LST API

**Endpoint:** `POST /custom/lst/`  
**Description:** Calculates Land Surface Temperature statistics for a custom Area of Interest (AOI) defined by user-provided GeoJSON polygon.

### Features:
- **Custom AOI**: User defines area using GeoJSON polygon
- **Statistical analysis**: Returns mean, min, max LST values in Celsius
- **12-month analysis**: Processes last 12 months of data
- **MODIS data**: 1km resolution analysis using MODIS MOD11A2

### Request:
```http
POST /custom/lst/
Content-Type: application/json

{
  "geometry": {
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [-60.0, -3.0],
          [-60.0, -2.0],
          [-59.0, -2.0],
          [-59.0, -3.0],
          [-60.0, -3.0]
        ]
      ]
    }
  }
}
```

### Response:
```json
{
  "success": true,
  "region": "Custom AOI",
  "data_type": "LST (Land Surface Temperature)",
  "time_period": "2023-09-01 to 2024-09-01",
  "total_months": 12,
  "monthly_statistics": [
    {
      "month": "2023-09",
      "month_name": "September 2023",
      "data_type": "LST",
      "unit": "Celsius",
      "statistics": {
        "mean": 28.45,
        "min": 22.15,
        "max": 35.67
      },
      "data_available": true
    }
  ],
  "aoi_bounds": [[[-60.0, -3.0], [-60.0, -2.0], [-59.0, -2.0], [-59.0, -3.0], [-60.0, -3.0]]]
}
```

---

## 5. Point NDVI Monthly API

**Endpoint:** `POST /custom/point/ndvi/monthly/`  
**Description:** Retrieves detailed NDVI data for a specific point location and month.

### Features:
- **Point-based sampling**: Gets NDVI values at exact coordinates
- **Monthly focus**: Analyzes single month in detail
- **Multiple formats**: Accepts lat/lon or GeoJSON Point
- **Detailed values**: Returns both median and all individual values
- **Image count**: Shows number of satellite images used

### Request Options:

#### Option 1: Direct Coordinates
```http
POST /custom/point/ndvi/monthly/
Content-Type: application/json

{
  "latitude": -3.1,
  "longitude": -60.0,
  "month": "2024-08"
}
```

#### Option 2: GeoJSON Point
```http
POST /custom/point/ndvi/monthly/
Content-Type: application/json

{
  "geometry": {
    "geometry": {
      "type": "Point",
      "coordinates": [-60.0, -3.1]
    }
  },
  "month": "2024-08"
}
```

### Response:
```json
{
  "success": true,
  "location": {
    "latitude": -3.1,
    "longitude": -60.0
  },
  "month": "2024-08",
  "month_name": "August 2024",
  "data_type": "NDVI",
  "median_ndvi": 0.8234,
  "all_ndvi_values": [0.8123, 0.8234, 0.8456, 0.8012],
  "image_count": 4,
  "data_available": true
}
```

---

## 6. Point LST Monthly API

**Endpoint:** `POST /custom/point/lst/monthly/`  
**Description:** Retrieves detailed Land Surface Temperature data for a specific point location and month.

### Features:
- **Point-based sampling**: Gets LST values at exact coordinates
- **Monthly focus**: Analyzes single month in detail
- **Multiple formats**: Accepts lat/lon or GeoJSON Point
- **Temperature conversion**: Automatic conversion from Kelvin to Celsius
- **Detailed values**: Returns both median and all individual values

### Request Options:

#### Option 1: Direct Coordinates
```http
POST /custom/point/lst/monthly/
Content-Type: application/json

{
  "latitude": -3.1,
  "longitude": -60.0,
  "month": "2024-08"
}
```

#### Option 2: GeoJSON Point
```http
POST /custom/point/lst/monthly/
Content-Type: application/json

{
  "geometry": {
    "geometry": {
      "type": "Point",
      "coordinates": [-60.0, -3.1]
    }
  },
  "month": "2024-08"
}
```

### Response:
```json
{
  "success": true,
  "location": {
    "latitude": -3.1,
    "longitude": -60.0
  },
  "month": "2024-08",
  "month_name": "August 2024",
  "data_type": "LST (Land Surface Temperature)",
  "unit": "Celsius",
  "median_lst": 28.45,
  "all_lst_values": [27.12, 28.45, 29.78, 26.89],
  "data_available": true
}
```

---

## Error Responses

All APIs return standardized error responses:

```json
{
  "success": false,
  "error": "Error description message"
}
```

Common error codes:
- `400`: Missing or invalid parameters
- `500`: Internal processing error (Earth Engine, network issues)

---

## Data Sources

- **NDVI**: Sentinel-2 SR Harmonized Collection (`COPERNICUS/S2_SR_HARMONIZED`)
- **LST**: MODIS Land Surface Temperature (`MODIS/061/MOD11A2`)
- **Resolution**: 10m (Sentinel-2), 1km (MODIS)
- **Time Range**: Last 12 months from current date

---

## Performance Features

1. **Concurrent Processing**: Uses ThreadPoolExecutor for parallel month processing
2. **Grid-based Tiling**: Ensures complete coverage for large areas
3. **Cloud Masking**: Filters cloudy pixels for better data quality
4. **Error Handling**: Graceful fallbacks and detailed error reporting
5. **Memory Management**: Optimized worker counts and tile sizes

---

## Usage Notes

- Amazon APIs (`GET`) require no parameters and process predefined regions
- Custom APIs (`POST`) require geometry/coordinate parameters
- Monthly APIs require `month` parameter in `YYYY-MM` format
- All coordinates use WGS84 decimal degrees (longitude, latitude order for GeoJSON)
- Processing time varies based on area size and data availability