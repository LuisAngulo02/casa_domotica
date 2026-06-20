from .models import DeviceState


DEFAULT_DEVICES = [
    ("luz_habitacion_1", "Habitacion 1", DeviceState.LIGHT),
    ("luz_habitacion_2", "Habitacion 2", DeviceState.LIGHT),
    ("luz_sala", "Sala", DeviceState.LIGHT),
    ("luz_cocina", "Cocina", DeviceState.LIGHT),
    ("luz_jardin", "Jardin", DeviceState.LIGHT),
    ("puerta", "Puerta principal", DeviceState.DOOR),
    ("cerradura", "Cerradura", DeviceState.LOCK),
]

DEVICE_COMMANDS = {
    "luz_habitacion_1": {"on": "L1_ON", "off": "L1_OFF"},
    "luz_habitacion_2": {"on": "L2_ON", "off": "L2_OFF"},
    "luz_sala": {"on": "L3_ON", "off": "L3_OFF"},
    "luz_cocina": {"on": "L4_ON", "off": "L4_OFF"},
    "luz_jardin": {"on": "EXT_ON", "off": "EXT_OFF"},
    "puerta": {"on": "DOOR_OPEN", "off": "DOOR_CLOSE"},
    "cerradura": {"on": "LOCK_ON", "off": "LOCK_OFF"},
}
