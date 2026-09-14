# Indoor Tracking System

Live Indoor Positioning System with Real-Time PDR Tracking and Vercel Web Analytics

## Features

- 🗺️ Real-time indoor positioning with PDR (Pedestrian Dead Reckoning)
- 📡 Live peer-to-peer tracking via Supabase Realtime
- 🧭 Smartphone sensor integration (accelerometer, gyroscope, compass)
- 📊 Vercel Web Analytics for visitor tracking
- 🎨 Modern dark mode UI with zero external CSS

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Vercel Analytics

This project is configured with Vercel Web Analytics. The Analytics component is integrated into the main app component (`src/App.jsx`).

To enable analytics:
1. Deploy the project to Vercel
2. Navigate to your project's Analytics section in the Vercel dashboard
3. Click the Enable button
4. Analytics will automatically start tracking page views and visitor data

## Project Structure

```
.
├── src/
│   ├── App.jsx           # Main application component with Analytics
│   └── main.jsx          # React entry point
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── package.json          # Project dependencies
└── README.md            # This file
```

## Technologies

- React 18
- Vite 5
- Supabase (Real-time & Database)
- Vercel Analytics
- Modern JavaScript (ES2021+)

## License

MIT
