# Casa Domótica Inteligente 🏠

Aplicación web moderna e interactiva para controlar una maqueta de casa domótica. Este proyecto integra hardware (Arduino UNO) y software (Django, Three.js) para ofrecer una experiencia visual en 3D y control avanzado mediante un panel y comandos de voz.

La explicación técnica completa de la arquitectura y el funcionamiento se encuentra en [DOCUMENTACION.md](DOCUMENTACION.md).

## ✨ Características Principales

*   **Maqueta 3D Interactiva:** Renderizado en tiempo real de la casa usando **Three.js**. Permite girar, acercar y seleccionar habitaciones.
*   **Control Remoto UI:** Panel de control con diseño *glassmorphism* responsivo (adaptable a móviles y tablets) para encender/apagar luces individuales, puertas, cerraduras, ventiladores y sensores.
*   **Control por Voz 🎤:** Integración con la *Web Speech API* para encender o apagar dispositivos mediante comandos hablados (ej. *"enciende la luz de la sala"*, *"apaga todas las luces"*).
*   **Gestión por Grupos:** Botones dedicados para encender o apagar todos los componentes simultáneamente.
*   **Feedback Visual y Auditorio:** Animaciones LED, notificaciones emergentes (toasts) y efectos de sonido al interactuar.
*   **Historial de Eventos:** Registro en tiempo real de todos los comandos ejecutados.
*   **Modo Simulación:** Desarrollo frontend sin necesidad de tener el Arduino conectado.
*   **Soporte Modo Claro/Oscuro:** Interfaz adaptable a la preferencia del usuario.

## 🚀 Tecnologías

*   **Backend:** Python 3, Django, PySerial (comunicación con Arduino), SQLite3.
*   **Frontend:** HTML5, Vanilla CSS3 (Custom Properties, CSS Grid/Flexbox), JavaScript ES6 (Módulos).
*   **Renderizado 3D:** Three.js.

## 🛠️ Instalación y Configuración (Buenas Prácticas)

Sigue estos pasos para configurar un entorno de desarrollo aislado (recomendado):

### 1. Clonar y preparar entorno virtual

Abre tu terminal y ejecuta:

```powershell
# 1. Ve a la carpeta del proyecto
cd casa_domotica

# 2. Crea un entorno virtual (venv) para aislar las dependencias
python -m venv .venv

# 3. Activa el entorno virtual
# En Windows (Powershell):
.\.venv\Scripts\Activate.ps1
# En Windows (CMD):
.venv\Scripts\activate.bat
# En Linux/Mac:
source .venv/bin/activate
```

### 2. Instalar dependencias

Con el entorno virtual activado, instala los paquetes requeridos:

```powershell
pip install -r requirements.txt
```

### 3. Base de Datos y Servidor

Prepara la base de datos local y levanta el servidor de desarrollo:

```powershell
# Aplicar migraciones iniciales de Django
python manage.py migrate

# Iniciar el servidor local
python manage.py runserver
```

### 4. Uso de la App

Abre tu navegador (se recomienda **Google Chrome** o **Microsoft Edge** para el control por voz) e ingresa a:
👉 `http://localhost:8000/`

> **Nota sobre el control por voz:** Es muy importante acceder a través de `localhost` en lugar de la IP `127.0.0.1`, ya que navegadores como Chrome requieren contextos seguros para habilitar el acceso al micrófono. Navegadores enfocados en privacidad estricta como **Brave** bloquean esta función por defecto.

## 🔌 Conexión con Arduino

El sistema soporta un modo "Simulación" para el desarrollo de software. Esto se controla en el archivo de configuración `domotica_project/settings.py`.

Mientras no tengas el hardware conectado:
*   Deja `ARDUINO_SIMULATION_MODE = True`. El sistema emulará respuestas en la consola del servidor.

**Cuando vayas a conectar la maqueta física:**
1.  Verifica en qué puerto USB se conectó tu Arduino (ej. `COM4` en Windows o `/dev/ttyUSB0` en Linux).
2.  Edita `domotica_project/settings.py` y ajusta `ARDUINO_SERIAL_PORT` a tu puerto correspondiente.
3.  Cambia `ARDUINO_SIMULATION_MODE = False`.
4.  Asegúrate de que el código del Arduino (`.ino`) esté diseñado para leer los siguientes comandos seriales terminados en salto de línea (`\n`):

### Comandos Soportados

*   Luces: `L1_ON`, `L1_OFF`, `L2_ON`, `L2_OFF`, `L3_ON`, `L3_OFF`, `L4_ON`, `L4_OFF`
*   Luz Exterior: `EXT_ON`, `EXT_OFF`
*   Puerta (Servo): `DOOR_OPEN`, `DOOR_CLOSE`
*   Cerradura Electromagnética: `LOCK_ON`, `LOCK_OFF`
*   Ventilador: `FAN_ON`, `FAN_OFF`
*   Sensor PIR (Estado simulado/controlado): `SENSOR_ON`, `SENSOR_OFF`

## 📁 Estructura del Proyecto

*   `dashboard/` - Aplicación principal de Django con la lógica del negocio (`views.py`, `services.py`).
*   `domotica_project/` - Configuración global del proyecto Django.
*   `static/dashboard/` - Archivos estáticos: CSS (`styles.css`), JavaScript (`app.js`, controladores) y modelos 3D.
*   `templates/dashboard/` - Vistas HTML.
*   `DOCUMENTACION.md` - Documentación técnica y arquitectura en detalle.

## 📝 Buenas Prácticas Aplicadas

1.  **Entornos Aislados:** Uso de `.venv` documentado e ignorado en `.gitignore` para prevenir problemas de dependencias.
2.  **Modularidad Frontend:** Uso de Clases de ES6 en `app.js` (`VoiceControl`, `ThreeScene`, `SoundEngine`) para encapsular la lógica.
3.  **UI/UX Responsivo:** Diseño fluido adaptativo (`clamp()`, Grid/Flexbox) que funciona en monitores ultra-anchos hasta teléfonos móviles pequeños.
4.  **Feedback de Usuario:** Estados visuales (botones *is-loading*, *is-on*) y manejo de errores proactivo (notificaciones Toast) para mantener al usuario informado en lugar de fallar silenciosamente.
5.  **Separación de Intereses (SoC):** La lógica de comunicación serial está desacoplada de las vistas HTTP mediante `services.py` y `serial_bridge.py`.
