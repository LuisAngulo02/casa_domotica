import { getCookie, showToast, SoundEngine } from './js/utils.js';
import { initModal, initSensorModal, initVoiceHelpModal } from './js/modal.js';
import { ThreeScene } from './js/three_scene.js';
import { VoiceControl } from './js/voice.js';

// Expose ThreeScene globally to keep compatibility with setHotspotState updates
window.ThreeScene = ThreeScene;

const deviceList = document.querySelector("#deviceList");
const historyList = document.querySelector("#history");
const refreshButton = document.querySelector("#refresh");
const themeToggleBtn = document.querySelector("#themeToggle");

// --- Small utilities ---

// Escapa HTML para evitar inyección cuando insertamos texto dinámico con innerHTML
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Fetch con timeout para no dejar peticiones colgadas si el backend/Arduino no responde
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Envuelve fetch + parseo de JSON validando response.ok, para no repetir el patrón en cada función
async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  let data = null;
  try {
    data = await response.json();
  } catch (parseError) {
    // El servidor pudo haber devuelto HTML de error en vez de JSON
    data = null;
  }
  if (!response.ok) {
    const message = (data && (data.message || data.error)) || `Error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// --- Theme Management ---
const storedTheme = localStorage.getItem("theme");
if (storedTheme === "day") {
  document.body.classList.add("is-day");
}

themeToggleBtn?.addEventListener("click", () => {
  document.body.classList.toggle("is-day");
  const isDay = document.body.classList.contains("is-day");
  localStorage.setItem("theme", isDay ? "day" : "night");

  // Desactivar auto-theme por preferencia manual del usuario
  localStorage.setItem("autoTheme", "false");
  const autoToggle = document.getElementById("auto-theme-toggle");
  if (autoToggle) autoToggle.checked = false;

  if (window.ThreeScene && typeof window.ThreeScene.updateTheme === "function") {
    window.ThreeScene.updateTheme(isDay);
  }
});

// --- Constants & Config ---
const kindIcons = {
  light: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  door: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sensor: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/><circle cx="12" cy="12" r="4"/></svg>`,
  fan: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/></svg>`,
  fan_mode: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

const sectionConfig = [
  { id: "lights", label: "Luces", kinds: ["light"] },
  { id: "access", label: "Accesos", kinds: ["door", "lock"] },
  { id: "other", label: "Otros", kinds: ["fan"] },
];

// Dispositivos que actualmente tienen una petición de toggle en curso.
// Evita que doble-clic o clics repetidos disparen múltiples requests simultáneos.
const pendingToggles = new Set();

// --- Device State Synchronization ---
function setHotspotState(device) {
  if (!device || !device.key) return;

  // Update old HTML buttons or indicators if they exist
  const deviceElements = document.querySelectorAll(`[data-device="${device.key}"]`);
  deviceElements.forEach((element) => {
    element.classList.toggle("is-on", !!device.is_on);

    const lamps = element.matches(".lamp, .lamp-bulb")
      ? [element]
      : element.querySelectorAll(".lamp, .lamp-bulb");

    lamps.forEach((lamp) => {
      lamp.classList.toggle("is-on", !!device.is_on);
    });
  });

  // Update Three.js model
  if (window.ThreeScene && window.ThreeScene.model && typeof window.ThreeScene.updateDeviceState === "function") {
    window.ThreeScene.updateDeviceState(device.key, !!device.is_on, device.speed);
  }

  // Update PIR motion alert banner and remote screen indicators
  if (device.key === "sensor_pir") {
    const pirAlert = document.getElementById("pirAlert");
    if (pirAlert) {
      pirAlert.classList.toggle("is-active", !!device.is_on);
    }

    const miniPir = document.getElementById("mini-pir");
    const miniPirVal = document.getElementById("mini-pir-val");
    if (miniPirVal) {
      miniPirVal.textContent = device.is_on ? "Alerta" : "Libre";
    }
    if (miniPir) {
      miniPir.className = "remote-sensor-mini " + (device.is_on ? "is-active" : "");
    }

    // Actualizar Panel de Monitoreo de Sensores
    const pirStatus = document.getElementById("pir-status-value");
    const pirLastTime = document.getElementById("pir-last-time");
    if (pirStatus) {
      pirStatus.textContent = device.is_on ? "Presencia Detectada" : "Sin presencia";
      pirStatus.className = "sensor-badge " + (device.is_on ? "is-active" : "");
    }
    if (device.is_on && pirLastTime) {
      const now = new Date();
      pirLastTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  // Sincronizar el estado del ventilador y su modo automático en el modal de sensores
  if (device.key === "modo_ventilador") {
    const fanAutoToggle = document.getElementById("modal-fan-auto-toggle");
    if (fanAutoToggle) {
      fanAutoToggle.checked = !!device.is_on;
    }
  }

  if (device.key === "ventilador") {
    const fanStatus = document.getElementById("modal-fan-status-value");
    if (fanStatus) {
      fanStatus.textContent = device.is_on ? "Activo" : "Inactivo";
      fanStatus.className = "sensor-badge " + (device.is_on ? "is-active" : "");
    }
  }
}

function renderDevices(devices) {
  if (!deviceList) return;
  if (!Array.isArray(devices)) {
    console.warn("renderDevices: se esperaba un array de dispositivos", devices);
    return;
  }

  deviceList.innerHTML = "";

  sectionConfig.forEach((section) => {
    const sectionDevices = devices.filter((d) => section.kinds.includes(d.kind));
    if (sectionDevices.length === 0) return;

    // Section label
    const label = document.createElement("div");
    label.className = "remote-section-label";
    label.textContent = section.label;
    deviceList.appendChild(label);

    // Cada sección se envuelve en su propio contenedor para poder darle
    // una forma distinta por CSS (grid de luces, "rocker" de accesos, etc.)
    // sin tener que tocar de nuevo el JS más adelante.
    const group = document.createElement("div");
    group.className = "remote-section-group";
    group.setAttribute("data-section", section.id);
    deviceList.appendChild(group);

    // Render each device as a remote button
    sectionDevices.forEach((device) => {
      setHotspotState(device);

      const btn = document.createElement("button");
      btn.className = `remote-btn${device.is_on ? " is-on" : ""}`;
      btn.setAttribute("data-device", device.key);
      btn.setAttribute("data-kind", device.kind);
      btn.type = "button";

      const icon = kindIcons[device.kind] || kindIcons.light;

      // El icono es SVG estático y confiable; el label del dispositivo puede venir
      // del backend, así que se escapa antes de insertarlo con innerHTML.
      btn.innerHTML = `
        <div class="remote-btn-icon">${icon}</div>
        <span class="remote-btn-label">${escapeHtml(device.label)}</span>
      `;
      group.appendChild(btn);
    });
  });
}

function renderHistory(events) {
  if (!historyList) return;
  historyList.innerHTML = "";

  if (!Array.isArray(events) || events.length === 0) {
    historyList.innerHTML = '<div class="history-item"><span class="event-time">--:--</span><span class="event-message">Sin eventos todavía</span></div>';
    return;
  }

  events.forEach((event) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const action = event.action || "";
    const isActionOn = action.includes("encender") || action.includes("abrir");
    const isActionOff = action.includes("apagar") || action.includes("cerrar");

    let badgeClass = "badge-info";
    let badgeText = "INFO";
    if (isActionOn) {
      badgeClass = "badge-on";
      badgeText = "ON";
    } else if (isActionOff) {
      badgeClass = "badge-off";
      badgeText = "OFF";
    }

    // created_at y message pueden venir del backend: se escapan por seguridad
    item.innerHTML = `
      <span class="event-time">${escapeHtml(event.created_at)}</span>
      <span class="event-message">
        <span class="badge ${badgeClass}">${badgeText}</span>
        ${escapeHtml(event.message)}
      </span>
    `;
    historyList.appendChild(item);
  });
}

async function loadDevices() {
  try {
    const data = await fetchJson("/api/devices/");
    renderDevices(data.devices);
    // Asegurar que el estado del sensor_pir y otros dispositivos no visibles en el control remoto se actualice
    data.devices.forEach((device) => {
      setHotspotState(device);
    });
  } catch (error) {
    console.error("Error cargando dispositivos:", error);
    showToast("Error al cargar dispositivos");
  }
}

async function loadHistory() {
  try {
    const data = await fetchJson("/api/history/");
    renderHistory(data.events);
  } catch (error) {
    console.error("Error cargando historial:", error);
  }
}

async function toggleDevice(deviceKey, forcedState = null, speed = null) {
  if (!deviceKey) return Promise.reject(new Error("deviceKey es requerido"));

  // Evita disparar el mismo toggle dos veces mientras la petición anterior sigue en curso
  if (pendingToggles.has(deviceKey)) {
    return Promise.reject(new Error("Acción ya en curso para este dispositivo"));
  }

  let element = document.querySelector(`[data-device="${deviceKey}"].lamp-group`);
  if (!element) {
    element = document.querySelector(`[data-device="${deviceKey}"].control-btn`);
  }
  if (!element) {
    element = document.querySelector(`[data-device="${deviceKey}"]`);
  }

  if (!element) {
    console.warn(`No se encontró elemento para ${deviceKey}`);
    return Promise.reject(new Error(`Dispositivo ${deviceKey} no encontrado`));
  }

  const lamp = element.matches(".lamp, .lamp-bulb") ? element : element.querySelector(".lamp, .lamp-bulb");
  const currentState = lamp ? lamp.classList.contains("is-on") : element.classList.contains("is-on");
  const nextState = forcedState !== null ? forcedState : !currentState;

  // Regla de seguridad cliente: no permitir abrir la puerta si la cerradura está bloqueada
  if (deviceKey === "puerta" && nextState === true) {
    const lockBtn = document.querySelector('[data-device="cerradura"]');
    const isLocked = lockBtn ? lockBtn.classList.contains("is-on") : false;
    if (isLocked) {
      SoundEngine.error();
      showToast("⚠️ Puerta bloqueada por la cerradura electrónica");
      return Promise.reject(new Error("La puerta está bloqueada por la cerradura"));
    }
  }

  SoundEngine.click();

  pendingToggles.add(deviceKey);
  element.classList.add("is-loading");

  try {
    const data = await fetchJson(`/api/devices/${deviceKey}/toggle/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({ is_on: nextState, speed: speed }),
    });

    setHotspotState(data.device);
    await loadDevices();
    await loadHistory();
    showToast(data.message || "Comando enviado");
  } catch (error) {
    console.error("Error al cambiar dispositivo:", error);
    showToast(error.message || "Error de conexión");
    throw error; // Rethrow to reject the outer promise!
  } finally {
    element.classList.remove("is-loading");
    pendingToggles.delete(deviceKey);
  }
}

