# Código para Arduino (Casa Domótica)

Este código está diseñado para cargarse en tu placa Arduino (Uno, Mega, Nano, etc.) usando el **Arduino IDE**. Se encarga de escuchar los comandos a través del puerto Serie (enviados por el servidor Django) y activar o desactivar los componentes correspondientes.

### Requisitos de Hardware:
- LEDs para las luces de las habitaciones, baño, sala, cocina y jardín.
- 1 fotoresistor o módulo LDR digital para detectar día/noche (luces interiores).
- 1 sensor PIR para detectar movimiento (luz del jardín).
- 1 servomotor para simular la puerta.
- La cerradura y el ventilador pueden quedar desconectados por ahora.

### Código `sketch.ino`

```cpp
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

// --- Polaridad física de los LEDs ---
// Los LEDs de esta maqueta están cableados en lógica inversa (activo en LOW).
const int LED_ON = LOW;
const int LED_OFF = HIGH;

// --- Polaridad del sensor LDR ---
const bool LDR_HIGH_ES_LUZ = false;

// --- Polaridad del sensor PIR ---
const bool PIR_HIGH_ES_MOVIMIENTO = true;

// --- Tiempo de retención de la luz del jardín tras la última detección ---
// Evita que la luz parpadee por los pulsos naturales del PIR.
const unsigned long PIR_HOLD_MS = 5000; // 5 segundos, ajustable

// --- Tiempo de calibración del PIR al arrancar ---
// Los módulos PIR (ej. HC-SR501) necesitan estabilizarse; durante este
// tiempo se ignoran sus lecturas para evitar falsos positivos al iniciar.
const unsigned long PIR_WARMUP_MS = 30000; // 30 segundos

Servo doorServo;
bool doorOpen = false;
bool lastLightState = false;
bool exteriorOn = false;
unsigned long lastMotionMillis = 0;
unsigned long bootMillis = 0;

// Enciende/apaga SOLO las luces interiores (el jardín no depende del LDR).
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

// Devuelve true si el sensor detecta luz ambiental real, sin importar
// la polaridad física del módulo (eso lo resuelve LDR_HIGH_ES_LUZ).
bool hayLuzAmbiental() {
  bool rawHigh = digitalRead(PIN_LDR) == HIGH;
  return LDR_HIGH_ES_LUZ ? rawHigh : !rawHigh;
}

// Devuelve true si el sensor PIR detecta movimiento real, sin importar
// la polaridad física del módulo (eso lo resuelve PIR_HIGH_ES_MOVIMIENTO).
bool hayMovimiento() {
  bool rawHigh = digitalRead(PIN_PIR) == HIGH;
  return PIR_HIGH_ES_MOVIMIENTO ? rawHigh : !rawHigh;
}

void applyDayNightLogic() {
  bool hayLuz = hayLuzAmbiental();
  bool shouldBeOn = !hayLuz; // con luz -> apagado, sin luz -> encendido
  if (hayLuz != lastLightState) {
    setInteriorLights(shouldBeOn);
    lastLightState = hayLuz;
  }
}

void applyMotionLogic() {
  // Ignorar el PIR mientras se está calibrando al arrancar.
  if (millis() - bootMillis < PIR_WARMUP_MS) {
    return;
  }

  if (hayMovimiento()) {
    lastMotionMillis = millis();
    if (!exteriorOn) {
      setExteriorLight(true);
    }
  } else if (exteriorOn && (millis() - lastMotionMillis >= PIR_HOLD_MS)) {
    // Solo apaga si ya pasó el tiempo de retención sin nueva detección.
    setExteriorLight(false);
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

  pinMode(PIN_LDR, INPUT);
  pinMode(PIN_PIR, INPUT);

  doorServo.attach(PIN_DOOR);
  doorServo.write(0);
  doorOpen = false;

  // Interior: arranca apagado, luego se aplica la lógica del fotoresistor.
  setInteriorLights(false);
  lastLightState = hayLuzAmbiental();
  if (!lastLightState) { // sin luz al arrancar -> encender interior
    setInteriorLights(true);
  }

  // Jardín: arranca apagado; se enciende solo cuando el PIR detecte
  // movimiento real después del tiempo de calibración.
  setExteriorLight(false);
  bootMillis = millis();
  lastMotionMillis = millis();
}

void loop() {
  applyDayNightLogic();
  applyMotionLogic();

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
      digitalWrite(PIN_EXT, LED_ON);
      exteriorOn = true;
      Serial.println("OK");
    }
    else if (comando == "EXT_OFF") {
      digitalWrite(PIN_EXT, LED_OFF);
      exteriorOn = false;
      Serial.println("OK");
    }
    else if (comando == "DOOR_OPEN") {
      doorServo.write(90);
      doorOpen = true;
      Serial.println("OK");
    }
    else if (comando == "DOOR_CLOSE") {
      doorServo.write(0);
      doorOpen = false;
      Serial.println("OK");
    }
    else if (comando == "LOCK_ON" || comando == "LOCK_OFF" || comando == "FAN_ON" || comando == "FAN_OFF" || comando == "PIR_ON" || comando == "PIR_OFF") {
      // Aún no conectados (o de solo lectura, como el PIR): se acepta el comando
      // para no romper la comunicación con Django.
      Serial.println("OK");
    }
    else if (comando == "SYNC") {
      int ldrVal = hayLuzAmbiental() ? 1 : 0;
      int pirVal = hayMovimiento() ? 1 : 0;
      float tempC = 0.0;

      Serial.print("SYNC:");
      Serial.print(digitalRead(PIN_L1) == LED_ON ? 1 : 0); Serial.print(",");   // 0: luz_habitacion_1
      Serial.print(digitalRead(PIN_L2) == LED_ON ? 1 : 0); Serial.print(",");   // 1: luz_habitacion_2
      Serial.print(digitalRead(PIN_L3) == LED_ON ? 1 : 0); Serial.print(",");   // 2: luz_sala
      Serial.print(digitalRead(PIN_L4) == LED_ON ? 1 : 0); Serial.print(",");   // 3: luz_cocina
      Serial.print(digitalRead(PIN_BANO) == LED_ON ? 1 : 0); Serial.print(","); // 4: luz_bano
      Serial.print(digitalRead(PIN_EXT) == LED_ON ? 1 : 0); Serial.print(",");  // 5: luz_jardin
      Serial.print(doorOpen ? "1" : "0"); Serial.print(",");                    // 6: puerta
      Serial.print("0"); Serial.print(",");                                    // 7: cerradura (aún no conectada)
      Serial.print(pirVal); Serial.print(",");                                 // 8: sensor_pir
      Serial.print("0"); Serial.print(",");                                    // 9: ventilador (aún no conectado)
      Serial.print(ldrVal); Serial.print(",");                                 // 10: LDR
      Serial.println(tempC, 1);                                               // 11: temperatura
    }
    else {
      Serial.println("ERROR");
    }
  }
}
```
