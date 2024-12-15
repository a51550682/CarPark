const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");
const cors = require("cors"); // 引入 CORS
const { Server } = require("ws"); // 引入 WebSocket

const app = express();
app.use(cors()); // 開啟 CORS 支援

// 提供靜態文件 (例如 HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// 設定路由
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 啟動伺服器端口
const port = process.env.PORT || 3000;

// MongoDB 連線
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
const client = new MongoClient(mongoUrl);

let db;

// MongoDB 連線函數
async function connectToMongo() {
  try {
    await client.connect();
    db = client.db("ParkingProject");
    console.log("MongoDB 連線成功");
  } catch (err) {
    console.error("MongoDB 連線失敗:", err);
    process.exit(1); // 終止程序，因為伺服器無法正常工作
  }
}

// API 路由 - 獲取停車場資料
app.get("/api/getParkingData", async (req, res) => {
  try {
    const collection = db.collection("ParkingData");
    const parkingData = await collection.find({}).toArray();

    if (!parkingData.length) {
      return res.json([]); // 如果沒有資料，回傳空陣列
    }

    const result = parkingData.map((parking) => {
      let carInfo = {
        availableSpaces: "無資料",
        numberOfSpaces: "無資料",
      };

      if (parking.data?.errorCarPark === 1) {
        carInfo = {
          availableSpaces: 0,
          numberOfSpaces: 0,
        };
      }

      if (parking.data?.errorCarPark !== 1) {
        parking.data?.Availabilities?.forEach((availability) => {
          if (availability.SpaceType === 1) {
            carInfo = {
              availableSpaces: availability.AvailableSpaces ?? "無資料",
              numberOfSpaces: availability.NumberOfSpaces ?? "無資料",
            };
          }
        });
      }

      return {
        name: parking.data?.CarParkName || "無名稱",
        lat: parking.data?.CarParkPosition?.PositionLat || 0,
        lon: parking.data?.CarParkPosition?.PositionLon || 0,
        carInfo,
        hourlyRates: parking.data?.HourlyRates?.[0]?.RatePrice || "",
        description: parking.data?.Description || "",
        disabledParkingSpaces: parking.data?.disabled_Availability || 0,
        carParkID: parking.data?.CarParkID || 0,
      };
    });
    res.json(result);
  } catch (err) {
    console.error("獲取停車場資料失敗:", err);
    res.status(500).send("資料加載失敗");
  }
});

// 定期通知前端更新
function startAutoUpdate(intervalMinutes, wss) {
  const intervalMilliseconds = intervalMinutes * 60 * 1000;
  setInterval(() => {
    console.log("通知前端更新數據：" + new Date().toLocaleString());
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // 確保連線是開啟的
        client.send("updateParkingData");
      }
    });
  }, intervalMilliseconds);
}

// 啟動 HTTP 伺服器
const server = app.listen(port, async () => {
  await connectToMongo();
  console.log(`伺服器已啟動，訪問：http://localhost:${port}`);
});

// 啟動 WebSocket 伺服器
const wss = new Server({ server });
wss.on("connection", (ws) => {
  console.log("前端已連線到 WebSocket");
  ws.on("message", (message) => {
    console.log("收到前端消息：", message);
  });
});

// 啟動定期通知
startAutoUpdate(3, wss);
