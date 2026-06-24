const deviceList = document.querySelector("#deviceList");
const historyList = document.querySelector("#history");
const toast = document.querySelector("#toast");
const refreshButton = document.querySelector("#refresh");

const kindLabels = {
  light: "Luz",
  door: "Puerta",
  lock: "Cerradura",
  sensor: "Sensor",
  fan: "Ventilador",
};

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return "";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3000);
}

function setHotspotState(device) {
  const deviceElements = document.querySelectorAll(`[data-device="${device.key}"]`);
  deviceElements.forEach((element) => {
    element.classList.toggle("is-on", device.is_on);

    const lamps = element.matches(".lamp, .lamp-bulb")
      ? [element]
      : element.querySelectorAll(".lamp, .lamp-bulb");

    lamps.forEach((lamp) => {
      lamp.classList.toggle("is-on", device.is_on);
    });
  });
}

function renderDevices(devices) {
  deviceList.innerHTML = "";
  devices.forEach((device) => {
    setHotspotState(device);

    const card = document.createElement("article");
    card.className = "device-card";

    const kindLabel = kindLabels[device.kind] || "Dispositivo";

    card.innerHTML = `
      <div>
        <div class="device-name">${device.label}</div>
        <div class="device-kind">${kindLabel}</div>
      </div>
      <button class="switch ${device.is_on ? "is-on" : ""}" type="button" data-device="${device.key}">
        ${device.is_on ? "Activo" : "Inactivo"}
      </button>
    `;
    deviceList.appendChild(card);
  });
}

function renderHistory(events) {
  historyList.innerHTML = "";
  if (!events.length) {
    historyList.innerHTML = '<div class="history-item"><span class="event-time">--:--</span><span class="event-message">Sin eventos todavia</span></div>';
    return;
  }

  events.forEach((event) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const actionEmoji = event.action.includes("encender") ? "+" : "-";
    const commandText = event.command || "Comando desconocido";

    item.innerHTML = `
      <span class="event-time">${event.created_at}</span>
      <span class="event-message">${actionEmoji} ${commandText} - ${event.message}</span>
    `;
    historyList.appendChild(item);
  });
}

async function loadDevices() {
  try {
    const response = await fetch("/api/devices/");
    const data = await response.json();
    renderDevices(data.devices);
  } catch (error) {
    console.error("Error cargando dispositivos:", error);
    showToast("Error al cargar dispositivos");
  }
}

async function loadHistory() {
  try {
    const response = await fetch("/api/history/");
    const data = await response.json();
    renderHistory(data.events);
  } catch (error) {
    console.error("Error cargando historial:", error);
  }
}

async function toggleDevice(deviceKey, forcedState = null) {
  let element = document.querySelector(`[data-device="${deviceKey}"].lamp-group`);
  if (!element) {
    element = document.querySelector(`[data-device="${deviceKey}"].control-btn`);
  }
  if (!element) {
    element = document.querySelector(`[data-device="${deviceKey}"]`);
  }

  if (!element) {
    console.warn(`No se encontro elemento para ${deviceKey}`);
    return;
  }

  const lamp = element.matches(".lamp, .lamp-bulb") ? element : element.querySelector(".lamp, .lamp-bulb");
  const currentState = lamp ? lamp.classList.contains("is-on") : element.classList.contains("is-on");
  const nextState = forcedState !== null ? forcedState : !currentState;

  try {
    const response = await fetch(`/api/devices/${deviceKey}/toggle/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({ is_on: nextState }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || data.error || "No se pudo enviar el comando");
      return;
    }

    setHotspotState(data.device);
    await loadDevices();
    await loadHistory();
    showToast(data.message || "Comando enviado");
  } catch (error) {
    console.error("Error al cambiar dispositivo:", error);
    showToast("Error de conexion");
  }
}

document.addEventListener("click", (event) => {
  let lampGroup = event.target.closest(".lamp-group[data-device]");
  if (lampGroup) {
    toggleDevice(lampGroup.dataset.device);
    return;
  }

  let button = event.target.closest("[data-device]");
  if (button && (button.classList.contains("control-btn") || button.classList.contains("switch"))) {
    toggleDevice(button.dataset.device);
    return;
  }
});

async function syncWeather() {
  try {
    const response = await fetch("/api/sync-weather/");
    const data = await response.json();
    if (response.ok) {
      console.log(data.message);
      await loadDevices();
      await loadHistory();
    }
  } catch (error) {
    console.error("Error sincronizando clima:", error);
  }
}

refreshButton.addEventListener("click", async () => {
  refreshButton.style.opacity = "0.6";
  await syncWeather();
  await loadDevices();
  await loadHistory();
  showToast("Estados y clima actualizados");
  refreshButton.style.opacity = "1";
});

loadDevices();
loadHistory();
syncWeather();
// Sync weather every 1 minute to keep it up to date
setInterval(syncWeather, 60000);
