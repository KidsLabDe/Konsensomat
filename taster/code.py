"""
Konsensomat - Taster-Controller
Raspberry Pi Pico mit CircuitPython

Hardware:
  GP22 - NeoPixel-Streifen (60 Pixel)
  GP21 - Taster links (geschlossen = gedrueckt)
  GP20 - LED im Taster links
  GP19 - Taster rechts (geschlossen = gedrueckt)
  GP18 - LED im Taster rechts

HID-Tastatur (PLAYER unten einstellen):
  Spieler 1: Taster links -> "1" (Ja), Taster rechts -> "2" (Nein)
  Spieler 2: Taster links -> "8" (Ja), Taster rechts -> "9" (Nein)

Beim Druecken gehen beide Taster-LEDs fuer 10 Sekunden aus.
NeoPixel zeigt Rainbow im Idle, nach Tastendruck 10s Ergebnis-Farbe.
"""

import time
import board
import digitalio
import neopixel
import usb_hid
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keycode import Keycode

# --- Konfiguration ---
PLAYER = 1  # 1 oder 2 — vor dem Aufspielen fuer jeden Pico setzen!

NEOPIXEL_PIN = board.GP22
NEOPIXEL_COUNT = 60
NEOPIXEL_BRIGHTNESS = 0.3

LED_OFF_DURATION = 10  # Sekunden, die beide LEDs nach Tastendruck aus bleiben
RESULT_DURATION = 10   # Sekunden, die die Ergebnis-Farbe angezeigt wird

DEBOUNCE_TIME = 0.03  # Zustand muss 30ms stabil sein (Druecken und Loslassen)
KEY_HOLD_TIME = 0.03  # Taste 30ms gedrueckt halten, damit der Host sie sicher sieht

RAINBOW_SPEED = 0.02  # Sekunden pro Rainbow-Schritt

# --- NeoPixel ---
pixels = neopixel.NeoPixel(
    NEOPIXEL_PIN,
    NEOPIXEL_COUNT,
    brightness=NEOPIXEL_BRIGHTNESS,
    auto_write=False,
)

# --- Taster (Pull-Up, geschlossen = LOW) ---
button_left = digitalio.DigitalInOut(board.GP21)
button_left.direction = digitalio.Direction.INPUT
button_left.pull = digitalio.Pull.UP

button_right = digitalio.DigitalInOut(board.GP19)
button_right.direction = digitalio.Direction.INPUT
button_right.pull = digitalio.Pull.UP

# --- LEDs in den Tastern ---
led_left = digitalio.DigitalInOut(board.GP20)
led_left.direction = digitalio.Direction.OUTPUT

led_right = digitalio.DigitalInOut(board.GP18)
led_right.direction = digitalio.Direction.OUTPUT

# --- HID Keyboard ---
keyboard = Keyboard(usb_hid.devices)

if PLAYER == 1:
    KEY_LEFT, KEY_RIGHT = Keycode.ONE, Keycode.TWO
else:
    KEY_LEFT, KEY_RIGHT = Keycode.EIGHT, Keycode.NINE

# --- Zustand ---
leds_off_until = 0      # Zeitpunkt, ab dem LEDs wieder angehen
result_until = 0         # Zeitpunkt, ab dem wieder Rainbow laeuft
result_color = None      # Aktuelle Ergebnis-Farbe oder None fuer Rainbow
rainbow_offset = 0       # Laufender Offset fuer Rainbow-Animation
last_rainbow_step = 0    # Zeitpunkt des letzten Rainbow-Schritts
key_release_at = 0     # Zeitpunkt, zu dem die gehaltene Taste losgelassen wird (0 = keine)


class DebouncedButton:
    """Meldet einen Druck erst, wenn der Pegel DEBOUNCE_TIME lang stabil ist."""

    def __init__(self, pin):
        self.pin = pin
        self.raw = False         # zuletzt gelesener Rohzustand
        self.stable = False      # entprellter Zustand
        self.changed_at = 0      # Zeitpunkt der letzten Rohaenderung

    def pressed_edge(self, now):
        """True genau einmal pro Druck (steigende Flanke nach Entprellung)."""
        raw = not self.pin.value  # LOW = gedrueckt wegen Pull-Up
        if raw != self.raw:
            self.raw = raw
            self.changed_at = now
        if raw != self.stable and now - self.changed_at >= DEBOUNCE_TIME:
            self.stable = raw
            return raw
        return False


