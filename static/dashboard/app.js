import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const deviceList = document.querySelector("#deviceList");
const historyList = document.querySelector("#history");
const toast = document.querySelector("#toast");
const refreshButton = document.querySelector("#refresh");
const themeToggleBtn = document.querySelector("#themeToggle");

// --- Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SoundEngine = {
  playTone(freq, type, duration, vol) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  },
  
  click() {
    this.playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(800, 'sine', 0.1, 0.05), 50);
  },
  
  success() {
    this.playTone(440, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(554, 'sine', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(659, 'sine', 0.3, 0.1), 200);
  },
  
  error() {
    this.playTone(200, 'sawtooth', 0.2, 0.1);
    setTimeout(() => this.playTone(150, 'sawtooth', 0.3, 0.1), 150);
  }
};
// --------------------

const storedTheme = localStorage.getItem("theme");
if (storedTheme === "day") {
  document.body.classList.add("is-day");
}

themeToggleBtn?.addEventListener("click", () => {
  document.body.classList.toggle("is-day");
  const isDay = document.body.classList.contains("is-day");
  localStorage.setItem("theme", isDay ? "day" : "night");
});

const kindLabels = {
  light: "Luz",
  door: "Puerta",
  lock: "Cerradura",
  sensor: "Sensor",
  fan: "Ventilador",
};

// SVG icons for each device kind
const kindIcons = {
  light: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  door: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sensor: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/><circle cx="12" cy="12" r="4"/></svg>`,
  fan: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/></svg>`,
};

// Grouping configuration for remote sections
const sectionConfig = [
  { id: "lights", label: "Luces", kinds: ["light"] },
  { id: "access", label: "Accesos", kinds: ["door", "lock"] },
  { id: "other", label: "Otros", kinds: ["sensor", "fan"] },
];

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
  // Update old HTML buttons if any exist
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

  // Update Three.js model if loaded
  if (window.ThreeScene) {
    window.ThreeScene.updateDeviceState(device.key, device.is_on);
  }
}

