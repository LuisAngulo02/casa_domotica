# Código para Arduino (Casa Domótica)

Este código está diseñado para cargarse en tu placa Arduino (Uno, Mega, Nano, etc.) usando el **Arduino IDE**. Se encarga de escuchar los comandos a través del puerto Serie (enviados por el servidor Django) y activar o desactivar los componentes correspondientes.

### Requisitos de Hardware:
- LEDs (para las luces de las habitaciones, baño, sala, cocina, jardín).
- 1 Servomotor (para simular la puerta).
- Módulo Relé o LEDs adicionales (para la cerradura, ventilador, y el indicador PIR).

### Código `sketch.ino`

```cpp
#include <Servo.h>

// Definición de pines para las luces (LEDs)
const int PIN_L1 = 3;       // Habitación 1 (LED)
const int PIN_L2 = 4;       // Habitación 2 (LED)
const int PIN_L3 = 5;       // Sala (LED)
const int PIN_L4 = 6;       // Cocina (LED)
const int PIN_BANO = 8;     // Baño (LED)
const int PIN_EXT = 10;     // Jardín / Exterior (LED)

// Definición de sensores (Entradas)
const int PIN_PIR = 2;      // Sensor de movimiento PIR (Entrada Digital)
const int PIN_LDR = 7;      // Fotoresistor (Entrada Digital o módulo D0)
const int PIN_TEMP = A0;    // Sensor de temperatura TMP36 (Entrada Analógica)

// Definición de actuadores adicionales (Salidas)
const int PIN_LOCK = 11;    // Cerradura electrónica (Relé o LED)
const int PIN_DOOR = 9;     // Puerta Principal (Servomotor)
const int PIN_FAN = 13;     // Ventilador de Sala (Motor DC o Relé)

Servo doorServo;
bool doorOpen = false;      // Estado de control del servomotor

void setup() {
  // Iniciar comunicación serial a los mismos baudios que Django
  Serial.begin(9600);
  
  // Configurar pines de salida (Actuadores)
  pinMode(PIN_L1, OUTPUT);
  pinMode(PIN_L2, OUTPUT);
  pinMode(PIN_L3, OUTPUT);
  pinMode(PIN_L4, OUTPUT);
  pinMode(PIN_BANO, OUTPUT);
  pinMode(PIN_EXT, OUTPUT);
  pinMode(PIN_LOCK, OUTPUT);
  pinMode(PIN_FAN, OUTPUT);

  // Configurar pines de entrada (Sensores)
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_LDR, INPUT);
  
  // Adjuntar y posicionar el servomotor de la puerta
  doorServo.attach(PIN_DOOR);
  doorServo.write(0); // Posición inicial (Cerrada)
  doorOpen = false;
  
  // Apagar todos los componentes al inicio
  apagarTodo();
}

void loop() {
  // Verificar si hay datos disponibles en el puerto serie
  if (Serial.available() > 0) {
    // Leer el comando hasta el salto de línea
    String comando = Serial.readStringUntil('\n');
    comando.trim(); // Eliminar espacios o retornos de carro invisibles
    
    // Procesar el comando recibido
    if (comando == "L1_ON") {
      digitalWrite(PIN_L1, HIGH);
      Serial.println("OK");
    } 
    else if (comando == "L1_OFF") {
      digitalWrite(PIN_L1, LOW);
      Serial.println("OK");
    }
    else if (comando == "L2_ON") {
      digitalWrite(PIN_L2, HIGH);
      Serial.println("OK");
    } 
    else if (comando == "L2_OFF") {
      digitalWrite(PIN_L2, LOW);
      Serial.println("OK");
    }
    else if (comando == "L3_ON") {
      digitalWrite(PIN_L3, HIGH);
      Serial.println("OK");
    } 
    else if (comando == "L3_OFF") {
      digitalWrite(PIN_L3, LOW);
      Serial.println("OK");
    }
    else if (comando == "L4_ON") {
      digitalWrite(PIN_L4, HIGH);
      Serial.println("OK");
    } 
    else if (comando == "L4_OFF") {
      digitalWrite(PIN_L4, LOW);
      Serial.println("OK");
    }
    else if (comando == "BANO_ON") {
      digitalWrite(PIN_BANO, HIGH);
      Serial.println("OK");
    } 
    else if (comando == "BANO_OFF") {
      digitalWrite(PIN_BANO, LOW);
      Serial.println("OK");
    }
    else if (comando == "EXT_ON") {
      digitalWrite(PIN_EXT, HIGH);
      Serial.println("OK");
    } 
    else if (comando == "EXT_OFF") {
      digitalWrite(PIN_EXT, LOW);
      Serial.println("OK");
    }
    else if (comando == "DOOR_OPEN") {
      doorServo.write(90); // Abrir puerta (90 grados)
      doorOpen = true;
      Serial.println("OK");
    } 
    else if (comando == "DOOR_CLOSE") {
      doorServo.write(0); // Cerrar puerta (0 grados)
      doorOpen = false;
      Serial.println("OK");
    }
    else if (comando == "LOCK_ON") {
      digitalWrite(PIN_LOCK, HIGH); // Activar cerradura
      Serial.println("OK");
    } 
    else if (comando == "LOCK_OFF") {
      digitalWrite(PIN_LOCK, LOW); // Desactivar cerradura
      Serial.println("OK");
    }
    else if (comando == "PIR_ON" || comando == "PIR_OFF") {
      // El PIR es un sensor físico de lectura, pero retornamos OK para compatibilidad
      Serial.println("OK");
    }
    else if (comando == "FAN_ON") {
      digitalWrite(PIN_FAN, HIGH); // Encender ventilador
      Serial.println("OK");
    } 
    else if (comando == "FAN_OFF") {
      digitalWrite(PIN_FAN, LOW); // Apagar ventilador
      Serial.println("OK");
    }
    else if (comando == "SYNC") {
      // Leer valores actuales de sensores físicos
      int pirState = digitalRead(PIN_PIR);
      int ldrVal = digitalRead(PIN_LDR); // HIGH (Noche/Oscuro), LOW (Día/Claro)
      
      // Medir temperatura con TMP36 (Analog A0)
      int sensorVal = analogRead(PIN_TEMP);
      float voltage = sensorVal * (5.0 / 1023.0);
      float tempC = (voltage - 0.5) * 100.0;
      
      // Retornar cadena SYNC con los 10 dispositivos principales (que incluye el PIR) más los otros 2 sensores (LDR y Temperatura)
      Serial.print("SYNC:");
      Serial.print(digitalRead(PIN_L1)); Serial.print(",");
      Serial.print(digitalRead(PIN_L2)); Serial.print(",");
      Serial.print(digitalRead(PIN_L3)); Serial.print(",");
      Serial.print(digitalRead(PIN_L4)); Serial.print(",");
      Serial.print(digitalRead(PIN_BANO)); Serial.print(",");
      Serial.print(digitalRead(PIN_EXT)); Serial.print(",");
      Serial.print(doorOpen ? "1" : "0"); Serial.print(",");
      Serial.print(digitalRead(PIN_LOCK)); Serial.print(",");
      Serial.print(pirState); Serial.print(",");
      Serial.print(digitalRead(PIN_FAN)); Serial.print(",");
      Serial.print(ldrVal); Serial.print(",");
      Serial.println(tempC, 1); // Envía ej. "23.4"
    }
    else {
      // Comando desconocido
      Serial.println("ERROR");
    }
  }
}

void apagarTodo() {
  digitalWrite(PIN_L1, LOW);
  digitalWrite(PIN_L2, LOW);
  digitalWrite(PIN_L3, LOW);
  digitalWrite(PIN_L4, LOW);
  digitalWrite(PIN_BANO, LOW);
  digitalWrite(PIN_EXT, LOW);
  digitalWrite(PIN_LOCK, LOW);
  digitalWrite(PIN_FAN, LOW);
  doorServo.write(0);
  doorOpen = false;
}
```
