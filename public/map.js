let map;
let parkingMarkers = [];
let currentInfoWindow;
let userPosition = null;

const mapStyles = [
  {
    featureType: "all",
    stylers: [
      { saturation: -80 }, // 減少顏色飽和度
      { lightness: 20 }, // 提高亮度
    ],
  },
  {
    featureType: "poi",
    stylers: [
      { visibility: "off" }, // 隱藏地標名稱
    ],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [
      { color: "#E5E5E5" }, // 柔和道路顏色
    ],
  },
  {
    featureType: "water",
    stylers: [
      { color: "#A9D3FF" }, // 水域柔和藍色
    ],
  },
];

// 初始化地圖
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 23.0, lng: 120.2123 },
    zoom: 16,
    styles: mapStyles,
    gestureHandling: "greedy", // 启用手势处理
  });

  // 添加圖例到地圖
  const legend = document.getElementById("legend");
  map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);

  detectUserLocation(); // 偵測使用者位置並設置地圖中心
  loadParkingData(); // 初始載入停車資料

  // 窗口大小变化时重新调整地图
  google.maps.event.addListener(window, "resize", () => {
    google.maps.event.trigger(map, "resize");
  });

  // 当用户点击地图其他区域时关闭 InfoWindow
  google.maps.event.addListener(map, "click", () => {
    if (currentInfoWindow) {
      currentInfoWindow.close();
      currentInfoWindow = null;
    }
  });

  // 绑定 radio button 事件监听器
  document.querySelectorAll('input[name="dataType"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      clearMarkers();

      // 根据选择的值加载相应数据并调整表单显示
      switch (this.value) {
        case "parking":
          loadParkingData();
          break;
        case "disabledParking":
          loadDisabledParkingData();
          break;
      }
    });
  });

  // 綁定表單提交事件監聽器
  document
    .getElementById("predict-form")
    .addEventListener("submit", async function (event) {
      event.preventDefault(); // 阻止表單默認提交行為

      // 獲取表單數據
      const carParkID = document.getElementById("car-park-id").value.trim();
      const time = document.getElementById("time").value;
      const weekday = document.getElementById("weekday").value;
      const is_weekend = document.getElementById("is_weekend").value;

      // 分割小時和分鐘
      const [hour, minute] = time.split(":").map((num) => parseInt(num, 10));

      // 構造特徵數據
      const features = {
        CarParkID: carParkID, // 傳遞停車場 ID
        hour: hour,
        minute: minute,
        weekday: parseInt(weekday),
        is_weekend: parseInt(is_weekend),
      };

      // 提交時印出數據
      console.log("停車場 ID:", carParkID);
      console.log("時間:", time);
      console.log("星期(週一:0):", weekday);
      console.log("是否為週末:", is_weekend);
      try {
        // 調用後端 API
        const response = await fetch("http://127.0.0.1:8080/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(features),
        });

        const data = await response.json();

        // 顯示預測結果
        if (response.ok) {
          document.getElementById("prediction-result").innerHTML = `
          <p>預測可用停車位數量：<strong>${data.prediction.toFixed(
            2
          )}</strong></p>
        `;
        } else {
          document.getElementById("prediction-result").innerHTML = `
          <p style="color: red;">錯誤：${data.error}</p>
        `;
        }
      } catch (error) {
        // 處理 API 請求錯誤
        document.getElementById("prediction-result").innerHTML = `
        <p style="color: red;">發生錯誤：${error.message}</p>
      `;
      }
    });
}

// 自動偵測今天的日期和時間
document.addEventListener("DOMContentLoaded", function () {
  const weekdaySelect = document.getElementById("weekday");
  const isWeekendInput = document.getElementById("is_weekend");
  const timeInput = document.getElementById("time");

  // 自動偵測今天星期幾，並轉換為週一開始的格式
  const now = new Date();
  const originalWeekday = now.getDay(); // 原始星期 (0: 周日, 1: 周一, ..., 6: 周六)
  const weekday = (originalWeekday + 6) % 7; // 映射為週一開始的星期 (週一: 0, 週日: 6)
  const isWeekend = weekday === 5 || weekday === 6 ? 1 : 0; // 是否為週末 (週六或週日)
  const hour = now.getHours().toString().padStart(2, "0"); // 小時
  const minute = now.getMinutes().toString().padStart(2, "0"); // 分鐘

  // 設置默認值
  weekdaySelect.value = weekday; // 自動選中今天的星期
  isWeekendInput.value = isWeekend; // 設定是否為週末的隱藏值
  timeInput.value = `${hour}:${minute}`; // 設置默認時間
});

