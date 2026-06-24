from django.db import models


class DeviceState(models.Model):
    LIGHT = "light"
    DOOR = "door"
    LOCK = "lock"
    SENSOR = "sensor"
    FAN = "fan"

    KIND_CHOICES = [
        (LIGHT, "Luz"),
        (DOOR, "Puerta"),
        (LOCK, "Cerradura"),
        (SENSOR, "Sensor"),
        (FAN, "Ventilador"),
    ]

    key = models.SlugField(unique=True)
    label = models.CharField(max_length=80)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    is_on = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["label"]

    def __str__(self):
        return self.label


class EventLog(models.Model):
    OK = "ok"
    ERROR = "error"
    SIMULATED = "simulado"

    STATUS_CHOICES = [
        (OK, "Correcto"),
        (ERROR, "Error"),
        (SIMULATED, "Simulado"),
    ]

    created_at = models.DateTimeField(auto_now_add=True)
    device_key = models.CharField(max_length=80)
    action = models.CharField(max_length=40)
    command = models.CharField(max_length=80)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    message = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%H:%M:%S} - {self.device_key} - {self.status}"
