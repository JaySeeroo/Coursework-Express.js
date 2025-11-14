const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const PropertiesReader = require("properties-reader");

const properties = PropertiesReader("dbconnection.properties");

const dbPrefix = properties.get("db.prefix");
const dbUser = properties.get("db.user");
const dbPassword = properties.get("db.password");
const dbHost = properties.get("db.host");
const dbName = properties.get("db.name");
const dbParams = properties.get("db.params");

const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}${dbParams}`;
const client = new MongoClient(uri);

const app = express();
app.use(cors());
app.use(express.json());

// GET all lessons
app.get("/api/lessons", async (req, res) => {
  try {
    const collection = client.db(dbName).collection("Products");
    const lessons = await collection.find({}).toArray();
    res.json(lessons);
  } catch (err) {
    res.status(500).send("Error fetching lessons");
  }
});

// POST order
app.post("/api/orders", async (req, res) => {
  try {
    const order = req.body;
    const collection = client.db(dbName).collection("Orders");
    await collection.insertOne(order);
    res.status(201).send("Order saved");
  } catch (err) {
    res.status(500).send("Error saving order");
  }
});

// GET search
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase() || "";
    const collection = client.db(dbName).collection("Products");

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

const PORT = 3000;

async function start() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Connection error:", err);
  }
}

start();
