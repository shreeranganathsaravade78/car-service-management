
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Please define MONGODB_URI in .env.local");
}

const options = {};

const mongoGlobal = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // Reuse the existing connection during development
  clientPromise =
    mongoGlobal._mongoClientPromise ??
    new MongoClient(uri, options).connect();

  mongoGlobal._mongoClientPromise = clientPromise;
} else {
  // Create a new connection in production
  clientPromise = new MongoClient(uri, options).connect();
}

export default clientPromise;
