/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "duckdb"],
  webpack: (config) => {
    // Add @db/* alias pointing to ./db/* (project root, not src/)
    config.resolve.alias["@db"] = path.join(__dirname, "db");
    return config;
  },
};

module.exports = nextConfig;
