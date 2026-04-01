import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD48x9Cqg88dzY0udAkbMsxblhZyhxG-f4",
  authDomain: "taxi-app-158f3.firebaseapp.com",
  projectId: "taxi-app-158f3",
  storageBucket: "taxi-app-158f3.firebasestorage.app",
  messagingSenderId: "150352653529",
  appId: "1:150352653529:web:2dd6d85b5219b8807962c8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let user = null;
let role = null;
let cooldown = {};
let lastState = {};

// VK INIT (ВАЖНО: только здесь)
vkBridge.send("VKWebAppGetUserInfo").then(res => {
  user = res.id;
});

// уведомления
function notify(msg){
  vkBridge.send("VKWebAppShowMessageBox", {
    title: "Taxi V6",
    message: msg
  });
}

// ================= ROLE =================
window.setRole = function(r){
  role = r;

  document.getElementById("roleSelect").classList.add("hidden");
  document.getElementById("topbar").classList.remove("hidden");

  if (r === "passenger") {
    document.getElementById("passengerUI").classList.remove("hidden");
    notify("Вы пассажир 🚶");
  }

  if (r === "driver") {
    document.getElementById("driverUI").classList.remove("hidden");
    notify("Вы водитель 🚗");
  }
};

// ================= DRIVER ONLINE (ФИКС 100%) =================
window.saveDriver = async function () {

  const callsign = document.getElementById("callsign").value.trim();

  if (!callsign) return notify("Введите позывной");
  if (!user) return notify("VK user не загружен");

  await addDoc(collection(db, "drivers"), {
    vk: user,
    status: "online",
    callsign,
    created: Date.now()
  });

  notify("Вы онлайн 🟢");
};

// ================= PRICELIST (как txt файлы городов) =================
const cityPrice = {
  "Город А": 120,
  "Город Б": 150,
  "Город Н": 200,
  "Город С": 250,
  "Город Д": 300
};

function getPrice(from, to){
  const a = cityPrice[from] || 150;
  const b = cityPrice[to] || 150;
  return Math.abs(b - a) + 50;
}

// ================= CREATE ORDER =================
window.createOrder = async function () {

  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();

  if (!from || !to) return notify("Заполните поля");

  const price = getPrice(from, to);

  await addDoc(collection(db, "orders"), {
    from,
    to,
    price,
    status: "new",
    passenger: user,
    driver: null,
    created: Date.now()
  });

  notify("Заказ создан 🚕 " + price + "₽");
};

// ================= DRIVER ACTIONS =================
window.acceptOrder = async function (id) {

  if (cooldown[user] && Date.now() - cooldown[user] < 120000) {
    return notify("Кулдаун 2 минуты ⏳");
  }

  await updateDoc(doc(db, "orders", id), {
    status: "accepted",
    driver: user
  });

  cooldown[user] = Date.now();
  notify("Заказ принят 🚖");
};

window.arrived = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "arrived" });
  notify("Вы на месте 📍");
};

window.finish = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "done" });
  notify("Поездка завершена ✅");
};

window.cancel = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "cancelled" });
  notify("Отмена ❌");
};

// ================= RENDER =================
onSnapshot(query(collection(db, "orders"), orderBy("created", "desc")), snap => {

  let html = "<h3>🚕 Заказы</h3>";

  snap.forEach(d => {
    const o = d.data();

    let style = "";
    if (o.status === "accepted") style = "opacity:0.6;";
    if (o.status === "done" || o.status === "cancelled")
      style = "opacity:0.3; filter:grayscale(1);";

    html += `<div class="card" style="${style}">
      <b>📍 ${o.from} → ${o.to}</b><br>
      💰 ${o.price || 150}₽<br>
      Статус: ${o.status}<br>`;

    // DRIVER
    if (role === "driver") {

      if (o.status === "new") {
        html += `<button onclick="acceptOrder('${d.id}')">Принять 🚖</button>`;
      }

      if (o.driver === user && o.status === "accepted") {
        html += `
          <button onclick="arrived('${d.id}')">На месте 📍</button>
          <button onclick="finish('${d.id}')">Завершить ✅</button>
          <button onclick="cancel('${d.id}')">Отмена ❌</button>
        `;
      }
    }

    // PASSENGER
    if (role === "passenger" && o.passenger === user) {

      if (o.status === "accepted") html += "🚖 Водитель едет...";
      if (o.status === "arrived") html += "📍 Машина на месте";
      if (o.status === "done") html += "✅ Завершено";

      if (o.status !== "done") {
        html += `<br><button onclick="cancel('${d.id}')">Отмена ❌</button>`;
      }
    }

    html += "</div>";
  });

  document.getElementById("orders").innerHTML = html;
});
