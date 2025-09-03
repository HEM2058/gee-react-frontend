"""
Satellite Data APIs for Environmental Monitoring
===============================================

This module contains API classes for retrieving satellite-based environmental data:
1. AmazonNDVIAPI - Amazon rainforest NDVI data with grid-based tiling
2. AmazonLSTAPI - Amazon rainforest Land Surface Temperature data
3. CustomNDVIAPI - Custom area NDVI statistics 
4. CustomLSTAPI - Custom area LST statistics
5. PointNDVIMonthlyAPI - Point-based NDVI data for specific month
6. PointLSTMonthlyAPI - Point-based LST data for specific month

Dependencies:
- Google Earth Engine (ee)
- Django REST Framework
- ThreadPoolExecutor for concurrent processing
"""

import ee
from concurrent.futures import ThreadPoolExecutor
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from datetime import datetime
from dateutil.relativedelta import relativedelta
from .geeAuth import init_earth_engine


class AmazonNDVIAPI(APIView):
    init_earth_engine()
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        """
        Get NDVI data for Amazon rainforest for the last 12 months
        Returns 12 monthly NDVI heat layers using grid-based tiling for complete coverage
        """
        try:
            # Amazon rainforest bounding box coordinates
            amazon_bounds = [
                [[-74.0, -18.0], [-74.0, 12.0], [-34.0, 12.0], [-34.0, -18.0], [-74.0, -18.0]]
            ]
            aoi = ee.Geometry.Polygon(amazon_bounds)
            
            # Create a grid system for the Amazon region to ensure complete coverage
            def create_grid_tiles(min_lon, max_lon, min_lat, max_lat, tile_size=5.0):
                """Create grid tiles for processing large areas efficiently"""
                tiles = []
                lon_step = tile_size
                lat_step = tile_size
                
                lon = min_lon
                while lon < max_lon:
                    lat = min_lat
                    while lat < max_lat:
                        tile_bounds = [
                            [[lon, lat], [lon, lat + lat_step], 
                             [lon + lon_step, lat + lat_step], [lon + lon_step, lat], [lon, lat]]
                        ]
                        tiles.append(ee.Geometry.Polygon(tile_bounds))
                        lat += lat_step
                    lon += lon_step
                return tiles
            
            # Create grid tiles for the Amazon region (5-degree tiles for manageable processing)
            grid_tiles = create_grid_tiles(-74.0, -34.0, -18.0, 12.0, 5.0)
            
            # Calculate date range for last 12 months
            end_date = datetime.now()
            start_date = end_date - relativedelta(months=12)
            
            # Cloud masking function for Sentinel-2
            def maskS2SCL(image):
                scl = image.select('SCL')
                cloudFree = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11))
                return image.updateMask(cloudFree).copyProperties(image, ["system:time_start"])

            # Function to calculate NDVI
            def addNDVI(image):
                ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
                return image.addBands(ndvi).copyProperties(image, ["system:time_start"])

            # Function to process a single tile for a given month
            def process_tile_month(tile, month_start, month_end):
                """Process a single grid tile for a specific month"""
                try:
                    # Load Sentinel-2 data for the tile and month
                    s2_tile = (
                        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                        .filterBounds(tile)
                        .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
                        .map(maskS2SCL)
                        .map(addNDVI)
                        .select(['NDVI'])
                    )
                    
                    # Calculate median NDVI for this tile
                    ndvi_tile = s2_tile.median().clip(tile)
                    return ndvi_tile
                    
                except Exception as tile_error:
                    # Return a blank image to maintain consistency
                    return ee.Image.constant(0).rename('NDVI').clip(tile)

            # Function to process a single month with full tile coverage
            def process_month(month_index):
                month_start = start_date + relativedelta(months=month_index)
                month_end = month_start + relativedelta(months=1)
                
                # Process all tiles for this month
                tile_images = []
                for i, tile in enumerate(grid_tiles):
                    try:
                        tile_ndvi = process_tile_month(tile, month_start, month_end)
                        tile_images.append(tile_ndvi)
                    except Exception as e:
                        # Add empty image to maintain tile consistency
                        empty_tile = ee.Image.constant(0).rename('NDVI').clip(tile)
                        tile_images.append(empty_tile)
                
                # Merge all tiles into a single image using mosaic
                if tile_images:
                    # Create an image collection from all tiles and mosaic them
                    tiles_collection = ee.ImageCollection.fromImages(tile_images)
                    merged_ndvi = tiles_collection.mosaic().clip(aoi)
                    
                    # Apply quality mosaic to get best pixel values - mask out zero values
                    merged_ndvi = merged_ndvi.updateMask(merged_ndvi.neq(0))
                else:
                    # Fallback: process entire region as single unit
                    s2_monthly = (
                        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                        .filterBounds(aoi)
                        .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
                        .map(maskS2SCL)
                        .map(addNDVI)
                        .select(['NDVI'])
                    )
                    merged_ndvi = s2_monthly.median().clip(aoi)
                
                # Visualization parameters for NDVI
                vis_params = {
                    'min': 0,
                    'max': 1.0,
                    'palette': ['#ff0000', '#ffff00', '#00ff00']
                }
                
                # Get tile URL for the merged image
                tile_url = merged_ndvi.getMapId(vis_params)['tile_fetcher'].url_format
                
                return {
                    'month': month_start.strftime('%Y-%m'),
                    'month_name': month_start.strftime('%B %Y'),
                    'tile_url': tile_url,
                    'vis_params': vis_params,
                    'data_type': 'NDVI',
                    'tiles_processed': len(tile_images),
                    'grid_coverage': 'complete'
                }
            
            # Process all months concurrently using ThreadPoolExecutor
            try:
                with ThreadPoolExecutor(max_workers=3) as executor:  # Reduced workers for memory management
                    futures = [executor.submit(process_month, i) for i in range(12)]
                    monthly_layers = [future.result() for future in futures]
            except Exception as e:
                monthly_layers = []
                for i in range(12):
                    monthly_layers.append(process_month(i))

            # Legend for NDVI
            legend = {
                'title': 'NDVI Values',
                'min': 0,
                'max': 1.0,
                'colors': ['#ff0000', '#ffff00', '#00ff00'],
                'labels': ['Low Vegetation', 'Moderate Vegetation', 'High Vegetation']
            }

            response = {
                "success": True,
                "region": "Amazon Rainforest",
                "data_type": "NDVI",
                "time_period": f"{start_date.strftime('%Y-%m')} to {end_date.strftime('%Y-%m')}",
                "total_layers": 12,
                "monthly_layers": monthly_layers,
                "legend": legend,
                "aoi_bounds": amazon_bounds,
                "processing_info": {
                    "grid_tiles": len(grid_tiles),
                    "tile_size_degrees": 5.0,
                    "coverage_method": "grid-based_tiling"
                }
            }

            return Response(response, status=200)

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)


