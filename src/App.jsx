import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Analytics } from '@vercel/analytics/react';

// Your Provided Supabase Credentials
const SUPABASE_URL = "https://gnhkgjqiqeoraygzjikd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaGtnanFpcWVvcmF5Z3pqaWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTIxMzIsImV4cCI6MjEwNDk2ODEzMn0.AvHjI6gAQA-LnPJY99BtbDnB2ryKj7NXwkXIj7AI0Uk";

// Initialize Live Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Clean, Modern Dark Mode Styling (Zero External CSS Required)
const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: "#090d16",
    color: "#f8fafc",
    minHeight: "100vh",
    padding: "16px",
    boxSizing: "border-box",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: "16px",
    border: "1px solid #1f2937",
    padding: "20px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
    marginBottom: "20px",
  },
  btnPrimary: {
    backgroundColor: "#0d9488",
    color: "#ffffff",
    border: "none",
    padding: "14px 24px",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "15px",
    width: "100%",
  },
  btnNav: {
    backgroundColor: "#1f2937",
    color: "#f8fafc",
    border: "1px solid #374151",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
  },
  statBox: {
    backgroundColor: "#1f2937",
    padding: "16px",
    borderRadius: "12px",
    border: "1px solid #374151",
  },
  badge: {
    backgroundColor: "#064e3b",
    color: "#34d399",
    padding: "4px 12px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  }
};

// Building Layout Segments (Corridors & Rooms)
const BUILDING_LAYOUT = {
  corridors: [
    { id: "c1", p1: [100, 150], p2: [550, 150] },
    { id: "c2", p1: [550, 150], p2: [550, 400] },
    { id: "c3", p1: [100, 150], p2: [100, 400] },
  ],
  rooms: [
    { name: "Room 101", bounds: { x: 40, y: 300, w: 120, h: 120 }, center: [100, 360] },
    { name: "Room 102", bounds: { x: 250, y: 30, w: 140, h: 90 }, center: [320, 75] },
    { name: "Room 103 (Lab)", bounds: { x: 490, y: 300, w: 120, h: 120 }, center: [550, 360] },
    { name: "Main Hallway", bounds: { x: 150, y: 120, w: 400, h: 60 }, center: [350, 150] },
  ]
};

// Map Matching Vector Projection Snapping Algorithm
const mapMatchPoint = (point) => {
  let minDistance = Infinity;
  let snapped = point;

  BUILDING_LAYOUT.corridors.forEach((seg) => {
    const l2 = (seg.p2[0] - seg.p1[0]) ** 2 + (seg.p2[1] - seg.p1[1]) ** 2;
    let t = ((point[0] - seg.p1[0]) * (seg.p2[0] - seg.p1[0]) + (point[1] - seg.p1[1]) * (seg.p2[1] - seg.p1[1])) / l2;
    t = Math.max(0, Math.min(1, t));

    const projX = seg.p1[0] + t * (seg.p2[0] - seg.p1[0]);
    const projY = seg.p1[1] + t * (seg.p2[1] - seg.p1[1]);
    const dist = Math.hypot(point[0] - projX, point[1] - projY);

    if (dist < minDistance) {
      minDistance = dist;
      snapped = [projX, projY];
    }
  });

  // Identify Current Active Room
  let currentRoom = "Corridor Area";
  BUILDING_LAYOUT.rooms.forEach((room) => {
    const { x, y, w, h } = room.bounds;
    if (snapped[0] >= x && snapped[0] <= x + w && snapped[1] >= y && snapped[1] <= y + h) {
      currentRoom = room.name;
    }
  });

  return { snapped, currentRoom };
};

