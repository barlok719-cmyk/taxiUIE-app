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
  storageBucket: "taxi-app-158f3.appspot.com",
  messagingSenderId: "150352653529",
  appId: "1:150352653529:web:2dd6d85b5219b8807962c8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const vkBridge = window.vkBridge;

let user = null;
let role = null;
let cooldown = {};
let lastState = {};

// ================= SAFE VK INIT =================
const vkReady = new Promise((resolve) => {
  if (!vkBridge) return resolve(null);

  vkBridge.send("VKWebAppGetUserInfo")
    .then(res => {
      user = res.id;
      console.log("VK USER LOADED:", user);
      resolve(user);
    })
    .catch(err => {
      console.log("VK ERROR:", err);
      resolve(null);
    });
});

// ================= NOTIFY =================
function notify(msg){
  try {
    vkBridge.send("VKWebAppShowMessageBox", {
      title: "Taxi V6",
      message: msg
    });
  } catch (e) {
    alert(msg);
  }
}

// ================= ROLE =================
window.setRole = function(r){
  role = r;
};

// ================= DRIVER ONLINE (FIXED 100%) =================
window.saveDriver = async function () {
  try {

    const callsign = document.getElementById("callsign").value.trim();

    if (!callsign) return notify("Введите позывной");

    // 🔥 ждём VK user
    await vkReady;

    if (!user) return notify("VK пользователь не загрузился");

    await addDoc(collection(db, "drivers"), {
      vk: user,
      status: "online",
      callsign,
      created: Date.now()
    });

    notify("Вы онлайн 🟢");

  } catch (e) {
    console.error("saveDriver error:", e);
    notify("Ошибка водитель online");
  }
};

// ================= ORDER =================
window.createOrder = async function () {

  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();

  if (!from || !to) return notify("Заполните поля");

  await vkReady;

  if (!user) return notify("VK не готов");

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

// ================= ACCEPT =================
window.acceptOrder = async function (id) {

  await vkReady;

  if (cooldown[user] && Date.now() - cooldown[user] < 120000) {
    return notify("Кулдаун 2 минуты ⏳");
  }

  await updateDoc(doc(db, "orders", id), {
    status: "accepted",
    driver: user
  });

  cooldown[user] = Date.now();
  notify("Приняли заказ 🚖");
};

// ================= STATUS =================
window.arrived = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "arrived" });
};

window.finish = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "done" });
};

window.cancel = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "cancelled" });
};

// ================= RENDER =================
onSnapshot(query(collection(db, "orders"), orderBy("created", "desc")), snap => {

  const el = document.getElementById("orders");
  let html = "<h3>🚕 Заказы</h3>";

  snap.forEach(d => {
    const o = d.data();

    let style = "";

    if (o.status === "accepted") style = "opacity:0.6;";
    if (o.status === "done" || o.status === "cancelled")
      style = "opacity:0.3; filter:grayscale(1);";

    html += `<div class="card" style="${style}">
      <b>${o.from} → ${o.to}</b><br>
      Статус: ${o.status}<br>`;

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

  el.innerHTML = html;
});