class AmazonLSTAPI(APIView):
    init_earth_engine()
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        """
        Get LST (Land Surface Temperature) data for Amazon rainforest for the last 12 months
        Returns 12 monthly LST heat layers using grid-based tiling for complete coverage
        """
        try:
            # Amazon rainforest bounding box coordinates
            amazon_bounds = [
                [[-74.0, -18.0], [-74.0, 12.0], [-34.0, 12.0], [-34.0, -18.0], [-74.0, -18.0]]
            ]
            aoi = ee.Geometry.Polygon(amazon_bounds)
            
            # Create a grid system for the Amazon region to ensure complete coverage
            def create_grid_tiles(min_lon, max_lon, min_lat, max_lat, tile_size=5.0):
                """Create grid tiles for processing large areas efficiently"""
                tiles = []
                lon_step = tile_size
                lat_step = tile_size
                
                lon = min_lon
                while lon < max_lon:
                    lat = min_lat
                    while lat < max_lat:
                        tile_bounds = [
                            [[lon, lat], [lon, lat + lat_step], 
                             [lon + lon_step, lat + lat_step], [lon + lon_step, lat], [lon, lat]]
                        ]
                        tiles.append(ee.Geometry.Polygon(tile_bounds))
                        lat += lat_step
                    lon += lon_step
                return tiles
            
            # Create grid tiles for the Amazon region (5-degree tiles for manageable processing)
            grid_tiles = create_grid_tiles(-74.0, -34.0, -18.0, 12.0, 5.0)
            
            # Calculate date range for last 12 months
            end_date = datetime.now()
            start_date = end_date - relativedelta(months=12)
            
            # Function to process a single tile for a given month
            def process_tile_month(tile, month_start, month_end):
                """Process a single grid tile for a specific month"""
                try:
                    # Load MODIS LST data for the tile and month
                    lst_tile = (
                        ee.ImageCollection("MODIS/061/MOD11A2")
                        .filterBounds(tile)
                        .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                        .select('LST_Day_1km')
                    )
                    
                    # Calculate median LST for this tile and convert to Celsius
                    lst_tile_image = (
                        lst_tile.median()
                        .multiply(0.02)  # Scale factor
                        .subtract(273.15)  # Convert Kelvin to Celsius
                        .clip(tile)
                    )
                    return lst_tile_image
                    
                except Exception as tile_error:
                    # Return a blank image to maintain consistency
                    return ee.Image.constant(0).rename('LST_Day_1km').clip(tile)

            # Function to process a single month with full tile coverage
            def process_month(month_index):
                month_start = start_date + relativedelta(months=month_index)
                month_end = month_start + relativedelta(months=1)
                
                # Process all tiles for this month
                tile_images = []
                for i, tile in enumerate(grid_tiles):
                    try:
                        tile_lst = process_tile_month(tile, month_start, month_end)
                        tile_images.append(tile_lst)
                    except Exception as e:
                        # Add empty image to maintain tile consistency
                        empty_tile = ee.Image.constant(0).rename('LST_Day_1km').clip(tile)
                        tile_images.append(empty_tile)
                
                # Merge all tiles into a single image using mosaic
                if tile_images:
                    # Create an image collection from all tiles and mosaic them
                    tiles_collection = ee.ImageCollection.fromImages(tile_images)
                    merged_lst = tiles_collection.mosaic().clip(aoi)
                    
                    # Apply quality mosaic to get best pixel values - mask out zero values
                    merged_lst = merged_lst.updateMask(merged_lst.neq(0))
                else:
                    # Fallback: process entire region as single unit
                    lst_collection = (
                        ee.ImageCollection("MODIS/061/MOD11A2")
                        .filterBounds(aoi)
                        .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                        .select('LST_Day_1km')
                    )
                    merged_lst = (
                        lst_collection.median()
                        .multiply(0.02)
                        .subtract(273.15)
                        .clip(aoi)
                    )
                
                # Visualization parameters for LST (in Celsius)
                vis_params = {
                    'min': 20,
                    'max': 40,
                    'palette': ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', 
                               '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
                }
                
                # Get tile URL for the merged image
                tile_url = merged_lst.getMapId(vis_params)['tile_fetcher'].url_format
                
                return {
                    'month': month_start.strftime('%Y-%m'),
                    'month_name': month_start.strftime('%B %Y'),
                    'tile_url': tile_url,
                    'vis_params': vis_params,
                    'data_type': 'LST',
                    'unit': 'Celsius',
                    'tiles_processed': len(tile_images),
                    'grid_coverage': 'complete'
                }
            
            # Process all months concurrently using ThreadPoolExecutor
            try:
                with ThreadPoolExecutor(max_workers=3) as executor:  # Reduced workers for memory management
                    futures = [executor.submit(process_month, i) for i in range(12)]
                    monthly_layers = [future.result() for future in futures]
            except Exception as e:
                monthly_layers = []
                for i in range(12):
                    monthly_layers.append(process_month(i))

            # Legend for LST
            legend = {
                'title': 'Land Surface Temperature (°C)',
                'min': 20,
                'max': 40,
                'colors': ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', 
                          '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'],
                'labels': ['Cool (20°C)', 'Moderate (25°C)', 'Warm (30°C)', 'Hot (35°C)', 'Very Hot (40°C)']
            }

            response = {
                "success": True,
                "region": "Amazon Rainforest",
                "data_type": "LST (Land Surface Temperature)",
                "time_period": f"{start_date.strftime('%Y-%m')} to {end_date.strftime('%Y-%m')}",
                "total_layers": 12,
                "monthly_layers": monthly_layers,
                "legend": legend,
                "aoi_bounds": amazon_bounds,
                "processing_info": {
                    "grid_tiles": len(grid_tiles),
                    "tile_size_degrees": 5.0,
                    "coverage_method": "grid-based_tiling"
                }
            }

            return Response(response, status=200)

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)