function renderDevices(devices) {
  deviceList.innerHTML = "";

  sectionConfig.forEach((section) => {
    const sectionDevices = devices.filter((d) => section.kinds.includes(d.kind));
    if (sectionDevices.length === 0) return;

    // Section label
    const label = document.createElement("div");
    label.className = "remote-section-label";
    label.textContent = section.label;
    deviceList.appendChild(label);

    // Render each device as a remote button
    sectionDevices.forEach((device) => {
      setHotspotState(device);

      const btn = document.createElement("button");
      btn.className = `remote-btn${device.is_on ? " is-on" : ""}`;
      btn.setAttribute("data-device", device.key);
      btn.setAttribute("data-kind", device.kind);
      btn.type = "button";

      const icon = kindIcons[device.kind] || kindIcons.light;

      btn.innerHTML = `
        <div class="remote-btn-icon">${icon}</div>
        <span class="remote-btn-label">${device.label}</span>
      `;
      deviceList.appendChild(btn);
    });
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

    const isActionOn = event.action.includes("encender") || event.action.includes("abrir");
    const isActionOff = event.action.includes("apagar") || event.action.includes("cerrar");
    
    let badgeClass = "badge-info";
    let badgeText = "INFO";
    if (isActionOn) {
      badgeClass = "badge-on";
      badgeText = "ON";
    } else if (isActionOff) {
      badgeClass = "badge-off";
      badgeText = "OFF";
    }
    
    const commandText = event.command || "Comando desconocido";

    item.innerHTML = `
      <span class="event-time">${event.created_at}</span>
      <span class="event-message">
        <span class="badge ${badgeClass}">${badgeText}</span>
        ${commandText} - ${event.message}
      </span>
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

  SoundEngine.click();

  const lamp = element.matches(".lamp, .lamp-bulb") ? element : element.querySelector(".lamp, .lamp-bulb");
  const currentState = lamp ? lamp.classList.contains("is-on") : element.classList.contains("is-on");
  const nextState = forcedState !== null ? forcedState : !currentState;

  // Visual loading state
  element.classList.add("is-loading");

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
  } finally {
    element.classList.remove("is-loading");
  }
}

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

let wasConnected = null;
const systemConnection = document.getElementById("systemConnection");

async function checkSystemStatus() {
  try {
    const response = await fetch("/api/system/status/");
    const data = await response.json();
    
    if (!systemConnection) return;
    
    const dot = systemConnection.querySelector(".connection-dot");
    const text = systemConnection.querySelector("span:last-child");

    if (data.connected) {
      systemConnection.classList.remove("is-disconnected");
      dot.classList.remove("is-disconnected");
      text.textContent = "Conectado";
      
      if (wasConnected === false) {
        showToast("✅ Arduino Conectado");
        SoundEngine.success();
      }
      wasConnected = true;
    } else {
      systemConnection.classList.add("is-disconnected");
      dot.classList.add("is-disconnected");
      text.textContent = "Desconectado";
      
      if (wasConnected === true) {
        showToast("⚠️ Arduino Desconectado");
        SoundEngine.error();
      }
      wasConnected = false;
    }
  } catch (error) {
    console.error("Error al verificar conexion:", error);
  }
}

// Initial check and start polling every 5 seconds
checkSystemStatus();
setInterval(checkSystemStatus, 5000);

async function checkPhysicalState() {
  if (!wasConnected) return; // don't poll if disconnected
  
  try {
    const response = await fetch("/api/sync-physical/");
    const data = await response.json();
    
    if (data.status === "ok" && data.changed) {
      await loadDevices();
      await loadHistory();
    }
  } catch (error) {
    console.error("Error sincronizando estado físico:", error);
  }
}

// Poll physical state every 2 seconds
setInterval(checkPhysicalState, 2000);

// --- Three.js Integration ---
window.ThreeScene = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  model: null,
  meshes: {},
  mixers: [],
  clock: new THREE.Clock(),

  mapping: {
    "luz_habitacion_1": "led_room1",
    "luz_habitacion_2": "led_room2",
    "luz_sala": "led_sala",
    "luz_cocina": "led_kitchen",
    "luz_jardin": "led_exterior",
    "puerta": "door_main",
    "cerradura": "lock_door",
    "ventilador": "fan_blade", 
  },

  init() {
    const canvas = document.getElementById("three-canvas");
    if (!canvas) return;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    this.camera.position.set(0, 15, 15);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    this.scene.add(dirLight);

    // Load Model
    const loader = new GLTFLoader();
    loader.load('/static/dashboard/casa_domotica_blender.glb', (gltf) => {
      this.model = gltf.scene;
      
      this.model.traverse((child) => {
        // Ocultar planos de referencia exportados por error (ej. "Plano", "Plano.001")
        if (child.name.toLowerCase().startsWith("plano")) {
          child.visible = false;
        }
        
        this.meshes[child.name] = child;
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
               child.material = child.material.map(m => m.clone());
            } else {
               child.material = child.material.clone();
            }
          }
        }
      });
      
      // Center model
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      this.model.position.sub(center);
      
      this.scene.add(this.model);

      // --- Setup Door Pivot & Group ---
      let doorMain = null;
      this.model.traverse(child => {
        if (child.name.toLowerCase().includes("door_main")) {
           doorMain = child;
        }
      });

      if (doorMain && doorMain.parent) {
        const doorGroup = new THREE.Group();
        doorMain.parent.add(doorGroup);
        
        if (doorMain.geometry) {
           doorMain.geometry.computeBoundingBox();
           const localBox = doorMain.geometry.boundingBox;
           const hingeLocal = new THREE.Vector3(localBox.min.x, 0, 0);
           const hingeWorld = doorMain.localToWorld(hingeLocal);
           doorMain.parent.worldToLocal(hingeWorld);
           doorGroup.position.copy(hingeWorld);
        } else {
           const box = new THREE.Box3().setFromObject(doorMain);
           const hingeWorld = new THREE.Vector3(box.min.x, box.getCenter(new THREE.Vector3()).y, box.getCenter(new THREE.Vector3()).z);
           doorMain.parent.worldToLocal(hingeWorld);
           doorGroup.position.copy(hingeWorld);
        }
        
        const doorParts = [
          "door_main",
          "door_panel_lower",
          "door_panel_upper",
          "door_window_frame",
          "door_window_glass",
          "door_knob",
          "lock_door"
        ];
        
        const partsToAttach = [];
        this.model.traverse(child => {
           doorParts.forEach(partName => {
              if (child.name.toLowerCase().includes(partName.toLowerCase())) {
                 partsToAttach.push(child);
              }
           });
        });
        
        partsToAttach.forEach(part => {
           doorGroup.attach(part);
        });
        
        this.meshes["door_pivot"] = doorGroup;
      }

      // --- Setup Fan Group ---
      let motor = null;
      this.model.traverse(child => {
        if (child.name.toLowerCase().includes("fan_motor_body")) {
           motor = child;
        }
      });

      if (motor && motor.parent) {
         const fanGroup = new THREE.Group();
         motor.parent.add(fanGroup);
         
         const box = new THREE.Box3().setFromObject(motor);
         const motorCenter = box.getCenter(new THREE.Vector3());
         motor.parent.worldToLocal(motorCenter);
         fanGroup.position.copy(motorCenter);
         
         const fanParts = ["fan_motor_body", "fan_blade_0", "fan_blade_1", "fan_blade_2", "fan_blade_3"];
         const partsToAttach = [];
         this.model.traverse(child => {
           fanParts.forEach(partName => {
             if (child.name.toLowerCase().includes(partName.toLowerCase())) {
                partsToAttach.push(child);
             }
           });
         });
         
         partsToAttach.forEach(part => {
            fanGroup.attach(part);
         });
         
         this.meshes["fan_group"] = fanGroup;
      }
      
      // Re-apply states now that model is loaded
      loadDevices(); 
    }, undefined, (error) => {
      console.error("Error loading 3D model:", error);
    });

    // Resize handler
    window.addEventListener('resize', () => {
      if (!canvas.parentElement) return;
      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });

    // Click handler for raycasting
    canvas.addEventListener('pointerdown', (e) => this.onClick(e));

    this.animate();
  },

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    
    this.controls.update();
    
    // Animate fan if on
    const fanGroup = this.meshes["fan_group"];
    if (fanGroup && fanGroup.userData.isOn) {
       fanGroup.rotation.y += 10 * delta;
    } else if (!fanGroup) {
      // Fallback
      if (this.meshes["fan_motor_body"] && this.meshes["fan_motor_body"].userData.isOn) {
        this.meshes["fan_motor_body"].rotation.y += 10 * delta;
      }
      for (let i = 0; i < 4; i++) {
        const blade = this.meshes[`fan_blade_${i}`];
        if (blade && blade.userData.isOn) {
           blade.rotation.y += 10 * delta;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  },

  onClick(event) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      
      const meshName = clickedMesh.name.toLowerCase();
      if (meshName.includes("lock_door") || meshName.includes("wall_led_indicator")) {
         toggleDevice("cerradura");
         return;
      } else if (meshName.includes("door_")) {
         toggleDevice("puerta");
         return;
      } else if (meshName.includes("fan_")) {
         toggleDevice("ventilador");
         return;
      }
      
      // Find which device key maps to this mesh name
      let foundDeviceKey = null;
      for (const [key, mappingName] of Object.entries(this.mapping)) {
        if (meshName.includes(mappingName.toLowerCase())) {
          foundDeviceKey = key;
          break;
        }
      }

      if (foundDeviceKey) {
        toggleDevice(foundDeviceKey);
      }
    }
  },

  updateDeviceState(deviceKey, isOn) {
    const meshName = this.mapping[deviceKey];
    if (!meshName) return;

    if (deviceKey === "puerta") {
      const door = this.meshes["door_pivot"] || this.meshes[meshName];
      if (door) {
        // Rotación de la puerta (-90 grados para abrir hacia adentro)
        door.rotation.y = isOn ? -Math.PI / 2 : 0; 
      }
    } else if (deviceKey === "cerradura") {
      this.model.traverse(child => {
        if ((child.name.toLowerCase().includes("lock_door") || child.name.toLowerCase().includes("wall_led_indicator")) && child.isMesh) {
           const mats = Array.isArray(child.material) ? child.material : [child.material];
           mats.forEach(mat => {
              if (mat) {
                 if (isOn) {
                    mat.emissive.setHex(0xff3333);
                    mat.emissiveIntensity = 2;
                 } else {
                    mat.emissive.setHex(0x33ff33);
                    mat.emissiveIntensity = 1.5;
                 }
              }
           });
        }
      });
    } else if (deviceKey === "ventilador") {
      const fan = this.meshes["fan_group"];
      if (fan) fan.userData.isOn = isOn;
      
      if (this.meshes["fan_motor_body"]) this.meshes["fan_motor_body"].userData.isOn = isOn;
      for (let i = 0; i < 4; i++) {
        if (this.meshes[`fan_blade_${i}`]) this.meshes[`fan_blade_${i}`].userData.isOn = isOn;
      }
    } else {
      // Assume it's a light (led_room1, etc)
      const led = this.meshes[meshName];
      if (led && led.material) {
        if (isOn) {
          led.material.emissive.setHex(0xffaa00);
          led.material.emissiveIntensity = 2;
        } else {
          led.material.emissive.setHex(0x000000);
          led.material.emissiveIntensity = 0;
        }
      }
    }
  }
};

// Initialize Three.js scene
window.addEventListener('DOMContentLoaded', () => {
  window.ThreeScene.init();
});
