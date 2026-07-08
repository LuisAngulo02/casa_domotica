export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const raw = parts.pop().split(";").shift();
    try {
      return decodeURIComponent(raw);
    } catch (error) {
      // Si el valor no está correctamente codificado, devolvemos el crudo en vez de romper
      return raw;
    }
  }
  return "";
}

let toastTimer = null;
export function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3000);
}

// --- Sound Engine ---
// El AudioContext se crea de forma perezosa (lazy) y protegida: algunos navegadores/webviews
// no lo soportan, y crearlo eagerly al importar el módulo rompería toda la carga de la app.
let audioCtx = null;

function getAudioContext() {
  if (audioCtx) return audioCtx;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.warn("Web Audio API no soportada en este navegador.");
    return null;
  }

  try {
    audioCtx = new AudioContextClass();
  } catch (error) {
    console.warn("No se pudo crear AudioContext:", error);
    audioCtx = null;
  }

  return audioCtx;
}

export const SoundEngine = {
  playTone(freq, type, duration, vol) {
    const ctx = getAudioContext();
    if (!ctx) return; // Sin soporte de audio: fallar en silencio, no romper la app

    if (ctx.state === "suspended") {
      ctx.resume().catch((error) => {
        console.warn("No se pudo reanudar el AudioContext:", error);
      });
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);

      // Liberar los nodos cuando termine el tono, para no acumular referencias
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (error) {
          // Ya pudieron haberse desconectado; no es crítico
        }
      };
    } catch (error) {
      console.warn("Error al reproducir tono:", error);
    }
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