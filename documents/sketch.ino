#include <Servo.h>

// Luces de la maqueta
const int PIN_L1 = 3;   // Habitación 1
const int PIN_L2 = 4;   // Habitación 2
const int PIN_L3 = 5;   // Sala
const int PIN_L4 = 6;   // Cocina
const int PIN_BANO = 8; // Baño
const int PIN_EXT = 10; // Jardín / Exterior

// Sensores y puerta
const int PIN_LDR = 11;  // Fotoresistor digital (controla SOLO luces interiores)
const int PIN_PIR = 13;  // Sensor de movimiento (controla SOLO la luz del jardín)
const int PIN_DOOR = 12; // Servo de la puerta
const int PIN_TMP36 = A1; // Sensor de temperatura TMP36 (analógico)
const int PIN_FAN = 9;    // Motor DC (ventilador) vía módulo de relé, canal In2
const int PIN_LOCK = 7;   // Cerradura solenoide vía módulo de relé, canal In1

// --- Polaridad física de los LEDs ---
// Los LEDs de esta maqueta están cableados en lógica inversa (activo en LOW).
const int LED_ON = LOW;
const int LED_OFF = HIGH;

// --- Polaridad del sensor LDR ---
const bool LDR_HIGH_ES_LUZ = false;

// --- Polaridad del sensor PIR ---
const bool PIR_HIGH_ES_MOVIMIENTO = true;

// --- Polaridad del módulo de relé (ventilador y cerradura) ---
// true  = activo en HIGH (HIGH activa el relé, LOW lo desactiva)
// false = activo en LOW  (LOW activa el relé, HIGH lo desactiva)  <-- tu módulo es este caso
const bool RELAY_ACTIVE_HIGH = false;

// --- Tiempo de retención de la luz del jardín tras la última detección ---
const unsigned long PIR_HOLD_MS = 5000; // 5 segundos, ajustable

// --- Tiempo de calibración del PIR al arrancar ---
const unsigned long PIR_WARMUP_MS = 30000; // 30 segundos

// --- Voltaje de referencia real del Arduino ---
const float VREF = 5.0;

// --- Umbrales de temperatura para el ventilador automático (con histéresis) ---
const float TEMP_ON = 31.0;  // °C a partir del cual se enciende el ventilador
const float TEMP_OFF = 26.0; // °C por debajo del cual se apaga

Servo doorServo;
bool doorOpen = false;
bool lastLightState = false;
bool exteriorOn = false;
bool manualOverride = false; // Override manual para la luz del jardín (PIR)
bool fanOn = false;
bool lockOn = false; // true = cerradura activada/abierta

// --- Modo del ventilador ---
// true  = MANUAL: el ventilador solo obedece a FAN_ON/FAN_OFF desde la web, ignora el sensor
// false = AUTO: el ventilador se controla solo por temperatura (TEMP_ON/TEMP_OFF)
bool fanManualMode = true; // Arranca en modo MANUAL por defecto

unsigned long lastMotionMillis = 0;
unsigned long bootMillis = 0;

void setInteriorLights(bool on) {
  digitalWrite(PIN_L1, on ? LED_ON : LED_OFF);
  digitalWrite(PIN_L2, on ? LED_ON : LED_OFF);
  digitalWrite(PIN_L3, on ? LED_ON : LED_OFF);
  digitalWrite(PIN_L4, on ? LED_ON : LED_OFF);
  digitalWrite(PIN_BANO, on ? LED_ON : LED_OFF);
}

void setExteriorLight(bool on) {
  digitalWrite(PIN_EXT, on ? LED_ON : LED_OFF);
  exteriorOn = on;
}

// Envía la señal correcta al módulo de relé sin importar su polaridad.
void writeRelay(int pin, bool on) {
  bool level = RELAY_ACTIVE_HIGH ? on : !on;
  digitalWrite(pin, level ? HIGH : LOW);
}

void setFan(bool on) {
  writeRelay(PIN_FAN, on);
  fanOn = on;
}