// 更新選擇時自動調整 is_weekend 值
document.getElementById("weekday").addEventListener("change", function (event) {
  const selectedWeekday = parseInt(event.target.value, 10); // 獲取選擇的星期值
  const isWeekend = selectedWeekday === 5 || selectedWeekday === 6 ? 1 : 0; // 是否為週末 (週六或週日)
  document.getElementById("is_weekend").value = isWeekend; // 更新隱藏字段值
  console.log(
    `[DEBUG] 選擇的星期: ${selectedWeekday}, 是否為週末: ${isWeekend}`
  );
});

// 調整時間的函數
function adjustTime(minutesToAdd) {
  const timeInput = document.getElementById("time");
  let [hour, minute] = timeInput.value.split(":").map(Number);

  // 確保時間輸入框有值，否則設置為當前時間
  if (isNaN(hour) || isNaN(minute)) {
    const now = new Date();
    hour = now.getHours();
    minute = now.getMinutes();
  }

  // 計算新的時間
  const newTime = new Date();
  newTime.setHours(hour);
  newTime.setMinutes(minute + minutesToAdd);

  // 獲取更新後的時、分
  const updatedHour = newTime.getHours().toString().padStart(2, "0");
  const updatedMinute = newTime.getMinutes().toString().padStart(2, "0");

  // 更新時間輸入框的值
  timeInput.value = `${updatedHour}:${updatedMinute}`;
}

// 創建標記的函數，並附加信息窗口
function createMarker({
  latLng,
  title,
  carParkID,
  carAvailableSpaces,
  carNumberOfSpaces,
  icon,
  parkingHourlyRates,
  parkingDescription,
}) {
  const marker = new google.maps.Marker({
    position: latLng,
    map: map,
    title: title,
    icon: icon,
  });

  parkingMarkers.push(marker);

  // 动态内容创建
  const parkingHourlyRatesInfo = parkingHourlyRates
    ? `<p>收費：每小時 NT$ ${parkingHourlyRates}</p>`
    : "";
  const parkingDescriptionInfo = parkingDescription
    ? `<p>${parkingDescription}</p>`
    : "";
  const carSpacesInfo =
    carAvailableSpaces !== undefined && carNumberOfSpaces !== undefined
      ? `<p><strong>剩餘車位: ${carAvailableSpaces}/${carNumberOfSpaces}</strong></p>`
      : "";
  const navigation = `<button class="navigate-button" onclick="navigateToParking(${latLng.lat}, ${latLng.lng})">🛣️ 點擊導航</button>`;

  const content = `
    <div class="info-window">
      <h3>🚗${title}</h3>
      ${parkingDescriptionInfo}
      ${parkingHourlyRatesInfo}
      ${carSpacesInfo}
      ${navigation}
    </div>
  `;

  // 使用 attachMarkerInfo 附加信息窗口
  attachMarkerInfo(marker, content);

  // 更新表單中的停車場名稱和 ID
  marker.addListener("click", () => {
    document.getElementById("car-park-name").value = title; // 顯示停車場名稱
    document.getElementById("car-park-id").value = carParkID; // 隱藏 ID，用於提交
  });
  return marker;
}

// 將信息窗口與標記綁定，支持淡入效果
function attachMarkerInfo(marker, content) {
  const infoWindow = new google.maps.InfoWindow({
    content: content,
  });

  // 绑定点击事件
  marker.addListener("click", () => {
    if (currentInfoWindow) {
      currentInfoWindow.close();
    }

    infoWindow.open(map, marker);
    currentInfoWindow = infoWindow;

    // 等待 InfoWindow DOM 加载完成后添加淡入效果
    google.maps.event.addListenerOnce(infoWindow, "domready", () => {
      const infoWindowElement = document.querySelector(".info-window");
      if (infoWindowElement) {
        infoWindowElement.classList.add("show");
      }
    });
  });
}

// 清除地圖上的標記
function clearMarkers() {
  parkingMarkers.forEach((marker) => marker.setMap(null));
  parkingMarkers = [];
}

// 加載停車場資料
async function loadParkingData() {
  try {
    const response = await fetch("/api/getParkingData");
    const parkingData = await response.json();

    parkingData.forEach((parking) => {
      const latLng = { lat: parking.lat, lng: parking.lon };
      let markerIcon;

      // 设置车位状态逻辑
      if (parking.carInfo.availableSpaces !== "無資料") {
        const carAvailableSpaces = parking.carInfo.availableSpaces;

        if (carAvailableSpaces >= 10) {
          markerIcon = "greencar.png"; // 许多空位
        } else if (carAvailableSpaces > 0 && carAvailableSpaces < 10) {
          markerIcon = "orangecar.png"; // 即将满位
        } else if (
          carAvailableSpaces === 0 &&
          parking.carInfo.numberOfSpaces > 0
        ) {
          markerIcon = "redcar.png"; // 已满位
        } else if (
          carAvailableSpaces === 0 &&
          parking.carInfo.numberOfSpaces === 0
        ) {
          markerIcon =
            "https://maps.google.com/mapfiles/kml/shapes/parking_lot.png"; // 无即时车位信息
        }

        // 设置图标大小
        const icon = {
          url: markerIcon,
          scaledSize: new google.maps.Size(100, 100),
        };

        // 调用 createMarker 创建标记
        createMarker({
          latLng,
          title: parking.name,
          parkingDescription: parking.description,
          carAvailableSpaces: carAvailableSpaces,
          carNumberOfSpaces: parking.carInfo.numberOfSpaces,
          icon: icon,
          parkingHourlyRates: parking.hourlyRates,
          carParkID: parking.carParkID,
        });
      }
    });
  } catch (error) {
    console.error("加載停車場資料時出錯 :", error);
  }
}

