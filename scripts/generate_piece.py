"""
Genera una pieza de cubo con marco hundido y bordes biselados.
Compatible con Blender 5.x (usa bmesh ops en lugar de bpy.ops.mesh).
Ejecutar con:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/generate_piece.py
"""
import bpy
import bmesh
import os
from mathutils import Vector

# Limpiar escena
bpy.ops.wm.read_factory_settings(use_empty=True)

# Crear cubo base de 0.85 x 0.85 x 0.85 (PIECE_SIZE del código)
bpy.ops.mesh.primitive_cube_add(size=0.85, location=(0, 0, 0))
obj = bpy.context.active_object
obj.name = "CubePiece"

# ============================================================
# Usar bmesh para todas las operaciones de geometría
# ============================================================
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(obj.data)

# ============================================================
# PASO 1: Bevel en todos los bordes (bordes redondeados)
# ============================================================
bmesh.ops.bevel(
    bm,
    geom=bm.edges[:],
    offset=0.025,
    segments=3,
    affect='EDGES',
    clamp_overlap=True,
)

bm.faces.ensure_lookup_table()
bm.edges.ensure_lookup_table()
bm.verts.ensure_lookup_table()

# ============================================================
# PASO 2: Inset en las 6 caras grandes para crear marco hundido
# ============================================================

# Encontrar las 6 caras más grandes (las caras originales del cubo)
face_areas = [(f, f.calc_area()) for f in bm.faces]
face_areas.sort(key=lambda x: x[1], reverse=True)
big_faces = [f for f, area in face_areas[:6]]

# Inset individual en cada cara grande
result = bmesh.ops.inset_individual(
    bm,
    faces=big_faces,
    thickness=0.04,
    depth=0.0,
    use_even_offset=True,
)

bm.faces.ensure_lookup_table()

# Las caras interiores (resultado del inset) son las que quedaron
# Identificar las nuevas caras grandes interiores
# Después del inset, las caras originales se dividieron — las interiores son
# las que tienen área similar a la original menos el marco
inner_face_areas = [(f, f.calc_area()) for f in bm.faces]
inner_face_areas.sort(key=lambda x: x[1], reverse=True)
# Las 6 caras más grandes después del inset son las interiores
inner_faces = [f for f, area in inner_face_areas[:6]]

# Hundir las caras interiores hacia adentro (-0.015 a lo largo de la normal)
for face in inner_faces:
    normal = face.normal.copy()
    for vert in face.verts:
        # Solo mover si el vértice pertenece exclusivamente a esta cara grande
        # (evitar mover vértices compartidos con el marco)
        shared_big = sum(1 for f in vert.link_faces if f in inner_faces)
        if shared_big == 1:
            vert.co -= normal * 0.015

bmesh.update_edit_mesh(obj.data)
bpy.ops.object.mode_set(mode='OBJECT')

# ============================================================
# PASO 3: Smooth shading
# ============================================================
bpy.ops.object.shade_smooth()

# ============================================================
# PASO 4: UV Unwrap limpio
# ============================================================
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=0.698132, island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')

# ============================================================
# PASO 5: Exportar como GLB
# ============================================================
output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'models')
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, 'cube_piece.glb')

# Build export kwargs
export_kwargs = dict(
    filepath=output_path,
    export_format='GLB',
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='NONE',
    export_cameras=False,
    export_lights=False,
)

# Try with draco compression
try:
    bpy.ops.export_scene.gltf(
        **export_kwargs,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
except TypeError:
    print("Note: Draco params not supported, exporting without compression")
    bpy.ops.export_scene.gltf(**export_kwargs)

print(f"\n✅ Exported: {output_path}")
print(f"   File size: {os.path.getsize(output_path)} bytes")
print(f"   Vertices: {len(obj.data.vertices)}")
print(f"   Faces: {len(obj.data.polygons)}")
