// Import required modules
const express = require("express");
const cors = require("cors");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const PropertiesReader = require("properties-reader");

// Load database connection properties from dbconnection.properties
const properties = PropertiesReader("dbconnection.properties");

// Extract DB connection details
const dbPrefix = properties.get("db.prefix");
const dbUser = properties.get("db.user");
const dbPassword = properties.get("db.password");
const dbHost = properties.get("db.host");
const dbName = properties.get("db.name");
const dbParams = properties.get("db.params");

// Construct MongoDB connection URI
const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}${dbParams}`;
const client = new MongoClient(uri);

// Initialize Express app
const app = express();
app.use(cors());              // Enable CORS for cross-origin requests
app.use(express.json());      // Parse JSON request bodies

/* ---------------------------
   Logger Middleware
   Logs every incoming request with timestamp, method, and URL
   --------------------------- */
app.use((req, res, next) => {
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.url}`;
  console.log(logEntry);
  next();
});

/* ---------------------------
   Static Image Middleware
   Serves static images from /images folder
   Example: http://localhost:3000/images/math.jpeg
   --------------------------- */
app.use("/images", express.static(path.join(__dirname, "images")));

/* ---------------------------
   GET /lessons
   Fetch all lessons from Products collection
   --------------------------- */
app.get("/lessons", async (req, res) => {
  try {
    const collection = client.db(dbName).collection("Products");
    const lessons = await collection.find({}).toArray();
    res.json(lessons);
  } catch (err) {
    console.error("Error fetching lessons:", err);
    res.status(500).send("Error fetching lessons");
  }
});

/* ---------------------------
   POST /orders
   Save a new order to Orders collection
   - Validates request body
   - Inserts order (name, phone, address, items)
   - Updates lesson spaces in Products collection
   --------------------------- */
app.post("/orders", async (req, res) => {
  try {
    const { name, phone, address, items } = req.body;

    // Validate order format
    if (!name || !phone || !Array.isArray(items)) {
      return res.status(400).send("Invalid order format");
    }

    // Insert order into Orders collection
    const ordersCollection = client.db(dbName).collection("Orders");
    await ordersCollection.insertOne({ name, phone, address, items });
    
    // Decrement spaces for each lesson ordered
    const lessonsCollection = client.db(dbName).collection("Products");
    for (const item of items) {
      await lessonsCollection.updateOne(
        { _id: new ObjectId(item.lessonId) },
        { $inc: { spaces: -item.qty } }
      );
    }

    res.status(201).send("Order saved");
  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).send("Error saving order");
  }
});

/* ---------------------------
   PUT /lessons/:id
   Update lesson details by ID
   --------------------------- */
app.put("/lessons/:id", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const updates = req.body;

    // Validate ObjectId format
    if (!ObjectId.isValid(lessonId)) {
      return res.status(400).send("Invalid lesson ID");
    }

    // Update lesson in Products collection
    const collection = client.db(dbName).collection("Products");
    const result = await collection.updateOne(
      { _id: new ObjectId(lessonId) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send("Lesson not found");
    }

    res.send("Lesson updated");
  } catch (err) {
    console.error("Error updating lesson:", err);
    res.status(500).send("Update failed");
  }
});

/* ---------------------------
   GET /search
   Search lessons by subject, location, price, or spaces
   --------------------------- */
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase() || "";
    const collection = client.db(dbName).collection("Products");

    // Search across multiple fields using regex
    const results = await collection.find({
      $or: [
        { subject: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
        { $expr: { $regexMatch: { input: { $toString: "$price" }, regex: query, options: "i" } } },
        { $expr: { $regexMatch: { input: { $toString: "$spaces" }, regex: query, options: "i" } } }
      ]
    }).toArray();

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Search failed");
  }
});

// Define server port
const PORT = 3000;

/* ---------------------------
   Start Server
   Connect to MongoDB Atlas and start Express server
   --------------------------- */
async function start() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
    app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
  } catch (err) {
    console.error("Connection error:", err);
  }
}

start();
