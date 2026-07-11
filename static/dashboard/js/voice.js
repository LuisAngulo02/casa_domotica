import { SoundEngine, showToast } from './utils.js';

// Espera ms milisegundos (usado entre pasos de comandos combinados como abrir cerradura + puerta)
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Escapa caracteres especiales de regex para poder usar un string arbitrario dentro de un RegExp
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Comprueba si `phrase` aparece en `text` como palabra/frase completa (con límites de palabra),
// no como substring suelto. Esto evita falsos positivos como "on" dentro de "habitacion".
function containsWholeWord(text, phrase) {
  if (!phrase) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}($|[^a-z0-9])`, "i");
  return pattern.test(text);
}

export const VoiceControl = {
  recognition: null,
  isListening: false,
  btn: null,
  led: null,
  toggleDeviceCallback: null,
  toggleAllLightsCallback: null,

  deviceSynonyms: {
    "luz_habitacion_1": ["habitacion 1", "habitacion uno", "cuarto 1", "cuarto uno", "luz 1", "dormitorio 1", "dormitorio uno"],
    "luz_habitacion_2": ["habitacion 2", "habitacion dos", "cuarto 2", "cuarto dos", "luz 2", "dormitorio 2", "dormitorio dos"],
    "luz_sala": ["luz sala", "luz de la sala", "luz salon", "luz del salon", "sala", "salon"],
    "luz_cocina": ["luz de la cocina", "luz cocina", "cocina"],
    "luz_bano": ["luz del bano", "luz del baño", "luz bano", "luz baño", "bano", "baño", "sanitario"],
    "luz_jardin": ["luz del jardin", "luz jardin", "jardin", "patio", "exterior", "luz exterior"],
    "puerta": ["puerta principal", "puerta de entrada", "puerta", "porton", "entrada"],
    "cerradura": ["cerradura", "seguro", "cerrojo", "candado", "llave"],
    "sensor_pir": ["sensor de movimiento", "sensor pir", "sensor"],
    "ventilador": ["ventilador de la sala", "ventilador sala", "ventilador", "aire", "abanico"],
    "modo_ventilador": ["ventilador automatico", "ventilador automatico", "modo automatico del ventilador", "modo automatico", "modo auto", "ventilador inteligente", "automatico del ventilador"]
  },

  onKeywords: ["encender", "prender", "conectar", "activar", "abrir", "enciende", "prende", "conecta", "activa", "abre", "on"],
  offKeywords: ["apagar", "desconectar", "desactivar", "cerrar", "apaga", "desconecta", "desactiva", "cierra", "off"],

  normalizeText(text) {
    if (!text) return "";
    return text.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/\s+/g, " ")            // Colapsar espacios múltiples
      .trim();
  },

  callToggleDevice(deviceKey, targetState, speed = null) {
    if (typeof this.toggleDeviceCallback !== "function") {
      return Promise.reject(new Error("toggleDeviceCallback no está configurado"));
    }
    return Promise.resolve(this.toggleDeviceCallback(deviceKey, targetState, speed));
  },

  callToggleAllLights(targetState) {
    if (typeof this.toggleAllLightsCallback !== "function") {
      return Promise.reject(new Error("toggleAllLightsCallback no está configurado"));
    }
    return Promise.resolve(this.toggleAllLightsCallback(targetState));
  },

  init(toggleDeviceCallback, toggleAllLightsCallback) {
    this.toggleDeviceCallback = toggleDeviceCallback;
    this.toggleAllLightsCallback = toggleAllLightsCallback;
    this.btn = document.getElementById("voiceBtn");
    this.led = document.getElementById("remoteLed");
    if (!this.btn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser.");
      this.btn.addEventListener("click", () => {
        SoundEngine.error();
        showToast("Tu navegador no soporta control por voz (usa Chrome o Edge)");
      });
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.btn.classList.add("is-listening");
      if (this.led) this.led.classList.add("is-listening");
      // Play a starting tone (Siri/Alexa-like high beep)
      SoundEngine.playTone(880, 'sine', 0.1, 0.05);
      setTimeout(() => SoundEngine.playTone(987, 'sine', 0.1, 0.05), 80);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.btn.classList.remove("is-listening");
      if (this.led) this.led.classList.remove("is-listening");
    };

    this.recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      this.isListening = false;
      this.btn.classList.remove("is-listening");
      if (this.led) this.led.classList.remove("is-listening");
      SoundEngine.error();

      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          showToast("Permiso de micrófono denegado");
          break;
        case 'network':
          showToast("Error de red. Brave bloquea esta función por privacidad. Usa Chrome/Edge o verifica http://localhost:8000");
          break;
        case 'no-speech':
          showToast("No se detectó voz, intenta de nuevo");
          break;
        case 'aborted':
          // Cancelado por el propio usuario o por la página; no hace falta alarmar
          break;
        default:
          showToast(`Error al escuchar: ${event.error}`);
      }
    };

    this.recognition.onresult = (event) => {
      const result = event.results && event.results[0] && event.results[0][0];
      if (!result || !result.transcript) {
        console.warn("Resultado de reconocimiento de voz vacío o inesperado", event);
        showToast("No se entendió, intenta de nuevo");
        return;
      }
      this.processCommand(result.transcript);
    };

    this.btn.addEventListener("click", () => {
      try {
        if (this.isListening) {
          this.recognition.stop();
        } else {
          this.recognition.start();
        }
      } catch (error) {
        // Puede lanzar InvalidStateError si se hace doble clic muy rápido
        console.error("Error al iniciar/detener reconocimiento de voz:", error);
        SoundEngine.error();
        showToast("No se pudo activar el micrófono, intenta de nuevo");
      }
    });
  },

  processCommand(rawSpeech) {
    const speech = this.normalizeText(rawSpeech);
    console.log(`Voz reconocida: "${rawSpeech}" (Normalizada: "${speech}")`);

    // --- Comandos Combinados Inteligentes (Cerradura + Puerta Principal) ---
    const openSynonyms = ["abrir todo", "abrir accesos", "abrir puerta y cerradura", "abrir la casa", "desbloquear entrada", "entrar a la casa", "abrir entrada"];
    const closeSynonyms = ["cerrar todo", "cerrar accesos", "cerrar puerta y cerradura", "cerrar la casa", "bloquear entrada", "asegurar entrada", "cerrar entrada"];

    const isCombinedOpen = openSynonyms.some((syn) => containsWholeWord(speech, this.normalizeText(syn)));
    const isCombinedClose = closeSynonyms.some((syn) => containsWholeWord(speech, this.normalizeText(syn)));

    if (isCombinedOpen) {
      showToast('Abriendo cerradura y puerta principal...');
      this.callToggleDevice("cerradura", false) // Desbloquear (seguro off)
        .then(() => wait(800)) // Esperar un instante
        .then(() => this.callToggleDevice("puerta", true)) // Abrir puerta
        .then(() => {
          SoundEngine.success();
        })
        .catch((err) => {
          console.error(err);
          SoundEngine.error();
          showToast("No se pudo completar la apertura");
        });
      return;
    }

    if (isCombinedClose) {
      showToast('Cerrando puerta principal y bloqueando cerradura...');
      this.callToggleDevice("puerta", false) // Cerrar puerta
        .then(() => wait(800)) // Esperar a que cierre
        .then(() => this.callToggleDevice("cerradura", true)) // Bloquear (seguro on)
        .then(() => {
          SoundEngine.success();
        })
        .catch((err) => {
          console.error(err);
          SoundEngine.error();
          showToast("No se pudo completar el cierre");
        });
      return;
    }

    // 1. Determine the target state (ON, OFF, or toggle/null)
    let targetState = null;
    const hasOn = this.onKeywords.some((keyword) => containsWholeWord(speech, keyword));
    const hasOff = this.offKeywords.some((keyword) => containsWholeWord(speech, keyword));

    if (hasOn && !hasOff) {
      targetState = true;
    } else if (hasOff && !hasOn) {
      targetState = false;
    }

    // 2. Identify target device
    let matchedDeviceKey = null;
    let longestMatchLength = 0;

    for (const [deviceKey, synonyms] of Object.entries(this.deviceSynonyms)) {
      for (const synonym of synonyms) {
        const normalizedSynonym = this.normalizeText(synonym);
        if (containsWholeWord(speech, normalizedSynonym)) {
          if (normalizedSynonym.length > longestMatchLength) {
            matchedDeviceKey = deviceKey;
            longestMatchLength = normalizedSynonym.length;
          }
        }
      }
    }

    // Check if the command refers to "all lights" or "everything"
    const isAllLights = containsWholeWord(speech, "todas las luces") ||
                        containsWholeWord(speech, "todas las habitaciones") ||
                        containsWholeWord(speech, "todo") ||
                        (containsWholeWord(speech, "luces") && matchedDeviceKey === null) ||
                        (containsWholeWord(speech, "luz") && matchedDeviceKey === null) ||
                        (containsWholeWord(speech, "todas") && matchedDeviceKey === null);

    if (isAllLights) {
      if (targetState !== null) {
        showToast(`Procesando: "${rawSpeech}" (Todas las luces)`);
        this.callToggleAllLights(targetState)
          .then(() => {
            SoundEngine.success();
          })
          .catch((err) => {
            console.error(err);
            SoundEngine.error();
            showToast("No se pudo actualizar las luces");
          });
      } else {
        // Alternar todas las luces
        const lightButtons = document.querySelectorAll('.remote-btn[data-kind="light"]');
        let anyLightOn = false;
        lightButtons.forEach((btn) => {
          if (btn.classList.contains('is-on')) anyLightOn = true;
        });
        const nextState = !anyLightOn;
        showToast(`Alternando todas las luces -> ${nextState ? "Encender" : "Apagar"}`);
        this.callToggleAllLights(nextState)
          .then(() => {
            SoundEngine.success();
          })
          .catch((err) => {
            console.error(err);
            SoundEngine.error();
            showToast("No se pudo actualizar las luces");
          });
      }
      return;
    }

    // Invertir lógica de cerradura para comandos de voz:
    // Decir "abrir cerradura" (targetState = true) significa desbloquear/abrir (is_on = false)
    // Decir "cerrar cerradura" (targetState = false) significa bloquear/cerrar (is_on = true)
    if (matchedDeviceKey === "cerradura" && targetState !== null) {
      targetState = !targetState;
    }

    if (matchedDeviceKey) {
      showToast(`Procesando: "${rawSpeech}"`);
      this.callToggleDevice(matchedDeviceKey, targetState)
        .then(() => {
          SoundEngine.success();
        })
        .catch((err) => {
          console.error(err);
          SoundEngine.error();
          showToast("No se pudo ejecutar el comando");
        });
    } else {
      SoundEngine.error();
      showToast(`No se entendió el comando: "${rawSpeech}"`);
    }
  }
};