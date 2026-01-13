import express from "express";
import rootRouter from "./src/routers/root_router.js";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// tất cả API v1
app.use("/api/v1", rootRouter);

// Serve static files (avatars)
app.use(express.static('public'));

const port = 3069;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;
