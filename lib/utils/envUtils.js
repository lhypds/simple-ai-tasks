const path = require('path');
const fs = require('fs');

function loadDotenv() {
  try {
    // prefer .env in the current working directory
    let dotenvPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(dotenvPath)) {
      // fallback to project root (one level up from this file)
      dotenvPath = path.resolve(__dirname, '..', '.env');
    }
    if (fs.existsSync(dotenvPath)) {
      try {
        require('dotenv').config({ path: dotenvPath });
      } catch (e) {
        // dotenv optional or not installed; ignore
      }
    }
  } catch (e) {
    // ignore any filesystem errors
  }
}

module.exports = { loadDotenv };
