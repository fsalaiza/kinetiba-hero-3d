# Kinetiba Hero 3D — Blender Project Status

**Última actualización:** 2026-05-01
**Sesión actual:** 005 (próxima — terminar de pulir match D2C, comenzando por color de fondo)
**Última sesión cerrada:** 004 — 2026-05-01 (match parcial, no completo)
**Versión .blend activa:** `kinetiba-hero-3d_v06_d2c_match.blend`
**GLB activo:** `public/models/kinetiba_cube_animated.glb` (131 KB, 28 animation tracks)
**Estado lookdev:** ⚠️ Match parcial contra D2C frame_010. Pendientes documentados en session_004 log.
**Blender version:** 5.1.1

---

## Contexto del proyecto

Hero web 3D para Kinetiba (PyME data platform). Stack: React 19 + R3F + GSAP +
Three.js. Inspiración: D2C Life Science (Awwwards SOTD) — GSAP + Three.js + Blender.

El cubo Rubik 3×3×3 actual usa decals procedurales con Canvas2D sobre una pieza
GLB básica. Se está migrando a piezas modeladas en Blender con **iconos
embossed reales**, materiales PBR procedural y animaciones core (face-solve,
unfold, scatter-to-plane, morph-to-pill) exportadas en GLB.

---

## Hallazgos visuales clave (validados contra frames D2C)

- **3×3×3, no 4×4×4** — MASTER_PLAN.md decía 64 piezas, los frames muestran 27.
- **El "burst" es scatter-a-plano horizontal**, no explosión 3D. Las piezas
  reorganizan acostadas formando un campo de datos.
- **Morph final es a píldora**, no a hélice DNA (Awwwards lo confirma textual).
- **Iconos son geometría real embossed**, no decals 2D — sombras direccionales
  imposibles de replicar con Canvas2D.
- Paleta D2C: 2 colores `#879186` (sage bg) + `#E6F7ED` (mint accent).

Correcciones pendientes en docs:
- `MASTER_PLAN.md` — cambiar "4×4×4 (64 piezas)" → "3×3×3 (27 piezas)"
- `MASTER_PLAN.md` — cambiar "hélice de DNA" → "píldora (pill)"

---

## Decisiones tomadas (Session 001)

| # | Decisión | Razón |
|---|----------|-------|
| 1 | Geometría: 3×3×3, mantener cantidad actual | Lo que D2C realmente usa |
| 2 | Alcance: Nivel B (geometría + materiales + animaciones base en Blender) | Sweet spot esfuerzo/resultado |
| 3 | Prototipo-first: 1 pieza punta-a-punta antes de escalar | Eliminar riesgo de pipeline antes de modelar 8 variantes |
| 4 | 8 iconos únicos: 4 semánticos (chart-bars/chat/invoice/bolt) + 4 abstractos | Suficiente densidad visual, mappable a secciones |
| 5 | Ubicación: `kinetiba-hero-3d/blender/` versionado con git | Asset del repo, no proyecto hobby standalone |
| 6 | Iconos como **geometría real**, no normal-map baked (en Session 001) | Iteración rápida; bake como optimización futura si hace falta |

---

## Plan de sesiones

| # | Tema | Estado |
|---|------|--------|
| 001 | Setup repo + 1 pieza prototipo (chart-bars icon) | ✅ DONE (2026-05-01) |
| 002 | Cubo 27 piezas armado + iconos procedural + animación scatter | ✅ DONE (2026-05-01) |
| 003 | Polish v2: edge tints + iconos contraste + drama lighting | ✅ DONE (2026-05-01) |
| 004 | Match D2C lookdev (bg dark, cream neutral, iconos 0.65×, encuadre) | ⚠️ DONE parcial (2026-05-01) |
| 005 | Bake a normal map (si hace falta optimizar tamaño GLB) | Pendiente / opcional |
| 006 | Pulido material: speckled, edge color tints, contact shadows | Pendiente |

---

## Estructura del repo (Blender side)

```
kinetiba-hero-3d/
├── blender/
│   ├── PROJECT-STATUS.md             ← este archivo
│   ├── sessions/
│   │   ├── _TEMPLATE.md
│   │   └── session_NNN_YYYY-MM-DD.md
│   ├── kinetiba-hero-3d_v02_prototype_piece.blend  ← current
│   ├── _versions/                     ← checkpoints históricos
│   ├── refs/                          ← frames clave de D2C, screenshots
│   └── exports/                       ← GLBs generados
│       └── cube_piece_prototype.glb
└── public/models/
    └── cube_piece_prototype.glb       ← copia del export, lo carga R3F
```

---

## Convenciones

- **Versionado .blend:** `kinetiba-hero-3d_vXX_<descripcion>.blend`
- **Checkpoint** antes de cambios grandes con `bpy.ops.wm.save_as_mainfile`
- **Session log** al cerrar sesión: `session_NNN_YYYY-MM-DD.md` siguiendo `_TEMPLATE.md`
- **PROJECT-STATUS.md** se actualiza cuando cambia el estado base

---

## Limitaciones técnicas confirmadas

- MCP timeout 4 min: no se puede usar `bpy.ops.render.render()` vía MCP.
  Renders pesados los hace Alfred con F12 manualmente.
- Viewport renders (`bpy.ops.render.opengl(write_still=True)`) sí funcionan vía MCP.
- Blender 5.1 enum changes: `NISHITA→MULTIPLE_SCATTERING`, no `dust_density`
  (turbidity), no `BLENDER_EEVEE_NEXT` (solo `BLENDER_EEVEE`).
