from .models import DeviceState


DEFAULT_DEVICES = [
    ("luz_habitacion_1", "Habitacion 1", DeviceState.LIGHT),
    ("luz_habitacion_2", "Habitacion 2", DeviceState.LIGHT),
    ("luz_sala", "Sala", DeviceState.LIGHT),
    ("luz_cocina", "Cocina", DeviceState.LIGHT),
    ("luz_bano", "Baño", DeviceState.LIGHT),
    ("luz_jardin", "Jardin", DeviceState.LIGHT),
    ("puerta", "Puerta principal", DeviceState.DOOR),
    ("cerradura", "Cerradura", DeviceState.LOCK),
    ("sensor_pir", "Sensor PIR", DeviceState.SENSOR),
    ("ventilador", "Ventilador Sala", DeviceState.FAN),
]

DEVICE_COMMANDS = {
    "luz_habitacion_1": {"on": "L1_ON", "off": "L1_OFF"},
    "luz_habitacion_2": {"on": "L2_ON", "off": "L2_OFF"},
    "luz_sala": {"on": "L3_ON", "off": "L3_OFF"},
    "luz_cocina": {"on": "L4_ON", "off": "L4_OFF"},
    "luz_bano": {"on": "BANO_ON", "off": "BANO_OFF"},
    "luz_jardin": {"on": "EXT_ON", "off": "EXT_OFF"},
    "puerta": {"on": "DOOR_OPEN", "off": "DOOR_CLOSE"},
    "cerradura": {"on": "LOCK_ON", "off": "LOCK_OFF"},
    "sensor_pir": {"on": "PIR_ON", "off": "PIR_OFF"},
    "ventilador": {"on": "FAN_ON", "off": "FAN_OFF"},
}

SYNC_ORDER = [
    "luz_habitacion_1",
    "luz_habitacion_2",
    "luz_sala",
    "luz_cocina",
    "luz_bano",
    "luz_jardin",
    "puerta",
    "cerradura",
    "sensor_pir",
    "ventilador",
]
