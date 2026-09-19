import "dotenv/config";
import app from "./app.js";
import DB from "./config/db.config.js";

const startServer = async () => {
    try {
        const connection = await DB.promise().getConnection();
        console.log("✅ Database connected successfully");
        connection.release();

        const PORT = process.env.PORT || 8000;
        app.listen(PORT, () => {
            console.log(`✅ User service is running on port ${PORT}`);
            console.log(`🌍 http://localhost:${PORT}/`);
        });
    } catch (error) {
        console.error("❌ Error connecting to the database:", error);
        process.exit(1);
    }
};

startServer();