class CustomNDVIAPI(APIView):
    init_earth_engine()
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """
        Get NDVI statistics for a custom Area of Interest (AOI)
        Requires POST with geometry parameter containing GeoJSON polygon
        """
        try:
            aoi_geojson = request.data.get("geometry")
            
            if not aoi_geojson:
                return Response({"success": False, "error": "Missing geometry parameter"}, status=400)

            if not isinstance(aoi_geojson, dict) or 'geometry' not in aoi_geojson or 'coordinates' not in aoi_geojson['geometry']:
                return Response({"success": False, "error": "Invalid AOI format"}, status=400)

            aoi = ee.Geometry.Polygon(aoi_geojson['geometry']['coordinates'])
            
            end_date = datetime.now()
            start_date = end_date - relativedelta(months=12)
            
            def maskS2SCL(image):
                scl = image.select('SCL')
                cloudFree = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11))
                return image.updateMask(cloudFree).copyProperties(image, ["system:time_start"])

            def addNDVI(image):
                ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
                return image.addBands(ndvi).copyProperties(image, ["system:time_start"])

            def process_month(month_index):
                month_start = start_date + relativedelta(months=month_index)
                month_end = month_start + relativedelta(months=1)
                
                s2_monthly = (
                    ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                    .filterBounds(aoi)
                    .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 100))
                    .map(maskS2SCL)
                    .map(addNDVI)
                    .select(['NDVI'])
                )
                
                image_count = s2_monthly.size().getInfo()
                ndvi_image = s2_monthly.median().clip(aoi)
                
                # Calculate statistics for the AOI
                stats = ndvi_image.reduceRegion(
                    reducer=ee.Reducer.mean().combine(
                        reducer2=ee.Reducer.minMax(),
                        sharedInputs=True
                    ),
                    geometry=aoi,
                    scale=10,  # 10m resolution for Sentinel-2
                    maxPixels=1e9
                ).getInfo()
                
                # Handle None values (no data available)
                mean_val = stats.get('NDVI_mean')
                min_val = stats.get('NDVI_min')
                max_val = stats.get('NDVI_max')
                
                return {
                    'month': month_start.strftime('%Y-%m'),
                    'month_name': month_start.strftime('%B %Y'),
                    'data_type': 'NDVI',
                    'statistics': {
                        'mean': round(mean_val, 4) if mean_val is not None else None,
                        'min': round(min_val, 4) if min_val is not None else None,
                        'max': round(max_val, 4) if max_val is not None else None
                    },
                    'data_available': mean_val is not None
                }
            
            # Process all months concurrently using ThreadPoolExecutor
            try:
                with ThreadPoolExecutor(max_workers=4) as executor:
                    futures = [executor.submit(process_month, i) for i in range(12)]
                    monthly_layers = [future.result() for future in futures]
            except Exception as e:
                monthly_layers = []
                for i in range(12):
                    monthly_layers.append(process_month(i))

            response = {
                "success": True,
                "region": "Custom AOI",
                "data_type": "NDVI",
                "time_period": f"{start_date.strftime('%Y-%m')} to {end_date.strftime('%Y-%m')}",
                "total_months": 12,
                "monthly_statistics": monthly_layers,
                "aoi_bounds": aoi_geojson['geometry']['coordinates']
            }
            
            return Response(response, status=200)

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)