async function toggleAllLights(targetState) {
  // Se leen las luces directamente del DOM renderizado (data-kind="light")
  // para no depender de una lista hardcodeada que puede desincronizarse del backend.
  const renderedLightKeys = Array.from(document.querySelectorAll('[data-kind="light"][data-device]'))
    .map((el) => el.getAttribute("data-device"));

  // Fallback por si el DOM todavía no se renderizó (p.ej. antes de la primera carga)
  const fallbackLightKeys = [
    "luz_habitacion_1",
    "luz_habitacion_2",
    "luz_sala",
    "luz_cocina",
    "luz_bano",
    "luz_jardin",
  ];

  const lightKeys = renderedLightKeys.length > 0 ? renderedLightKeys : fallbackLightKeys;

  const results = await Promise.allSettled(
    lightKeys.map((key) =>
      fetchJson(`/api/devices/${key}/toggle/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ is_on: targetState }),
      })
    )
  );

  let successCount = 0;
  let failureCount = 0;

  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value && result.value.device) {
      setHotspotState(result.value.device);
      successCount += 1;
    } else {
      failureCount += 1;
      if (result.status === "rejected") {
        console.error("Error al cambiar una luz:", result.reason);
      }
    }
  });

  await loadDevices();
  await loadHistory();

  if (failureCount === 0) {
    showToast(targetState ? "Todas las luces encendidas" : "Todas las luces apagadas");
  } else if (successCount === 0) {
    showToast("Error de conexión al actualizar luces");
  } else {
    showToast(`Se actualizaron ${successCount} luces, ${failureCount} fallaron`);
  }
}

async function syncWeather() {
  try {
    const isAutoTheme = localStorage.getItem("autoTheme") !== "false";
    const data = await fetchJson(`/api/sync-weather/?auto_theme=${isAutoTheme}`);

    console.log(data.message);

    // Conmutar tema automáticamente simulando la fotoresistencia (LDR) si está activo
    const isNight = data.is_night;

    if (isAutoTheme) {
      document.body.classList.toggle("is-day", !isNight);
      localStorage.setItem("theme", isNight ? "night" : "day");
      if (window.ThreeScene && typeof window.ThreeScene.updateTheme === "function") {
        window.ThreeScene.updateTheme(!isNight);
      }
    }

    // Actualizar pantalla/barra de sensores en el control remoto
    const miniLdr = document.getElementById("mini-ldr");
    const miniLdrVal = document.getElementById("mini-ldr-val");
    if (miniLdrVal) {
      miniLdrVal.textContent = isNight ? "Noche" : "Día";
    }
    if (miniLdr) {
      miniLdr.className = "remote-sensor-mini " + (isNight ? "is-active" : "is-success");
    }

    const miniTemp = document.getElementById("mini-temp");
    const miniTempVal = document.getElementById("mini-temp-val");
    if (miniTempVal && typeof data.temperature === "number" && !Number.isNaN(data.temperature)) {
      miniTempVal.textContent = `${data.temperature.toFixed(1)} °C`;
    }
    if (miniTemp && typeof data.temperature === "number" && !Number.isNaN(data.temperature)) {
      let tempClass = "remote-sensor-mini";
      if (data.temperature < 18) {
        tempClass += " is-success";
      } else if (data.temperature >= 26) {
        tempClass += " is-active";
      }
      miniTemp.className = tempClass;
    }

    // Actualizar información de Fotoresistencia (LDR) en el panel de sensores
    const ldrStatus = document.getElementById("ldr-status-value");
    const ldrIconDay = document.getElementById("ldr-icon-day");
    const ldrIconNight = document.getElementById("ldr-icon-night");
    if (ldrStatus) {
      ldrStatus.textContent = isNight ? "Noche - Oscuro" : "Día - Soleado";
      ldrStatus.className = "sensor-badge " + (isNight ? "is-active" : "is-success");
    }
    if (ldrIconDay && ldrIconNight) {
      ldrIconDay.style.display = isNight ? "none" : "block";
      ldrIconNight.style.display = isNight ? "block" : "none";
    }

    // Actualizar información de Temperatura (TMP36) en el panel de sensores
    const tempStatus = document.getElementById("temp-status-value");
    const tempLabel = document.getElementById("temp-label-value");
    if (tempStatus && typeof data.temperature === "number" && !Number.isNaN(data.temperature)) {
      tempStatus.textContent = `${data.temperature.toFixed(1)} °C`;

      let label = "Normal";
      let badgeClass = "sensor-badge";
      if (data.temperature < 18) {
        label = "Fresco / Frío";
        badgeClass += " is-success";
      } else if (data.temperature >= 26) {
        label = "Caluroso / Motor DC Activo";
        badgeClass += " is-active";
      }

      tempStatus.className = badgeClass;
      if (tempLabel) {
        tempLabel.textContent = label;
      }
    }

    await loadDevices();
    await loadHistory();
  } catch (error) {
    console.error("Error sincronizando clima:", error);
  }
}

let wasConnected = null;
const systemConnection = document.getElementById("systemConnection");

async function checkSystemStatus() {
  try {
    const data = await fetchJson("/api/system/status/", {}, 15000);

    if (!systemConnection) return;

    const dot = systemConnection.querySelector(".connection-dot");
    const text = systemConnection.querySelector("span:last-child");

    if (data.connected) {
      systemConnection.classList.remove("is-disconnected");
      dot?.classList.remove("is-disconnected");
      if (text) text.textContent = "Conectado";

      if (wasConnected === false) {
        showToast("✅ Arduino Conectado");
        SoundEngine.success();
      }
      wasConnected = true;
    } else {
      systemConnection.classList.add("is-disconnected");
      dot?.classList.add("is-disconnected");
      if (text) text.textContent = "Desconectado";

      if (wasConnected === true) {
        showToast("⚠️ Arduino Desconectado");
        SoundEngine.error();
      }
      wasConnected = false;
    }
  } catch (error) {
    if (error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      console.warn("Verificación de conexión agotó el tiempo de espera");
      wasConnected = false;
      return;
    }

    console.error("Error al verificar conexión:", error);
    // Si ni siquiera pudimos consultar el estado, asumimos desconexión para no
    // seguir sondeando el estado físico contra un backend que no responde.
    wasConnected = false;
  }
}

async function checkPhysicalState() {
  if (wasConnected === false) return; // don't poll if we already know it is disconnected

  try {
    const data = await fetchJson("/api/sync-physical/");

    if (data.status === "ok" && data.changed) {
      await loadDevices();
      await loadHistory();
      await syncWeather();
    }
  } catch (error) {
    console.error("Error sincronizando estado físico:", error);
  }
}

// --- Event Handlers & Delegation ---
document.addEventListener("click", (event) => {
  let lampGroup = event.target.closest(".lamp-group[data-device]");
  if (lampGroup) {
    toggleDevice(lampGroup.dataset.device);
    return;
  }

  let button = event.target.closest("[data-device]");
  if (button && (button.classList.contains("control-btn") || button.classList.contains("switch") || button.classList.contains("remote-btn"))) {
    toggleDevice(button.dataset.device);
    return;
  }
});

refreshButton?.addEventListener("click", async () => {
  if (refreshButton.disabled) return; // evita clics repetidos mientras refresca

  refreshButton.disabled = true;
  refreshButton.style.opacity = "0.6";
  try {
    await syncWeather();
    await loadDevices();
    await loadHistory();
    showToast("Estados y clima actualizados");
  } finally {
    refreshButton.disabled = false;
    refreshButton.style.opacity = "1";
  }
});

// --- Polling intervals (se pausan cuando la pestaña no está visible) ---
let weatherIntervalId = null;
let systemStatusIntervalId = null;
let physicalStateIntervalId = null;

function startPolling() {
  stopPolling();
  weatherIntervalId = setInterval(syncWeather, 60000);       // Poll weather every 1 minute
  systemStatusIntervalId = setInterval(checkSystemStatus, 5000);  // Check Arduino connection every 5s
  physicalStateIntervalId = setInterval(checkPhysicalState, 2000); // Poll Arduino physical state changes every 2s
}

function stopPolling() {
  if (weatherIntervalId) clearInterval(weatherIntervalId);
  if (systemStatusIntervalId) clearInterval(systemStatusIntervalId);
  if (physicalStateIntervalId) clearInterval(physicalStateIntervalId);
  weatherIntervalId = null;
  systemStatusIntervalId = null;
  physicalStateIntervalId = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopPolling();
  } else {
    // Al volver a la pestaña, refrescamos de inmediato y reanudamos el sondeo
    checkSystemStatus();
    loadDevices();
    loadHistory();
    startPolling();
  }
});

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  // Init modules
  ThreeScene.init(toggleDevice, loadDevices);
  VoiceControl.init(toggleDevice, toggleAllLights);
  initModal(loadHistory);
  initSensorModal();
  initVoiceHelpModal();

  // Configurar el checkbox del auto-theme basado en localStorage
  const autoToggle = document.getElementById("auto-theme-toggle");
  if (autoToggle) {
    autoToggle.checked = localStorage.getItem("autoTheme") !== "false";
    autoToggle.addEventListener("change", (e) => {
      localStorage.setItem("autoTheme", e.target.checked ? "true" : "false");
      if (e.target.checked) {
        syncWeather(); // Sincronización inmediata al activar
      }
    });
  }

  // Configurar el checkbox de Ventilador Automático (modo_ventilador) en el modal de sensores
  const fanAutoToggle = document.getElementById("modal-fan-auto-toggle");
  if (fanAutoToggle) {
    fanAutoToggle.addEventListener("change", async () => {
      try {
        await toggleDevice("modo_ventilador");
      } catch (err) {
        console.error("Error al conmutar modo del ventilador:", err);
        fanAutoToggle.checked = !fanAutoToggle.checked;
      }
    });
  }

  // Initial updates
  loadDevices();
  loadHistory();
  syncWeather();
  checkSystemStatus();
  checkPhysicalState();

  // Set up intervals
  startPolling();
});