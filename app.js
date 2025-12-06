const API_URL = "https://panchawati-cafe-ea183bf57462.herokuapp.com/api/v1";
const SOCKET_URL = "https://panchawati-cafe-ea183bf57462.herokuapp.com";

// State
let orders = [];
let token = localStorage.getItem("token");

// DOM Elements
const els = {
  railToCook: document.getElementById("rail-to-cook"),
  railReady: document.getElementById("rail-ready"),
  railCompleted: document.getElementById("rail-completed"),
  countToCook: document.getElementById("count-to-cook"),
  countReady: document.getElementById("count-ready"),
  badgeToCook: document.getElementById("badge-to-cook"),
  badgeReady: document.getElementById("badge-ready"),
  badgeCompleted: document.getElementById("badge-completed"),
  socketStatus: document.getElementById("socket-status"),
  connectionText: document.getElementById("connection-text"),
  clock: document.getElementById("clock"),
  logoutBtn: document.getElementById("logout-btn"),
  logoutBtnMobile: document.getElementById("logout-btn-mobile"),
  mobileCountCook: document.getElementById("mobile-count-cook"),
  mobileCountReady: document.getElementById("mobile-count-ready"),
};

// Initialize
function init() {
  console.log("App init, token:", token);
  if (!token || token === "undefined") {
    console.log("No valid token found, redirecting to login");
    window.location.href = "login.html";
    return;
  }

  initSocket();
  fetchOrders();
  startClock();

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener("click", logout);
  }
  if (els.logoutBtnMobile) {
    els.logoutBtnMobile.addEventListener("click", logout);
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// Socket.IO
function initSocket() {
  const socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: {
      token: token,
    },
  });

  socket.on("connect", () => {
    console.log("✅ Connected to WebSocket");
    els.socketStatus.classList.remove("bg-red-500");
    els.socketStatus.classList.add("bg-green-500");
    els.connectionText.textContent = "Live";
    els.connectionText.classList.add("text-green-600");
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected from WebSocket");
    els.socketStatus.classList.remove("bg-green-500");
    els.socketStatus.classList.add("bg-red-500");
    els.connectionText.textContent = "Disconnected";
    els.connectionText.classList.remove("text-green-600");
  });

  socket.on("order:created", (order) => {
    console.log("🔔 New Order:", order);
    // Add to list if not exists
    if (!orders.find((o) => o.id === order.id)) {
      orders.unshift(order);
      renderOrders();
      playNotificationSound();
    }
  });

  socket.on("order:statusUpdated", (updatedOrder) => {
    console.log("🔄 Order Updated:", updatedOrder);
    const index = orders.findIndex((o) => o.id === updatedOrder.id);
    if (index !== -1) {
      orders[index] = updatedOrder;
      renderOrders();
    }
  });
}

// API
async function fetchOrders() {
  try {
    const res = await fetch(`${API_URL}/orders?status=PENDING,KITCHEN,READY`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (data.success) {
      // Sort by newest first
      orders = data.data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      renderOrders();
    } else if (res.status === 401) {
      logout();
    }
  } catch (error) {
    console.error("Failed to fetch orders:", error);
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (data.success) {
      // Optimistic update
      const index = orders.findIndex((o) => o.id === orderId);
      if (index !== -1) {
        orders[index].status = newStatus;
        renderOrders();
      }
    }
  } catch (error) {
    console.error("Failed to update status:", error);
    alert("Failed to update order status");
  }
}

// Rendering
function renderOrders() {
  // Clear rails
  els.railToCook.innerHTML = "";
  els.railReady.innerHTML = "";
  els.railCompleted.innerHTML = "";

  let counts = { toCook: 0, ready: 0, completed: 0 };

  orders.forEach((order) => {
    const card = createOrderCard(order);
    const status = mapStatus(order.status);

    if (status === "to_cook") {
      els.railToCook.appendChild(card);
      counts.toCook++;
    } else if (status === "ready") {
      els.railReady.appendChild(card);
      counts.ready++;
    } else if (status === "completed") {
      els.railCompleted.appendChild(card);
      counts.completed++;
    }
  });

  // Update counts
  els.countToCook.textContent = counts.toCook;
  els.countReady.textContent = counts.ready;
  els.badgeToCook.textContent = counts.toCook;
  els.badgeReady.textContent = counts.ready;
  els.badgeCompleted.textContent = counts.completed;

  // Update mobile counts
  if (els.mobileCountCook) els.mobileCountCook.textContent = counts.toCook;
  if (els.mobileCountReady) els.mobileCountReady.textContent = counts.ready;
}

function createOrderCard(order) {
  const div = document.createElement("div");
  const status = mapStatus(order.status);

  let borderClass = "card-new";
  let btnHtml = "";

  // Always show Complete button for active orders
  if (status === "to_cook" || status === "ready") {
    borderClass = "card-new";
    btnHtml = `
      <button onclick="updateOrderStatus('${order.id}', 'COMPLETED')" class="flex-1 bg-green-600 text-white py-4 rounded-xl text-base font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2">
        <span>Complete Order</span> <i class="fa-solid fa-check-circle"></i>
      </button>
    `;
  } else {
    borderClass = "card-completed";
    // No buttons for completed
  }

  div.className = `bg-white rounded-2xl p-5 shadow-sm border border-slate-100 ${borderClass} animate-slide-in group hover:shadow-md transition-all`;

  const timeAgo = getTimeAgo(new Date(order.createdAt));
  const itemsHtml = order.items
    .map(
      (item) => `
    <div class="flex justify-between items-start text-sm py-1">
      <div class="flex gap-3">
        <span class="font-bold text-slate-900 w-6 text-center bg-slate-100 rounded-md h-6 flex items-center justify-center">${
          item.quantity
        }</span>
        <div class="flex flex-col">
            <span class="text-slate-700 font-medium">${
              item.menuItem?.name || "Unknown Item"
            }</span>
            ${
              item.notes
                ? `<span class="text-xs text-orange-500 italic mt-0.5"><i class="fa-solid fa-note-sticky mr-1"></i>${item.notes}</span>`
                : ""
            }
        </div>
      </div>
    </div>
  `
    )
    .join("");

  div.innerHTML = `
    <div class="flex justify-between items-start mb-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="font-black text-xl text-slate-900">#${
            order.orderNumber
          }</span>
          <span class="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide border border-blue-100">${order.type.replace(
            "_",
            " "
          )}</span>
        </div>
        <p class="text-xs text-slate-500 font-medium flex items-center gap-1">
            <i class="fa-regular fa-user"></i> ${
              order.customer?.name || "Guest"
            } 
            ${
              order.tableNo
                ? `<span class="mx-1">•</span> <i class="fa-solid fa-chair"></i> ${order.tableNo}`
                : ""
            }
        </p>
      </div>
      <span class="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">${timeAgo}</span>
    </div>
    
    <div class="space-y-1 mb-5 border-t border-dashed border-slate-100 pt-4">
      ${itemsHtml}
    </div>

    <div class="flex gap-2">
      ${btnHtml}
    </div>
  `;

  return div;
}

// Helpers
function mapStatus(status) {
  if (status === "PENDING" || status === "KITCHEN") return "to_cook";
  if (status === "READY") return "ready";
  if (status === "COMPLETED" || status === "DELIVERED") return "completed";
  return "to_cook";
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function startClock() {
  setInterval(() => {
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, 1000);
}

function playNotificationSound() {
  // Simple beep or custom sound could go here
  // const audio = new Audio('path/to/sound.mp3');
  // audio.play().catch(e => console.log("Audio play failed", e));
}

init();