class PointNDVIMonthlyAPI(APIView):
    init_earth_engine()
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """
        Get NDVI data for a specific point location and month
        Requires POST with latitude/longitude or geometry and month parameters
        """
        try:
            # Handle both direct lat/lon and geometry object formats
            latitude = request.data.get("latitude")
            longitude = request.data.get("longitude")
            geometry = request.data.get("geometry")
            month = request.data.get("month")  # Format: YYYY-MM
            
            if latitude is not None and longitude is not None:
                # Direct lat/lon format
                try:
                    lat = float(latitude)
                    lon = float(longitude)
                except (ValueError, TypeError):
                    return Response({"success": False, "error": "Invalid latitude or longitude format"}, status=400)
            elif geometry is not None:
                # Geometry object format
                if isinstance(geometry, dict) and 'geometry' in geometry:
                    geom_data = geometry['geometry']
                    if geom_data.get('type') == 'Point' and 'coordinates' in geom_data:
                        coords = geom_data['coordinates']
                        if len(coords) >= 2:
                            lon, lat = coords[0], coords[1]
                        else:
                            return Response({"success": False, "error": "Invalid coordinates format"}, status=400)
                    else:
                        return Response({"success": False, "error": "Invalid geometry format - expected Point"}, status=400)
                else:
                    return Response({"success": False, "error": "Invalid geometry object format"}, status=400)
            else:
                return Response({"success": False, "error": "Missing latitude/longitude or geometry parameter"}, status=400)
            
            if not month:
                return Response({"success": False, "error": "Missing month parameter"}, status=400)
            
            try:
                month_date = datetime.strptime(month, '%Y-%m')
            except (ValueError, TypeError):
                return Response({"success": False, "error": "Invalid month format (use YYYY-MM)"}, status=400)

            point = ee.Geometry.Point([lon, lat])
            
            month_start = month_date
            month_end = month_start + relativedelta(months=1)
            
            def maskS2SCL(image):
                scl = image.select('SCL')
                cloudFree = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11))
                return image.updateMask(cloudFree).copyProperties(image, ["system:time_start"])

            def addNDVI(image):
                ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
                return image.addBands(ndvi).copyProperties(image, ["system:time_start"])
            
            s2_monthly = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(point)
                .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 50))
                .map(maskS2SCL)
                .map(addNDVI)
                .select(['NDVI'])
            )
            
            image_count = s2_monthly.size().getInfo()
            ndvi_image = s2_monthly.median()
            
            # Sample point value with null checking
            try:
                sampled = ndvi_image.sample(point, 10)
                sample_size = sampled.size().getInfo()
                if sample_size > 0:
                    first_sample = sampled.first()
                    ndvi_value = first_sample.get('NDVI').getInfo()
                else:
                    ndvi_value = None
            except Exception as sample_error:
                ndvi_value = None
            
            # Get all individual values for more detailed analysis
            ndvi_values = []
            try:
                all_values = s2_monthly.getRegion(point, 10).getInfo()
                if len(all_values) > 1:  # First row is headers
                    for row in all_values[1:]:
                        if row[4] is not None:  # NDVI value is at index 4
                            ndvi_values.append(round(row[4], 4))
            except Exception as region_error:
                ndvi_values = []

            response = {
                "success": True,
                "location": {"latitude": lat, "longitude": lon},
                "month": month,
                "month_name": month_start.strftime('%B %Y'),
                "data_type": "NDVI",
                "median_ndvi": round(ndvi_value, 4) if ndvi_value is not None else None,
                "all_ndvi_values": ndvi_values,
                "image_count": image_count,
                "data_available": ndvi_value is not None
            }
            
            return Response(response, status=200)

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)


