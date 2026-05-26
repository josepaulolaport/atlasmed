import "dotenv/config"; // Load environment variables for the app
import app from "./app";
import { initializeBackgroundJobs } from "../infrastructure/jobs/init";

const port = process.env.PORT || 3000;

async function start() {
  try {
    await initializeBackgroundJobs();
    
    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
      console.log(`📊 Metrics available at http://localhost:${port}/health/metrics`);
      console.log(`🏥 Health check at http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
