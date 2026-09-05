# Continuidad del proyecto Kineti

Antes de retomar trabajo en este repositorio, leer [docs/SESSION_STATE.md](docs/SESSION_STATE.md) y, para rendimiento, [docs/PERFORMANCE_OPTIMIZATION.md](docs/PERFORMANCE_OPTIMIZATION.md).

- El usuario habla español. Kineti representa movimiento, datos verificables, tuberías deterministas e inteligencia agéntica. Evitar la palabra ERP en el contenido público.
- Conservar la calidad visual: no reducir efectos, materiales, geometría o resolución por defecto sin evidencia de equivalencia perceptual. Los experimentos con pérdida visual deben ser opcionales y estar desactivados.
- La web de producción utiliza Three r185 con WebGPURenderer/TSL y fallback WebGL2. Los ensayos de otros motores ya están documentados; no reiniciar esa investigación por falta de contexto.
- Producción: `npm run build:lab`, después `npm run precompress`, y `npm run serve` en 4174. Los accesos antiguos del escritorio inician desarrollo en 5173 y no restauran el servicio de Tailscale.
- Mantener el arreglo `material.positionNode = positionLocal` del hero y el instancing del mosaico mediante `InstancedBufferGeometry`; consultar la evidencia antes de cambiarlos.
- No confundir viewport móvil con medición en un teléfono físico. No afirmar mejoras de FPS a partir de tiempos de arranque.
- Los respaldos y compilaciones locales están excluidos de Git. No eliminar trabajo previo ni sobrescribir servicios existentes al retomar.