class CustomLSTAPI(APIView):
    init_earth_engine()
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """
        Get LST statistics for a custom Area of Interest (AOI)
        Requires POST with geometry parameter containing GeoJSON polygon
        """
        try:
            aoi_geojson = request.data.get("geometry")
            
            if not aoi_geojson:
                return Response({"success": False, "error": "Missing geometry parameter"}, status=400)

            if not isinstance(aoi_geojson, dict) or 'geometry' not in aoi_geojson or 'coordinates' not in aoi_geojson['geometry']:
                return Response({"success": False, "error": "Invalid AOI format"}, status=400)

            aoi = ee.Geometry.Polygon(aoi_geojson['geometry']['coordinates'])
            
            end_date = datetime.now()
            start_date = end_date - relativedelta(months=12)
            
            def process_month(month_index):
                month_start = start_date + relativedelta(months=month_index)
                month_end = month_start + relativedelta(months=1)
                
                lst_collection = (
                    ee.ImageCollection("MODIS/061/MOD11A2")
                    .filterBounds(aoi)
                    .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                    .select('LST_Day_1km')
                )
                
                lst_image = (
                    lst_collection.median()
                    .multiply(0.02)
                    .subtract(273.15)
                    .clip(aoi)
                )
                
                # Calculate statistics for the AOI
                stats = lst_image.reduceRegion(
                    reducer=ee.Reducer.mean().combine(
                        reducer2=ee.Reducer.minMax(),
                        sharedInputs=True
                    ),
                    geometry=aoi,
                    scale=1000,  # 1km resolution for MODIS
                    maxPixels=1e9
                ).getInfo()
                
                # Handle None values (no data available)
                mean_val = stats.get('LST_Day_1km_mean')
                min_val = stats.get('LST_Day_1km_min')
                max_val = stats.get('LST_Day_1km_max')
                
                return {
                    'month': month_start.strftime('%Y-%m'),
                    'month_name': month_start.strftime('%B %Y'),
                    'data_type': 'LST',
                    'unit': 'Celsius',
                    'statistics': {
                        'mean': round(mean_val, 2) if mean_val is not None else None,
                        'min': round(min_val, 2) if min_val is not None else None,
                        'max': round(max_val, 2) if max_val is not None else None
                    },
                    'data_available': mean_val is not None
                }
            
            # Process all months concurrently using ThreadPoolExecutor
            try:
                with ThreadPoolExecutor(max_workers=4) as executor:
                    futures = [executor.submit(process_month, i) for i in range(12)]
                    monthly_layers = [future.result() for future in futures]
            except Exception as e:
                monthly_layers = []
                for i in range(12):
                    monthly_layers.append(process_month(i))

            response = {
                "success": True,
                "region": "Custom AOI",
                "data_type": "LST (Land Surface Temperature)",
                "time_period": f"{start_date.strftime('%Y-%m')} to {end_date.strftime('%Y-%m')}",
                "total_months": 12,
                "monthly_statistics": monthly_layers,
                "aoi_bounds": aoi_geojson['geometry']['coordinates']
            }

            return Response(response, status=200)

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)


