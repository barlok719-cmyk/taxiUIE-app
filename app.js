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

vkBridge.send("VKWebAppInit");

// 🔥 FIREBASE (ТВОИ ДАННЫЕ)
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

let role = "";
let user = null;
let cooldown = {};

// VK USER
vkBridge.send("VKWebAppGetUserInfo").then(res => {
  user = res.id;
});

// 🔔 уведомления (простые VK)
function notify(text){
  vkBridge.send("VKWebAppShowMessageBox", {
    title: "Taxi App",
    message: text
  });
}

// ================= ROLE =================
window.setRole = function(r){
  role = r;

  document.getElementById("roleSelect").classList.add("hidden");

  if(r==="driver")
    document.getElementById("driverUI").classList.remove("hidden");
  else
    document.getElementById("passengerUI").classList.remove("hidden");
}

// ================= DRIVER =================
window.saveDriver = async function(){
  await addDoc(collection(db,"drivers"),{
    vk:user,
    status:"online",
    callsign:document.getElementById("callsign").value
  });

  notify("Вы онлайн 🟢");
}

// ================= ORDER CREATE =================
window.createOrder = async function(){
  await addDoc(collection(db,"orders"),{
    from:from.value,
    to:to.value,
    status:"new",
    passenger:user,
    driver:null,
    created:Date.now()
  });

  notify("Заказ создан 🚕");
}

// ================= ACCEPT =================
window.acceptOrder = async function(id){

  if(cooldown[user] && Date.now()-cooldown[user] < 120000){
    notify("Кулдаун 2 минуты");
    return;
  }

  await updateDoc(doc(db,"orders",id),{
    status:"accepted",
    driver:user
  });

  cooldown[user]=Date.now();

  notify("Заказ принят 🚖");
}

// ================= STATUS =================
window.arrived = id =>
  updateDoc(doc(db,"orders",id),{status:"arrived"});

window.finish = id =>
  updateDoc(doc(db,"orders",id),{status:"done"});

window.cancel = id =>
  updateDoc(doc(db,"orders",id),{status:"cancelled"});

// ================= RENDER =================
onSnapshot(query(collection(db,"orders"), orderBy("created","desc")), snap => {

  let html = "<h3>🚕 Заказы</h3>";

  snap.forEach(d => {
    let o = d.data();

    let style = "";

    if(o.status==="accepted") style="opacity:0.5;";
    if(o.status==="done" || o.status==="cancelled") style="opacity:0.3; filter:grayscale(1);";

    html += `<div class="card" style="${style}">
      <b>${o.from} → ${o.to}</b><br>
      Статус: ${o.status}<br>
    `;

    // DRIVER
    if(role==="driver"){

      if(o.status==="new"){
        html += `<button onclick="acceptOrder('${d.id}')">Принять</button>`;
      }

      if(o.driver===user && o.status==="accepted"){
        html += `
          <button onclick="arrived('${d.id}')">На месте</button>
          <button onclick="finish('${d.id}')">Выхожу</button>
          <button onclick="cancel('${d.id}')">Отмена</button>
        `;
      }
    }

    // PASSENGER
    if(role==="passenger" && o.passenger===user){

      if(o.status==="accepted"){
        html += "🚖 Водитель едет";
      }

      if(o.status==="arrived"){
        html += "🚕 Машина на месте";
      }

      if(o.status==="done"){
        html += "✅ Завершено";
      }

      if(o.status!=="done"){
        html += `<br><button onclick="cancel('${d.id}')">Отмена</button>`;
      }
    }

    html += "</div>";
  });

  document.getElementById("orders").innerHTML = html;
});