void setLock(bool on) {
  writeRelay(PIN_LOCK, on);
  lockOn = on;
}

bool hayLuzAmbiental() {
  bool rawHigh = digitalRead(PIN_LDR) == HIGH;
  return LDR_HIGH_ES_LUZ ? rawHigh : !rawHigh;
}

bool hayMovimiento() {
  bool rawHigh = digitalRead(PIN_PIR) == HIGH;
  return PIR_HIGH_ES_MOVIMIENTO ? rawHigh : !rawHigh;
}

float leerTemperatura() {
  int lectura = analogRead(PIN_TMP36);
  float voltaje = lectura * (VREF / 1023.0);
  float tempC = (voltaje - 0.5) * 100.0;
  return tempC;
}

void applyDayNightLogic() {
  bool hayLuz = hayLuzAmbiental();
  bool shouldBeOn = !hayLuz;
  if (hayLuz != lastLightState) {
    setInteriorLights(shouldBeOn);
    lastLightState = hayLuz;
  }
}

void applyMotionLogic() {
  if (manualOverride) {
    return;
  }
  if (millis() - bootMillis < PIR_WARMUP_MS) {
    return;
  }
  if (hayMovimiento()) {
    lastMotionMillis = millis();
    if (!exteriorOn) {
      setExteriorLight(true);
    }
  } else if (exteriorOn && (millis() - lastMotionMillis >= PIR_HOLD_MS)) {
    setExteriorLight(false);
  }
}

// Control del ventilador: si está en modo MANUAL, el sensor de temperatura
// se ignora por completo y solo manda la web (FAN_ON/FAN_OFF). Si está en
// modo AUTO, se controla solo por temperatura con histéresis.
void applyFanLogic() {
  if (fanManualMode) {
    return; // en manual, el sensor no toca el ventilador para nada
  }

  float tempC = leerTemperatura();

  if (!fanOn && tempC >= TEMP_ON) {
    setFan(true);
  } else if (fanOn && tempC <= TEMP_OFF) {
    setFan(false);
  }
}

void setup() {
  Serial.begin(9600);

  pinMode(PIN_L1, OUTPUT);
  pinMode(PIN_L2, OUTPUT);
  pinMode(PIN_L3, OUTPUT);
  pinMode(PIN_L4, OUTPUT);
  pinMode(PIN_BANO, OUTPUT);
  pinMode(PIN_EXT, OUTPUT);
  pinMode(PIN_FAN, OUTPUT);
  pinMode(PIN_LOCK, OUTPUT);

  pinMode(PIN_LDR, INPUT);
  pinMode(PIN_PIR, INPUT);

  doorServo.attach(PIN_DOOR);
  doorServo.write(120);
  doorOpen = false;

  setInteriorLights(false);
  lastLightState = hayLuzAmbiental();
  if (!lastLightState) {
    setInteriorLights(true);
  }

  setExteriorLight(false);
  bootMillis = millis();
  lastMotionMillis = millis();

  // Ventilador: arranca apagado y en modo MANUAL (controlado solo desde la web)
  setFan(false);
  fanManualMode = true;

  // Cerradura: arranca cerrada/desactivada
  setLock(false);
}

