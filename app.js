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

// 🔥 ЖДЁМ VK БЕЗ КРАША
const vkBridge = window.vkBridge;

let user = null;
let role = null;

// безопасный notify
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

// VK init safe
if (vkBridge) {
  vkBridge.send("VKWebAppGetUserInfo")
    .then(res => {
      user = res.id;
      console.log("VK USER:", user);
    })
    .catch(err => {
      console.log("VK ERROR", err);
    });
} else {
  console.log("VK BRIDGE NOT FOUND");
}

// ================= ROLE =================
window.setRole = function(r){
  role = r;

  document.getElementById("roleSelect").style.display = "none";
  document.getElementById("topbar").style.display = "flex";

  document.getElementById("passengerUI").classList.add("hidden");
  document.getElementById("driverUI").classList.add("hidden");

  if (r === "passenger") {
    document.getElementById("passengerUI").classList.remove("hidden");
    notify("Пассажир");
  }

  if (r === "driver") {
    document.getElementById("driverUI").classList.remove("hidden");
    notify("Водитель");
  }
};

// ================= DRIVER =================
window.saveDriver = async function () {
  try {
    const callsign = document.getElementById("callsign").value;

    if (!callsign) return notify("нет позывного");
    if (!user) return notify("нет VK user");

    await addDoc(collection(db, "drivers"), {
      vk: user,
      callsign,
      status: "online",
      created: Date.now()
    });

    notify("онлайн");
  } catch (e) {
    console.log(e);
    notify("ошибка driver");
  }
};

// ================= ORDER =================
window.createOrder = async function () {
  try {
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;

    if (!from || !to) return notify("поля пустые");

    await addDoc(collection(db, "orders"), {
      from,
      to,
      status: "new",
      passenger: user,
      created: Date.now()
    });

    notify("заказ создан");
  } catch (e) {
    console.log(e);
    notify("ошибка заказа");
  }
};

// ================= DRIVER ACTION =================
window.acceptOrder = async function (id) {
  try {
    await updateDoc(doc(db, "orders", id), {
      status: "accepted",
      driver: user
    });

    notify("принял");
  } catch (e) {
    console.log(e);
  }
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
  let html = "<h3>Заказы</h3>";

  snap.forEach(d => {
    const o = d.data();

    html += `
      <div class="card">
        <b>${o.from} → ${o.to}</b><br>
        ${o.status}<br>
    `;

    if (role === "driver" && o.status === "new") {
      html += `<button onclick="acceptOrder('${d.id}')">Принять</button>`;
    }

    if (role === "passenger" && o.passenger === user) {
      html += `<button onclick="cancel('${d.id}')">Отмена</button>`;
    }

    html += `</div>`;
  });

  el.innerHTML = html;
});
