import { cleanupJobs } from "./cleanup.jobs";

export async function initializeBackgroundJobs(): Promise<void> {
  try {
    console.log("🚀 Initializing background jobs...");
    
    await cleanupJobs.initializeAllJobs();
    
    console.log("✅ Background jobs initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize background jobs:", error);
    throw error;
  }
}
