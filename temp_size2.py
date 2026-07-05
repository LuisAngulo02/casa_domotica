import json
import struct

def parse_glb(file_path):
    with open(file_path, 'rb') as f:
        magic = f.read(4)
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]
        
        chunk0_len = struct.unpack('<I', f.read(4))[0]
        chunk0_type = f.read(4)
        json_data = f.read(chunk0_len)
        
        gltf = json.loads(json_data.decode('utf-8'))
        return gltf

gltf = parse_glb('d:/programassss/domotica/casa_domotica/static/dashboard/casa_domotica_blender.glb')

nodes = gltf.get('nodes', [])
meshes = gltf.get('meshes', [])
accessors = gltf.get('accessors', [])

fanParts = ["fan_motor_body", "fan_blade_0", "fan_blade_1", "fan_blade_2", "fan_blade_3"]

for node in nodes:
    name = node.get('name', '')
    for partName in fanParts:
        if partName.lower() in name.lower():
            mesh_idx = node.get('mesh')
            if mesh_idx is not None:
                mesh = meshes[mesh_idx]
                for primitive in mesh.get('primitives', []):
                    pos_accessor_idx = primitive.get('attributes', {}).get('POSITION')
                    if pos_accessor_idx is not None:
                        acc = accessors[pos_accessor_idx]
                        min_val = acc.get('min')
                        max_val = acc.get('max')
                        if min_val and max_val:
                            size = [max_val[i] - min_val[i] for i in range(3)]
                            print(f"Match: {partName} -> Node: {name}, Size: {size}")
