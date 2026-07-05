import re

try:
    with open('d:/programassss/domotica/casa_domotica/static/dashboard/casa_domotica_blender.glb', 'rb') as f:
        data = f.read()
    names = re.findall(b'"name":"([^"]+)"', data)
    print("Found names:")
    for n in sorted(set(names)):
        print(n.decode('utf-8', errors='ignore'))
except Exception as e:
    print(f"Error: {e}")
