import "dotenv/config"; // Load environment variables for the app
import app from "./app";

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
