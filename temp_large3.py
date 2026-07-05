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

for i, node in enumerate(nodes):
    mesh_idx = node.get('mesh')
    if mesh_idx is not None:
        mesh = meshes[mesh_idx]
        acc = accessors[mesh['primitives'][0]['attributes']['POSITION']]
        size = [acc['max'][j] - acc['min'][j] for j in range(3)]
        if size[0] > 5 and size[2] > 5:
            print(f"Name: {node.get('name', mesh.get('name', 'Unnamed'))}, Size: {size}")