void loop() {
  applyDayNightLogic();
  applyMotionLogic();
  applyFanLogic();

  if (Serial.available() > 0) {
    String comando = Serial.readStringUntil('\n');
    comando.trim();

    if (comando == "L1_ON") {
      digitalWrite(PIN_L1, LED_ON);
      Serial.println("OK");
    }
    else if (comando == "L1_OFF") {
      digitalWrite(PIN_L1, LED_OFF);
      Serial.println("OK");
    }
    else if (comando == "L2_ON") {
      digitalWrite(PIN_L2, LED_ON);
      Serial.println("OK");
    }
    else if (comando == "L2_OFF") {
      digitalWrite(PIN_L2, LED_OFF);
      Serial.println("OK");
    }
    else if (comando == "L3_ON") {
      digitalWrite(PIN_L3, LED_ON);
      Serial.println("OK");
    }
    else if (comando == "L3_OFF") {
      digitalWrite(PIN_L3, LED_OFF);
      Serial.println("OK");
    }
    else if (comando == "L4_ON") {
      digitalWrite(PIN_L4, LED_ON);
      Serial.println("OK");
    }
    else if (comando == "L4_OFF") {
      digitalWrite(PIN_L4, LED_OFF);
      Serial.println("OK");
    }
    else if (comando == "BANO_ON") {
      digitalWrite(PIN_BANO, LED_ON);
      Serial.println("OK");
    }
    else if (comando == "BANO_OFF") {
      digitalWrite(PIN_BANO, LED_OFF);
      Serial.println("OK");
    }
    else if (comando == "EXT_ON") {
      setExteriorLight(true);
      manualOverride = true;
      Serial.println("OK");
    }
    else if (comando == "EXT_OFF") {
      setExteriorLight(false);
      manualOverride = false;
      Serial.println("OK");
    }
    else if (comando == "DOOR_OPEN") {
      doorServo.write(180);
      doorOpen = true;
      Serial.println("OK");
    }
    else if (comando == "DOOR_CLOSE") {
      doorServo.write(120);
      doorOpen = false;
      Serial.println("OK");
    }
    else if (comando == "FAN_ON") {
      fanManualMode = true; // forzar modo manual al usar control directo
      setFan(true);
      Serial.println("OK");
    }
    else if (comando == "FAN_OFF") {
      fanManualMode = true; // forzar modo manual al usar control directo
      setFan(false);
      Serial.println("OK");
    }
    else if (comando == "FAN_MODE_AUTO") {
      // Pasa a control automático por temperatura; applyFanLogic()
      // decidirá el estado según TEMP_ON/TEMP_OFF en el próximo loop().
      fanManualMode = false;
      Serial.println("OK");
    }
    else if (comando == "FAN_MODE_MANUAL") {
      // Pasa a control manual; el sensor deja de tocar el ventilador.
      fanManualMode = true;
      Serial.println("OK");
    }
    else if (comando == "LOCK_ON") {
      setLock(true);
      Serial.println("OK");
    }
    else if (comando == "LOCK_OFF") {
      setLock(false);
      Serial.println("OK");
    }
    else if (comando == "PIR_ON" || comando == "PIR_OFF") {
      Serial.println("OK");
    }
    else if (comando == "SYNC") {
      int ldrVal = hayLuzAmbiental() ? 1 : 0;
      int pirVal = hayMovimiento() ? 1 : 0;
      float tempC = leerTemperatura();

      Serial.print("SYNC:");
      Serial.print(digitalRead(PIN_L1) == LED_ON ? 1 : 0); Serial.print(",");
      Serial.print(digitalRead(PIN_L2) == LED_ON ? 1 : 0); Serial.print(",");
      Serial.print(digitalRead(PIN_L3) == LED_ON ? 1 : 0); Serial.print(",");
      Serial.print(digitalRead(PIN_L4) == LED_ON ? 1 : 0); Serial.print(",");
      Serial.print(digitalRead(PIN_BANO) == LED_ON ? 1 : 0); Serial.print(",");
      Serial.print(digitalRead(PIN_EXT) == LED_ON ? 1 : 0); Serial.print(",");
      Serial.print(doorOpen ? "1" : "0"); Serial.print(",");
      Serial.print(lockOn ? "1" : "0"); Serial.print(",");
      Serial.print(pirVal); Serial.print(",");
      Serial.print(fanOn ? "1" : "0"); Serial.print(",");
      Serial.print(fanManualMode ? "1" : "0"); Serial.print(","); // 10: modo ventilador (1=manual, 0=auto)
      Serial.print(ldrVal); Serial.print(",");
      Serial.println(tempC, 1);
    }
    else {
      Serial.println("ERROR");
    }
  }
}