class PointLSTMonthlyAPI(APIView):
    init_earth_engine()
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """
        Get LST data for a specific point location and month
        Requires POST with latitude/longitude or geometry and month parameters
        """
        try:
            # Handle both direct lat/lon and geometry object formats
            latitude = request.data.get("latitude")
            longitude = request.data.get("longitude")
            geometry = request.data.get("geometry")
            month = request.data.get("month")  # Format: YYYY-MM
            
            if latitude is not None and longitude is not None:
                # Direct lat/lon format
                try:
                    lat = float(latitude)
                    lon = float(longitude)
                except (ValueError, TypeError):
                    return Response({"success": False, "error": "Invalid latitude or longitude format"}, status=400)
            elif geometry is not None:
                # Geometry object format
                if isinstance(geometry, dict) and 'geometry' in geometry:
                    geom_data = geometry['geometry']
                    if geom_data.get('type') == 'Point' and 'coordinates' in geom_data:
                        coords = geom_data['coordinates']
                        if len(coords) >= 2:
                            lon, lat = coords[0], coords[1]
                        else:
                            return Response({"success": False, "error": "Invalid coordinates format"}, status=400)
                    else:
                        return Response({"success": False, "error": "Invalid geometry format - expected Point"}, status=400)
                else:
                    return Response({"success": False, "error": "Invalid geometry object format"}, status=400)
            else:
                return Response({"success": False, "error": "Missing latitude/longitude or geometry parameter"}, status=400)
            
            if not month:
                return Response({"success": False, "error": "Missing month parameter"}, status=400)
            
            try:
                month_date = datetime.strptime(month, '%Y-%m')
            except (ValueError, TypeError):
                return Response({"success": False, "error": "Invalid month format (use YYYY-MM)"}, status=400)

            point = ee.Geometry.Point([lon, lat])
            
            month_start = month_date
            month_end = month_start + relativedelta(months=1)
            
            lst_collection = (
                ee.ImageCollection("MODIS/061/MOD11A2")
                .filterBounds(point)
                .filterDate(month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))
                .select('LST_Day_1km')
            )
            
            lst_image = (
                lst_collection.median()
                .multiply(0.02)
                .subtract(273.15)
            )
            
            # Sample point value with null checking
            try:
                sampled = lst_image.sample(point, 1000)
                sample_size = sampled.size().getInfo()
                if sample_size > 0:
                    first_sample = sampled.first()
                    lst_value = first_sample.get('LST_Day_1km').getInfo()
                else:
                    lst_value = None
            except Exception as sample_error:
                lst_value = None
            
            # Get all individual values
            lst_values = []
            try:
                all_values = lst_collection.getRegion(point, 1000).getInfo()
                if len(all_values) > 1:
                    for row in all_values[1:]:
                        if row[4] is not None:
                            # Convert from Kelvin to Celsius
                            celsius_val = (row[4] * 0.02) - 273.15
                            lst_values.append(round(celsius_val, 2))
            except Exception as region_error:
                lst_values = []

            response = {
                "success": True,
                "location": {"latitude": lat, "longitude": lon},
                "month": month,
                "month_name": month_start.strftime('%B %Y'),
                "data_type": "LST (Land Surface Temperature)",
                "unit": "Celsius",
                "median_lst": round(lst_value, 2) if lst_value is not None else None,
                "all_lst_values": lst_values,
                "data_available": lst_value is not None
            }
            
            return Response(response, status=200)

        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)