export default function IndoorTrackingSystem() {
  const [deviceRole, setDeviceRole] = useState(null); // 'broadcaster' | 'receiver'
  const [userId] = useState(`USER-${Math.floor(1000 + Math.random() * 9000)}`);
  
  // Real-time State
  const [position, setPosition] = useState([100, 150]);
  const [heading, setHeading] = useState(0);
  const [activeZone, setActiveZone] = useState("Room 101 Entrance");
  const [stepCount, setStepCount] = useState(0);
  const [peerDevices, setPeerDevices] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  const accelRef = useRef({ lastZ: 9.81, threshold: 2.5 });
  const channelRef = useRef(null);

  // Initialize Real-Time WebSockets via Supabase Broadcast
  useEffect(() => {
    const channel = supabase.channel("indoor_tracking_room", {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "location_update" }, (payload) => {
        if (payload.payload && payload.payload.userId !== userId) {
          setPeerDevices((prev) => ({
            ...prev,
            [payload.payload.userId]: payload.payload,
          }));
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Transmit Telemetry over Supabase Realtime Channel
  const transmitLocation = (newPos, currentHeading) => {
    const { snapped, currentRoom } = mapMatchPoint(newPos);
    
    setPosition(snapped);
    setActiveZone(currentRoom);

    const payload = {
      userId,
      position: snapped,
      heading: currentHeading,
      room: currentRoom,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (channelRef.current && isConnected) {
      channelRef.current.send({
        type: "broadcast",
        event: "location_update",
        payload,
      });
    }
  };

  // Smartphone Hardware Sensor Initialization
  const startHardwareSensors = async () => {
    setDeviceRole("broadcaster");

    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        await DeviceMotionEvent.requestPermission();
      } catch (e) {
        console.log("Motion permissions warning:", e);
      }
    }

    // Accelerometer Step Detection Peak Listener
    window.addEventListener("devicemotion", (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      const currentZ = acc.z || 9.81;
      const delta = Math.abs(currentZ - accelRef.current.lastZ);
      accelRef.current.lastZ = currentZ;

      if (delta > accelRef.current.threshold) {
        setStepCount((prev) => {
          const nextStep = prev + 1;
          const strideLength = 15;
          const rad = (heading * Math.PI) / 180;
          const dx = Math.cos(rad) * strideLength;
          const dy = Math.sin(rad) * strideLength;

          setPosition((prevPos) => {
            const rawNext = [prevPos[0] + dx, prevPos[1] + dy];
            transmitLocation(rawNext, heading);
            return rawNext;
          });

          return nextStep;
        });
      }
    });

    // Gyroscope / Compass Listener
    window.addEventListener("deviceorientation", (e) => {
      if (e.alpha !== null) {
        const compassHeading = Math.round(e.alpha);
        setHeading(compassHeading);
      }
    });
  };

  // Cross-Platform Manual Walking Controls
  const handleManualWalk = (dir) => {
    const stepSize = 16;
    let dx = 0, dy = 0;
    let newHeading = heading;

    if (dir === "UP") { dy = -stepSize; newHeading = 270; }
    if (dir === "DOWN") { dy = stepSize; newHeading = 90; }
    if (dir === "LEFT") { dx = -stepSize; newHeading = 180; }
    if (dir === "RIGHT") { dx = stepSize; newHeading = 0; }

    setHeading(newHeading);
    setStepCount((s) => s + 1);
    const newPos = [position[0] + dx, position[1] + dy];
    transmitLocation(newPos, newHeading);
  };

  return (
    <div style={styles.container}>
      {/* Top Navigation Header */}
      <div style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Live Indoor Positioning System</h1>
          <p style={{ margin: "4px 0 0 0", color: "#9ca3af", fontSize: "13px" }}>
            Real-Time PDR Tracking + Vector Map Snapping
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={styles.badge}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: isConnected ? "#34d399" : "#f87171", display: "inline-block" }}></span>
            {isConnected ? "Supabase Live Connected" : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Mode Selection Overlay */}
      {!deviceRole && (
        <div style={styles.card}>
          <h2 style={{ fontSize: "18px", marginTop: 0 }}>Select Device Mode for This Screen</h2>
          <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "20px" }}>
            Is phone/screen ko location sender (Broadcaster) banana chahte hain ya live tracking screen (Observer)?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <button onClick={startHardwareSensors} style={styles.btnPrimary}>
              📱 Track My Device (Broadcaster)
            </button>
            <button onClick={() => setDeviceRole("receiver")} style={{ ...styles.btnPrimary, backgroundColor: "#3b82f6" }}>
              🖥️ Monitor Other Devices (Observer)
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE TRACKING & MAP INTERFACE */}
      {deviceRole && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
          <div style={styles.card}>
            <h2 style={{ fontSize: "16px", marginTop: 0, marginBottom: "8px", fontWeight: "700" }}>📍 Building Floor Plan</h2>
            <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "12px" }}>
              Live location visualization with PDR-based motion tracking
            </p>

            {/* SVG Floor Plan */}
            <div style={{ backgroundColor: "#0f172a", padding: "16px", borderRadius: "10px", overflow: "auto" }}>
              <svg width="600" height="450" style={{ backgroundColor: "#1e293b", borderRadius: "8px" }}>
                {/* Corridors */}
                {BUILDING_LAYOUT.corridors.map((corridor) => (
                  <line
                    key={corridor.id}
                    x1={corridor.p1[0]}
                    y1={corridor.p1[1]}
                    x2={corridor.p2[0]}
                    y2={corridor.p2[1]}
                    stroke="#475569"
                    strokeWidth="50"
                    strokeLinecap="round"
                  />
                ))}

                {/* Room Rectangles */}
                {BUILDING_LAYOUT.rooms.map((room) => (
                  <g key={room.name}>
                    <rect
                      x={room.bounds.x}
                      y={room.bounds.y}
                      width={room.bounds.w}
                      height={room.bounds.h}
                      fill="#1e40af"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      opacity="0.6"
                    />
                    <text x={room.center[0]} y={room.center[1]} textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="600">
                      {room.name}
                    </text>
                  </g>
                ))}

                {/* Other Devices (Peer Tracking) */}
                {Object.values(peerDevices).map((peer) => (
                  <g key={peer.userId}>
                    <circle cx={peer.position[0]} cy={peer.position[1]} r="20" fill="#3b82f6" opacity="0.5" />
                    <text x={peer.position[0]} y={peer.position[1] - 14} textAnchor="middle" fill="#60a5fa" fontSize="10" fontWeight="bold">
                      {peer.userId}
                    </text>
                  </g>
                ))}

                {/* Your Current Position Marker */}
                <g>
                  <circle cx={position[0]} cy={position[1]} r="16" fill="#0d9488" />
                  <circle cx={position[0]} cy={position[1]} r="24" fill="#0d9488" opacity="0.3" />
                  <text x={position[0]} y={position[1] - 18} textAnchor="middle" fill="#2dd4bf" fontSize="12" fontWeight="bold">
                    YOU ({activeZone})
                  </text>
                </g>
              </svg>
            </div>

            {/* Direction Navigation Walk Panel */}
            <div style={{ marginTop: "16px" }}>
              <span style={{ fontSize: "12px", color: "#9ca3af", display: "block", marginBottom: "8px" }}>
                Walk Controls (Use on Mobile or Laptop to test room-to-room movement):
              </span>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => handleManualWalk("LEFT")} style={styles.btnNav}>⬅️ West</button>
                <button onClick={() => handleManualWalk("UP")} style={styles.btnNav}>⬆️ North</button>
                <button onClick={() => handleManualWalk("DOWN")} style={styles.btnNav}>⬇️ South</button>
                <button onClick={() => handleManualWalk("RIGHT")} style={styles.btnNav}>➡️ East</button>
              </div>
            </div>
          </div>

          {/* Telemetry Status Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div style={styles.statBox}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>YOUR CURRENT ROOM</span>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#2dd4bf", marginTop: "4px" }}>
                {activeZone}
              </div>
            </div>

            <div style={styles.statBox}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>CONNECTED PEERS</span>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#60a5fa", marginTop: "4px" }}>
                {Object.keys(peerDevices).length} Active Devices
              </div>
            </div>

            <div style={styles.statBox}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>STEPS & COMPASS</span>
              <div style={{ fontSize: "15px", fontWeight: "700", marginTop: "4px" }}>
                {stepCount} Steps | {heading}°
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Vercel Web Analytics Component */}
      <Analytics />
    </div>
  );
}
