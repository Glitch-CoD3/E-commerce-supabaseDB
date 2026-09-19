import "dotenv/config";
import app from "./app.js";
import DB from "./config/db.config.js";

const startServer = async () => {
    try {
        const connection = await DB.promise().getConnection();
        console.log("✅ Database connected successfully");
        connection.release();

        const PORT = process.env.PORT || 8003;
        const SERVICE_NAME = process.env.SERVICE_NAME || "Order-Service";
        const ORDER_SERVICE_URI = process.env.ORDER_SERVICE_URI || `http://localhost:${PORT}`;

        app.listen(PORT, () => {
            console.log(`✅ ${SERVICE_NAME} is running on port ${PORT}`);
            console.log(`🌍 ${ORDER_SERVICE_URI}`);
        });
    } catch (error) {
        console.error("❌ Error connecting to the database:", error);
        process.exit(1);
    }
};

startServer();
