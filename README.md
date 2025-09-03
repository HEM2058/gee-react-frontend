# Earth Engine Dashboard

A geospatial web application that combines React frontend with OpenLayers mapping capabilities, Django backend, and Google Earth Engine integration for advanced earth observation data visualization and analysis.

## Tech Stack

### Frontend
- **React** - Modern JavaScript library for building user interfaces
- **OpenLayers** - High-performance mapping library for rendering geospatial data
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Recharts** - Chart library for data visualization
- **Lucide React** - Icon library

### Backend
- **Django** - Python web framework for robust API development
- **Django REST Framework** - For building RESTful APIs
- **Google Earth Engine** - Cloud platform for planetary-scale geospatial analysis

### Additional Libraries
- **html2canvas** - Screenshot functionality for map exports
- **jsPDF** - PDF generation for reports
- **Papa Parse** - CSV parsing for data import/export

## Project Structure

```
Assignment/
├── gee-react-frontend/          # React frontend application
│   ├── .claude/                 # Claude configuration files
│   ├── node_modules/            # Node.js dependencies
│   ├── src/                     # Source code directory
│   ├── .gitignore              # Git ignore rules
│   ├── dashboard.jsx           # Main dashboard component
│   ├── index.html              # HTML entry point
│   ├── package-lock.json       # Locked dependency versions
│   ├── package.json            # Frontend dependencies and scripts
│   └── postcss.config.js       # PostCSS configuration
├── backend/                    # Django backend application
│   ├── SATELLITE_APIS_README.md # Backend API documentation
│   └── satellite_apis.py      # Satellite API implementations
```