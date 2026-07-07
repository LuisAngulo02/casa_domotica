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
const int PIN_L1 = 2;       // Habitación 1
const int PIN_L2 = 3;       // Habitación 2
const int PIN_L3 = 4;       // Sala
const int PIN_L4 = 5;       // Cocina
const int PIN_BANO = 6;     // Baño
const int PIN_EXT = 7;      // Jardín

// Definición de pines para otros componentes
const int PIN_LOCK = 8;     // Cerradura (Relé o LED)
const int PIN_DOOR = 9;     // Puerta Principal (Servomotor)
const int PIN_PIR_IND = 10; // Indicador de simulación PIR (LED)
const int PIN_FAN = 11;     // Ventilador de Sala (Relé o Transistor)

Servo doorServo;

void setup() {
  // Iniciar comunicación serial a los mismos baudios que Django
  Serial.begin(9600);
  
  // Configurar pines como salida
  pinMode(PIN_L1, OUTPUT);
  pinMode(PIN_L2, OUTPUT);
  pinMode(PIN_L3, OUTPUT);
  pinMode(PIN_L4, OUTPUT);
  pinMode(PIN_BANO, OUTPUT);
  pinMode(PIN_EXT, OUTPUT);
  pinMode(PIN_LOCK, OUTPUT);
  pinMode(PIN_PIR_IND, OUTPUT);
  pinMode(PIN_FAN, OUTPUT);
  
  // Adjuntar y posicionar el servomotor de la puerta
  doorServo.attach(PIN_DOOR);
  doorServo.write(0); // Posición inicial (Cerrada)
  
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
      Serial.println("OK");
    } 
    else if (comando == "DOOR_CLOSE") {
      doorServo.write(0); // Cerrar puerta (0 grados)
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
    else if (comando == "PIR_ON") {
      digitalWrite(PIN_PIR_IND, HIGH); // Encender indicador del PIR
      Serial.println("OK");
    } 
    else if (comando == "PIR_OFF") {
      digitalWrite(PIN_PIR_IND, LOW); // Apagar indicador del PIR
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
  digitalWrite(PIN_PIR_IND, LOW);
  digitalWrite(PIN_FAN, LOW);
}
```