def wheel(pos):
    """Farbrad: 0-255 ergibt RGB-Werte ueber den gesamten Regenbogen."""
    if pos < 85:
        return (255 - pos * 3, pos * 3, 0)
    elif pos < 170:
        pos -= 85
        return (0, 255 - pos * 3, pos * 3)
    else:
        pos -= 170
        return (pos * 3, 0, 255 - pos * 3)


def rainbow_step():
    """Einen Schritt der Rainbow-Animation ausfuehren."""
    global rainbow_offset, last_rainbow_step
    now = time.monotonic()
    if now - last_rainbow_step < RAINBOW_SPEED:
        return
    last_rainbow_step = now
    for i in range(NEOPIXEL_COUNT):
        pixel_index = (i * 256 // NEOPIXEL_COUNT + rainbow_offset) % 256
        pixels[i] = wheel(pixel_index)
    pixels.show()
    rainbow_offset = (rainbow_offset + 1) % 256


def set_button_leds(on):
    """Beide Taster-LEDs ein- oder ausschalten."""
    led_left.value = on
    led_right.value = on
    print(f"[LED] Taster-LEDs {'AN' if on else 'AUS'}")


def show_result(color):
    """Ergebnis-Farbe auf dem NeoPixel-Streifen anzeigen."""
    global result_until, result_color
    print(f"[NEOPIXEL] Ergebnis-Farbe {color} fuer {RESULT_DURATION}s")
    pixels.fill(color)
    pixels.show()
    result_color = color
    result_until = time.monotonic() + RESULT_DURATION


def handle_press(name, keycode, result_col):
    """Tastendruck verarbeiten: HID senden, LEDs aus, Ergebnis anzeigen."""
    global leds_off_until, key_release_at

    print(f"[TASTER] {name} gedrueckt -> sende Keycode {keycode}")
    keyboard.press(keycode)
    key_release_at = time.monotonic() + KEY_HOLD_TIME

    # Beide Taster-LEDs fuer 10 Sekunden ausschalten
    set_button_leds(False)
    leds_off_until = time.monotonic() + LED_OFF_DURATION

    # Ergebnis-Farbe anzeigen
    show_result(result_col)


# --- Initialisierung ---
set_button_leds(True)

print("========================================")
print("Konsensomat - Taster-Controller")
print(f"  Spieler: {PLAYER}")
print(f"  NeoPixel: {NEOPIXEL_COUNT} Pixel an GP22")
print(f"  Taster links: GP21, LED: GP20")
print(f"  Taster rechts: GP19, LED: GP18")
print(f"  LED-Sperrzeit: {LED_OFF_DURATION}s")
print(f"  Ergebnis-Anzeige: {RESULT_DURATION}s")
print("========================================")
print("[INIT] Taster-Controller gestartet, warte auf Eingabe...")

# --- Hauptschleife ---
debounced_left = DebouncedButton(button_left)
debounced_right = DebouncedButton(button_right)

while True:
    now = time.monotonic()

    # Taster zuerst lesen, damit kein Druck durch NeoPixel-Updates verloren geht
    if debounced_left.pressed_edge(now):
        handle_press("LINKS", KEY_LEFT, (0, 255, 0))  # Gruen
    if debounced_right.pressed_edge(now):
        handle_press("RECHTS", KEY_RIGHT, (255, 0, 0))  # Rot

    # Gehaltene Taste(n) nach KEY_HOLD_TIME loslassen
    if key_release_at > 0 and now >= key_release_at:
        keyboard.release_all()
        key_release_at = 0

    # LEDs wieder einschalten wenn Sperrzeit abgelaufen
    if leds_off_until > 0 and now >= leds_off_until:
        print("[LED] Sperrzeit abgelaufen, LEDs wieder an")
        set_button_leds(True)
        leds_off_until = 0

    # Ergebnis-Anzeige beenden -> zurueck zu Rainbow
    if result_color is not None and now >= result_until:
        print("[NEOPIXEL] Ergebnis vorbei, zurueck zu Rainbow")
        result_color = None
        result_until = 0

    # NeoPixel: Ergebnis-Farbe oder Rainbow
    if result_color is None:
        rainbow_step()

    time.sleep(0.002)  # 2ms Polling
