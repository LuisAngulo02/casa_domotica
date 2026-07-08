import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from './utils.js';

// Máximo delta de tiempo (segundos) permitido por frame de animación. Evita saltos bruscos
// en la puerta, el ventilador o las transiciones de luz cuando la pestaña estuvo en segundo
// plano y requestAnimationFrame se pausó por un buen rato.
const MAX_DELTA = 0.1;

// Distancia máxima (px) entre pointerdown y pointerup para considerarlo un "click" real
// y no el inicio de un arrastre de OrbitControls sobre un hotspot.
const CLICK_DRAG_THRESHOLD = 6;

export const ThreeScene = {
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
  toggleCallback: null,
  loadDevicesCallback: null,
  roomLights: {},
  initialized: false,
  pointerDownPos: null,
  pointerDownTime: 0,

  mapping: {
    "luz_habitacion_1": "led_room1",
    "luz_habitacion_2": "led_room2",
    "luz_sala": "led_sala",
    "luz_cocina": "led_kitchen",
    "luz_bano": "led_bath",
    "luz_jardin": "led_exterior",
    "puerta": "door_main",
    "cerradura": "lock_door",
    "ventilador": "fan_blade",
  },

  init(toggleCallback, loadDevicesCallback) {
    this.toggleCallback = toggleCallback;
    this.loadDevicesCallback = loadDevicesCallback;

    const canvas = document.getElementById("three-canvas");
    if (!canvas) return;

    // Evitar inicializar dos veces el mismo canvas (listeners duplicados, renderer duplicado)
    if (this.initialized) {
      console.warn("ThreeScene.init() ya fue llamado antes; se ignora la nueva inicialización.");
      return;
    }
    this.initialized = true;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (error) {
      console.error("No se pudo inicializar WebGL:", error);
      showToast("Tu navegador no soporta la vista 3D (WebGL no disponible)");
      this.initialized = false;
      return;
    }

    // Usamos siempre el tamaño del contenedor padre como fuente de verdad, tanto en la
    // inicialización como en el resize, para que el aspect ratio no "salte" en el primer resize.
    const getContainerSize = () => {
      const parent = canvas.parentElement;
      const width = (parent ? parent.clientWidth : canvas.clientWidth) || 1;
      const height = (parent ? parent.clientHeight : canvas.clientHeight) || 1;
      return { width, height };
    };

    const { width: initWidth, height: initHeight } = getContainerSize();

    this.renderer.setSize(initWidth, initHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, initWidth / initHeight, 0.1, 100);
    this.camera.position.set(0, 15, 15);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1;

    // Lights
    const isDay = document.body.classList.contains("is-day");

    const ambientLight = new THREE.AmbientLight(0xffffff, isDay ? 0.85 : 0.15);
    this.scene.add(ambientLight);
    this.ambientLight = ambientLight;
    this.ambientLight.userData = { targetIntensity: ambientLight.intensity };

    const dirLight = new THREE.DirectionalLight(isDay ? 0xffffff : 0x556699, isDay ? 1.1 : 0.2);
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
    this.dirLight = dirLight;
    this.dirLight.userData = {
      targetIntensity: dirLight.intensity,
      targetColor: isDay ? 0xffffff : 0x556699
    };

    // Load Model
    const loader = new GLTFLoader();
    loader.load('/static/dashboard/casa_domotica_blender.glb', (gltf) => {
      this.model = gltf.scene;
      this.roomLights = {}; // Initialize PointLights object
      this.meshes = {};     // Reiniciar por si el modelo se vuelve a cargar

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
        doorGroup.userData.targetY = 0; // Initialize smooth target
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

      // --- Create PointLights for rooms dynamic illumination ---
      for (const [deviceKey, meshName] of Object.entries(this.mapping)) {
        if (deviceKey.startsWith("luz_")) {
          const ledMesh = this.meshes[meshName];
          if (ledMesh) {
            const worldPos = new THREE.Vector3();
            ledMesh.getWorldPosition(worldPos);

            const lightPos = worldPos.clone();
            if (deviceKey !== "luz_jardin") {
              lightPos.y -= 0.6; // Adjust slightly below ceiling/LED mesh to cast light down
            } else {
              lightPos.y += 0.5; // Garden light exterior positioning
            }

            // PointLight(color, intensity, distance, decay) (más prominente)
            const pointLight = new THREE.PointLight(0xffffff, 0, 14, 0.8);
            pointLight.position.copy(lightPos);
            pointLight.castShadow = true;
            pointLight.shadow.bias = -0.001;
            pointLight.shadow.mapSize.width = 512;
            pointLight.shadow.mapSize.height = 512;
            pointLight.userData.targetIntensity = 0;

            this.scene.add(pointLight);
            this.roomLights[deviceKey] = pointLight;
          }
        }
      }

      // Re-apply states now that model is loaded
      if (typeof this.loadDevicesCallback === "function") {
        this.loadDevicesCallback();
      }
    }, undefined, (error) => {
      console.error("Error loading 3D model:", error);
      showToast("No se pudo cargar el modelo 3D de la casa");
    });

    // Resize handler (usa el tamaño del contenedor, igual que en la inicialización)
    window.addEventListener('resize', () => {
      if (!this.renderer || !this.camera) return;
      const { width, height } = getContainerSize();
      if (width <= 0 || height <= 0) return; // Evita aspect ratio NaN/Infinity si el canvas está oculto
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });

    // Distinguimos click de arrastre de cámara: solo se hace toggle si el puntero no se
    // movió más que CLICK_DRAG_THRESHOLD px entre el pointerdown y el pointerup.
    canvas.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerDownTime = performance.now();
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!this.pointerDownPos) return;

      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      this.pointerDownPos = null;

      if (distance <= CLICK_DRAG_THRESHOLD) {
        this.onClick(e);
      }
    });

    this.animate();
  },

  animate() {
    requestAnimationFrame(() => this.animate());

    // Clamp del delta para evitar saltos grandes tras pausas de la pestaña en segundo plano
    const delta = Math.min(this.clock.getDelta(), MAX_DELTA);

    if (!this.renderer || !this.scene || !this.camera) return;

    if (this.controls) this.controls.update();

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

    // Lerp ambient and directional lights for theme transitions
    if (this.ambientLight && this.ambientLight.userData.targetIntensity !== undefined) {
      const lerpFactor = 1 - Math.exp(-4 * delta);
      this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, this.ambientLight.userData.targetIntensity, lerpFactor);
    }
    if (this.dirLight && this.dirLight.userData.targetIntensity !== undefined) {
      const lerpFactor = 1 - Math.exp(-4 * delta);
      this.dirLight.intensity = THREE.MathUtils.lerp(this.dirLight.intensity, this.dirLight.userData.targetIntensity, lerpFactor);

      const currentHex = this.dirLight.color.getHex();
      const targetHex = this.dirLight.userData.targetColor;
      if (currentHex !== targetHex) {
        const targetColorObj = new THREE.Color(targetHex);
        this.dirLight.color.lerp(targetColorObj, lerpFactor);
      }
    }

    // Animate door smoothly (using frame-rate independent lerp)
    const door = this.meshes["door_pivot"];
    if (door && door.userData.targetY !== undefined) {
      const lerpFactor = 1 - Math.exp(-6 * delta);
      door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, door.userData.targetY, lerpFactor);
    }

    // Animate point lights intensity smoothly
    if (this.roomLights) {
      for (const [key, light] of Object.entries(this.roomLights)) {
        if (light.userData.targetIntensity !== undefined) {
          const lerpFactor = 1 - Math.exp(-8 * delta);
          light.intensity = THREE.MathUtils.lerp(light.intensity, light.userData.targetIntensity, lerpFactor);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  },

  onClick(event) {
    if (!this.renderer || !this.camera) return;

    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const meshName = (clickedMesh.name || "").toLowerCase();

      let targetKey = null;
      if (meshName.includes("lock_door") || meshName.includes("wall_led_indicator")) {
        targetKey = "cerradura";
      } else if (meshName.includes("door_")) {
        targetKey = "puerta";
      } else if (meshName.includes("fan_")) {
        targetKey = "ventilador";
      } else {
        // Find mapping
        for (const [key, mappingName] of Object.entries(this.mapping)) {
          if (meshName.includes(mappingName.toLowerCase())) {
            targetKey = key;
            break;
          }
        }
      }

      if (targetKey && typeof this.toggleCallback === "function") {
        this.toggleCallback(targetKey);
      }
    }
  },

  updateTheme(isDay) {
    if (!this.ambientLight || !this.dirLight) return;
    this.ambientLight.userData.targetIntensity = isDay ? 0.85 : 0.15;
    this.dirLight.userData.targetIntensity = isDay ? 1.1 : 0.2;
    this.dirLight.userData.targetColor = isDay ? 0xffffff : 0x556699;
  },

  // Aplica isOn/emissive a uno o varios materiales de forma segura, ya sea que
  // child.material sea un único Material o un array de Materials.
  _setEmissive(mesh, onColorHex, onIntensity, offColorHex, offIntensity, isOn) {
    if (!mesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
      if (!mat || !mat.emissive) return;
      if (isOn) {
        mat.emissive.setHex(onColorHex);
        mat.emissiveIntensity = onIntensity;
      } else {
        mat.emissive.setHex(offColorHex);
        mat.emissiveIntensity = offIntensity;
      }
    });
  },

  updateDeviceState(deviceKey, isOn) {
    const meshName = this.mapping[deviceKey];
    if (!meshName) return;

    if (deviceKey === "puerta") {
      const door = this.meshes["door_pivot"] || this.meshes[meshName];
      if (door) {
        // Rotación suave de la puerta (invertido el ángulo a Math.PI / 2 para abrir hacia adentro)
        door.userData.targetY = isOn ? Math.PI / 2 : 0;
      }
    } else if (deviceKey === "cerradura") {
      if (this.model) {
        this.model.traverse(child => {
          if ((child.name.toLowerCase().includes("lock_door") || child.name.toLowerCase().includes("wall_led_indicator")) && child.isMesh) {
            this._setEmissive(child, 0xff3333, 2, 0x33ff33, 1.5, isOn);
          }
        });
      }
    } else if (deviceKey === "ventilador") {
      const fan = this.meshes["fan_group"];
      if (fan) fan.userData.isOn = isOn;

      if (this.meshes["fan_motor_body"]) this.meshes["fan_motor_body"].userData.isOn = isOn;
      for (let i = 0; i < 4; i++) {
        if (this.meshes[`fan_blade_${i}`]) this.meshes[`fan_blade_${i}`].userData.isOn = isOn;
      }
    } else {
      // Assume it's a light (led_room1, etc)
      // Nota: se normaliza a array por si el mesh tiene múltiples materiales (antes esto
      // asumía un único Material y podía lanzar una excepción con multi-material).
      const led = this.meshes[meshName];
      this._setEmissive(led, 0xffffff, 4, 0x000000, 0, isOn);

      // Sincronizar el target de intensidad de las luces PointLight (más prominente)
      const pointLight = this.roomLights[deviceKey];
      if (pointLight) {
        pointLight.userData.targetIntensity = isOn ? (deviceKey === "luz_jardin" ? 5.5 : 4.5) : 0;
      }
    }
  }
};