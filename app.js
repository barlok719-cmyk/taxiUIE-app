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

// VK init
vkBridge.send("VKWebAppGetUserInfo").then(res => {
  user = res.id;
});

// норм уведомления
function notify(msg){
  vkBridge.send("VKWebAppShowMessageBox", {
    title: "Taxi V6",
    message: msg
  });
}

// сделать доступной HTML-кнопку назад
window.back = function(){
  role = null;
};

// ========== ROLE ==========
window.setRole = function(r){
  role = r;
};

// ========== DRIVER ONLINE ==========
window.saveDriver = async function () {

  const callsign = document.getElementById("callsign").value.trim();

  if (!callsign) {
    notify("Введите позывной");
    return;
  }

  if (!user) {
    notify("Пользователь не загружен");
    return;
  }

  await addDoc(collection(db, "drivers"), {
    vk: user,
    status: "online",
    callsign: callsign,
    created: Date.now()
  });

  notify("Вы онлайн 🟢");
};

// ========== CREATE ORDER ==========
window.createOrder = async function () {

  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();

  if (!from || !to) {
    notify("Заполните поля");
    return;
  }

  await addDoc(collection(db, "orders"), {
    from,
    to,
    status: "new",
    passenger: user,
    driver: null,
    created: Date.now()
  });

  notify("Заказ создан 🚕");
};

// ========== ACCEPT ==========
window.acceptOrder = async function (id) {

  if (cooldown[user] && Date.now() - cooldown[user] < 120000) {
    notify("Кулдаун 2 минуты ⏳");
    return;
  }

  await updateDoc(doc(db, "orders", id), {
    status: "accepted",
    driver: user
  });

  cooldown[user] = Date.now();
  notify("Вы приняли заказ 🚖");
};

// ========== STATUS ==========
window.arrived = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "arrived" });
  notify("Вы на месте 📍");
};

window.finish = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "done" });
  notify("Заказ завершён ✅");
};

window.cancel = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "cancelled" });
  notify("Заказ отменён ❌");
};

// ========== RENDER ==========
onSnapshot(query(collection(db, "orders"), orderBy("created", "desc")), snap => {

  let html = "<h3>🚕 Заказы</h3>";

  snap.forEach(d => {
    let o = d.data();

    let style = "";

    if (o.status === "accepted") style = "opacity:0.6;";
    if (o.status === "done" || o.status === "cancelled") style = "opacity:0.3; filter:grayscale(1);";

    // уведомления
    if (!lastState[d.id] || lastState[d.id] !== o.status) {
      lastState[d.id] = o.status;

      if (o.status === "accepted" && o.passenger === user) notify("Заказ принят 🚖");
      if (o.status === "arrived" && o.passenger === user) notify("Машина приехала 📍");
      if (o.status === "done" && o.passenger === user) notify("Поездка завершена ✅");
    }

    html += `<div class="card" style="${style}">
      <b>📍 ${o.from} → ${o.to}</b><br>
      Статус: ${o.status}<br>`;

    // DRIVER UI
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

    // PASSENGER UI
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