// 加載身心障礙停車場資料
async function loadDisabledParkingData() {
  try {
    const response = await fetch("/api/getParkingData");
    const parkingData = await response.json();

    // 篩選有身心障礙停車位的停車場
    const filteredData = parkingData.filter(
      (parking) => parking.disabledParkingSpaces > 0
    );

    filteredData.forEach((parking) => {
      const latLng = { lat: parking.lat, lng: parking.lon };
      let markerIcon;

      // 設置車位狀態邏輯
      if (parking.carInfo.availableSpaces !== "無資料") {
        const carAvailableSpaces = parking.carInfo.availableSpaces;

        if (carAvailableSpaces >= 10) {
          markerIcon = "greencar.png"; // 許多空位
        } else if (carAvailableSpaces > 0 && carAvailableSpaces < 10) {
          markerIcon = "orangecar.png"; // 即將滿位
        } else if (
          carAvailableSpaces === 0 &&
          parking.carInfo.numberOfSpaces > 0
        ) {
          markerIcon = "redcar.png"; // 已滿位
        } else if (
          carAvailableSpaces === 0 &&
          parking.carInfo.numberOfSpaces === 0
        ) {
          markerIcon =
            "https://maps.google.com/mapfiles/kml/shapes/parking_lot.png"; // 無即時車位資訊
        }

        // 設置圖標大小
        const icon = {
          url: markerIcon,
          scaledSize: new google.maps.Size(100, 100),
        };

        createMarker({
          latLng,
          title: parking.name,
          parkingDescription: parking.description,
          carAvailableSpaces: carAvailableSpaces,
          carNumberOfSpaces: parking.carInfo.numberOfSpaces,
          icon: icon,
          parkingHourlyRates: parking.hourlyRates,
          carParkID: parking.carParkID,
        });
      }
    });
  } catch (error) {
    console.error("加載身心障礙停車場資料時出錯：", error);
  }
}

// 偵測使用者位置
function detectUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        //map.setCenter(userPosition); 設置地圖中心至使用者位置
      },
      (error) => {
        console.error("偵測使用者位置失敗：", error);
      }
    );
  } else {
    console.error("瀏覽器不支援地理位置偵測。");
  }
}

// 導航到停車場
function navigateToParking(lat, lng) {
  if (userPosition) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userPosition.lat},${userPosition.lng}&destination=${lat},${lng}`;
    window.open(url, "_blank");
  } else {
    alert("無法取得使用者位置，無法導航。");
  }
}

function showUpdateNotification() {
  const notification = document.getElementById("updateNotification");

  // 顯示提示框
  notification.classList.remove("hidden");
  notification.classList.add("visible");

  // 設定3秒後自動隱藏
  setTimeout(() => {
    notification.classList.remove("visible");
    notification.classList.add("hidden");
  }, 3000); // 3000毫秒 = 3秒
}

function getSelectedDataType() {
  const selectedRadio = document.querySelector(
    'input[name="dataType"]:checked'
  );
  return selectedRadio ? selectedRadio.value : null;
}

async function updateParkingData() {
  try {
    clearMarkers();
    const selectedType = getSelectedDataType();
    switch (selectedType) {
      case "parking":
        await loadParkingData();
        break;
      case "disabledParking":
        await loadDisabledParkingData();
        break;
      default:
        console.warn("未選擇任何資料類型");
        break;
    }
    console.log("資料已根據選擇類型更新：" + new Date().toLocaleTimeString());

    // 顯示更新通知
    showUpdateNotification();
  } catch (error) {
    console.error("更新資料時出錯：", error);
  }
}

// 建立 WebSocket 連線
const socket = new WebSocket(`wss://${window.location.host}`);

// 監聽 WebSocket 訊息
socket.addEventListener("message", (event) => {
  if (event.data === "updateParkingData") {
    console.log("接收到伺服端通知，開始更新停車場資料");
    updateParkingData();
  }
});

window.onload = initMap;
