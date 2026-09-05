import express from 'express';
import { MongoClient } from 'mongodb';
import mqtt from 'mqtt';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import dns from 'dns';

// Force Node to prefer IPv4 over IPv6 to fix HiveMQ ECONNREFUSED on Windows
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
const DB_NAME = 'solar_dashboard';
const COLLECTION_NAME = 'telemetry';

app.use(cors());
app.use(express.json());

let db;
let telemetryCollection;
let mqttClient;

// -- 1. Setup MongoDB --
async function initDB() {
    try {
        console.log(`[DB] Connecting to MongoDB at ${MONGO_URI}...`);
        const client = await MongoClient.connect(MONGO_URI);
        db = client.db(DB_NAME);
        
        // Check if collection exists
        const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray();
        if (collections.length === 0) {
            console.log(`[DB] Creating Time Series Collection: ${COLLECTION_NAME}`);
            await db.createCollection(COLLECTION_NAME, {
                timeseries: {
                    timeField: 'timestamp',
                    metaField: 'metadata',
                    granularity: 'seconds'
                }
            });
        } else {
            console.log(`[DB] Collection ${COLLECTION_NAME} already exists.`);
        }
        
        telemetryCollection = db.collection(COLLECTION_NAME);
        console.log('[DB] MongoDB initialized successfully.');
    } catch (err) {
        console.error('[DB] MongoDB Connection Error:', err);
        process.exit(1);
    }
}

let lastMqttTime = 0;
let currentOverrideAngle = 90;

async function initMQTT() {
    console.log(`[MQTT] Resolving IPv4 for broker.hivemq.com...`);
    try {
        const addresses = await dns.promises.resolve4('broker.hivemq.com');
        const ipv4 = addresses[0];
        const brokerUrl = `mqtt://${ipv4}:1883`;
        console.log(`[MQTT] Connecting to broker at ${brokerUrl} ...`);
        
        // Connect directly to the IPv4 address to bypass Windows IPv6 routing issues
        mqttClient = mqtt.connect(brokerUrl, { reconnectPeriod: 2000 });

        mqttClient.on('connect', () => {
            console.log('[MQTT] Connected to broker.');
            mqttClient.subscribe('SOLAR_V1', (err) => {
                if (!err) {
                    console.log('[MQTT] Subscribed to SOLAR_V1');
                } else {
                    console.error('[MQTT] Subscription error:', err);
                }
            });
        });

    mqttClient.on('message', async (topic, message) => {
        if (topic === 'SOLAR_V1') {
            try {
                lastMqttTime = Date.now();
                let rawStr = message.toString();
                // Repair malformed payload syntax (e.g. :nan, :inf, "lat":, or "lon":})
                rawStr = rawStr
                    .replace(/:\s*nan/gi, ':0')
                    .replace(/:\s*infinity/gi, ':0')
                    .replace(/:\s*-?inf/gi, ':0')
                    .replace(/:\s*,/g, ':"0",')
                    .replace(/:\s*}/g, ':"0"}');
                const payload = JSON.parse(rawStr);
                
                let in_v = isNaN(Number(payload.in_v)) ? 0 : Number(payload.in_v);
                let in_a = isNaN(Number(payload.in_a)) ? 0 : Number(payload.in_a);
                let out_v = isNaN(Number(payload.out_v)) ? 0 : Number(payload.out_v);
                let out_a = isNaN(Number(payload.out_a)) ? 0 : Number(payload.out_a);

                // Construct Time Series Document
                const doc = {
                    timestamp: new Date(),
                    metadata: {
                        device_id: 'solar_tracker_01',
                        coordinates: { 
                            lat: String(payload.lat || "6.854"), 
                            lon: String(payload.lon || "80.090") 
                        }
                    },
                    measurements: {
                        in_v,
                        in_a,
                        out_v,
                        out_a,
                        angle: isNaN(Number(payload.angle)) ? currentOverrideAngle : Number(payload.angle),
                        rain: String(payload.rain || "NO").toUpperCase()
                    }
                };
                
                // Insert into DB
                if (telemetryCollection) {
                    await telemetryCollection.insertOne(doc);
                }

                // Broadcast via WebSocket
                broadcastWS(doc);
                
            } catch (err) {
                console.error('[MQTT] Error processing message:', err.message);
            }
        }
    });

    mqttClient.on('error', (err) => {
        console.error('[MQTT] Connection error:', err);
    });
    
    } catch (err) {
        console.error(`[MQTT] DNS resolution failed:`, err);
    }
}

// -- 3. Setup WebSocket --
function broadcastWS(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('[WS] New client connected.');
    ws.on('close', () => console.log('[WS] Client disconnected.'));
});

// -- 4. Express API Routes --
app.get('/api/telemetry', async (req, res) => {
    try {
        if (!telemetryCollection) {
            return res.status(503).json({ error: 'Database not initialized' });
        }
        const data = await telemetryCollection
            .find({})
            .sort({ timestamp: -1 })
            .limit(100)
            .toArray();
            
        // Explicitly sort ascending by timestamp for accurate time-series chart rendering
        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        res.json(data);
    } catch (err) {
        console.error('[API] Error fetching telemetry:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/telemetry/daily', async (req, res) => {
    try {
        if (!telemetryCollection) {
            return res.status(503).json({ error: 'Database not initialized' });
        }
        
        // Aggregate energy yield per day
        const pipeline = [
            {
                $sort: { timestamp: 1 } // Ensure chronological order for integration
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$timestamp" },
                        month: { $month: "$timestamp" },
                        day: { $dayOfMonth: "$timestamp" }
                    },
                    readings: {
                        $push: {
                            timestamp: "$timestamp",
                            power: { $multiply: ["$measurements.in_v", "$measurements.in_a"] }
                        }
                    }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
        ];

        const dailyData = await telemetryCollection.aggregate(pipeline).toArray();
        
        // Calculate Wh using simple Riemann sum / trapezoidal rule approximation
        const result = dailyData.map(day => {
            let totalJoules = 0;
            const readings = day.readings;
            for (let i = 1; i < readings.length; i++) {
                const dt_seconds = (new Date(readings[i].timestamp).getTime() - new Date(readings[i-1].timestamp).getTime()) / 1000;
                // Avoid huge gaps acting as continuous power (cap dt to 5 minutes)
                if (dt_seconds > 0 && dt_seconds <= 300) {
                    const avgPower = (readings[i].power + readings[i-1].power) / 2;
                    totalJoules += avgPower * dt_seconds;
                }
            }
            const dateStr = `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`;
            return {
                date: dateStr,
                wh: totalJoules / 3600 // 1 Wh = 3600 Joules
            };
        });

        res.json(result);
    } catch (err) {
        console.error('[API] Error fetching daily telemetry:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/control', (req, res) => {
    try {
        const { angle, command } = req.body;
        if (!mqttClient) {
            return res.status(500).json({ error: 'MQTT not connected' });
        }

        if (command) {
            console.log(`[API] Received command: ${command}`);
            mqttClient.publish('SOLAR_CONTROL', String(command).toUpperCase());
            return res.json({ success: true, message: `Command sent: ${command}` });
        } else if (angle !== undefined) {
            currentOverrideAngle = Number(angle);
            console.log(`[API] Received control command. Setting angle to ${angle}`);
            mqttClient.publish('SOLAR_CONTROL', String(angle));
            return res.json({ success: true, message: `Angle override sent: ${angle}` });
        } else {
            res.status(400).json({ error: 'Invalid payload' });
        }
    } catch (err) {
        console.error('[API] Error sending control command:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// -- 5. Graceful Shutdown --
function shutdown() {
    console.log('\n[SYS] Shutting down gracefully...');
    if (mqttClient) mqttClient.end();
    wss.clients.forEach((client) => client.terminate());
    wss.close();
    server.close(() => {
        console.log('[SYS] HTTP server closed.');
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// -- 6. Start Application --
async function start() {
    await initDB();
    initMQTT();
    
    server.listen(PORT, () => {
        console.log(`[SYS] Server running on http://localhost:${PORT}`);
    });
}

start();
